#!/usr/bin/env node
/**
 * Paginate Berth Marine WP REST products → residual import JSON (catalog gaps only).
 * Uses product slug/title/excerpt for meaningful names (no sitemap placeholders).
 *
 *   node scripts/fetch-berth-wp-residual.mjs [--max-pages=491] [--merge]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { normalizeImpaCode, rowCode } from './lib/impa-quality-gate.mjs';
import { derivePlateId } from './lib/impa-scraper-schema.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public/data/berth/imports/berth-wp-residual.json');
const FULL_PATH = join(ROOT, 'public/data/impa-full.json');
const WP_PRODUCT_API = 'https://www.berthmarine.com/wp-json/wp/v2/product';
const WP_UA = 'Mozilla/5.0 (compatible; TVC-Berth-WP-Residual/1.0)';

const THIN_NAME_RE = /^(?:impa \d{6}|marine stores item \d{6})$/i;

function parseArgs(argv) {
  let maxPages = 0;
  let perPage = 100;
  let merge = false;
  for (const arg of argv) {
    if (arg.startsWith('--max-pages=')) maxPages = Math.max(0, Number(arg.slice(12)) || 0);
    if (arg.startsWith('--per-page=')) perPage = Math.min(100, Math.max(1, Number(arg.slice(11)) || 100));
    if (arg === '--merge') merge = true;
  }
  return { maxPages, perPage, merge };
}

function decodeHtmlEntities(text) {
  return String(text || '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .trim();
}

function codeFromSlug(slug) {
  const m = String(slug || '').match(/^impa-code-(\d{6})(?:-|$)/i);
  return m ? m[1] : '';
}

function nameFromWpProduct(row) {
  const excerpt = decodeHtmlEntities(String(row?.excerpt?.rendered || '').replace(/<[^>]+>/g, ' '));
  const fromExcerpt = excerpt.replace(/\s+/g, ' ').trim();
  if (fromExcerpt.length >= 3 && !/^impa code:/i.test(fromExcerpt)) return fromExcerpt;
  const title = decodeHtmlEntities(String(row?.title?.rendered || ''))
    .replace(/^Impa Code:\s*/i, '')
    .replace(/^\d{6}\s*[–-]\s*/i, '')
    .trim();
  return title.replace(/\s+/g, ' ').trim();
}

function loadCatalogCodes() {
  const have = new Set();
  if (!existsSync(FULL_PATH)) return have;
  const full = JSON.parse(readFileSync(FULL_PATH, 'utf8'));
  for (const row of full.items || []) {
    const code = normalizeImpaCode(rowCode(row));
    if (code) have.add(code);
  }
  return have;
}

function passesCandidate(row) {
  const code = normalizeImpaCode(row.impa_code);
  const name = String(row.item_name || '').trim();
  if (!code || !/^\d{6}$/.test(code)) return false;
  if (!name || name.length < 3) return false;
  if (THIN_NAME_RE.test(name)) return false;
  if (!row.plate_key && !derivePlateId(code)) return false;
  return true;
}

async function fetchPage(page, perPage, attempt = 0) {
  const url = `${WP_PRODUCT_API}?per_page=${perPage}&page=${page}&_fields=slug,title,excerpt,link`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': WP_UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(90_000),
    });
    if (res.status === 400) return { rows: [], totalPages: 0 };
    if (!res.ok) throw new Error(`WP HTTP ${res.status} page ${page}`);
    const totalPages = Number(res.headers.get('x-wp-totalpages') || 0);
    const rows = await res.json();
    return { rows: Array.isArray(rows) ? rows : [], totalPages };
  } catch (err) {
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      return fetchPage(page, perPage, attempt + 1);
    }
    console.warn(`SKIP page ${page}: ${err.message}`);
    return { rows: [], totalPages: 0 };
  }
}

function runNode(script, args = []) {
  const r = spawnSync('node', [script, ...args], { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const catalog = loadCatalogCodes();
  const before = catalog.size;
  console.log(`Catalog baseline: ${before} codes`);

  const { rows: probe, totalPages } = await fetchPage(1, opts.perPage);
  const pages = opts.maxPages > 0 ? Math.min(opts.maxPages, totalPages) : totalPages;
  console.log(`WP products: ~${totalPages} pages (${opts.perPage}/page), scanning ${pages} pages`);

  const byCode = new Map();
  let scanned = 0;

  async function consume(rows) {
    for (const row of rows) {
      const code = codeFromSlug(row.slug);
      if (!code || catalog.has(code) || byCode.has(code)) continue;
      const item_name = nameFromWpProduct(row);
      const candidate = {
        impa_code: code,
        item_name,
        product_url: row.link || `https://www.berthmarine.com/product/${row.slug}/`,
        plate_key: code,
        chapter: code.slice(0, 2),
        category: `Chapter ${code.slice(0, 2)}`,
        image_url: `https://www.berthmarine.com/wp-content/uploads/2022/05/${code}.jpg`,
      };
      if (passesCandidate(candidate)) byCode.set(code, candidate);
    }
  }

  await consume(probe);
  scanned += 1;

  for (let page = 2; page <= pages; page += 1) {
    const { rows } = await fetchPage(page, opts.perPage);
    await consume(rows);
    scanned += 1;
    if (page % 10 === 0 || page === pages) {
      console.log(`Page ${page}/${pages} — residual candidates ${byCode.size}`);
    }
  }

  const items = [...byCode.values()].sort((a, b) => a.impa_code.localeCompare(b.impa_code));
  const payload = {
    source: 'berthmarine.com',
    category_slug: 'wp-residual',
    category_name: 'Berth WP REST residual',
    scraped_at: new Date().toISOString(),
    item_count: items.length,
    items,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n');
  console.log(`WROTE ${OUT} (${items.length} new candidates)`);

  if (opts.merge) {
    runNode('scripts/merge-impa-chapters.mjs');
    runNode('scripts/generate-impa-seo-index.mjs');
    runNode('scripts/generate-sitemap.mjs');
    const after = JSON.parse(readFileSync(FULL_PATH, 'utf8')).count;
    console.log('\n=== WP residual ingest ===');
    console.log(`Previous: ${before}`);
    console.log(`New total: ${after}`);
    console.log(`Delta: +${after - before}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
