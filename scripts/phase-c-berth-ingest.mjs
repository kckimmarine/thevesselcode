#!/usr/bin/env node
/**
 * Phase C: Berth Marine secondary ingestion (enrich + expand toward 30k–50k).
 *
 *   node scripts/discover-berth-sitemap-codes.mjs
 *   node scripts/fetch-berth-sitemaps.mjs
 *   node scripts/berth-sitemap-to-import.mjs [--skip-plates]
 *   node scripts/phase-c-berth-ingest.mjs --merge-only
 *   (legacy detail scrape) node scripts/phase-c-berth-ingest.mjs --scrape-batch=40
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  loadBerthSitemapCodes,
  writeBerthWorklist,
  codesMissingFromCatalog,
} from './lib/berth-sitemap-codes.mjs';

const root = process.cwd();
const SITEMAP_CODES = join(root, 'public/data/berth/sitemap-codes.json');
const WORKLIST_PATH = join(root, 'public/data/berth/worklist-new-codes.json');
const PROGRESS_PATH = join(root, 'public/data/berth/ingest-progress.json');

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function parseArgs(argv) {
  const opts = {
    mergeOnly: false,
    discover: true,
    scrapeBatch: 80,
    delay: 0.35,
    maxBatches: 0,
    newOnly: true,
  };
  for (const arg of argv) {
    if (arg === '--merge-only') opts.mergeOnly = true;
    else if (arg === '--all-codes') opts.newOnly = false;
    else if (arg === '--no-discover') opts.discover = false;
    else if (arg.startsWith('--scrape-batch=')) opts.scrapeBatch = Number(arg.slice(15)) || 80;
    else if (arg.startsWith('--delay=')) opts.delay = Number(arg.slice(8)) || 0.35;
    else if (arg.startsWith('--max-batches=')) opts.maxBatches = Number(arg.slice(14)) || 0;
  }
  return opts;
}

function loadProgress() {
  if (!existsSync(PROGRESS_PATH)) return { offset: 0 };
  return JSON.parse(readFileSync(PROGRESS_PATH, 'utf8'));
}

function saveProgress(offset, total) {
  mkdirSync(join(root, 'public/data/berth'), { recursive: true });
  writeFileSync(PROGRESS_PATH, JSON.stringify({
    offset,
    total,
    updated_at: new Date().toISOString(),
  }, null, 2));
}

function mergeAndSeo() {
  run('node', ['scripts/merge-impa-chapters.mjs']);
  run('node', ['scripts/generate-impa-seo-index.mjs']);
  run('node', ['scripts/generate-sitemap.mjs']);
  const full = JSON.parse(readFileSync(join(root, 'public/data/impa-full.json'), 'utf8'));
  console.log('\n=== Phase C merge summary ===');
  console.log(JSON.stringify(full.merge_stats || {}, null, 2));
  console.log('catalog count:', full.count);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.discover && !opts.mergeOnly) {
    run('node', ['scripts/discover-berth-sitemap-codes.mjs']);
  }

  if (!opts.mergeOnly) {
    if (!existsSync(SITEMAP_CODES)) {
      console.error('Missing sitemap codes — run discover-berth-sitemap-codes.mjs');
      process.exit(1);
    }
    const sitemapCodes = loadBerthSitemapCodes(root);
    const codes = opts.newOnly
      ? codesMissingFromCatalog(root, sitemapCodes)
      : sitemapCodes;
    if (opts.newOnly) {
      writeBerthWorklist(root, codes, 'worklist-new-codes');
      console.log(`Berth worklist: ${codes.length} codes not in SM catalog (of ${sitemapCodes.length} sitemap)`);
    }
    const codesFile = opts.newOnly ? WORKLIST_PATH : SITEMAP_CODES;
    const progress = loadProgress();
    let offset = progress.offset || 0;
    let batches = 0;

    while (offset < codes.length) {
      if (opts.maxBatches > 0 && batches >= opts.maxBatches) break;
      console.log(`\n--- Berth scrape batch offset=${offset} size=${opts.scrapeBatch} ---`);
      run('node', [
        'scripts/scrape-berthmarine.mjs',
        `--codes-file=${codesFile}`,
        `--offset=${offset}`,
        `--batch=${opts.scrapeBatch}`,
        `--delay=${opts.delay}`,
      ]);
      offset += opts.scrapeBatch;
      batches += 1;
      saveProgress(offset, codes.length);
      mergeAndSeo();
      const count = JSON.parse(readFileSync(join(root, 'public/data/impa-full.json'), 'utf8')).count;
      if (count >= 30_000) {
        console.log('Target 30,000+ catalog count reached.');
        break;
      }
    }
  } else {
    mergeAndSeo();
  }
}

main();
