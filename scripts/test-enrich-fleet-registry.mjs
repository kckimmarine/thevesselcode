#!/usr/bin/env node
/**
 * Validate fleet enrichment pipeline (structural — no hand-curated IMO fixtures).
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FLEET_DIR = join(ROOT, 'public', 'data', 'fleet');

const run = spawnSync('node', ['scripts/enrich-fleet-registry.mjs'], { cwd: ROOT, stdio: 'inherit' });
if (run.status !== 0) process.exit(run.status ?? 1);

const indexPath = join(FLEET_DIR, 'fleet-index.json');
if (!existsSync(indexPath)) {
    console.error('FAIL missing fleet-index.json');
    process.exit(1);
}

const index = JSON.parse(readFileSync(indexPath, 'utf8'));
if (!index.enrichedAt) {
    console.error('FAIL fleet-index missing enrichedAt');
    process.exit(1);
}

let withManager = 0;
let withDwt = 0;
let withYear = 0;
let withMmsi = 0;
const chunkFiles = readdirSync(FLEET_DIR).filter((f) => /^fleet-\d{2}\.json$/.test(f));
for (const file of chunkFiles) {
    const payload = JSON.parse(readFileSync(join(FLEET_DIR, file), 'utf8'));
    for (const ship of payload.ships || []) {
        if (ship.m && String(ship.m).trim()) withManager++;
        if (ship.d > 0) withDwt++;
        if (ship.y > 0) withYear++;
        if (ship.s) withMmsi++;
    }
}

const checks = [
    ['vessel count', (index.count || 0) >= 1000, String(index.count)],
    ['enrichedAt set', Boolean(index.enrichedAt), index.enrichedAt],
    ['ships with manager', withManager >= 20, String(withManager)],
    ['ships with built year', withYear >= 500, String(withYear)],
    ['ships with MMSI index', withMmsi >= 500, String(withMmsi)],
];

let failed = 0;
for (const [label, ok, detail] of checks) {
    console.log(ok ? 'OK' : 'FAIL', label, detail ? `— ${detail}` : '');
    if (!ok) failed++;
}

console.log('INFO ships with DWT:', withDwt);

if (failed) {
    console.error('\nEnrichment validation FAILED');
    process.exit(1);
}
console.log('\nEnrichment validation passed.');
