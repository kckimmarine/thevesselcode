/**
 * Generated fleet enrichment (build/cache output — not hand-edited).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { digitsOnlyImo, isValidImoNumber } from './imo-checksum.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CACHE_DIR = join(ROOT, 'data', 'fleet-cache');
export const GENERATED_ENRICHMENT_PATH = join(CACHE_DIR, 'generated-fleet-enrichment.json');

export function vesselRowFromRecord(v) {
    const imo = digitsOnlyImo(v.imo || v.i);
    if (!isValidImoNumber(imo)) return null;
    return {
        imo,
        name: v.name ? String(v.name).trim().toUpperCase() : undefined,
        type: v.type || v.t,
        dwt: Number(v.dwt ?? v.d) || 0,
        built_year: Number(v.built_year ?? v.y) || 0,
        flag: v.flag || v.f,
        technical_manager: String(v.technical_manager || v.m || '').trim(),
        engine_model: String(v.engine_model || v.e || '').trim(),
        mmsi: v.mmsi || v.s ? String(v.mmsi || v.s).replace(/\D/g, '') : '',
    };
}

export function loadGeneratedEnrichmentVessels() {
    if (!existsSync(GENERATED_ENRICHMENT_PATH)) return [];
    const data = JSON.parse(readFileSync(GENERATED_ENRICHMENT_PATH, 'utf8'));
    const list = Array.isArray(data) ? data : data?.vessels || [];
    return list.map(vesselRowFromRecord).filter(Boolean);
}

export function loadGeneratedEnrichmentCompactRows() {
    return loadGeneratedEnrichmentVessels().map((v) => ({
        i: v.imo,
        n: v.name,
        t: v.type,
        d: v.dwt,
        y: v.built_year,
        f: v.flag,
        m: v.technical_manager,
        e: v.engine_model,
        s: v.mmsi,
    }));
}

/**
 * Snapshot Seafarer cache into generated enrichment JSON (post-ingest).
 */
export function writeGeneratedEnrichmentFromSeafarerCache() {
    const shipsPath = join(CACHE_DIR, 'seafarer-ships.dat');
    const companiesPath = join(CACHE_DIR, 'seafarer-companies.dat');
    if (!existsSync(shipsPath)) {
        return { written: false, reason: 'missing seafarer-ships.dat', count: 0 };
    }

    const ships = JSON.parse(readFileSync(shipsPath, 'utf8'));
    const companies = existsSync(companiesPath)
        ? JSON.parse(readFileSync(companiesPath, 'utf8'))
        : [];
    const bySlug = new Map((companies || []).map((c) => [c.slug, c]));

    const vessels = [];
    for (const s of ships) {
        const imo = digitsOnlyImo(s.imo);
        if (!isValidImoNumber(imo)) continue;
        const manager = bySlug.get(s.manager_slug)?.name || bySlug.get(s.owner_slug)?.name || '';
        const engineBits = [s.builder, s.classification_society].filter(Boolean).join(' · ');
        const dwt = Number(s.dwt) || 0;
        const year = Number(s.year_built) || 0;
        if (!manager && !dwt && !year && !engineBits && !s.mmsi) continue;
        vessels.push({
            imo,
            name: s.name ? String(s.name).trim().toUpperCase() : undefined,
            type: s.type,
            dwt,
            built_year: year,
            flag: s.flag_iso3 || s.flag || '',
            technical_manager: manager,
            engine_model: engineBits,
            mmsi: s.mmsi ? String(s.mmsi).replace(/\D/g, '') : '',
        });
    }

    mkdirSync(CACHE_DIR, { recursive: true });
    const payload = {
        v: 1,
        generatedAt: new Date().toISOString(),
        source: 'seafarer-index-cache',
        vessels,
    };
    writeFileSync(GENERATED_ENRICHMENT_PATH, JSON.stringify(payload));
    return { written: true, count: vessels.length };
}
