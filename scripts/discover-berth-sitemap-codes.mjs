#!/usr/bin/env node
/**
 * Discover all IMPA product codes from Berth Marine Yoast product sitemaps.
 * Output: public/data/berth/sitemap-codes.json
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public/data/berth/sitemap-codes.json');
const UA = 'Mozilla/5.0 (compatible; TVC-Berth-Discover/1.0)';

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

async function main() {
  const codes = new Set();
  for (let i = 1; i <= 10; i += 1) {
    const url = `https://www.berthmarine.com/product-sitemap${i}.xml`;
    try {
      const xml = await fetchText(url);
      for (const m of xml.matchAll(/impa-code-(\d{6})/g)) codes.add(m[1]);
      console.log('OK', url, 'total', codes.size);
    } catch (err) {
      if (i === 1) throw err;
      break;
    }
  }
  const list = [...codes].sort();
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({
    source: 'berthmarine.com',
    discovered_at: new Date().toISOString(),
    count: list.length,
    codes: list,
  }, null, 2) + '\n');
  console.log(`Wrote ${list.length} codes → ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
