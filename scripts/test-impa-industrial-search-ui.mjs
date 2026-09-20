#!/usr/bin/env node
/** Toolkit catalog search: JIS 10K 50A → globe valve without IMPA code */
import { chromium } from '@playwright/test';
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FULL_SRC = join(ROOT, 'public/data/impa-full.json');
const FULL_DEST = join(ROOT, 'data/impa-full.json');
if (existsSync(FULL_SRC)) {
  mkdirSync(dirname(FULL_DEST), { recursive: true });
  copyFileSync(FULL_SRC, FULL_DEST);
}
const ART = '/opt/cursor/artifacts';
const BASE = process.env.TVC_BASE_URL || 'http://127.0.0.1:3000';

function check(name, ok, detail = '') {
  console.log(ok ? 'OK' : 'FAIL', name, detail ? `— ${detail}` : '');
  if (!ok) process.exitCode = 1;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.goto(`${BASE}/toolkit.html`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
await page.locator('.store-search').waitFor({ state: 'visible', timeout: 120_000 });
for (let i = 0; i < 48; i += 1) {
  const stats = await page.evaluate(() => ({
    total: typeof TVC_StoreManager !== 'undefined' ? TVC_StoreManager.getTotalCount() : 0,
    mem: typeof TVC_StoreManager !== 'undefined' ? TVC_StoreManager.isMemorySearchReady() : false,
  }));
  if (stats.total > 50000 && stats.mem) break;
  await page.waitForTimeout(5000);
}

const preload = await page.evaluate(async () => {
  const total = TVC_StoreManager.getTotalCount();
  const item = await TVC_StoreManager.getItemByCode('750231');
  const probe = await TVC_StoreManager.searchCatalog('Globe Valve JIS 10K 50A', { limit: 5 });
  return {
    total,
    mem: TVC_StoreManager.isMemorySearchReady(),
    itemLand: item?.land_compat_name,
    itemSearchLower: item?.industrial_search_lower,
    probeCount: probe?.items?.length,
    lastEngine: probe?.engine,
  };
});
console.log('preload', preload);

const rows = await page.evaluate(async () => {
  await TVC_StoreManager.searchCatalog('JIS 10K 50A', { limit: 500 });
  const items = TVC_StoreManager.getLastSearch()?.items || [];
  return items.map((r) => ({
    code: r.impa_code || r.code,
    name: r.name,
  }));
});

check('JIS 10K 50A returns hits', rows.length > 0, `count=${rows.length}`);
check(
  'includes 750231 globe valve 50mm',
  rows.some((r) => r.code === '750231' && /globe valve/i.test(r.name)),
  rows.slice(0, 8).map((r) => r.code).join(','),
);

await page.screenshot({ path: join(ART, 'impa-search-jis-10k-50a.png'), fullPage: false });
await browser.close();

if (process.exitCode) {
  console.error('\nIMPA industrial search UI tests FAILED');
  process.exit(1);
}
console.log('\nIMPA industrial search UI tests passed.');
