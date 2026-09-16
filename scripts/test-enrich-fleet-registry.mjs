#!/usr/bin/env node
/**
 * Validate fleet enrichment for ROYAL CRYSTAL 7 (IMO 9381330).
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IMO = '9381330';

const run = spawnSync('node', ['scripts/enrich-fleet-registry.mjs'], { cwd: ROOT, stdio: 'inherit' });
if (run.status !== 0) process.exit(run.status ?? 1);

const index = JSON.parse(readFileSync(join(ROOT, 'public/data/fleet/fleet-index.json'), 'utf8'));
const part = index.imo[IMO];
const chunk = JSON.parse(readFileSync(join(ROOT, `public/data/fleet/fleet-${part}.json`), 'utf8'));
const ship = chunk.ships.find((s) => s.i === IMO);

const checks = [
    ['name', ship?.n === 'ROYAL CRYSTAL 7', ship?.n],
    ['manager', ship?.m === 'INFICESS SHIPPING CO LTD', ship?.m],
    ['dwt', ship?.d === 13102, String(ship?.d)],
    ['year', ship?.y === 2007, String(ship?.y)],
    ['engine', Boolean(ship?.e && ship.e.includes('MAN')), ship?.e],
    ['mmsi', ship?.s === '440527000', ship?.s],
];

let failed = 0;
for (const [label, ok, detail] of checks) {
    console.log(ok ? 'OK' : 'FAIL', label, detail ? `— ${detail}` : '');
    if (!ok) failed++;
}

if (failed) {
    console.error('\nEnrichment validation FAILED');
    process.exit(1);
}
console.log('\nEnrichment validation passed.');
