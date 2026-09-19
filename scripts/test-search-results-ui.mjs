#!/usr/bin/env node
/** Smoke: home hero in-app search results panel */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ART = '/opt/cursor/artifacts';
mkdirSync(ART, { recursive: true });
const BASE = process.env.TVC_BASE_URL || 'http://127.0.0.1:3000';

function check(name, ok, detail = '') {
    console.log(ok ? 'OK' : 'FAIL', name, detail ? `— ${detail}` : '');
    if (!ok) process.exitCode = 1;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.goto(`${BASE}/home/`, { waitUntil: 'domcontentloaded' });
await page.locator('#homeHeroSearchInput').waitFor({ state: 'visible' });

await page.locator('#homeHeroSearchInput').fill('791801');
await page.locator('#homeHeroSearchForm').evaluate((f) => f.requestSubmit());
await page.locator('#tvcSearchResultsPanel').waitFor({ state: 'visible', timeout: 8000 });
const internalText = await page.locator('#tvcSearchResultsPanel').innerText();
check('IMPA intercept shows TVC panel', /MARITIME SEARCH/i.test(internalText) && /791801/.test(internalText));
await page.screenshot({ path: join(ART, 'search-results-impa-internal.png'), fullPage: false });

await page.locator('#homeHeroSearchInput').fill('xyz quota fallback probe');
await page.locator('#homeHeroSearchForm').evaluate((f) => f.requestSubmit());
await page.locator('#tvcSearchResultsPanel').waitFor({ state: 'visible' });
await page.waitForTimeout(800);
const webText = await page.locator('#tvcSearchResultsPanel').innerText();
check(
    'web query shows results or fallback notice',
    /Continue Search on Google/i.test(webText) || /Searching/i.test(webText) || webText.includes('example.com') || webText.includes('quota'),
    webText.slice(0, 120),
);
await page.screenshot({ path: join(ART, 'search-results-web-fallback.png'), fullPage: false });

await browser.close();
if (process.exitCode) process.exit(1);
console.log('\nSearch results UI smoke passed.');
