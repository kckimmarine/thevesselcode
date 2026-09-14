#!/usr/bin/env node
/**
 * Polite background batch runner: Berth Marine plate → WebP (800px, q80).
 *
 *   node scripts/batch-berth-plates.mjs --limit 20
 *   node scripts/batch-berth-plates.mjs --concurrency 2
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  downloadBerthPlateWebp,
  plateExists,
  berthWebpPath,
} from './lib/berth-plate-download.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PLATES_DIR = join(ROOT, 'public/data/plates');
const MASTER_JSON = join(ROOT, 'public/data/berth/imports/berth-sitemap-master.json');
const DATA_DIR = join(ROOT, '.data');
const PROGRESS_PATH = join(DATA_DIR, 'berth-plates-progress.json');
const FAILED_PATH = join(DATA_DIR, 'berth-plates-failed.json');
const LOG_PATH = join(DATA_DIR, 'berth-plates-backfill.log');

const JITTER_MIN_MS = 300;
const JITTER_MAX_MS = 500;
const BACKOFF_STEPS_MS = [10_000, 30_000, 60_000, 120_000];

function parseArgs(argv) {
  const opts = {
    limit: 0,
    concurrency: 2,
    offset: 0,
    retryFailed: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--limit' && argv[i + 1] != null) {
      opts.limit = Math.max(0, Number(argv[++i]) || 0);
    } else if (arg.startsWith('--limit=')) {
      opts.limit = Math.max(0, Number(arg.slice(8)) || 0);
    } else if (arg === '--concurrency' && argv[i + 1] != null) {
      const n = Number(argv[++i]) || 2;
      opts.concurrency = Math.min(3, Math.max(1, n));
    } else if (arg.startsWith('--concurrency=')) {
      const n = Number(arg.slice(14)) || 2;
      opts.concurrency = Math.min(3, Math.max(1, n));
    } else if (arg === '--offset' && argv[i + 1] != null) {
      opts.offset = Math.max(0, Number(argv[++i]) || 0);
    } else if (arg.startsWith('--offset=')) {
      opts.offset = Math.max(0, Number(arg.slice(9)) || 0);
    } else if (arg === '--retry-failed') {
      opts.retryFailed = true;
    }
  }
  return opts;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function jitterDelay() {
  return JITTER_MIN_MS + Math.floor(Math.random() * (JITTER_MAX_MS - JITTER_MIN_MS + 1));
}

function logLine(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(LOG_PATH, `${line}\n`, { flag: 'a' });
  } catch {
    /* ignore log write errors */
  }
}

function loadJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

function saveProgress(progress) {
  mkdirSync(DATA_DIR, { recursive: true });
  progress.updated_at = new Date().toISOString();
  writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2) + '\n');
}

function saveFailed(failed) {
  mkdirSync(DATA_DIR, { recursive: true });
  failed.updated_at = new Date().toISOString();
  writeFileSync(FAILED_PATH, JSON.stringify(failed, null, 2) + '\n');
}

function loadWorkItems() {
  if (!existsSync(MASTER_JSON)) {
    throw new Error(`Missing ${MASTER_JSON} — run berth-sitemap-to-import first`);
  }
  const payload = JSON.parse(readFileSync(MASTER_JSON, 'utf8'));
  return (payload.items || []).filter((i) => i?.impa_code);
}

function buildQueue(items, opts, progress) {
  const completed = new Set(progress.completed || []);
  let queue = items.filter((item) => {
    const code = String(item.impa_code).padStart(6, '0');
    if (completed.has(code)) return false;
    if (plateExists(PLATES_DIR, item)) return false;
    return true;
  });

  if (opts.retryFailed) {
    const failed = loadJson(FAILED_PATH, { items: [] });
    const codes = new Set((failed.items || []).map((f) => f.impa_code));
    queue = queue.filter((i) => codes.has(i.impa_code));
  }

  queue = queue.slice(opts.offset);
  if (opts.limit > 0) queue = queue.slice(0, opts.limit);
  return queue;
}

async function processItem(item) {
  const code = String(item.impa_code).padStart(6, '0');
  if (plateExists(PLATES_DIR, item)) {
    return { code, status: 'skipped' };
  }

  let attempt = 0;
  while (attempt < BACKOFF_STEPS_MS.length + 1) {
    try {
      await sleep(jitterDelay());
      const result = await downloadBerthPlateWebp(item, PLATES_DIR);
      logLine(`OK ${code} → ${berthWebpPath(PLATES_DIR, item)}`);
      return { code, status: result.skipped ? 'skipped' : 'ok' };
    } catch (err) {
      const isRate = err.code === 'RATE_LIMIT' || err.status === 429;
      const isNetwork = err.name === 'TypeError' || /fetch/i.test(String(err.message));
      if ((isRate || isNetwork) && attempt < BACKOFF_STEPS_MS.length) {
        const wait = BACKOFF_STEPS_MS[attempt];
        logLine(`BACKOFF ${code} attempt ${attempt + 1} wait ${wait}ms — ${err.message}`);
        await sleep(wait);
        attempt += 1;
        continue;
      }
      const entry = {
        impa_code: code,
        error: String(err.message || err),
        status: err.status || null,
        at: new Date().toISOString(),
      };
      logLine(`FAIL ${code} — ${entry.error}`);
      return { code, status: 'failed', entry };
    }
  }
  return { code, status: 'failed', entry: { impa_code: code, error: 'max retries' } };
}

function applyResult(result, progress, failed, runStats) {
  const completedSet = new Set(progress.completed || []);
  if (result.status === 'ok') {
    runStats.ok += 1;
    completedSet.add(result.code);
  } else if (result.status === 'skipped') {
    runStats.skipped += 1;
    completedSet.add(result.code);
  } else if (result.status === 'failed') {
    runStats.failed += 1;
    failed.items = (failed.items || []).filter((f) => f.impa_code !== result.code);
    failed.items.push(result.entry);
  }
  progress.completed = [...completedSet].sort();
}

async function runPool(queue, concurrency, worker) {
  let index = 0;
  async function workerLoop() {
    while (true) {
      const i = index;
      index += 1;
      if (i >= queue.length) return;
      await worker(queue[i], i);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => workerLoop()));
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const items = loadWorkItems();
  const progress = loadJson(PROGRESS_PATH, {
    started_at: new Date().toISOString(),
    completed: [],
    stats: { ok: 0, skipped: 0, failed: 0 },
  });
  const failed = loadJson(FAILED_PATH, { items: [] });
  const stats = { ok: 0, skipped: 0, failed: 0 };
  let statsAtLastCheckpoint = { ok: 0, skipped: 0, failed: 0 };

  const queue = buildQueue(items, opts, progress);
  logLine(`Queue ${queue.length} plates (concurrency=${opts.concurrency}, master=${items.length})`);

  if (!queue.length) {
    logLine('Nothing to do — all plates present or completed.');
    return;
  }

  let processed = 0;
  let chain = Promise.resolve();
  const withLock = (fn) => {
    chain = chain.then(fn);
    return chain;
  };

  await runPool(queue, opts.concurrency, async (item) => {
    const result = await processItem(item);
    await withLock(async () => {
      applyResult(result, progress, failed, stats);
      processed += 1;
      if (processed % 5 === 0 || processed === queue.length) {
        const delta = {
          ok: stats.ok - statsAtLastCheckpoint.ok,
          skipped: stats.skipped - statsAtLastCheckpoint.skipped,
          failed: stats.failed - statsAtLastCheckpoint.failed,
        };
        progress.stats = {
          ok: (progress.stats?.ok || 0) + delta.ok,
          skipped: (progress.stats?.skipped || 0) + delta.skipped,
          failed: (progress.stats?.failed || 0) + delta.failed,
        };
        statsAtLastCheckpoint = { ...stats };
        saveProgress(progress);
        saveFailed(failed);
        logLine(`Checkpoint ${processed}/${queue.length} (run ok=${stats.ok} skip=${stats.skipped} fail=${stats.failed})`);
      }
    });
  });
  await chain;

  const finalDelta = {
    ok: stats.ok - statsAtLastCheckpoint.ok,
    skipped: stats.skipped - statsAtLastCheckpoint.skipped,
    failed: stats.failed - statsAtLastCheckpoint.failed,
  };
  if (finalDelta.ok || finalDelta.skipped || finalDelta.failed) {
    progress.stats = {
      ok: (progress.stats?.ok || 0) + finalDelta.ok,
      skipped: (progress.stats?.skipped || 0) + finalDelta.skipped,
      failed: (progress.stats?.failed || 0) + finalDelta.failed,
    };
  }
  saveProgress(progress);
  saveFailed(failed);
  logLine(`Done. ok=${stats.ok} skipped=${stats.skipped} failed=${stats.failed}`);
  logLine(`Progress: ${PROGRESS_PATH}`);
  logLine(`Failed: ${FAILED_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
