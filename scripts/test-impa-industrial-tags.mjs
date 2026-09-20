#!/usr/bin/env node
/** Regression: industrial tag enrichment + land-marine search tokens */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchIndustrialSearch } from './lib/impa-industrial-tags.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function check(name, ok, detail = '') {
  console.log(ok ? 'OK' : 'FAIL', name, detail ? `— ${detail}` : '');
  if (!ok) process.exitCode = 1;
}

const verify = spawnSync(process.execPath, ['scripts/enrich-impa-industrial-tags.mjs', '--verify'], {
  cwd: ROOT,
  stdio: 'inherit',
});
check('enrich --verify exit 0', verify.status === 0, `status=${verify.status}`);

const ch75 = JSON.parse(readFileSync(join(ROOT, 'public/data/chapters/impa-75.json'), 'utf8'));
const hits = matchIndustrialSearch(ch75, 'JIS 10K 50A', { limit: 10 });
check('impa-75 persisted tags search', hits.some((r) => String(r.c) === '750231'), `top=${hits[0]?.c}`);

if (process.exitCode) {
  console.error('\nIMPA industrial tag tests FAILED');
  process.exit(1);
}
console.log('\nIMPA industrial tag tests passed.');
