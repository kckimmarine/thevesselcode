#!/usr/bin/env node
/**
 * Mechanical Toolkit — bolt torque & crankshaft deflection regression tests.
 * Run: node scripts/test-mechanical-engineering-calc.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const mechSrc = readFileSync(join(ROOT, 'js/toolkit/mechanicalCalc.js'), 'utf8');
const sandbox = { globalThis: {}, module: { exports: {} } };
sandbox.globalThis = sandbox;
vm.runInNewContext(mechSrc, sandbox, { filename: 'mechanicalCalc.js' });
const Mech = sandbox.globalThis.TVC_MechanicalCalc;

const boltJson = JSON.parse(readFileSync(join(ROOT, 'data/bolt-torque-standards.json'), 'utf8'));
Mech.setStandards(boltJson);

const results = [];
function check(name, ok, detail = '') {
    results.push({ name, ok, detail });
    console.log(ok ? 'OK' : 'FAIL', name, detail ? `— ${detail}` : '');
}

check('mechanicalCalc module', !!Mech?.calcBoltTorque && !!Mech?.diagnoseDeflection);

const m16 = Mech.calcBoltTorque({ size: 'M16', propertyClass: '8.8', lubrication: 'oiled' });
check('M16 8.8 oiled no error', !m16.error);
const target = 185;
const tol = target * 0.05;
check(
    'M16 8.8 oiled torque ~185 N·m (±5%)',
    m16.torqueNm >= target - tol && m16.torqueNm <= target + tol,
    `torqueNm=${m16.torqueNm}`,
);

check('M16 k factor oiled', m16.kFactor === 0.14);
check('M16 dry > oiled', Mech.calcBoltTorque({ size: 'M16', propertyClass: '8.8', lubrication: 'dry' }).torqueNm > m16.torqueNm);

const lookup = Mech.buildTorqueLookupTable();
check('lookup table rows', lookup.length === 11 * 3, `rows=${lookup.length}`);

const defl = Mech.diagnoseDeflection({
    strokeMm: 1200,
    top: 0.12,
    bottom: 0,
    port: 0,
    starboard: 0,
    unit: 'mm',
});
check('deflection deltaV', Math.abs(defl.deltaV - 0.12) < 1e-9, `deltaV=${defl.deltaV}`);
check('deflection limit 1200 stroke', Math.abs(defl.allowableLimitMm - 0.084) < 1e-9, `limit=${defl.allowableLimitMm}`);
check('deflection EXCEEDED', defl.status === 'EXCEEDED' && defl.color === 'red');

const normal = Mech.diagnoseDeflection({
    strokeMm: 1200,
    top: 0.05,
    bottom: 0,
    port: 0,
    starboard: 0,
});
check('deflection NORMAL band', normal.status === 'NORMAL' && normal.color === 'green');

const attention = Mech.diagnoseDeflection({
    strokeMm: 1200,
    top: 0.08,
    bottom: 0,
    port: 0,
    starboard: 0,
});
check('deflection ATTENTION band', attention.status === 'ATTENTION' && attention.color === 'yellow');

const failed = results.filter((r) => !r.ok);
if (failed.length) {
    console.error('\nMechanical engineering calc tests FAILED');
    process.exit(1);
}
console.log('\nMechanical engineering calc tests passed.');
