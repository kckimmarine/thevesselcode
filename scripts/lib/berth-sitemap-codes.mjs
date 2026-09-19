import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeImpaCode, rowCode } from './impa-quality-gate.mjs';

export function loadBerthSitemapCodes(root) {
  const path = join(root, 'public/data/berth/sitemap-codes.json');
  if (!existsSync(path)) return [];
  const payload = JSON.parse(readFileSync(path, 'utf8'));
  return payload.codes || [];
}

export function writeBerthWorklist(root, codes, label = 'worklist') {
  const out = join(root, 'public/data/berth', `${label}.json`);
  mkdirSync(join(root, 'public/data/berth'), { recursive: true });
  writeFileSync(out, JSON.stringify({
    generated_at: new Date().toISOString(),
    count: codes.length,
    codes,
  }, null, 2) + '\n');
  return out;
}

export function codesMissingFromCatalog(root, berthCodes) {
  const fullPath = join(root, 'public/data/impa-full.json');
  const have = new Set();
  if (existsSync(fullPath)) {
    const full = JSON.parse(readFileSync(fullPath, 'utf8'));
    for (const row of full.items || []) {
      const code = normalizeImpaCode(rowCode(row));
      if (code) have.add(code);
    }
  }
  return berthCodes.filter((c) => !have.has(String(c).padStart(6, '0')));
}
