#!/usr/bin/env node
/**
 * Vessel registry lookup regression & search latency check.
 * Run: node scripts/test-vessel-lookup.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const registry = JSON.parse(readFileSync(join(ROOT, 'data/vessel-registry-sample.json'), 'utf8'));
const lookupSrc = readFileSync(join(ROOT, 'js/ui/vesselLookup.js'), 'utf8');
const toolkitHtml = readFileSync(join(ROOT, 'toolkit.html'), 'utf8');

const sandbox = { globalThis: {}, document: undefined, location: { search: '' } };
sandbox.globalThis = sandbox;
vm.runInNewContext(lookupSrc, sandbox, { filename: 'vesselLookup.js' });
const Lookup = sandbox.globalThis.TVC_VesselLookup;

Lookup.setVesselRegistry(registry);

const results = [];
function check(name, ok, detail = '') {
    results.push({ name, ok, detail });
    console.log(ok ? 'OK' : 'FAIL', name, detail ? `— ${detail}` : '');
}

check('vesselLookup module', !!Lookup?.searchVessels);
check('toolkit embeds vessel lookup input', toolkitHtml.includes('id="tvcVesselLookupInput"'));
check('toolkit loads vesselLookup.js', toolkitHtml.includes('js/ui/vesselLookup.js'));

const phoenix = registry.vessels.find((v) => v.imo === '9876543');
check('seed TVC PHOENIX', phoenix?.name === 'TVC PHOENIX' && phoenix?.technical_manager?.includes('ABC Shipping'));

const imoHits = Lookup.searchVessels('9876543');
check('IMO exact match', imoHits[0]?.imo === '9876543', imoHits[0]?.name);

const nameHits = Lookup.searchVessels('phoenix');
check('name match', nameHits.some((v) => v.imo === '9876543'));

const iterations = 500;
const start = performance.now();
for (let i = 0; i < iterations; i++) {
    Lookup.searchVessels('9876543');
}
const elapsed = performance.now() - start;
const perSearchMs = elapsed / iterations;
check('IMO search latency < 100ms', perSearchMs < 100, `${perSearchMs.toFixed(3)} ms avg over ${iterations} runs`);

const failed = results.filter((r) => !r.ok);
if (failed.length) {
    console.error('\nVessel lookup tests FAILED');
    process.exit(1);
}
console.log('\nVessel lookup tests passed.');
