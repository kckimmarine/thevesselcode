#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const path = join(root, 'data/templates/archetypes.json');
const doc = JSON.parse(readFileSync(path, 'utf8'));

const EXPECTED = {
  BULK_CARRIER: { components: 40, jobs: 116 },
  OIL_TANKER: { components: 42, jobs: 125 },
  CONTAINER: { components: 41, jobs: 121 },
};

let failed = false;
for (const [key, a] of Object.entries(doc.archetypes || {})) {
  const n = (a.components || []).length;
  const jobs = a.components.reduce((s, c) => s + c.jobs.length, 0);
  const exp = EXPECTED[key];
  if (exp) {
    if (n !== exp.components || jobs !== exp.jobs) {
      console.error(`FAIL ${key}: expected ${exp.components}/${exp.jobs}, got ${n}/${jobs}`);
      failed = true;
    }
  } else if (n < 40) {
    console.error(`FAIL ${key}: ${n} components (need 40+)`);
    failed = true;
  }
  for (const c of a.components) {
    if (!c.name || !c.category || !c.maker_default) {
      console.error(`FAIL ${key}: component missing name/category/maker_default`, c);
      failed = true;
    }
    if (!['DECK', 'ENGINE'].includes(String(c.category).toUpperCase())) {
      console.error(`FAIL ${key}: invalid category`, c.name);
      failed = true;
    }
    if (!Array.isArray(c.jobs) || !c.jobs.length) {
      console.error(`FAIL ${key}: no jobs on`, c.name);
      failed = true;
    }
  }
  console.log(`OK ${key}: ${n} components, ${jobs} jobs`);
}

if (failed) process.exit(1);
console.log('vessel archetypes data OK');
