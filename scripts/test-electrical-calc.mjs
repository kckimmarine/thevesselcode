#!/usr/bin/env node
/**
 * Electrical Toolkit — PT100 & motor FLC regression tests.
 * Run: node scripts/test-electrical-calc.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const src = readFileSync(join(ROOT, 'js/toolkit/electricalCalc.js'), 'utf8');
const sandbox = { globalThis: {}, module: { exports: {} } };
sandbox.globalThis = sandbox;
vm.runInNewContext(src, sandbox, { filename: 'electricalCalc.js' });
const Elec = sandbox.globalThis.TVC_ElectricalCalc;

const results = [];
function check(name, ok, detail = '') {
    results.push({ name, ok, detail });
    console.log(ok ? 'OK' : 'FAIL', name, detail ? `— ${detail}` : '');
}

check('electricalCalc module', !!Elec?.pt100ToTemperature && !!Elec?.calculateMotorSpecs);

const t0 = Elec.pt100ToTemperature(100.0);
check('PT100 100Ω -> 0°C', t0 != null && Math.abs(t0 - 0) <= 0.2, `t=${t0}`);

const t100 = Elec.pt100ToTemperature(138.51);
check('PT100 138.51Ω -> 100°C', t100 != null && Math.abs(t100 - 100) <= 0.2, `t=${t100}`);

const t50 = Elec.pt100ToTemperature(119.4);
check('PT100 119.4Ω -> 50°C', t50 != null && Math.abs(t50 - 50) <= 0.2, `t=${t50}`);

const table = Elec.getPt100ReferenceTable();
check('PT100 table 0-200 step 10', table.length === 21 && table[0].tempC === 0 && table[table.length - 1].tempC === 200);

const motor = Elec.calculateMotorSpecs({ powerKw: 15, voltage: 440, powerFactor: 0.85, efficiency: 0.9 });
check('15 kW FLC ~25.6 A', Math.abs(motor.flcAmps - 25.6) <= 1, `flc=${motor.flcAmps}`);
check('15 kW EOCR ~28.2 A', Math.abs(motor.eocrSettingAmps - 28.2) <= 1, `eocr=${motor.eocrSettingAmps}`);
check('DOL factor 6.5', Math.abs(motor.dolStartingAmps - motor.flcAmps * 6.5) < 0.1);
check('advice text', typeof motor.adviceText === 'string' && motor.adviceText.length > 20);

const failed = results.filter((r) => !r.ok);
if (failed.length) {
    console.error('\nElectrical calc tests FAILED');
    process.exit(1);
}
console.log('\nElectrical calc tests passed.');
