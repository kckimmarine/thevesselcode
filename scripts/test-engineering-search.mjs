#!/usr/bin/env node
/**
 * Engineering knowledge index & search regression tests.
 * Run: node scripts/test-engineering-search.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const index = JSON.parse(readFileSync(join(ROOT, 'data/engineering-knowledge-index.json'), 'utf8'));
const searchSrc = readFileSync(join(ROOT, 'js/toolkit/engineeringSearch.js'), 'utf8');
const toolkitHtml = readFileSync(join(ROOT, 'toolkit.html'), 'utf8');

const sandbox = { globalThis: {}, module: { exports: {} } };
sandbox.globalThis = sandbox;
vm.runInNewContext(searchSrc, sandbox, { filename: 'engineeringSearch.js' });
const Search = sandbox.globalThis.TVC_EngineeringSearch;

Search.setKnowledgeIndex(index);

const LIVE_TABS = [...toolkitHtml.matchAll(/data-tool-tab="([^"]+)"/g)].map((m) => m[1]);
const UNIQUE_TABS = [...new Set(LIVE_TABS)];

const results = [];
function check(name, ok, detail = '') {
    results.push({ name, ok, detail });
    console.log(ok ? 'OK' : 'FAIL', name, detail ? `— ${detail}` : '');
}

check('engineeringSearch module', !!Search?.searchEngineeringKnowledge);

const moduleTabs = [...toolkitHtml.matchAll(/class="[^"]*module-card[^"]*"[^>]*data-tool-tab="([^"]+)"/g)].map((m) => m[1]);
const expectedModuleTabs = [
    'bunker', 'engineering', 'mechanical', 'combustion', 'lube', 'paint', 'electrical', 'compliance', 'auxiliary', 'catalog',
];
check('toolkit module cards wired', moduleTabs.length === 10, `tabs=${moduleTabs.join(',')}`);
for (const tab of expectedModuleTabs) {
    check(`module card data-tool-tab="${tab}"`, moduleTabs.includes(tab));
}

const QUERY_EXPECT = [
    ['torque', 'mech-bolt-torque'],
    ['디플렉션', 'mech-crank-deflection'],
    ['Pmax', 'ice-pmax-balance'],
    ['PT100', 'ee-pt100-iec'],
    ['boiler', 'aux-boiler-water'],
    ['OWS', 'psc-ows-15ppm'],
];

for (const [query, expectedId] of QUERY_EXPECT) {
    const hits = Search.searchEngineeringKnowledge(query);
    const top = hits[0]?.entry;
    check(`query "${query}" top id`, top?.id === expectedId, top ? `got ${top.id}` : 'no results');
}

for (const entry of index.entries) {
    const tab = entry.calculatorTab;
    check(`calculatorTab "${tab}" for ${entry.id}`, UNIQUE_TABS.includes(tab), `tabs=${UNIQUE_TABS.join(',')}`);
}

const failed = results.filter((r) => !r.ok);
if (failed.length) {
    console.error('\nEngineering search tests FAILED');
    process.exit(1);
}
console.log('\nEngineering search tests passed.');
