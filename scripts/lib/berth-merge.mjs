/**
 * Multi-source merge: Space-Marine baseline + Berth Marine overlay.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeImpaCode, rowCode } from './impa-quality-gate.mjs';
import { derivePlateId } from './impa-scraper-schema.mjs';
import {
  berthItemToCompact,
  berthPlateFileExists,
  cleanBerthItemName,
} from './berth-to-compact.mjs';

function loadBerthImportFiles(root) {
  const dataDir = join(root, 'public', 'data');
  const paths = [];
  for (const f of readdirSync(dataDir)) {
    if (f.startsWith('berth-import-') && f.endsWith('.json')) {
      paths.push(join(dataDir, f));
    }
  }
  const berthDir = join(dataDir, 'berth', 'imports');
  if (existsSync(berthDir)) {
    for (const f of readdirSync(berthDir)) {
      if (f.endsWith('.json')) paths.push(join(berthDir, f));
    }
  }
  const items = [];
  for (const path of paths) {
    try {
      const payload = JSON.parse(readFileSync(path, 'utf8'));
      for (const row of payload.items || []) {
        if (row?.skipped || row?.error) continue;
        items.push(row);
      }
    } catch {
      /* skip corrupt import */
    }
  }
  return items;
}

function smPlateScore(row, platesDir) {
  const p = String(row?.p || row?.plate_id || '').trim();
  if (!p) return 0;
  if (berthPlateFileExists(p, platesDir)) return 3;
  if (/^berth-/i.test(p)) return 2;
  if (/\.(jpg|webp|png)$/i.test(p)) return 2;
  if (/^PL-\d{2}-\d{2}$/i.test(p)) return 1;
  return 1;
}

function enrichExistingRow(existing, berthCompact, platesDir) {
  const out = { ...existing };
  let touched = false;

  const berthPlate = berthCompact.p;
  if (berthPlate && berthPlateFileExists(berthPlate, platesDir)) {
    if (smPlateScore(existing, platesDir) < 2) {
      out.p = berthPlate;
      touched = true;
    }
  }

  const smName = String(existing.n || existing.name || '').trim();
  const berthName = String(berthCompact.n || '').trim();
  if (berthName.length > smName.length + 8) {
    out.n = berthName;
    touched = true;
  }

  const specs = {
    ...(existing.specs && typeof existing.specs === 'object' ? existing.specs : {}),
    ...(berthCompact.specs || {}),
  };
  specs.Source = specs.Source?.includes('Berth') ? specs.Source : 'Space-Marine + Berth Marine';
  out.specs = specs;
  if (berthCompact.specs) touched = true;

  if (!out.u && berthCompact.u) {
    out.u = berthCompact.u;
    touched = true;
  }
  if (!out.category && berthCompact.category) {
    out.category = berthCompact.category;
    touched = true;
  }

  return { row: out, enriched: touched };
}

/**
 * @param {Map<string, object>} byCode Space-Marine keyed rows
 * @returns {{ added: number, enriched: number, berthRows: number, skippedInvalid: number }}
 */
export function upsertBerthIntoCatalog(byCode, root) {
  const platesDir = join(root, 'public', 'data', 'plates');
  const berthItems = loadBerthImportFiles(root);
  let added = 0;
  let enriched = 0;
  let skippedInvalid = 0;

  for (const raw of berthItems) {
    const compact = berthItemToCompact(raw);
    if (!compact) {
      skippedInvalid += 1;
      continue;
    }
    const code = normalizeImpaCode(rowCode(compact));
    const existing = byCode.get(code);
    if (!existing) {
      if (!compact.p || !berthPlateFileExists(compact.p, platesDir)) {
        compact.p = derivePlateId(code) || compact.p || `berth-${code}`;
      }
      byCode.set(code, compact);
      added += 1;
      continue;
    }
    const { row, enriched: did } = enrichExistingRow(existing, compact, platesDir);
    byCode.set(code, row);
    if (did) enriched += 1;
  }

  return { added, enriched, berthRows: berthItems.length, skippedInvalid };
}

export { loadBerthImportFiles };
