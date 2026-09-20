#!/usr/bin/env node
/** IMPA detail commerce badges + Fast RFQ modal smoke test */
import { chromium } from '@playwright/test';
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ART = '/opt/cursor/artifacts';
const FULL_SRC = join(ROOT, 'public/data/impa-full.json');
const FULL_DEST = join(ROOT, 'data/impa-full.json');
if (existsSync(FULL_SRC)) {
  mkdirSync(dirname(FULL_DEST), { recursive: true });
  copyFileSync(FULL_SRC, FULL_DEST);
}
mkdirSync(ART, { recursive: true });

const BASE = process.env.TVC_BASE_URL || 'http://127.0.0.1:3000';

function check(name, ok, detail = '') {
  console.log(ok ? 'OK' : 'FAIL', name, detail ? `— ${detail}` : '');
  if (!ok) process.exitCode = 1;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

await page.goto(`${BASE}/toolkit.html`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
for (let i = 0; i < 48; i += 1) {
  const total = await page.evaluate(() => (typeof TVC_StoreManager !== 'undefined' ? TVC_StoreManager.getTotalCount() : 0));
  if (total > 50000) break;
  await page.waitForTimeout(3000);
}

await page.evaluate(async () => {
  const item = await TVC_StoreManager.getItemByCode('750231');
  if (!item?.land_compat_name) throw new Error('750231 missing land_compat_name in catalog');
  TVC_StoreMenu.openImpaDetailModal(item);
});
await page.locator('#impaDetailModal').waitFor({ state: 'visible', timeout: 30_000 });

const trust = await page.locator('#impaDetailTrustHeader').innerText();
check('superintendent verified badge', /1st Class Superintendent Verified/i.test(trust));
check('land compat badge on valve', /Land\/Plant Compatible.*50A/i.test(trust));

const stock = await page.locator('#impaDetailStockSla').innerText();
check('stock hub copy', /Busan Logistics Hub/i.test(stock));
check('delivery SLA copy', /24~48h Direct Port Delivery/i.test(stock));

const overflow = await page.evaluate(() => {
  const box = document.querySelector('.impa-detail-box');
  if (!box) return true;
  return box.scrollWidth <= window.innerWidth + 2;
});
check('390px modal no horizontal overflow', overflow);

await page.locator('#btn-modal-rfq').click();
await page.locator('#impaFastRfqModal').waitFor({ state: 'visible' });
const itemVal = await page.locator('#impaFastRfqItem').inputValue();
check('RFQ item prefilled', itemVal.includes('750231') && /50A|Globe/i.test(itemVal));

await page.screenshot({ path: join(ART, 'impa-commerce-390-rfq-modal.png'), fullPage: false });
await browser.close();

if (process.exitCode) {
  console.error('\nIMPA commerce conversion tests FAILED');
  process.exit(1);
}
console.log('\nIMPA commerce conversion tests passed.');
