#!/usr/bin/env node
/**
 * Fleet universal search data regression (profiles + ex-name index + chunk field x).
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function check(name, ok, detail = '') {
    console.log(ok ? 'OK' : 'FAIL', name, detail ? `— ${detail}` : '');
    if (!ok) process.exitCode = 1;
}

const profiles = JSON.parse(readFileSync(join(ROOT, 'public/data/fleet/fleet-profiles.json'), 'utf8'));
const exIdx = JSON.parse(readFileSync(join(ROOT, 'public/data/fleet/fleet-exname-index.json'), 'utf8'));
const index = JSON.parse(readFileSync(join(ROOT, 'public/data/fleet/fleet-index.json'), 'utf8'));
const part = index.imo['9418303'];
const chunk = JSON.parse(readFileSync(join(ROOT, `public/data/fleet/fleet-${part}.json`), 'utf8'));
const ship = chunk.ships.find((s) => s.i === '9418303');

check('profile 9418303', profiles.vessels?.['9418303']?.name === 'BANGKOK CHEMI');
check('ex-name golden sea', exIdx.exact?.['golden sea 1'] === '9418303');
check('ex-name chemi ocean', exIdx.exact?.['chemi ocean'] === '9418303');
check('chunk name', ship?.n === 'BANGKOK CHEMI', ship?.n);
check('chunk ex-names', Array.isArray(ship?.x) && ship.x.includes('GOLDEN SEA 1'));
check('ais snapshot', existsSync(join(ROOT, 'public/data/fleet-ais-positions.json')));

const svc = readFileSync(join(ROOT, 'js/services/fleetRegistryService.js'), 'utf8');
check('searchVessels alias', svc.includes('searchVessels: searchFleet'));
check('exname index url', svc.includes('fleet-exname-index.json'));
check('pure IMO skips ex-name match', svc.includes('isPureImoQuery') && svc.includes('exNameMatchedByQuery'));

if (process.exitCode) {
    console.error('\nFleet universal search tests FAILED');
    process.exit(1);
}
console.log('\nFleet universal search tests passed.');
