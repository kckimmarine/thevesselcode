#!/usr/bin/env node
/**
 * Master aggregator — unit calc suites + Playwright engineering toolkit E2E.
 * Run: node scripts/verify-all-engineering.mjs
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url));
const cwd = join(ROOT, '..');

const STEPS = [
    { name: 'Mechanical calc', cmd: 'npm', args: ['run', 'test:mechanical-calc'] },
    { name: 'Combustion calc', cmd: 'npm', args: ['run', 'test:combustion-calc'] },
    { name: 'Electrical calc', cmd: 'npm', args: ['run', 'test:electrical-calc'] },
    { name: 'Auxiliary calc', cmd: 'npm', args: ['run', 'test:auxiliary-calc'] },
    { name: 'Engineering search', cmd: 'npm', args: ['run', 'test:engineering-search'] },
    {
        name: 'Playwright toolkit E2E',
        cmd: 'npx',
        args: ['playwright', 'test', 'e2e/toolkit-engineering-suite.spec.js'],
    },
];

const rows = [];

for (const step of STEPS) {
    const started = Date.now();
    const result = spawnSync(step.cmd, step.args, {
        cwd,
        stdio: 'inherit',
        env: { ...process.env, CI: process.env.CI || '' },
    });
    const ms = Date.now() - started;
    const ok = result.status === 0;
    rows.push({ name: step.name, ok, ms });
}

const pad = (s, n) => String(s).padEnd(n);
const nameW = Math.max(24, ...rows.map((r) => r.name.length));
const line = '─'.repeat(nameW + 22);

console.log('\n' + line);
console.log(pad('Suite', nameW) + pad('Result', 10) + 'Duration');
console.log(line);
for (const r of rows) {
    const dur = `${(r.ms / 1000).toFixed(1)}s`;
    console.log(pad(r.name, nameW) + pad(r.ok ? 'PASS' : 'FAIL', 10) + dur);
}
console.log(line);

const failed = rows.filter((r) => !r.ok);
const passed = rows.filter((r) => r.ok).length;
console.log(`\nScorecard: ${passed}/${rows.length} passed`);
if (failed.length) {
    console.error('FAILED:', failed.map((f) => f.name).join(', '));
    process.exit(1);
}
console.log('All engineering verification suites passed.');
