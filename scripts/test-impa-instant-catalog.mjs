/**
 * Verify IMPA toolkit paints catalog rows without blocking "Loading catalog…"
 * Run: TVC_BASE_URL=http://127.0.0.1:4317 node scripts/test-impa-instant-catalog.mjs
 */
import { chromium } from '@playwright/test';
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FULL_SRC = join(ROOT, 'public/data/impa-full.json');
const FULL_DEST = join(ROOT, 'data/impa-full.json');
if (existsSync(FULL_SRC)) {
  mkdirSync(dirname(FULL_DEST), { recursive: true });
  copyFileSync(FULL_SRC, FULL_DEST);
}

const BASE = process.env.TVC_BASE_URL || 'http://127.0.0.1:4317';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const results = [];

  await page.goto(`${BASE}/toolkit`, { waitUntil: 'load' });

  await page.locator('#impaTableContainer .store-vl-head').waitFor({ state: 'visible', timeout: 15_000 });
  await page.locator('#impaTableContainer .store-vl-row').first().waitFor({ state: 'visible', timeout: 5_000 });

  const rowCount = await page.locator('#impaTableContainer .store-vl-row').count();
  const loading = await page.locator('.store-loading').count();
  const pageSize = await page.locator('#impaPageSizeSelect').inputValue().catch(() => '');

  results.push({ check: 'no blocking loading text', ok: loading === 0 });
  results.push({ check: 'table header painted', ok: await page.locator('#impaTableContainer .store-vl-head').isVisible() });
  results.push({ check: 'first page rows (13 default)', ok: rowCount === 13, detail: rowCount });
  results.push({ check: 'public page size default 13', ok: pageSize === '13', detail: pageSize });
  results.push({
    check: 'pagination bar visible for seed catalog',
    ok: await page.locator('#impaPagination').isVisible(),
  });

  const failed = results.filter((r) => !r.ok);
  console.log(JSON.stringify({ passed: results.length - failed.length, total: results.length, results }, null, 2));
  await browser.close();
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
