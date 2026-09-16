#!/usr/bin/env node
/**
 * Merge technical particulars (m,d,y,e) into existing fleet chunks.
 *
 * Sources:
 *  - data/fleet-cache/generated-fleet-enrichment.json (sync output)
 *  - data/fleet-cache/seafarer-ships.dat (MoU/open mirror via Seafarer Index)
 *  - Optional USCG PSIX SOAP (IMO as VIN) when ENRICH_PSIX=1
 *
 * Usage: node scripts/enrich-fleet-registry.mjs
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, cpSync, realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { digitsOnlyImo, isValidImoNumber } from './lib/imo-checksum.mjs';
import { loadGeneratedEnrichmentCompactRows } from './lib/fleet-enrichment-store.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FLEET_DIR = join(ROOT, 'public', 'data', 'fleet');
const CACHE_DIR = join(ROOT, 'data', 'fleet-cache');

function loadJson(path) {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf8'));
}

function loadEnrichmentRows() {
    return [...loadGeneratedEnrichmentCompactRows(), ...loadProfileOverlayRows()];
}

function loadProfileOverlayRows() {
    const path = join(ROOT, 'public', 'data', 'fleet', 'fleet-profiles.json');
    const data = loadJson(path);
    const rows = [];
    for (const [imoKey, profile] of Object.entries(data?.vessels || {})) {
        const imo = digitsOnlyImo(imoKey);
        if (!isValidImoNumber(imo)) continue;
        const exNames = (profile.ex_names || [])
            .map((n) => String(n).trim().toUpperCase())
            .filter(Boolean);
        rows.push({
            i: imo,
            n: profile.name ? String(profile.name).trim().toUpperCase() : undefined,
            t: profile.type,
            d: Number(profile.dwt) || 0,
            y: Number(profile.built_year) || 0,
            f: profile.flag,
            m: String(profile.technical_manager || '').trim(),
            e: String(profile.engine_model || '').trim(),
            s: profile.mmsi ? String(profile.mmsi).replace(/\D/g, '') : '',
            x: exNames.length ? exNames : undefined,
        });
    }
    return rows;
}

function loadSeafarerEnrichment() {
    const path = join(CACHE_DIR, 'seafarer-ships.dat');
    const companiesPath = join(CACHE_DIR, 'seafarer-companies.dat');
    if (!existsSync(path)) return [];
    const ships = JSON.parse(readFileSync(path, 'utf8'));
    const companies = existsSync(companiesPath) ? JSON.parse(readFileSync(companiesPath, 'utf8')) : [];
    const bySlug = new Map((companies || []).map((c) => [c.slug, c]));
    const out = [];
    for (const s of ships) {
        const imo = digitsOnlyImo(s.imo);
        if (!isValidImoNumber(imo)) continue;
        const manager = bySlug.get(s.manager_slug)?.name || bySlug.get(s.owner_slug)?.name || '';
        const engineBits = [s.builder, s.classification_society].filter(Boolean).join(' · ');
        out.push({
            i: imo,
            d: Number(s.dwt) || 0,
            y: Number(s.year_built) || 0,
            m: manager,
            e: engineBits,
            s: s.mmsi ? String(s.mmsi).replace(/\D/g, '') : '',
        });
    }
    return out;
}

async function fetchPsixByImo(imo) {
    if (process.env.ENRICH_PSIX !== '1') return null;
    const body = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <getVesselSummary xmlns="https://cgmix.uscg.mil">
      <VesselID></VesselID>
      <VesselName></VesselName>
      <CallSign></CallSign>
      <VIN>${imo}</VIN>
      <HIN></HIN>
      <Flag></Flag>
      <Service></Service>
      <BuildYear></BuildYear>
    </getVesselSummary>
  </soap:Body>
</soap:Envelope>`;
    try {
        const res = await fetch('https://cgmix.uscg.mil/xml/PSIXData.asmx', {
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
                SOAPAction: 'https://cgmix.uscg.mil/getVesselSummary',
            },
            body,
        });
        const xml = await res.text();
        const yearMatch = xml.match(/ConstructionCompletedYear[^>]*>(\d{4})</i);
        const nameMatch = xml.match(/<VesselName>([^<]+)</i);
        if (!yearMatch && !nameMatch) return null;
        return {
            i: imo,
            y: yearMatch ? Number(yearMatch[1]) : 0,
            n: nameMatch ? nameMatch[1].trim().toUpperCase() : undefined,
            m: '',
            e: '',
            d: 0,
        };
    } catch {
        return null;
    }
}

function mergeShip(base, patch) {
    const out = { ...base };
    if (patch.n && String(patch.n).trim()) out.n = String(patch.n).trim().toUpperCase();
    if (patch.t && String(patch.t).trim()) out.t = String(patch.t).trim();
    if (patch.f && String(patch.f).trim()) out.f = String(patch.f).trim();
    if (patch.m && String(patch.m).trim()) out.m = String(patch.m).trim();
    if (patch.e && String(patch.e).trim()) out.e = String(patch.e).trim();
    if (patch.d && Number(patch.d) > 0) out.d = Number(patch.d);
    if (patch.y && Number(patch.y) > 0) out.y = Number(patch.y);
    if (patch.s && String(patch.s).trim()) out.s = String(patch.s).replace(/\D/g, '');
    if (patch.x && Array.isArray(patch.x)) {
        const prev = Array.isArray(out.x) ? out.x : [];
        out.x = [...new Set([...prev, ...patch.x.map((n) => String(n).trim().toUpperCase()).filter(Boolean)])];
    }
    return out;
}

function buildOverlayMaps(rows) {
    const byImo = new Map();
    for (const row of rows) {
        const prev = byImo.get(row.i);
        byImo.set(row.i, prev ? mergeShip(prev, row) : row);
    }
    return byImo;
}

async function main() {
    if (!existsSync(FLEET_DIR)) {
        console.error('Missing fleet dir. Run: node scripts/ingest-global-fleet.mjs');
        process.exit(1);
    }

    const overlay = buildOverlayMaps([
        ...loadEnrichmentRows(),
        ...loadSeafarerEnrichment(),
    ]);

    if (process.env.ENRICH_PSIX === '1') {
        const psixImos = (process.env.ENRICH_PSIX_IMOS || '')
            .split(',')
            .map((v) => digitsOnlyImo(v))
            .filter(isValidImoNumber);
        for (const imo of psixImos) {
            const psix = await fetchPsixByImo(imo);
            if (psix) {
                const prev = overlay.get(imo) || { i: imo };
                overlay.set(imo, mergeShip(prev, psix));
            }
        }
    }

    const chunkFiles = readdirSync(FLEET_DIR).filter((f) => /^fleet-\d{2}\.json$/.test(f));
    let touched = 0;
    let enrichedFields = 0;

    for (const file of chunkFiles) {
        const path = join(FLEET_DIR, file);
        const payload = JSON.parse(readFileSync(path, 'utf8'));
        const ships = payload.ships || [];
        let changed = false;
        for (let i = 0; i < ships.length; i++) {
            const ship = ships[i];
            const patch = overlay.get(ship.i);
            if (!patch) continue;
            const merged = mergeShip(ship, patch);
            if (JSON.stringify(merged) !== JSON.stringify(ship)) {
                if (!ship.m && merged.m) enrichedFields++;
                if (!ship.d && merged.d) enrichedFields++;
                if (!ship.y && merged.y) enrichedFields++;
                if (!ship.e && merged.e) enrichedFields++;
                ships[i] = merged;
                changed = true;
            }
        }
        if (changed) {
            writeFileSync(path, JSON.stringify({ ...payload, ships }));
            touched++;
        }
    }

    const indexPath = join(FLEET_DIR, 'fleet-index.json');
    if (existsSync(indexPath)) {
        const index = JSON.parse(readFileSync(indexPath, 'utf8'));
        index.enrichedAt = new Date().toISOString();
        index.enrichmentSources = ['generated-fleet-enrichment', 'seafarer-index', 'uscg-psix-optional'];
        writeFileSync(indexPath, JSON.stringify(index));
    }

    const devMirror = join(ROOT, 'data', 'fleet');
    try {
        const src = realpathSync(FLEET_DIR);
        const dest = existsSync(devMirror) ? realpathSync(devMirror) : devMirror;
        if (src !== dest) {
            cpSync(FLEET_DIR, devMirror, { recursive: true });
        }
    } catch {
        cpSync(FLEET_DIR, devMirror, { recursive: true });
    }

    spawnSync('node', ['scripts/build-fleet-exname-index.mjs'], { cwd: ROOT, stdio: 'inherit' });

    console.log('OK enriched chunks:', touched, 'files');
    console.log('OK new spec fields filled:', enrichedFields);
    console.log('OK overlay records:', overlay.size);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
