#!/usr/bin/env node
/**
 * Global fleet ingest + search validation (ranking + Chemi demo IMOs).
 * Run: node scripts/test-global-fleet.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FLEET_DIR = join(ROOT, 'public', 'data', 'fleet');

const SEARCH_EXPECT = [
    { query: 'incheon chemi', imo: '9424857', name: 'INCHEON CHEMI' },
    { query: 'bangkok chemi', imo: '9418303', name: 'BANGKOK CHEMI' },
    { query: 'phoebe', imo: '9297711', name: 'PHOEBE' },
];

const fleetSrc = readFileSync(join(ROOT, 'js/services/fleetRegistryService.js'), 'utf8');

const results = [];
function check(name, ok, detail = '') {
    results.push({ name, ok, detail });
    console.log(ok ? 'OK' : 'FAIL', name, detail ? `— ${detail}` : '');
}

check('fleet-index exists', existsSync(join(FLEET_DIR, 'fleet-index.json')));
const index = JSON.parse(readFileSync(join(FLEET_DIR, 'fleet-index.json'), 'utf8'));
check('fleet count 30k+', index.count >= 30000, `count=${index.count}`);
check('fleet count <= 55k', index.count <= 55000, `count=${index.count}`);

const sandbox = {
    globalThis: {},
    fetch: async (url) => {
        const path = url.startsWith('/data/fleet/')
            ? join(FLEET_DIR, url.replace('/data/fleet/', ''))
            : join(ROOT, 'public', url.replace(/^\//, ''));
        const body = readFileSync(path, 'utf8');
        return { ok: true, json: async () => JSON.parse(body) };
    },
};
sandbox.globalThis = sandbox;
vm.runInNewContext(fleetSrc, sandbox, { filename: 'fleetRegistryService.js' });
const Fleet = sandbox.globalThis.TVC_FleetRegistry;

async function runSearchTests() {
    check('fleetRegistry module', !!Fleet?.searchFleet);
    await Fleet.loadIndex();

    for (const { query, imo, name } of SEARCH_EXPECT) {
        const hits = await Fleet.searchFleet(query);
        const top = hits[0];
        check(`search "${query}"`, top?.imo === imo, top ? `${top.name} (${top.imo})` : 'no hits');
        if (top && name) {
            check(`name "${query}"`, top.name === name, top.name);
        }
    }

    const imoHits = await Fleet.searchFleet('9297711');
    check('IMO 9297711 direct', imoHits[0]?.imo === '9297711', imoHits[0]?.name);
    check(
        'IMO 9297711 no ex-name false positive',
        !imoHits[0]?._exNameMatch,
        imoHits[0]?._exNameMatch || 'clean'
    );

    await Fleet.searchFleet('9297711');
    const start = performance.now();
    const iterations = 300;
    for (let i = 0; i < iterations; i++) {
        await Fleet.searchFleet('9297711');
    }
    const perMs = (performance.now() - start) / iterations;
    check('IMO lookup latency < 10ms (warm cache)', perMs < 10, `${perMs.toFixed(2)} ms avg`);
}

runSearchTests()
    .then(() => {
        const failed = results.filter((r) => !r.ok);
        if (failed.length) {
            console.error('\nGlobal fleet tests FAILED');
            process.exit(1);
        }
        console.log('\nGlobal fleet tests passed.');
    })
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
