#!/usr/bin/env node
/**
 * Ingest CSV / JSON / TXT / XLSX from data/raw_archives → data/tvc-knowledge-base.json
 * Usage: node scripts/ingest-domain-archives.mjs
 */
import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const RAW_DIR = path.join(ROOT, 'data', 'raw_archives');
const OUT_PATH = path.join(ROOT, 'data', 'tvc-knowledge-base.json');

const DATA_EXT = new Set(['.csv', '.json', '.txt', '.xlsx']);
const SKIP_NAMES = new Set(['readme.md', '.gitkeep']);

/** @typedef {Record<string, string>} RawRow */

function normKey(k) {
    return String(k || '')
        .trim()
        .toLowerCase()
        .replace(/[\s\-]+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
}

function normText(v) {
    return String(v ?? '')
        .replace(/\s+/g, ' ')
        .trim();
}

function normPartNumber(v) {
    const s = normText(v).toUpperCase();
    return s || '';
}

function parsePrice(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(String(v).replace(/[$,\s]/g, ''));
    return Number.isFinite(n) && n >= 0 ? n : null;
}

function canonicalRow(raw) {
    const m = {};
    for (const [k, val] of Object.entries(raw || {})) {
        m[normKey(k)] = val;
    }
    const pick = (...keys) => {
        for (const key of keys) {
            const v = normText(m[key]);
            if (v) return v;
        }
        return '';
    };
    return {
        equipment_name: pick('equipment_name', 'equipment', 'machinery', 'asset'),
        job_title: pick('job_title', 'job', 'work_title', 'title', 'description'),
        part_number: pick('part_number', 'part_no', 'partno', 'spare_no', 'item_no'),
        unit_price_usd: m.unit_price_usd ?? m.price ?? m.unit_price ?? m.standard_price ?? m.cost,
        vendor_name: pick('vendor_name', 'vendor', 'supplier', 'maker'),
        trouble_cause: pick('trouble_cause', 'cause', 'symptoms', 'fault', 'trouble', 'presumed_cause'),
        corrective_action: pick('corrective_action', 'action_taken', 'action', 'repair', 'work_done'),
        class_remarks: pick('class_remarks', 'class_comment', 'inspection_tips', 'remarks', 'survey_note'),
    };
}

function rowToStructures(canonical, sourceFile) {
    const parts = [];
    const trouble = [];
    const equip = canonical.equipment_name;
    const partNo = normPartNumber(canonical.part_number);
    const price = parsePrice(canonical.unit_price_usd);

    if (partNo || (canonical.job_title && price !== null)) {
        parts.push({
            part_number: partNo || `UNKNOWN-${normKey(canonical.job_title).slice(0, 24)}`,
            name: canonical.job_title || partNo,
            standard_price: price,
            last_vendor: canonical.vendor_name || null,
            compatible_equipment: equip || null,
            _source: sourceFile,
        });
    }

    if (equip && (canonical.trouble_cause || canonical.corrective_action || canonical.job_title)) {
        trouble.push({
            equipment: equip,
            symptoms: canonical.trouble_cause || canonical.job_title,
            presumed_cause: canonical.trouble_cause || '',
            action_taken: canonical.corrective_action || canonical.job_title || '',
            inspection_tips: canonical.class_remarks || '',
            _source: sourceFile,
        });
    }

    return { parts, trouble };
}

function parseCsv(text) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];
    const splitLine = (line) => {
        const out = [];
        let cur = '';
        let inQ = false;
        for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (c === '"') {
                inQ = !inQ;
                continue;
            }
            if (c === ',' && !inQ) {
                out.push(cur);
                cur = '';
                continue;
            }
            cur += c;
        }
        out.push(cur);
        return out.map((s) => s.trim());
    };
    const headers = splitLine(lines[0]).map(normKey);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const cells = splitLine(lines[i]);
        if (cells.every((c) => !c)) continue;
        /** @type {RawRow} */
        const row = {};
        headers.forEach((h, idx) => {
            row[h] = cells[idx] ?? '';
        });
        rows.push(row);
    }
    return rows;
}

function parseTxt(text) {
    const rows = [];
    for (const line of text.split(/\r?\n/)) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const sep = t.includes('|') ? '|' : t.includes('\t') ? '\t' : null;
        if (!sep) continue;
        /** @type {RawRow} */
        const row = {};
        for (const piece of t.split(sep)) {
            const eq = piece.indexOf('=');
            if (eq <= 0) continue;
            row[piece.slice(0, eq).trim()] = piece.slice(eq + 1).trim();
        }
        if (Object.keys(row).length) rows.push(row);
    }
    return rows;
}

function parseJson(text) {
    const data = JSON.parse(text);
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.records)) return data.records;
    if (data && Array.isArray(data.rows)) return data.rows;
    if (data && typeof data === 'object') return [data];
    return [];
}

async function parseXlsx(filePath) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(filePath);
    const sheet = wb.worksheets[0];
    if (!sheet) return [];
    const headerRow = sheet.getRow(1);
    const headers = [];
    headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
        headers[col] = normKey(cell.value);
    });
    const rows = [];
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return;
        /** @type {RawRow} */
        const rec = {};
        row.eachCell({ includeEmpty: true }, (cell, col) => {
            const h = headers[col];
            if (!h) return;
            rec[h] = cell.value == null ? '' : String(cell.value);
        });
        if (Object.keys(rec).length) rows.push(rec);
    });
    return rows;
}

function dedupeParts(list) {
    const byKey = new Map();
    for (const item of list) {
        const key = normPartNumber(item.part_number) || normKey(item.name);
        const prev = byKey.get(key);
        if (!prev) {
            byKey.set(key, { ...item });
            continue;
        }
        const price = item.standard_price ?? prev.standard_price;
        byKey.set(key, {
            part_number: prev.part_number || item.part_number,
            name: prev.name || item.name,
            standard_price: price,
            last_vendor: item.last_vendor || prev.last_vendor,
            compatible_equipment: item.compatible_equipment || prev.compatible_equipment,
            _source: prev._source || item._source,
        });
    }
    return [...byKey.values()].map(({ _source, ...rest }) => rest);
}

function troubleFingerprint(t) {
    return [
        normKey(t.equipment),
        normKey(t.presumed_cause),
        normKey(t.action_taken),
    ].join('|');
}

function dedupeTrouble(list) {
    const byKey = new Map();
    for (const item of list) {
        const key = troubleFingerprint(item);
        if (!byKey.has(key)) {
            byKey.set(key, { ...item });
            continue;
        }
        const prev = byKey.get(key);
        byKey.set(key, {
            equipment: prev.equipment,
            symptoms: prev.symptoms || item.symptoms,
            presumed_cause: prev.presumed_cause || item.presumed_cause,
            action_taken: prev.action_taken || item.action_taken,
            inspection_tips: prev.inspection_tips || item.inspection_tips,
            _source: prev._source || item._source,
        });
    }
    return [...byKey.values()].map(({ _source, ...rest }) => rest);
}

async function loadArchiveFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const base = path.basename(filePath);
    const rel = path.relative(ROOT, filePath);
    const empty = { parts: [], trouble: [], file: rel, rowCount: 0 };
    if (SKIP_NAMES.has(base.toLowerCase()) || base.startsWith('_')) return empty;
    if (!DATA_EXT.has(ext)) return empty;

    let rawRows = [];
    if (ext === '.csv') {
        rawRows = parseCsv(fs.readFileSync(filePath, 'utf8'));
    } else if (ext === '.json') {
        rawRows = parseJson(fs.readFileSync(filePath, 'utf8'));
    } else if (ext === '.txt') {
        rawRows = parseTxt(fs.readFileSync(filePath, 'utf8'));
    } else if (ext === '.xlsx') {
        rawRows = await parseXlsx(filePath);
    }

    const parts = [];
    const trouble = [];
    for (const raw of rawRows) {
        const c = canonicalRow(raw);
        const { parts: p, trouble: t } = rowToStructures(c, rel);
        parts.push(...p);
        trouble.push(...t);
    }
    return { parts, trouble, file: rel, rowCount: rawRows.length };
}

async function main() {
    if (!fs.existsSync(RAW_DIR)) {
        fs.mkdirSync(RAW_DIR, { recursive: true });
    }

    const entries = fs.readdirSync(RAW_DIR, { withFileTypes: true });
    const files = entries
        .filter((e) => e.isFile())
        .map((e) => path.join(RAW_DIR, e.name))
        .sort();

    let allParts = [];
    let allTrouble = [];
    const sources = [];

    for (const file of files) {
        const result = await loadArchiveFile(file);
        if (result.rowCount === 0 && !result.parts?.length && !result.trouble?.length) continue;
        allParts = allParts.concat(result.parts || []);
        allTrouble = allTrouble.concat(result.trouble || []);
        if ((result.rowCount || 0) > 0) {
            sources.push({ file: result.file, rows: result.rowCount });
        }
    }

    const payload = {
        version: 1,
        generated_at: new Date().toISOString(),
        sources,
        structured_parts: dedupeParts(allParts),
        trouble_history: dedupeTrouble(allTrouble),
    };

    fs.writeFileSync(OUT_PATH, `${JSON.stringify(payload)}\n`, 'utf8');

    console.log(
        `[ingest-domain-archives] wrote ${OUT_PATH}`,
    );
    console.log(
        `  parts: ${payload.structured_parts.length}, trouble: ${payload.trouble_history.length}, files: ${sources.length}`,
    );
}

main().catch((err) => {
    console.error('[ingest-domain-archives] fatal', err);
    process.exit(1);
});
