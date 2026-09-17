import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.TVC_BASE || 'http://127.0.0.1:3000';

async function main() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof TVC_I18n !== 'undefined' && document.querySelector('.login-submit') && !document.querySelector('.login-submit').disabled, null, { timeout: 90000 });
    await page.fill('#loginUser', 'gfsm');
    await page.fill('#loginPass', '0000');
    await page.click('.login-submit');
    await page.waitForTimeout(4500);
    const shipName = await page.locator('#cmaxsShipName').textContent();
    const imo = await page.locator('#cmaxsShipCode').textContent();
    const tabs = await page.locator('#tabBar .tab-btn[data-tab]').allTextContents();
    const errors = [];
    if (String(shipName).includes('Fleet View')) errors.push(`ship name: ${shipName}`);
    if (String(imo).trim() === 'SM') errors.push(`imo artifact: ${imo}`);
    const order = tabs.map(t => t.replace(/\s+/g, ' ').trim());
    const certIdx = order.findIndex(t => /Certificate|증서/.test(t));
    const menuIdx = order.findIndex(t => /Menu|메뉴/.test(t));
    const pmsIdx = order.findIndex(t => /PMS/.test(t));
    if (menuIdx < 0 || certIdx < 0 || pmsIdx < 0 || !(menuIdx < certIdx && certIdx < pmsIdx)) {
        errors.push(`tab order: ${JSON.stringify(order)}`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    const mobileBrand = await page.evaluate(() => {
        const h = document.querySelector('.cmaxs-header .app-product-header');
        return h ? getComputedStyle(h, '::after').content : '';
    });
    if (!/SM Mode/.test(mobileBrand)) errors.push(`mobile brand: ${mobileBrand}`);
    await page.click('#mobileNavBtn');
    await page.waitForTimeout(400);
    const drawerCert = await page.locator('#tabBar .tab-btn[data-tab="certificates"]').textContent();
    if (!/Certificate|증서/.test(String(drawerCert))) errors.push(`drawer cert label: ${drawerCert}`);
    await page.click('#appLangToggleBtn');
    await page.waitForTimeout(500);
    const lang = await page.evaluate(() => document.documentElement.lang);
    const tabMenu = await page.locator('#tabBar .tab-btn[data-tab="menu"]').textContent();
    if (lang !== 'en') errors.push(`lang attr: ${lang}`);
    if (!/Menu/.test(String(tabMenu))) errors.push(`en menu tab: ${tabMenu}`);
    await browser.close();
    if (errors.length) {
        console.error('SM HEADER I18N TEST FAILED', errors);
        process.exit(1);
    }
    console.log('SM HEADER I18N TEST OK');
}

main().catch((e) => { console.error(e); process.exit(1); });
