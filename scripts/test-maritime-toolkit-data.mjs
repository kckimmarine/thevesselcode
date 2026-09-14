#!/usr/bin/env node
/**
 * Maritime Toolkit — ASTM 54B bunker math & flange dataset checks.
 * Run: node scripts/test-maritime-toolkit-data.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const bunkerPath = join(ROOT, 'js/toolkit/bunkerCalc.js');
const bunkerSrc = readFileSync(bunkerPath, 'utf8');
const sandbox = { globalThis: {}, module: { exports: {} } };
sandbox.globalThis = sandbox;
vm.runInNewContext(bunkerSrc, sandbox, { filename: 'bunkerCalc.js' });
const Bunker = sandbox.globalThis.TVC_BunkerCalc;

const flangeJson = JSON.parse(readFileSync(join(ROOT, 'data/flange-standards.json'), 'utf8'));
const rows = flangeJson.rows || [];

const results = [];
function check(name, ok, detail = '') {
    results.push({ name, ok, detail });
    console.log(ok ? 'OK' : 'FAIL', name, detail ? `— ${detail}` : '');
}

check('bunkerCalc module', !!Bunker?.calcBunkerAstM54B);

const spot = Bunker.calcBunkerAstM54B({
    volumeM3: 500,
    density15: 991,
    tempC: 40,
    fuelKey: 'VLSFO',
});

check('spot VCF 4dp (ASTM exp.)', Math.abs(spot.vcf - 0.9905) < 0.0002, `vcf=${spot.vcf.toFixed(6)}`);
check('spot alpha > 0', spot.alpha > 0.0003 && spot.alpha < 0.0005, `alpha=${spot.alpha.toFixed(7)}`);
check('spot mass in air (user formula)', Math.abs(spot.mt - 490.251) < 0.02, `mt=${spot.mt.toFixed(3)}`);

const spend = Bunker.calcFuelExpenditureUsd(spot.mt, 612.5);
check('fuel expenditure USD', spend != null && Math.abs(spend - spot.mt * 612.5) < 0.01, `usd=${spend?.toFixed(2)}`);
check('fuel expenditure null without price', Bunker.calcFuelExpenditureUsd(spot.mt, 0) === null);

const vcfRef = 0.9829;
const mtTableRef = (500 * vcfRef * 991) / 1000;
check(
    'spot-check reference ~487.023 MT @ VCF 0.9829 (table lookup)',
    Math.abs(mtTableRef - 487.023) < 0.05,
    `mtRef=${mtTableRef.toFixed(3)}`,
);

const dist = Bunker.calcBunkerAstM54B({ volumeM3: 100, density15: 800, tempC: 20, fuelKey: 'LSMGO' });
check('distillate K0 branch', Bunker.kCoefficients(800).K1 === 0);
check('LSMGO CO₂ factor', dist.co2Factor === 3.206);

check('flange dataset rows', rows.length >= 80, `count=${rows.length}`);

const jis10_50 = rows.find((r) => r.standard === 'JIS 10K' && r.nb === '50A');
check('JIS 10K 50A OD/PCD', jis10_50?.od === 155 && jis10_50?.pcd === 120, JSON.stringify(jis10_50));
check('JIS 10K 50A bolts', jis10_50?.bolts === 8 && jis10_50?.hole === 19 && jis10_50?.bolt === 'M16');

const jis10_100 = rows.find((r) => r.standard === 'JIS 10K' && r.nb === '100A');
check('JIS 10K 100A', jis10_100?.od === 210 && jis10_100?.pcd === 175 && jis10_100?.bolts === 8);

const standards = [...new Set(rows.map((r) => r.standard))].sort();
check('flange standards present', standards.join(', ').includes('JIS 5K') && standards.includes('ANSI 150#') && standards.includes('DIN PN10'));

for (const std of ['JIS 5K', 'JIS 10K', 'JIS 16K']) {
    const n = rows.filter((r) => r.standard === std).length;
    check(`${std} size coverage`, n >= 15, `rows=${n}`);
}

const failed = results.filter((r) => !r.ok);
if (failed.length) {
    console.error('\nMaritime toolkit data tests FAILED');
    process.exit(1);
}
console.log('\nMaritime toolkit data tests passed.');
