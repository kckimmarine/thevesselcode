#!/usr/bin/env node
/**
 * Download Berth Marine product sitemap XML files for offline parsing (rate-limit friendly).
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public/data/berth/sitemaps');
const UA = 'Mozilla/5.0 (compatible; TVC-Berth-Sitemap/1.0)';

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function fetchText(url, attempt = 0) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (res.status === 429 && attempt < 6) {
    const wait = 3000 * (attempt + 1);
    console.warn('RATE LIMIT', url, `wait ${wait}ms`);
    await sleep(wait);
    return fetchText(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  let saved = 0;
  for (let i = 1; i <= 15; i += 1) {
    const url = `https://www.berthmarine.com/product-sitemap${i}.xml`;
    const out = join(OUT_DIR, `product-sitemap${i}.xml`);
    if (existsSync(out) && process.argv.includes('--skip-existing')) {
      console.log('SKIP', out);
      saved += 1;
      continue;
    }
    try {
      const xml = await fetchText(url);
      writeFileSync(out, xml);
      saved += 1;
      console.log('OK', out, `(${xml.length} bytes)`);
      await sleep(2500);
    } catch (err) {
      console.warn('STOP at', url, err.message);
      break;
    }
  }
  console.log(`Saved ${saved} sitemap file(s) under ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
