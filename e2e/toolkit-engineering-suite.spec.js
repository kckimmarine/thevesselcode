/**
 * Maritime Toolkit — 5-phase engineering modules + unified search (E2E).
 */
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const SCREEN_DIR = path.join(__dirname, '..', 'artifacts', 'screenshots');
const SCREEN_MIRROR = '/opt/cursor/artifacts/screenshots';

const BENIGN_CONSOLE = [
    /favicon/i,
    /Failed to load resource.*favicon/i,
    /net::ERR_BLOCKED_BY_CLIENT/i,
];

test.describe.configure({ mode: 'serial' });

function ensureDirs() {
    fs.mkdirSync(SCREEN_DIR, { recursive: true });
    fs.mkdirSync(SCREEN_MIRROR, { recursive: true });
}

async function capture(page, filename) {
    ensureDirs();
    const dest = path.join(SCREEN_DIR, filename);
    await page.screenshot({ path: dest, fullPage: false });
    try {
        fs.copyFileSync(dest, path.join(SCREEN_MIRROR, filename));
    } catch {
        /* mirror optional */
    }
    return dest;
}

const ALLOWED_404 = [
    /\/data\/impa-catalog\.json$/,
    /\/data\/market-indices\.json$/,
];

function attachConsoleGuards(page, bucket) {
    page.on('response', (response) => {
        if (response.status() !== 404) return;
        const url = response.url();
        if (ALLOWED_404.some((re) => re.test(url))) return;
        bucket.push(`404: ${url}`);
    });
    page.on('console', (msg) => {
        if (msg.type() !== 'error') return;
        const text = msg.text();
        if (BENIGN_CONSOLE.some((re) => re.test(text))) return;
        if (/Failed to load resource.*404/.test(text)) return;
        bucket.push(`console: ${text}`);
    });
    page.on('pageerror', (err) => {
        bucket.push(`pageerror: ${err.message}`);
    });
}

function assertNoConsoleErrors(bucket, label) {
    expect(bucket, `${label} console errors:\n${bucket.join('\n')}`).toEqual([]);
}

async function gotoToolkit(page) {
    await page.goto('/toolkit', { waitUntil: 'networkidle' });
    await expect(page.locator('#mktEngSearchInput')).toBeVisible();
    await expect(page.locator('#storePublicToolkit')).toBeVisible();
}

async function clickToolTab(page, tabId) {
    await page.locator(`[data-tool-tab="${tabId}"]`).click();
    await expect(page.locator(`[data-tool-tab="${tabId}"]`)).toHaveClass(/active/);
    await expect(page.locator(`[data-tool-panel="${tabId}"]:not(.hidden)`)).toBeVisible();
}

test.describe('Maritime Engineering Toolkit suite', () => {
    let consoleErrors = [];

    test.beforeEach(async ({ page }) => {
        consoleErrors = [];
        attachConsoleGuards(page, consoleErrors);
    });

    test.afterEach(() => {
        assertNoConsoleErrors(consoleErrors, test.info().title);
    });

    test('1 — Live search & routing (PT100 → Electrical)', async ({ page }) => {
        await gotoToolkit(page);
        const input = page.locator('#mktEngSearchInput');
        await input.fill('PT100');
        const tray = page.locator('#mktEngSearchTray');
        await expect(tray).toBeVisible();
        await expect(tray.locator('.mkt-eng-search-card-title')).toContainText(/PT100/i);
        await expect(tray.locator('dt').filter({ hasText: 'Principle' })).toBeVisible();
        await expect(tray.locator('dt').filter({ hasText: 'Standard' })).toBeVisible();
        await expect(tray.locator('dt').filter({ hasText: 'Action' })).toBeVisible();
        await capture(page, 'e2e-01-search-pt100-tray.png');
        await tray.locator('.mkt-eng-search-open').first().click();
        await expect(page.locator('[data-tool-tab="electrical"]')).toHaveClass(/active/);
        await expect(page.locator('#storeToolElectrical:not(.hidden)')).toBeVisible();
        await capture(page, 'e2e-01-electrical-tab-active.png');
    });

    test('2 — Mechanical diagnostics (torque & deflection)', async ({ page }) => {
        await gotoToolkit(page);
        await clickToolTab(page, 'mechanical');
        await page.waitForFunction(
            () => {
                const sel = document.querySelector('#boltSizeSelect');
                return sel && sel.options.length > 5;
            },
            { timeout: 20_000 },
        );
        await page.selectOption('#boltSizeSelect', 'M16');
        await page.selectOption('#boltClassSelect', '8.8');
        await page.selectOption('#boltLubeSelect', 'oiled');
        await page.waitForFunction(
            () => {
                const t = parseFloat(document.querySelector('#boltTorqueNm')?.textContent || '');
                return t >= 183 && t <= 185;
            },
            { timeout: 15_000 },
        );
        const torque = parseFloat(await page.locator('#boltTorqueNm').innerText());
        expect(torque).toBeGreaterThanOrEqual(183);
        expect(torque).toBeLessThanOrEqual(185);
        await page.fill('#deflStroke', '1200');
        await page.fill('#deflTop', '0.12');
        await page.fill('#deflBottom', '0.00');
        const verdict = page.locator('#deflVerdict');
        await expect(verdict).toContainText(/EXCEEDED/i);
        await expect(verdict).not.toHaveText(/^—/);
        await capture(page, 'e2e-02-mechanical-panel.png');
    });

    test('3 — Combustion balance & cylinder lube', async ({ page }) => {
        await gotoToolkit(page);
        await clickToolTab(page, 'combustion');
        await page.locator('#combPreset6').click();
        const statuses = page.locator('#combInputTable .comb-result-status');
        await expect(statuses).toHaveCount(6);
        for (let i = 0; i < 6; i += 1) {
            await expect(statuses.nth(i)).toContainText('BALANCED');
        }
        await page.fill('#cylLubeKw', '10000');
        await page.fill('#cylLubeSulfur', '0.5');
        await page.selectOption('#cylLubeBn', '40');
        await page.locator('#cylLubeKw').dispatchEvent('input');
        const gkwh = parseFloat(await page.locator('#cylLubeGkwh').innerText());
        const dayL = parseFloat(await page.locator('#cylLubeDay').innerText());
        expect(gkwh).toBeGreaterThanOrEqual(0.74);
        expect(gkwh).toBeLessThanOrEqual(0.76);
        expect(dayL).toBeGreaterThanOrEqual(195);
        expect(dayL).toBeLessThanOrEqual(197);
        await capture(page, 'e2e-03-combustion-panel.png');
    });

    test('4 — Electrical PT100 & motor FLC', async ({ page }) => {
        await gotoToolkit(page);
        await clickToolTab(page, 'electrical');
        await page.fill('#pt100Ohms', '138.51');
        await page.locator('#pt100Ohms').dispatchEvent('input');
        await expect(page.locator('#pt100TempOut')).toHaveText(/100\.0\s*°C/);
        await page.fill('#motorKw', '15');
        await page.selectOption('#motorVoltage', '440');
        await page.locator('#motorKw').dispatchEvent('input');
        const flcText = await page.locator('#motorFlc').innerText();
        const flc = parseFloat(flcText);
        expect(flc).toBeGreaterThanOrEqual(25.5);
        expect(flc).toBeLessThanOrEqual(25.9);
        await capture(page, 'e2e-04-electrical-panel.png');
    });

    test('5 — Auxiliary refrigerant & boiler water', async ({ page }) => {
        await gotoToolkit(page);
        await clickToolTab(page, 'auxiliary');
        await page.selectOption('#refrigGas', 'R134a');
        await page.fill('#refrigSuctionP', '1.0');
        await page.locator('#refrigSuctionP').dispatchEvent('input');
        await expect(page.locator('#refrigTsatE')).toContainText('-10.2');
        await page.fill('#boilerCl', '450');
        await page.locator('#boilerCl').dispatchEvent('input');
        const status = page.locator('#boilerStatus');
        await expect(status).toContainText(/CRITICAL/i);
        await expect(status).toContainText(/Blowdown/i);
        await capture(page, 'e2e-05-auxiliary-panel.png');
    });
});
