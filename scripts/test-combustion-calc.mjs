#!/usr/bin/env node
/**
 * Combustion balance & cylinder lube feed rate regression tests.
 * Run: node scripts/test-combustion-calc.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const src = readFileSync(join(ROOT, 'js/toolkit/combustionCalc.js'), 'utf8');
const sandbox = { globalThis: {}, module: { exports: {} } };
sandbox.globalThis = sandbox;
vm.runInNewContext(src, sandbox, { filename: 'combustionCalc.js' });
const Comb = sandbox.globalThis.TVC_CombustionCalc;

const results = [];
function check(name, ok, detail = '') {
    results.push({ name, ok, detail });
    console.log(ok ? 'OK' : 'FAIL', name, detail ? `— ${detail}` : '');
}

check('combustionCalc module', !!Comb?.diagnoseCombustion && !!Comb?.calculateCylinderLube);

const balanced = Comb.diagnoseCombustion(Comb.sampleSixCylinderBalanced());
check('balanced 6-cyl all BALANCED', balanced.cylinders.every((c) => c.status === 'BALANCED' && c.color === 'green'));

const base = Comb.sampleSixCylinderBalanced();
const skewed = base.map((c, i) => (i === 0 ? { ...c, pMax: c.pMax + 5 } : c));
const imbal = Comb.diagnoseCombustion(skewed);
const cyl1 = imbal.cylinders.find((c) => c.cylNo === 1);
check('Pmax +5 bar triggers IMBALANCED', cyl1?.status === 'IMBALANCED' && cyl1?.color === 'red');
check(
    'VIT timing hint on high Pmax',
    cyl1?.hints?.some((h) => /injection timing|VIT/i.test(h)),
    cyl1?.hints?.join(' | '),
);

const afterBurn = Comb.diagnoseCombustion([
    { cylNo: 1, pMax: 140, pComp: 105, tExh: 420 },
    { cylNo: 2, pMax: 145, pComp: 105, tExh: 380 },
    { cylNo: 3, pMax: 145, pComp: 105, tExh: 380 },
]);
const abCyl = afterBurn.cylinders.find((c) => c.cylNo === 1);
check(
    'after-burn hint when low Pmax and high Texh',
    abCyl?.hints?.some((h) => /after-burning|spray defect/i.test(h)),
);

const lube = Comb.calculateCylinderLube({ powerKw: 10000, sulfurPercent: 0.5, bn: 40, oilDensity: 0.92 });
check('lube feed ~0.75 g/kWh', Math.abs(lube.targetFeedRateGPerKwh - 0.75) < 0.01, `g/kWh=${lube.targetFeedRateGPerKwh}`);
check('lube daily ~195 L/day', Math.abs(lube.dailyLiters - 195) < 3, `L/day=${lube.dailyLiters}`);
check('lube status advice present', typeof lube.statusAdvice === 'string' && lube.statusAdvice.length > 10);

const failed = results.filter((r) => !r.ok);
if (failed.length) {
    console.error('\nCombustion calc tests FAILED');
    process.exit(1);
}
console.log('\nCombustion calc tests passed.');
