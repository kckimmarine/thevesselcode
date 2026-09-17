import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
        const grid = document.getElementById('cmaxsMenuBody');
        const shipCol = document.getElementById('smLeftCol');
        const workflows = document.getElementById('menuMainCol');
        const outstanding = document.getElementById('menuOutstandingCol');
        const pmsCard = document.getElementById('pmsOutstandingCard');
        const pmsHost = document.getElementById('outstandingTasksPanel');
        const spareHost = document.getElementById('spareOutstandingPanel');
        const pmsFlow = document.querySelector('.tvc-section-pms-flow');
        const spareFlow = document.querySelector('.tvc-section-spare-flow');
        const gridStyle = grid ? getComputedStyle(grid) : null;
        const pmsRect = pmsFlow?.getBoundingClientRect();
        const spareRect = spareFlow?.getBoundingClientRect();
        const outRect = outstanding?.getBoundingClientRect();
        const wfRect = workflows?.getBoundingClientRect();
        const flowPanel = pmsFlow?.querySelector('.menu-flow-panel.spare-flow-panel');
        const flowCols = flowPanel ? getComputedStyle(flowPanel).gridTemplateColumns : '';
        const matrix = pmsHost?.querySelector('.ot-pms-table');
        return {
            hasGrid: grid?.classList.contains('menu-dashboard-grid'),
            gridCols: gridStyle?.gridTemplateColumns || '',
            hasShipCol: !!shipCol && !shipCol.classList.contains('hidden'),
            workflowsFlexCol: workflows ? getComputedStyle(workflows).flexDirection : '',
            outstandingFlexCol: outstanding ? getComputedStyle(outstanding).flexDirection : '',
            pmsHostInOutstanding: outstanding?.contains(pmsHost),
            spareHostInOutstanding: outstanding?.contains(spareHost),
            hasMatrix: !!matrix,
            workflowsStacked: pmsRect && spareRect
                ? Math.abs(pmsRect.left - spareRect.left) < 24 && spareRect.top > pmsRect.top + 40
                : null,
            outstandingRightOfWorkflows: outRect && wfRect ? outRect.left >= wfRect.right - 8 : null,
            workflowMinWidth: pmsRect?.width ?? 0,
            flowSubCols: flowCols.trim().split(/\s+/).filter(Boolean).length,
            scrollHeight: document.documentElement.scrollHeight,
            viewport: window.innerHeight,
        };
    });

    const errors = [];
    if (!layout.hasGrid) errors.push('cmaxsMenuBody missing menu-dashboard-grid');
    if (!layout.hasShipCol) errors.push('SM ship list column not visible');
    if (layout.workflowsFlexCol !== 'column') errors.push(`workflows not flex column: ${layout.workflowsFlexCol}`);
    if (layout.outstandingFlexCol !== 'column') errors.push(`outstanding not flex column: ${layout.outstandingFlexCol}`);
    if (!layout.pmsHostInOutstanding) errors.push('PMS outstanding not in col-outstanding');
    if (!layout.spareHostInOutstanding) errors.push('SPARE outstanding not in col-outstanding');
    if (!layout.hasMatrix) errors.push('PMS matrix not rendered');
    if (layout.workflowsStacked === false) errors.push('PMS/SPARE workflow cards not vertically stacked');
    if (layout.outstandingRightOfWorkflows === false) errors.push('outstanding column not right of workflows');
    if (layout.workflowMinWidth > 0 && layout.workflowMinWidth < 320) {
        errors.push(`workflow column too narrow: ${layout.workflowMinWidth}px`);
    }
    if (layout.flowSubCols !== 3) errors.push(`workflow sub-grid not 3 columns: ${layout.flowSubCols}`);
    const colCount = layout.gridCols.trim().split(/\s+/).filter(Boolean).length;
    if (colCount !== 3) errors.push(`expected 3 grid columns, got ${colCount}: ${layout.gridCols}`);

    await page.screenshot({ path: path.join(ARTIFACTS, 'menu-dashboard-grid-1920.png'), fullPage: false });

    await page.setViewportSize({ width: 1000, height: 900 });
    await page.waitForTimeout(800);
    const stacked = await page.evaluate(() => {
        const g = document.getElementById('cmaxsMenuBody');
        return {
            cols: g ? getComputedStyle(g).gridTemplateColumns : '',
            innerWidth: window.innerWidth,
        };
    });
    const stackedCols = stacked.cols.trim().split(/\s+/).filter(Boolean).length;
    if (stacked.innerWidth <= 1280 && stackedCols > 1) {
        errors.push(`expected single column ≤1280px (w=${stacked.innerWidth}), got: ${stacked.cols}`);
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
