#!/usr/bin/env node
/**
 * Phase B: scrape Space-Marine chapters until merged catalog reaches ~30,000 items.
 * See docs/IMPA-SEO-SCALING-CHECKLIST.md
 *
 *   node scripts/phase-b-scrape.mjs
 *   node scripts/phase-b-scrape.mjs --target=30000 --delay=0.2
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const PY = join(root, 'scripts', 'scrape_spacemarine.py');

/** High-priority Phase B chapters + SM backlog (skip 59/81 baseline). */
const DEFAULT_PHASE_B = [
  '67', '17', '55', '69', '19', '15', '21',
  '79', '49',
  '10', '11', '25', '27', '31', '35', '37', '39', '51', '53',
  '33', '71',
];

const SKIP_RESCRAPE = new Set(['59', '81']);

function parseArgs(argv) {
  const opts = { target: 30_000, chapters: [...DEFAULT_PHASE_B], delay: 0.2, dryRun: false };
  for (const arg of argv) {
    if (arg.startsWith('--target=')) opts.target = Number(arg.slice(9)) || 30_000;
    else if (arg.startsWith('--chapters=')) {
      opts.chapters = arg.slice(11).split(',').map((s) => s.trim()).filter(Boolean);
    } else if (arg.startsWith('--delay=')) opts.delay = Number(arg.slice(8)) || 0.2;
    else if (arg === '--dry-run') opts.dryRun = true;
  }
  return opts;
}

function mergedCount() {
  const path = join(root, 'public', 'data', 'impa-full.json');
  if (!existsSync(path)) return 0;
  const data = JSON.parse(readFileSync(path, 'utf8'));
  return Number(data.count) || (data.items?.length ?? 0);
}

function runMergeAndIndex() {
  const steps = [
    ['merge', 'node', ['scripts/merge-impa-chapters.mjs']],
    ['seo-index', 'node', ['scripts/generate-impa-seo-index.mjs']],
  ];
  for (const [, cmd, args] of steps) {
    const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit' });
    if (r.status !== 0) process.exit(r.status ?? 1);
  }
}

function scrapeChapter(chapter, delay) {
  console.log(`\n=== Space-Marine scrape category ${chapter} ===`);
  const r = spawnSync('python3', [PY, '--category', chapter, '--delay', String(delay)], {
    cwd: root,
    stdio: 'inherit',
  });
  if (r.status !== 0) {
    console.warn(`WARN: category ${chapter} scrape failed (status ${r.status})`);
    return false;
  }
  return true;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const startCount = mergedCount();
  console.log(`Phase B scrape — target ~${opts.target}, baseline merge count ${startCount}`);
  console.log(`Chapters queue: ${opts.chapters.join(', ')}`);

  if (opts.dryRun) {
    console.log('Dry run — no HTTP scrape');
    return;
  }

  for (const chapter of opts.chapters) {
    if (SKIP_RESCRAPE.has(chapter)) {
      console.log(`Skip ${chapter} (baseline chapter file retained)`);
      continue;
    }
    scrapeChapter(chapter, opts.delay);
    runMergeAndIndex();
    const count = mergedCount();
    console.log(`After ch ${chapter}: impa-full count = ${count}`);
    if (count >= opts.target) {
      console.log(`Target ${opts.target} reached.`);
      break;
    }
  }

  const finalCount = mergedCount();
  console.log(`\nPhase B scrape done. impa-full count = ${finalCount} (started ${startCount})`);
  if (finalCount < opts.target * 0.95) {
    console.warn(`WARN: count below 95% of target ${opts.target} — add more chapters or re-run.`);
    process.exit(2);
  }
}

main();
