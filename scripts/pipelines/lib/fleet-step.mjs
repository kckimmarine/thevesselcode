import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { runNodeScript, PIPELINE_ROOT } from './run-step.mjs';
import { normalizeFleetChunkShip } from './normalizer.mjs';
import { validateFleetStore } from '../../lib/fleet-sync-validate.mjs';

const FLEET_DIR = join(PIPELINE_ROOT, 'public', 'data', 'fleet');
const CACHE_DIR = join(PIPELINE_ROOT, 'data', 'fleet-cache');
const GENERATED_ENRICHMENT = join(CACHE_DIR, 'generated-fleet-enrichment.json');

function writeGeneratedEnrichmentFromSeafarer() {
    const shipsPath = join(CACHE_DIR, 'seafarer-ships.dat');
    const companiesPath = join(CACHE_DIR, 'seafarer-companies.dat');
    if (!existsSync(shipsPath)) {
        return { written: false, count: 0, reason: 'missing seafarer-ships.dat' };
    }
    const ships = JSON.parse(readFileSync(shipsPath, 'utf8'));
    const companies = existsSync(companiesPath)
        ? JSON.parse(readFileSync(companiesPath, 'utf8'))
        : [];
    const bySlug = new Map((companies || []).map((c) => [c.slug, c]));
    const vessels = [];
    for (const s of ships) {
        const row = normalizeFleetChunkShip({
            i: s.imo,
            n: s.name,
            t: s.type,
            d: s.dwt,
            y: s.year_built,
            f: s.flag_iso3 || s.flag,
            m: bySlug.get(s.manager_slug)?.name || bySlug.get(s.owner_slug)?.name || '',
            e: [s.builder, s.classification_society].filter(Boolean).join(' · '),
            s: s.mmsi,
        }, 'VERIFIED_REGISTRY');
        if (!row) continue;
        vessels.push({
            imo: row.i,
            name: row.n,
            type: row.t,
            dwt: row.d || 0,
            built_year: row.y || 0,
            flag: row.f,
            technical_manager: row.m || '',
            engine_model: row.e || '',
            mmsi: row.s || '',
        });
    }
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(GENERATED_ENRICHMENT, JSON.stringify({
        v: 1,
        generatedAt: new Date().toISOString(),
        source: 'seafarer-index-cache',
        vessels,
    }));
    return { written: true, count: vessels.length };
}

function touchNormalizedChunks() {
    if (!existsSync(FLEET_DIR)) return { normalized: 0 };
    const files = readdirSync(FLEET_DIR).filter((f) => /^fleet-\d{2}\.json$/.test(f));
    let normalized = 0;
    for (const file of files) {
        const path = join(FLEET_DIR, file);
        const payload = JSON.parse(readFileSync(path, 'utf8'));
        const ships = (payload.ships || [])
            .map((s) => normalizeFleetChunkShip(s, 'OPEN_CRAWL'))
            .filter(Boolean);
        writeFileSync(path, JSON.stringify({ ...payload, ships }));
        normalized += ships.length;
    }
    return { normalized };
}

export function runFleetPipeline({ offline = false } = {}) {
    const env = offline ? { FLEET_SKIP_DOWNLOAD: '1' } : {};
    const report = { steps: [], warnings: [] };

    const ingest = runNodeScript('scripts/ingest-global-fleet.mjs', { env, label: 'fleet:ingest' });
    report.steps.push({ name: 'ingest', ...ingest });
    if (!ingest.ok) {
        report.warnings.push('fleet ingest failed — previous chunks retained if ingest aborted early');
        return report;
    }

    const gen = writeGeneratedEnrichmentFromSeafarer();
    report.steps.push({ name: 'generateEnrichment', ok: gen.written, count: gen.count, reason: gen.reason });
    if (!gen.written) report.warnings.push(gen.reason || 'enrichment cache not written');

    const enrich = runNodeScript('scripts/enrich-fleet-registry.mjs', { label: 'fleet:enrich' });
    report.steps.push({ name: 'enrich', ...enrich });

    const norm = touchNormalizedChunks();
    report.steps.push({ name: 'normalizeChunks', ok: true, normalized: norm.normalized });

    const validation = validateFleetStore(FLEET_DIR);
    report.validation = validation;
    if (validation.warnings?.length) report.warnings.push(...validation.warnings);

    const statusPath = join(FLEET_DIR, 'sync-status.json');
    writeFileSync(statusPath, JSON.stringify({
        v: 1,
        pipeline: 'maritime-ingestion',
        completedAt: new Date().toISOString(),
        offline,
        ...report,
    }, null, 2));

    return report;
}
