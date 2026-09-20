#!/usr/bin/env node
/** Single direct-answer search verification (812101 + Brain briefing) */
import { chromium } from '@playwright/test';
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
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
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.goto(`${BASE}/toolkit.html`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
await page.locator('.store-search').waitFor({ state: 'visible', timeout: 120_000 });
for (let i = 0; i < 24; i += 1) {
    const ready = await page.evaluate(() => (globalThis.TVC_StoreManager?.getTotalCount?.() || 0) > 1000);
    if (ready) break;
    await page.waitForTimeout(5000);
}
await page.locator('.store-search').fill('812101');
await page.locator('.store-search').press('Enter');
await page.locator('#impaDetailModal').waitFor({ state: 'visible', timeout: 30_000 });
const badge = (await page.locator('#impaDetailBadge').textContent()) || '';
const listRows = await page.locator('.store-public-table tbody tr').count().catch(() => 0);
check('812101 opens IMPA detail modal', badge.includes('812101'), badge.trim());
check('812101 skips multi-row catalog list', listRows <= 1, `rows=${listRows}`);
await page.screenshot({ path: join(ART, 'direct-search-812101-modal.png'), fullPage: false });

await page.locator('#modalCloseBtn').click().catch(() => {});
await page.goto(`${BASE}/home/`, { waitUntil: 'domcontentloaded' });
await page.locator('#homeHeroSearchInput').waitFor({ state: 'visible' });
await page.locator('#homeHeroSearchInput').fill('Yanmar 6N21L RPM 헌팅');
await page.locator('#homeHeroSearchForm').evaluate((f) => f.requestSubmit());
await page.locator('#tvcSearchResultsPanel').waitFor({ state: 'visible', timeout: 15_000 });
const panelText = await page.locator('#tvcSearchResultsPanel').innerText();
check(
    'Yanmar hunting shows in-page TVC search panel (not Brain auto-open)',
    /MARITIME INTEL/i.test(panelText) && /Yanmar/i.test(panelText),
    panelText.slice(0, 160),
);
const brainAuto = await page.locator('#modal-tvc-brain').isVisible().catch(() => false);
check('Yanmar submit does not auto-open Brain modal', !brainAuto);
await page.waitForTimeout(1500);
await page.screenshot({ path: join(ART, 'direct-search-home-inline-panel.png'), fullPage: false });
await browser.close();

if (process.exitCode) {
    console.error('\nDirect search flow tests FAILED');
    process.exit(1);
}
console.log('\nDirect search flow tests passed.');
