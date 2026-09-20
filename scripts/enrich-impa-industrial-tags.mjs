#!/usr/bin/env node
/**
 * Append industrial_tags + land_compat_name to IMPA chapter JSON (compact `n` field).
 *
 * Usage:
 *   node scripts/enrich-impa-industrial-tags.mjs public/data/chapters/impa-81.json
 *   node scripts/enrich-impa-industrial-tags.mjs --all-chapters
 *   node scripts/enrich-impa-industrial-tags.mjs --verify
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, copyFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  extractIndustrialTags,
  matchIndustrialSearch,
} from './lib/impa-industrial-tags.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CHAPTERS_DIR = join(ROOT, 'public/data/chapters');

function loadItems(path) {
  const data = JSON.parse(readFileSync(path, 'utf8'));
  if (Array.isArray(data)) return { path, items: data, wrapper: null };
  if (Array.isArray(data?.items)) return { path, items: data.items, wrapper: data };
  throw new Error(`Unsupported catalog shape: ${path}`);
}

function saveItems({ path, items, wrapper }) {
  const out = wrapper ? { ...wrapper, items } : items;
  writeFileSync(path, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
}

function enrichRow(row) {
  const name = String(row?.n || row?.name || '').trim();
  const { industrial_tags, land_compat_name } = extractIndustrialTags(name);
  return {
    ...row,
    industrial_tags,
    land_compat_name,
  };
}

function enrichFile(filePath, { dryRun = false } = {}) {
  const loaded = loadItems(filePath);
  let tagged = 0;
  const items = loaded.items.map((row) => {
    const next = enrichRow(row);
    if (next.land_compat_name || next.industrial_tags.length) tagged += 1;
    return next;
  });
  if (!dryRun) saveItems({ ...loaded, items });
  return { count: items.length, tagged, items };
}

function runVerify() {
  const ch81 = join(CHAPTERS_DIR, 'impa-81.json');
  const ch75 = join(CHAPTERS_DIR, 'impa-75.json');
  const results = [];

  function check(name, ok, detail = '') {
    results.push({ name, ok, detail });
    console.log(ok ? 'OK' : 'FAIL', name, detail ? `— ${detail}` : '');
  }

  if (!existsSync(ch81)) {
    console.error('Missing', ch81);
    process.exit(1);
  }

  const enriched81 = enrichFile(ch81, { dryRun: true });
  check('impa-81 enrich smoke', enriched81.count > 0, `${enriched81.count} rows, ${enriched81.tagged} tagged`);

  const sampleTape = enriched81.items.find((r) => /100\s*mm/i.test(String(r.n)));
  check(
    'impa-81 mm size tag',
    sampleTape?.industrial_tags?.some((t) => /mm/i.test(t)),
    sampleTape ? sampleTape.industrial_tags.join(', ') : 'no tape row',
  );

  if (!existsSync(ch75)) {
    console.error('Missing valve chapter for JIS verify:', ch75);
    process.exit(1);
  }

  const enriched75 = enrichFile(ch75, { dryRun: true });
  const query = 'JIS 10K 50A';
  const hits = matchIndustrialSearch(enriched75.items, query, { limit: 30 });
  const globe50 = hits.filter((r) => /globe valve/i.test(String(r.n)) && /50\s*mm/i.test(String(r.n)));
  check(
    `query "${query}" matches globe valve 50mm`,
    globe50.length >= 1,
    globe50[0] ? `${globe50[0].c} ${globe50[0].land_compat_name}` : `hits=${hits.length}`,
  );

  const code750231 = enriched75.items.find((r) => String(r.c) === '750231');
  check(
    '750231 land_compat_name',
    code750231?.land_compat_name === 'Globe Valve JIS 10K 50A',
    code750231?.land_compat_name || 'missing',
  );

  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.error('\nIndustrial tag verification FAILED');
    process.exit(1);
  }
  console.log('\nIndustrial tag verification passed.');
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--verify')) {
    runVerify();
    return;
  }

  const dryRun = args.includes('--dry-run');
  const paths = [];

  if (args.includes('--all-chapters')) {
    for (const file of readdirSync(CHAPTERS_DIR).sort()) {
      if (/^impa-\d{2}\.json$/.test(file)) paths.push(join(CHAPTERS_DIR, file));
    }
  } else {
    const fileArgs = args.filter((a) => !a.startsWith('--'));
    if (!fileArgs.length) paths.push(join(CHAPTERS_DIR, 'impa-81.json'));
    else paths.push(...fileArgs.map((p) => (p.startsWith('/') ? p : join(process.cwd(), p))));
  }

  let total = 0;
  let tagged = 0;
  for (const p of paths) {
    if (!existsSync(p)) {
      console.error('Skip missing', p);
      continue;
    }
    const stats = enrichFile(p, { dryRun });
    total += stats.count;
    tagged += stats.tagged;
    console.log(`${dryRun ? '[dry-run] ' : ''}${p}: ${stats.count} rows, ${stats.tagged} with industrial tags`);
  }
  console.log(`Done. ${total} rows, ${tagged} tagged.`);

  const merged = join(ROOT, 'public/data/impa-full.json');
  if (existsSync(merged)) {
    mkdirSync(join(ROOT, 'data'), { recursive: true });
    copyFileSync(merged, join(ROOT, 'data/impa-full.json'));
    console.log('Mirrored public/data/impa-full.json → data/impa-full.json');
  }
}

main();
