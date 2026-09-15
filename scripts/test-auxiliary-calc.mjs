#!/usr/bin/env node
/**
 * Auxiliary Toolkit — refrigeration & boiler water regression tests.
 * Run: node scripts/test-auxiliary-calc.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const src = readFileSync(join(ROOT, 'js/toolkit/auxiliaryCalc.js'), 'utf8');
const sandbox = { globalThis: {}, module: { exports: {} } };
sandbox.globalThis = sandbox;
vm.runInNewContext(src, sandbox, { filename: 'auxiliaryCalc.js' });
const Aux = sandbox.globalThis.TVC_AuxiliaryCalc;

const results = [];
function check(name, ok, detail = '') {
    results.push({ name, ok, detail });
    console.log(ok ? 'OK' : 'FAIL', name, detail ? `— ${detail}` : '');
}

check('auxiliaryCalc module', !!Aux?.diagnoseRefrigerant && !!Aux?.diagnoseBoilerWater);

const r134 = Aux.diagnoseRefrigerant({
    refrigerant: 'R134a',
    suctionBarGauge: 1.0,
    suctionLineTempC: 0,
    dischargeBarGauge: 8,
    liquidLineTempC: 25,
});
check('R134a 1.0 bar gauge sat evap -10 to -15°C', r134.tSatEvap >= -15 && r134.tSatEvap <= -10, `tSatEvap=${r134.tSatEvap}`);
check('refrigerant superheat computed', Number.isFinite(r134.superheat));
check('refrigerant advice string', typeof r134.diagnosisAdvice === 'string' && r134.diagnosisAdvice.length > 10);

const boiler = Aux.diagnoseBoilerWater({ ph: 10.2, chloridePpm: 450, phosphatePpm: 30 });
check('chloride 450 CRITICAL', boiler.status === 'CRITICAL');
check('chloride blowdown action', boiler.actions.some((a) => /blowdown/i.test(a)));
check('blowdown flag', boiler.blowdownRequired === true);

const boilerLowPo4 = Aux.diagnoseBoilerWater({ ph: 10, chloridePpm: 120, phosphatePpm: 12 });
check('low phosphate WARNING', boilerLowPo4.status === 'WARNING');
check('phosphate dosing hint', boilerLowPo4.actions.some((a) => /35 ppm/i.test(a)));

const failed = results.filter((r) => !r.ok);
if (failed.length) {
    console.error('\nAuxiliary calc tests FAILED');
    process.exit(1);
}
console.log('\nAuxiliary calc tests passed.');
