#!/usr/bin/env node
/**
 * Merge public/data/chapters/*.json + data/impa-catalog.json → public/data/impa-full.json
 * Overlay Berth Marine imports (enrich existing + insert new codes).
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  filterQualityItems,
  normalizeImpaCode,
  rowCode,
} from './lib/impa-quality-gate.mjs';
import { upsertBerthIntoCatalog } from './lib/berth-merge.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CHAPTERS_DIR = join(ROOT, 'public/data/chapters');
const SEED_PATH = join(ROOT, 'data/impa-catalog.json');
const OUT_PATH = join(ROOT, 'public/data/impa-full.json');

function loadRows(path) {
  if (!existsSync(path)) return [];
  const data = JSON.parse(readFileSync(path, 'utf8'));
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function main() {
  const byCode = new Map();
  const chapters = [];
  const rawRows = [];

  for (const row of loadRows(SEED_PATH)) {
    rawRows.push(row);
  }

  if (existsSync(CHAPTERS_DIR)) {
    for (const file of readdirSync(CHAPTERS_DIR).sort()) {
      const m = /^impa-(\d{2})\.json$/.exec(file);
      if (!m) continue;
      chapters.push(m[1]);
      for (const row of loadRows(join(CHAPTERS_DIR, file))) {
        rawRows.push(row);
      }
    }
  }

  for (const row of rawRows) {
    const code = normalizeImpaCode(rowCode(row));
    if (!code) continue;
    byCode.set(code, row);
  }

  const smCount = byCode.size;
  const berthStats = upsertBerthIntoCatalog(byCode, ROOT);

  const merged = [...byCode.values()];
  const { kept, rejected } = filterQualityItems(merged);
  if (rejected.length) {
    console.warn(`Quality gate rejected ${rejected.length} row(s) (sample):`, rejected.slice(0, 5));
  }

  const items = kept.sort((a, b) => rowCode(a).localeCompare(rowCode(b)));
  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(
    OUT_PATH,
    JSON.stringify({
      generated_at: new Date().toISOString(),
      chapters,
      count: items.length,
      merge_stats: {
        space_marine_baseline: smCount,
        berth_rows_ingested: berthStats.berthRows,
        berth_added: berthStats.added,
        berth_enriched: berthStats.enriched,
        berth_skipped_invalid: berthStats.skippedInvalid,
        quality_rejected: rejected.length,
      },
      items,
    }, null, 2) + '\n',
    'utf8',
  );
  console.log(
    `Merged ${items.length} catalog items (${chapters.length} SM chapters) → public/data/impa-full.json`,
  );
  console.log(
    `Berth overlay: +${berthStats.added} new, ${berthStats.enriched} enriched `
    + `(SM baseline ${smCount}, berth rows ${berthStats.berthRows})`,
  );
}

main();
