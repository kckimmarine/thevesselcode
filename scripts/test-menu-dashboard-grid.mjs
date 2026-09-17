import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.TVC_BASE || 'http://127.0.0.1:3000';
const ARTIFACTS = process.env.TVC_ARTIFACTS || '/opt/cursor/artifacts';

async function loginSm(page) {
    await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
        () => typeof TVC_I18n !== 'undefined' && document.querySelector('.login-submit') && !document.querySelector('.login-submit').disabled,
        null,
        { timeout: 90000 }
    );
    await page.fill('#loginUser', 'abc shipping');
    await page.fill('#loginPass', '0000');
    await page.click('.login-submit');
    await page.waitForTimeout(5000);
}

async function main() {
    fs.mkdirSync(ARTIFACTS, { recursive: true });
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const consoleErrors = [];
    page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await loginSm(page);

    const vesselRow = page.locator('#fleetTableBody tr').first();
    if (await vesselRow.count()) {
        await vesselRow.click();
        await page.waitForTimeout(2500);
    }

    await page.locator('#tabBar .tab-btn[data-tab="menu"]').click();
    await page.waitForTimeout(1500);

    const layout = await page.evaluate(() => {
        const grid = document.querySelector('.menu-dashboard-grid');
        const pmsCard = document.getElementById('pmsOutstandingCard');
        const pmsHost = document.getElementById('outstandingTasksPanel');
        const auxHost = document.getElementById('outstandingTasksAuxPanel');
        const pmsFlow = document.querySelector('.tvc-section-pms-flow');
        const spareFlow = document.querySelector('.tvc-section-spare-flow');
        const gridStyle = grid ? getComputedStyle(grid) : null;
        const pmsRect = pmsCard?.getBoundingClientRect();
        const pmsFlowRect = pmsFlow?.getBoundingClientRect();
        const spareRect = spareFlow?.getBoundingClientRect();
        const matrix = pmsHost?.querySelector('.ot-matrix, .ot-pms-matrix, table');
        return {
            hasGrid: !!grid,
            gridCols: gridStyle?.gridTemplateColumns || '',
            pmsInRightCol: pmsCard?.classList.contains('menu-col-right'),
            pmsHostChildOfCard: pmsCard?.contains(pmsHost),
            auxSeparate: auxHost && !pmsCard?.contains(auxHost),
            hasPmsFlow: !!pmsFlow,
            hasSpareFlow: !!spareFlow,
            hasMatrix: !!matrix,
            rightLeftOfSpare: pmsRect && spareRect ? pmsRect.left > spareRect.left : null,
            pmsFlowLeftOfSpare: pmsFlowRect && spareRect ? pmsFlowRect.left < spareRect.left : null,
            scrollHeight: document.documentElement.scrollHeight,
            viewport: window.innerHeight,
        };
    });

    const errors = [];
    if (!layout.hasGrid) errors.push('missing .menu-dashboard-grid');
    if (!layout.pmsInRightCol) errors.push('pmsOutstandingCard not menu-col-right');
    if (!layout.pmsHostChildOfCard) errors.push('outstandingTasksPanel not inside pmsOutstandingCard');
    if (!layout.auxSeparate) errors.push('aux panel not separate from right column');
    if (!layout.hasMatrix) errors.push('PMS matrix not rendered');
    if (layout.rightLeftOfSpare === false) errors.push('right column not to the right of SPARE flow');
    if (layout.pmsFlowLeftOfSpare === false) errors.push('PMS flow not left of SPARE flow');
    const colCount = layout.gridCols.trim().split(/\s+/).filter(Boolean).length;
    if (colCount !== 3) errors.push(`expected 3 grid columns, got ${colCount}: ${layout.gridCols}`);

    const deckBtn = page.locator('.outstanding-tasks-panel .dept-btn, .outstanding-tasks-panel [data-dept="Deck"]').first();
    if (await deckBtn.count()) {
        await deckBtn.click();
        await page.waitForTimeout(400);
    }

    await page.screenshot({ path: path.join(ARTIFACTS, 'menu-dashboard-grid-1920.png'), fullPage: false });

    await page.setViewportSize({ width: 1200, height: 900 });
    await page.waitForTimeout(400);
    const stacked = await page.evaluate(() => {
        const g = document.querySelector('.menu-dashboard-grid');
        return g ? getComputedStyle(g).gridTemplateColumns : '';
    });
    if (!/^[\d.]+px$/.test(stacked.trim()) && !stacked.includes('100%') && stacked.split(' ').length > 1) {
        errors.push(`expected single column ≤1280px, got: ${stacked}`);
    }

    await browser.close();

    const filteredConsole = consoleErrors.filter(
        (e) => !/favicon|Failed to load resource|CORS policy|net::ERR_FAILED/i.test(e)
    );
    if (filteredConsole.length) errors.push(`console: ${filteredConsole.slice(0, 3).join(' | ')}`);

    if (errors.length) {
        console.error('MENU DASHBOARD GRID TEST FAILED', errors, layout);
        process.exit(1);
    }
    console.log('MENU DASHBOARD GRID TEST OK', layout);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
