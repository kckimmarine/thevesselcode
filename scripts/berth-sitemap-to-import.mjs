#!/usr/bin/env node
/**
 * Parse cached Berth product sitemaps → berth-import JSON + optional plate downloads.
 */
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { codesMissingFromCatalog } from './lib/berth-sitemap-codes.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITEMAP_DIR = join(ROOT, 'public/data/berth/sitemaps');
const OUT_JSON = join(ROOT, 'public/data/berth/imports/berth-sitemap-master.json');
const PLATES_DIR = join(ROOT, 'public/data/plates');
const UA = 'Mozilla/5.0 TVC-Berth/1.0';
const PLATE_MAX_WIDTH = 800;
const PLATE_WEBP_QUALITY = 80;

function decodeXml(text) {
  return String(text || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .trim();
}

function parseSitemapFiles() {
  if (!existsSync(SITEMAP_DIR)) return [];
  const byCode = new Map();
  for (const file of readdirSync(SITEMAP_DIR).filter((f) => f.endsWith('.xml')).sort()) {
    const xml = readFileSync(join(SITEMAP_DIR, file), 'utf8');
    const urlBlocks = xml.split('<url>').slice(1);
    for (const block of urlBlocks) {
      const loc = block.match(/<loc>([^<]+)<\/loc>/i)?.[1] || '';
      const code = loc.match(/impa-code-(\d{6})/i)?.[1];
      if (!code) continue;
      const imageLoc = block.match(/<image:loc>([^<]+)<\/image:loc>/i)?.[1] || '';
      const imageTitle = block.match(/<image:title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/image:title>/i)?.[1] || '';
      const title = decodeXml(imageTitle).replace(new RegExp(`^${code}\\s*[–-]\\s*`, 'i'), '').trim();
      const image_url = imageLoc
        || `https://www.berthmarine.com/wp-content/uploads/2022/05/${code}.jpg`;
      byCode.set(code, {
        impa_code: code,
        item_name: title || `Marine stores item ${code}`,
        image_url,
        plate_key: code.replace(/[^a-zA-Z0-9._-]/g, '') || code,
        category: `Chapter ${code.slice(0, 2)}`,
        product_url: loc || `https://www.berthmarine.com/product/impa-code-${code}/`,
      });
    }
  }
  return [...byCode.values()].sort((a, b) => a.impa_code.localeCompare(b.impa_code));
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function downloadPlate(item, dryRun) {
  const key = item.plate_key || item.impa_code;
  const outPath = join(PLATES_DIR, `berth-${key}.webp`);
  if (existsSync(outPath)) return true;
  if (dryRun) return false;
  try {
    const res = await fetch(item.image_url, { headers: { 'User-Agent': UA, Accept: 'image/*' } });
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    mkdirSync(PLATES_DIR, { recursive: true });
    await sharp(buf)
      .resize({ width: PLATE_MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: PLATE_WEBP_QUALITY })
      .toFile(outPath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const newOnly = !process.argv.includes('--all-codes');
  const dryRun = process.argv.includes('--dry-run');
  const skipPlates = process.argv.includes('--skip-plates');
  const items = parseSitemapFiles();
  const work = newOnly ? codesMissingFromCatalog(ROOT, items.map((i) => i.impa_code)) : items.map((i) => i.impa_code);
  const workSet = new Set(work);
  const selected = items.filter((i) => workSet.has(i.impa_code));

  console.log(`Sitemap parsed ${items.length} items; import set ${selected.length} (${newOnly ? 'new only' : 'all'})`);

  let platesOk = 0;
  if (!skipPlates) {
    for (let i = 0; i < selected.length; i += 1) {
      const ok = await downloadPlate(selected[i], dryRun);
      if (ok) platesOk += 1;
      if ((i + 1) % 25 === 0) console.log(`plates ${i + 1}/${selected.length}`);
      await sleep(120);
    }
  }

  const payload = {
    source: 'berthmarine.com',
    category_slug: 'sitemap-master',
    category_name: 'Berth Marine sitemap import',
    scraped_at: new Date().toISOString(),
    item_count: selected.length,
    items: selected,
  };
  mkdirSync(dirname(OUT_JSON), { recursive: true });
  if (!dryRun) {
    writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2));
    console.log('WROTE', OUT_JSON);
  }
  console.log(`Plates saved/verified: ${platesOk}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
