#!/usr/bin/env node
/**
 * Vessel lookup UI wiring regression.
 * Run: node scripts/test-vessel-lookup.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const toolkitHtml = readFileSync(join(ROOT, 'toolkit.html'), 'utf8');
const lookupSrc = readFileSync(join(ROOT, 'js/ui/vesselLookup.js'), 'utf8');

const results = [];
function check(name, ok, detail = '') {
    results.push({ name, ok, detail });
    console.log(ok ? 'OK' : 'FAIL', name, detail ? `— ${detail}` : '');
}

check('toolkit embeds vessel lookup input', toolkitHtml.includes('id="tvcVesselLookupInput"'));
check('toolkit loads fleetRegistryService', toolkitHtml.includes('js/services/fleetRegistryService.js'));
check('toolkit loads vesselLookup.js', toolkitHtml.includes('js/ui/vesselLookup.js'));
check('vesselLookup uses fleet service', lookupSrc.includes('TVC_FleetRegistry'));
check('cross-links removed', !lookupSrc.includes('ASTM 54B Calc'));
check('AIS button retained', lookupSrc.includes('View Live Position'));
check('voyage panel', lookupSrc.includes('tvc-vessel-voyage-panel'));
check('on-demand AIS fetch', lookupSrc.includes('/api/vessel-ais'));
check('stale AIS badge not raw hours', lookupSrc.includes('_aisFresh') && lookupSrc.includes('tvc-vessel-voyage-badge'));
check('ex-name badge', lookupSrc.includes('tvc-vessel-exname-badge'));
check('leaflet map modal wired', toolkitHtml.includes('vesselMapModal.js'));
check('no vesselfinder iframe', !lookupSrc.includes('vesselfinder.com'));
check('fleet index present', existsSync(join(ROOT, 'public/data/fleet/fleet-index.json')));

const failed = results.filter((r) => !r.ok);
if (failed.length) {
    console.error('\nVessel lookup tests FAILED');
    process.exit(1);
}
console.log('\nVessel lookup tests passed.');
