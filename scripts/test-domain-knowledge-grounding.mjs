#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const {
    matchKnowledgeBaseFromData,
    formatGroundingAnswer,
    loadKnowledgeBase,
} = require(join(ROOT, 'api/_lib/brainKnowledgeGrounding.js'));

const kb = loadKnowledgeBase() || JSON.parse(readFileSync(join(ROOT, 'data/tvc-knowledge-base.json'), 'utf8'));

function check(name, ok, detail = '') {
    console.log(ok ? 'OK' : 'FAIL', name, detail ? `— ${detail}` : '');
    if (!ok) process.exitCode = 1;
}

const q = 'FWG JWP salinity plate gasket';
const matches = matchKnowledgeBaseFromData(kb, q);
check('KB match parts', matches.parts.length >= 1, `parts=${matches.parts.length}`);
check('KB match trouble', matches.trouble.length >= 1, `trouble=${matches.trouble.length}`);

const md = formatGroundingAnswer(matches, 'KO');
check('grounding markdown', md.includes('핵심 결론') && md.includes('FWG'), 'KO answer');

const pn = matchKnowledgeBaseFromData(kb, 'ME-EV-SP-6S50');
check('part number exact', pn.parts.some((p) => p.part_number === 'ME-EV-SP-6S50'));

if (process.exitCode) {
    console.error('\nDomain knowledge grounding tests FAILED');
    process.exit(1);
}
console.log('\nDomain knowledge grounding tests passed.');
