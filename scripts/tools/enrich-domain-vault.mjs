#!/usr/bin/env node
/**
 * Unattended domain spec ingest: data/raw-specs/*.json → data/industrial-mro-index.json
 * Usage: npm run enrich:vault
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RAW_DIR = join(ROOT, 'data', 'raw-specs');
const OUT_PATH = join(ROOT, 'data', 'industrial-mro-index.json');

const FLANGE_STANDARDS = new Set(['JIS', 'DIN', 'ANSI', 'ASME', 'ISO']);

function parsePositiveNumber(value, field) {
    if (value == null || value === '') return { ok: true, value: null };
    const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, '').trim());
    if (!Number.isFinite(n) || n <= 0) {
        return { ok: false, error: `${field} must be a positive number`, value: null };
    }
    return { ok: true, value: n };
}

function normalizeFlangeStandard(raw) {
    const text = String(raw || '').trim().toUpperCase();
    if (!text) return null;
    for (const std of FLANGE_STANDARDS) {
        if (text === std || text.startsWith(`${std} `) || text.includes(std)) return std;
    }
    return null;
}

function normalizePressureRating(raw) {
    const s = String(raw || '').trim();
    if (!s) return null;
    const m = s.match(/\b(10|16|20|40)\s*K\b/i);
    if (m) return `${m[1]}K`;
    const pn = s.match(/\bPN\s*(10|16|25|40)\b/i);
    if (pn) return `PN${pn[1]}`;
    const lb = s.match(/\b(150|300)\s*LB\b/i);
    if (lb) return `${lb[1]}LB`;
    if (/10K/i.test(s)) return '10K';
    return s.slice(0, 32);
}

function normalizeNominalDiameter(record) {
    return String(
        record.nominal_diameter || record.nominal || record.size || record.diameter || '',
    ).trim() || null;
}

function entryId(normalized) {
    const key = [
        normalized.flange_standard || '',
        normalized.nominal_diameter || '',
        normalized.pcd_mm ?? '',
        normalized.pressure_rating || '',
        normalized.tightening_torque_nm ?? '',
    ].join('|');
    return createHash('sha256').update(key).digest('hex').slice(0, 16);
}

function mapRawRecord(record, sourceFile, index) {
    const rejections = [];
    const pcdSource = record.pcd_mm ?? record.pcd;
    const pcd = parsePositiveNumber(pcdSource, 'pcd_mm');
    if (!pcd.ok) rejections.push(pcd.error);

    const torque = parsePositiveNumber(record.tightening_torque_nm, 'tightening_torque_nm');
    if (!torque.ok) rejections.push(torque.error);

    const flangeStandard = normalizeFlangeStandard(
        record.flange_standard || record.standard || record.flange_std,
    );
    if (record.flange_standard || record.standard) {
        if (!flangeStandard) rejections.push('flange_standard not recognized (JIS/DIN/ANSI/ASME/ISO)');
    }

    const nominal = normalizeNominalDiameter(record);
    const pressure = normalizePressureRating(record.pressure_rating || record.pressure);

    const hasSignal = flangeStandard || nominal || pcd.value != null || torque.value != null || pressure;
    if (!hasSignal) {
        rejections.push('no mappable mechanical fields');
    }

    if (rejections.length) {
        return {
            ok: false,
            reason: rejections.join('; '),
            source_file: sourceFile,
            row_index: index,
            label: record.label || null,
        };
    }

    return {
        ok: true,
        entry: {
            id: entryId({
                flange_standard: flangeStandard,
                nominal_diameter: nominal,
                pcd_mm: pcd.value,
                pressure_rating: pressure,
                tightening_torque_nm: torque.value,
            }),
            pcd_mm: pcd.value,
            nominal_diameter: nominal,
            flange_standard: flangeStandard,
            pressure_rating: pressure,
            tightening_torque_nm: torque.value,
            label: String(record.label || '').trim() || null,
            source_file: sourceFile,
            ingested_at: new Date().toISOString(),
        },
    };
}

function loadExistingIndex() {
    if (!existsSync(OUT_PATH)) {
        return { version: 1, generated_at: null, entries: [], stats: {}, rejected_samples: [] };
    }
    try {
        return JSON.parse(readFileSync(OUT_PATH, 'utf8'));
    } catch {
        return { version: 1, generated_at: null, entries: [], stats: {}, rejected_samples: [] };
    }
}

function main() {
    if (!existsSync(RAW_DIR)) {
        mkdirSync(RAW_DIR, { recursive: true });
        console.log('Created empty', RAW_DIR.replace(`${ROOT}/`, ''));
    }

    const files = readdirSync(RAW_DIR)
        .filter((f) => f.endsWith('.json'))
        .sort();

    const existing = loadExistingIndex();
    const byId = new Map((existing.entries || []).map((e) => [e.id, e]));
    const rejected = [];
    let accepted = 0;

    for (const file of files) {
        const path = join(RAW_DIR, file);
        let doc;
        try {
            doc = JSON.parse(readFileSync(path, 'utf8'));
        } catch (err) {
            rejected.push({ source_file: file, reason: `invalid JSON: ${err.message}` });
            continue;
        }
        const rows = Array.isArray(doc.records) ? doc.records : [];
        rows.forEach((row, idx) => {
            const mapped = mapRawRecord(row, file, idx);
            if (mapped.ok) {
                byId.set(mapped.entry.id, mapped.entry);
                accepted += 1;
            } else {
                rejected.push(mapped);
            }
        });
    }

    const payload = {
        version: 1,
        generated_at: new Date().toISOString(),
        entries: [...byId.values()].sort((a, b) => a.id.localeCompare(b.id)),
        stats: {
            accepted,
            rejected: rejected.length,
            source_files: files.length,
            entry_count: byId.size,
        },
        rejected_samples: rejected.slice(0, 50),
    };

    writeFileSync(OUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);
    console.log('OK industrial-mro-index.json');
    console.log(`  entries: ${payload.stats.entry_count} (+${accepted} accepted this run)`);
    console.log(`  rejected: ${payload.stats.rejected} (samples kept: ${payload.rejected_samples.length})`);
    console.log(`  raw files: ${files.length}`);

    if (accepted < 1 && files.length > 0) {
        console.error('FAIL: no valid records ingested');
        process.exit(1);
    }
}

main();
