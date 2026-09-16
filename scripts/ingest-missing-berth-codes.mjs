#!/usr/bin/env node
/**
 * Ingest Berth Marine IMPA codes present in sitemap discovery but missing from impa-full.json.
 * Writes public/data/berth/imports/berth-gap-ingest.json (does not overwrite master import).
 *
 *   node scripts/ingest-missing-berth-codes.mjs [--merge]
 *   node scripts/ingest-missing-berth-codes.mjs --scrape --batch=80
 *   node scripts/ingest-missing-berth-codes.mjs --no-wp-api --scrape
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { codesMissingFromCatalog, loadBerthSitemapCodes, writeBerthWorklist } from './lib/berth-sitemap-codes.mjs';
import { normalizeImpaCode } from './lib/impa-quality-gate.mjs';
import { derivePlateId } from './lib/impa-scraper-schema.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SITEMAP_DIR = join(ROOT, 'public/data/berth/sitemaps');
const GAP_IMPORT = join(ROOT, 'public/data/berth/imports/berth-gap-ingest.json');
const GAP_WORKLIST = join(ROOT, 'public/data/berth/gap-worklist.json');
const FULL_PATH = join(ROOT, 'public/data/impa-full.json');
const WP_PRODUCT_API = 'https://www.berthmarine.com/wp-json/wp/v2/product';
const WP_UA = 'Mozilla/5.0 (compatible; TVC-Berth-Gap/1.0)';

function parseArgs(argv) {
  let batch = 80;
  let delayMs = 1100;
  for (const arg of argv) {
    if (arg.startsWith('--batch=')) batch = Math.max(1, Number(arg.slice('--batch='.length)) || 80);
    if (arg.startsWith('--delay=')) delayMs = Math.max(350, Number(arg.slice('--delay='.length)) || 1100);
  }
  return {
    scrape: argv.includes('--scrape'),
    wpApi: !argv.includes('--no-wp-api'),
    merge: argv.includes('--merge') || !argv.includes('--no-merge'),
    incrementalMerge: argv.includes('--incremental-merge'),
    dryRun: argv.includes('--dry-run'),
    batch,
    delayMs,
  };
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

function nameFromWpProduct(row) {
  const excerpt = decodeHtmlEntities(String(row?.excerpt?.rendered || '').replace(/<[^>]+>/g, ' '));
  const fromExcerpt = excerpt.replace(/\s+/g, ' ').trim();
  if (fromExcerpt.length >= 3 && !/^impa code:/i.test(fromExcerpt)) return fromExcerpt;
  const title = decodeHtmlEntities(String(row?.title?.rendered || ''))
    .replace(/^Impa Code:\s*/i, '')
    .trim();
  return title;
}

async function fetchWpProductBySlug(code) {
  const slug = `impa-code-${code}`;
  const url = `${WP_PRODUCT_API}?slug=${encodeURIComponent(slug)}`;
  const res = await fetch(url, { headers: { 'User-Agent': WP_UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`WP API HTTP ${res.status} (${slug})`);
  const rows = await res.json();
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return null;
  const item_name = nameFromWpProduct(row);
  return {
    impa_code: code,
    item_name,
    product_url: row.link || `https://www.berthmarine.com/product/${slug}/`,
    plate_key: code,
    chapter: code.slice(0, 2),
    category: `Chapter ${code.slice(0, 2)}`,
    image_url: `https://www.berthmarine.com/wp-content/uploads/2022/05/${code}.jpg`,
  };
}

async function fetchWpProductsForMissing(missingList) {
  const found = new Map();
  const codes = [...new Set(missingList.map((c) => normalizeImpaCode(c)).filter(Boolean))];
  const concurrency = 8;
  let done = 0;
  for (let i = 0; i < codes.length; i += concurrency) {
    const slice = codes.slice(i, i + concurrency);
    const rows = await Promise.all(slice.map((code) => fetchWpProductBySlug(code).catch(() => null)));
    for (const row of rows) {
      if (row?.impa_code) found.set(row.impa_code, row);
    }
    done += slice.length;
    if (done % 80 === 0 || done === codes.length) {
      console.log(`WP API slug lookup ${done}/${codes.length} — resolved ${found.size}`);
    }
    await new Promise((r) => setTimeout(r, 80));
  }
  return found;
}

function decodeXml(text) {
  return String(text || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .trim();
}

function sitemapItemsForCodes(codeSet) {
  const items = [];
  if (!existsSync(SITEMAP_DIR)) return items;
  for (const file of readdirSync(SITEMAP_DIR).filter((f) => f.endsWith('.xml')).sort()) {
    const xml = readFileSync(join(SITEMAP_DIR, file), 'utf8');
    for (const block of xml.split('<url>').slice(1)) {
      const loc = block.match(/<loc>([^<]+)<\/loc>/i)?.[1] || '';
      const code = loc.match(/impa-code-(\d{6})/i)?.[1];
      if (!code || !codeSet.has(code)) continue;
      const imageLoc = block.match(/<image:loc>([^<]+)<\/image:loc>/i)?.[1] || '';
      const imageTitle = block.match(/<image:title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/image:title>/i)?.[1] || '';
      const title = decodeXml(imageTitle).replace(new RegExp(`^${code}\\s*[–-]\\s*`, 'i'), '').trim();
      items.push({
        impa_code: code,
        item_name: title || '',
        image_url: imageLoc || `https://www.berthmarine.com/wp-content/uploads/2022/05/${code}.jpg`,
        plate_key: code,
        category: `Chapter ${code.slice(0, 2)}`,
        product_url: loc || `https://www.berthmarine.com/product/impa-code-${code}/`,
      });
    }
  }
  return items;
}

function runNode(script, args = []) {
  const r = spawnSync('node', [script, ...args], { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function catalogCount() {
  if (!existsSync(FULL_PATH)) return 0;
  const full = JSON.parse(readFileSync(FULL_PATH, 'utf8'));
  return Number(full.count) || (full.items || []).length;
}

function alreadyScrapedCodeSet() {
  const scraped = new Set();
  const importsDir = join(ROOT, 'public/data/berth/imports');
  if (!existsSync(importsDir)) return scraped;
  for (const f of readdirSync(importsDir).filter((file) => /^codes-batch-\d+-\d+\.json$/.test(file))) {
    const payload = JSON.parse(readFileSync(join(importsDir, f), 'utf8'));
    for (const row of payload.items || []) {
      if (row.skipped || row.error) continue;
      const code = normalizeImpaCode(row.impa_code);
      const name = String(row.item_name || '').trim();
      if (code && name.length >= 3 && !/^Marine stores item \d{6}$/i.test(name)) scraped.add(code);
    }
  }
  return scraped;
}

function loadScrapedItemsForCodes(missingSet) {
  const importsDir = join(ROOT, 'public/data/berth/imports');
  const rows = [];
  if (!existsSync(importsDir)) return rows;
  for (const f of readdirSync(importsDir).filter((file) => /^codes-batch-\d+-\d+\.json$/.test(file))) {
    const payload = JSON.parse(readFileSync(join(importsDir, f), 'utf8'));
    for (const row of payload.items || []) {
      if (row.skipped || row.error) continue;
      const code = normalizeImpaCode(row.impa_code);
      if (!code || !missingSet.has(code)) continue;
      rows.push(row);
    }
  }
  return rows;
}

function scrapeMissingInBatches(missing, batchSize, delayMs = 1100, incrementalMerge = false) {
  const scraped = alreadyScrapedCodeSet();
  const pending = missing.filter((c) => !scraped.has(normalizeImpaCode(c)));
  console.log(`Scrape pending: ${pending.length} (${scraped.size} already in batch imports)`);
  writeBerthWorklist(ROOT, pending, 'gap-worklist');
  const relWorklist = 'public/data/berth/gap-worklist.json';
  for (let offset = 0; offset < pending.length; offset += batchSize) {
    const slice = pending.slice(offset, offset + batchSize);
    console.log(`\n--- Scrape batch offset ${offset} (${slice.length} codes) ---`);
    runNode('scripts/scrape-berthmarine.mjs', [
      `--codes-file=${relWorklist}`,
      `--batch=${slice.length}`,
      `--offset=${offset}`,
      `--delay=${delayMs}`,
      '--skip-download',
    ]);
    if (incrementalMerge) {
      runNode('scripts/merge-impa-chapters.mjs');
    }
  }
}

function passesGapQuality(row) {
  const code = normalizeImpaCode(row.impa_code);
  const name = String(row.item_name || '').trim();
  if (!code) return false;
  if (!name || name.length < 3) return false;
  if (/^Marine stores item \d{6}$/i.test(name)) return false;
  if (/^IMPA \d{6}$/.test(name)) return false;
  if (!row.plate_key && !derivePlateId(code)) return false;
  return true;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const before = catalogCount();
  const sitemapCodes = loadBerthSitemapCodes(ROOT);
  const missing = codesMissingFromCatalog(ROOT, sitemapCodes);
  console.log(`Catalog baseline: ${before}`);
  console.log(`Berth sitemap codes: ${sitemapCodes.length}`);
  console.log(`Missing from catalog: ${missing.length}`);
  if (!missing.length) {
    console.log('No gap codes to ingest.');
    if (opts.merge) {
      runNode('scripts/generate-impa-seo-index.mjs');
      runNode('scripts/generate-sitemap.mjs');
    }
    return;
  }
  if (missing.length <= 32) {
    console.log('Gap codes:', missing.join(', '));
  } else {
    console.log('Gap sample:', missing.slice(0, 12).join(', '), '…');
  }

  const missingSet = new Set(missing.map((c) => normalizeImpaCode(c)).filter(Boolean));
  const byCode = new Map(sitemapItemsForCodes(missingSet).map((i) => [i.impa_code, i]));

  if (opts.wpApi) {
    try {
      const wpRows = await fetchWpProductsForMissing(missing);
      for (const [code, row] of wpRows) {
        byCode.set(code, { ...byCode.get(code), ...row });
      }
    } catch (err) {
      console.warn('WP API gap fetch failed:', err.message);
      if (!opts.scrape) {
        console.error('Re-run with --scrape or fix network access to Berth Marine WP API');
        process.exit(1);
      }
    }
  }

  if (opts.scrape) {
    if (missing.length > 24) {
      scrapeMissingInBatches(missing, opts.batch, opts.delayMs, opts.incrementalMerge);
    } else {
      runNode('scripts/scrape-berthmarine.mjs', [`--codes=${missing.join(',')}`, '--skip-download']);
    }
    for (const row of loadScrapedItemsForCodes(missingSet)) {
      const code = normalizeImpaCode(row.impa_code);
      const name = String(row.item_name || '').trim();
      if (name.length >= 3) {
        byCode.set(code, { ...byCode.get(code), ...row, item_name: name });
      }
    }
  }

  const items = [...byCode.values()].filter(passesGapQuality);

  console.log(`Quality-pass gap items: ${items.length}`);
  if (!items.length) {
    console.error('No ingestable items after quality filter — run with --scrape or check WP API');
    process.exit(1);
  }

  const payload = {
    source: 'berthmarine.com',
    category_slug: 'gap-ingest',
    category_name: 'Berth sitemap gap',
    scraped_at: new Date().toISOString(),
    item_count: items.length,
    items,
  };

  if (opts.dryRun) {
    console.log('DRY-RUN would write', GAP_IMPORT, 'items', items.length);
    return;
  }

  mkdirSync(dirname(GAP_IMPORT), { recursive: true });
  writeFileSync(GAP_IMPORT, JSON.stringify(payload, null, 2) + '\n');
  console.log('WROTE', GAP_IMPORT);

  if (opts.merge) {
    runNode('scripts/merge-impa-chapters.mjs');
    runNode('scripts/generate-impa-seo-index.mjs');
    runNode('scripts/generate-sitemap.mjs');
    const after = catalogCount();
    console.log('\n=== Ingest summary ===');
    console.log(`Previous: ${before}`);
    console.log(`New total: ${after}`);
    console.log(`Delta: +${after - before}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
