#!/usr/bin/env node
/**
 * Phase 1 fleet sync — ingest → generated enrichment → enrich → AIS → report.
 *
 * Usage:
 *   node scripts/run-fleet-sync.mjs
 *   node scripts/run-fleet-sync.mjs --offline
 *
 * Exits 0 when upstream APIs fail (preserves prior fleet chunks); exits 1 on invalid CLI only.
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeGeneratedEnrichmentFromSeafarerCache } from './lib/fleet-enrichment-store.mjs';
import { validateFleetStore } from './lib/fleet-sync-validate.mjs';
import { refreshFleetAisPositions } from './refresh-fleet-ais-positions.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FLEET_DIR = join(ROOT, 'public', 'data', 'fleet');
const SYNC_STATUS_PATH = join(FLEET_DIR, 'sync-status.json');

const offline = process.argv.includes('--offline');
const startedAt = new Date().toISOString();

function runNodeScript(relPath, extraEnv = {}) {
    const t0 = Date.now();
    const res = spawnSync('node', [relPath], {
        cwd: ROOT,
        stdio: 'inherit',
        env: {
            ...process.env,
            ...(offline ? { FLEET_SKIP_DOWNLOAD: '1' } : {}),
            ...extraEnv,
        },
    });
    return {
        ok: res.status === 0,
        exitCode: res.status ?? 1,
        durationMs: Date.now() - t0,
        error: res.error?.message || null,
    };
}

function mirrorAisToDataDir() {
    const src = join(ROOT, 'public', 'data', 'fleet-ais-positions.json');
    const destDir = join(ROOT, 'data');
    if (!existsSync(src)) return;
    mkdirSync(destDir, { recursive: true });
    copyFileSync(src, join(destDir, 'fleet-ais-positions.json'));
}

async function main() {
    const report = {
        v: 1,
        startedAt,
        completedAt: null,
        offline,
        steps: {},
        checksums: {},
        warnings: [],
        ok: true,
    };

    report.steps.ingest = runNodeScript('scripts/ingest-global-fleet.mjs');
    if (!report.steps.ingest.ok) {
        report.warnings.push('ingest failed — keeping existing fleet chunks');
        report.ok = false;
    } else {
        const gen = writeGeneratedEnrichmentFromSeafarerCache();
        report.steps.generateEnrichment = {
            ok: gen.written,
            count: gen.count,
            reason: gen.reason || null,
            durationMs: 0,
        };
        if (!gen.written) {
            report.warnings.push(gen.reason || 'generated enrichment not written');
        }

        report.steps.enrich = runNodeScript('scripts/enrich-fleet-registry.mjs');
        if (!report.steps.enrich.ok) {
            report.warnings.push('enrich failed — fleet ingest data may be partial');
            report.ok = false;
        }
    }

    try {
        const ais = await refreshFleetAisPositions();
        report.steps.ais = { ok: true, durationMs: 0, ...ais };
        if (ais.warnings?.length) report.warnings.push(...ais.warnings);
        mirrorAisToDataDir();
    } catch (err) {
        report.steps.ais = { ok: false, error: String(err?.message || err) };
        report.warnings.push('AIS refresh failed — previous snapshots preserved');
    }

    const validation = validateFleetStore(FLEET_DIR);
    report.checksums = {
        fleetIndexSha256: validation.indexSha256,
        chunkCount: validation.chunkCount,
        vesselCount: validation.vesselCount,
        fleetGenerated: validation.generated,
        fleetEnrichedAt: validation.enrichedAt,
    };
    if (validation.warnings.length) report.warnings.push(...validation.warnings);
    if (!validation.ok) {
        report.warnings.push(...validation.errors);
        report.ok = false;
    }

    report.completedAt = new Date().toISOString();
    mkdirSync(FLEET_DIR, { recursive: true });
    writeFileSync(SYNC_STATUS_PATH, JSON.stringify(report, null, 2));
    console.log('OK sync-status.json', SYNC_STATUS_PATH);
    console.log(JSON.stringify(report, null, 2));

    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
