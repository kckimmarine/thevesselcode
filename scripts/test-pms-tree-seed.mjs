/**
 * PMS GROUP Tree + seed smoke (taxonomy rail removed, jobs visible)
 * Run: TVC_BASE_URL=http://127.0.0.1:3000 node scripts/test-pms-tree-seed.mjs
 */
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const BASE = process.env.TVC_BASE_URL || 'http://127.0.0.1:3000';
const ART = '/opt/cursor/artifacts';

async function waitLoginReady(page) {
    const btn = page.locator('#loginScreen .login-submit');
    for (let i = 0; i < 80; i++) {
        const disabled = await btn.isDisabled().catch(() => true);
        const label = ((await btn.textContent().catch(() => '')) || '').trim();
        if (!disabled && !/Preparing|Signing/i.test(label)) return;
        await page.waitForTimeout(400);
    }
    throw new Error('Login UI not ready');
}

async function loginEngineer(page) {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await waitLoginReady(page);
    if (await page.locator('#appShell').isVisible().catch(() => false)) return;
    await page.locator('#loginUser').fill('engineer');
    await page.locator('#loginPass').fill('0000');
        const dept = page.locator('#loginDept');
        if (await dept.count()) await dept.selectOption('ENGINE').catch(() => {});
        await page.locator('#loginScreen .login-submit').click();
        await page.waitForFunction(() => {
            const app = document.getElementById('appShell');
            return app && !app.classList.contains('hidden');
        }, null, { timeout: 90_000 });
    await page.waitForTimeout(1500);
}

async function main() {
    fs.mkdirSync(ART, { recursive: true });
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const results = [];

    try {
        await loginEngineer(page);
        await page.evaluate(() => window.TVC_App?.switchTab?.('actual'));
        await page.waitForTimeout(800);
        await page.locator('#tab-actual').waitFor({ state: 'visible', timeout: 15_000 });

        const railCount = await page.locator('#actTaxonomyRail').count();
        const railText = await page.locator('.spare-taxonomy-rail').textContent().catch(() => '');
        results.push({
            check: 'prototype taxonomy rail removed from DOM',
            ok: railCount === 0 && !/MAIN PROPULSION/i.test(railText || ''),
        });

        const treeHtml = await page.locator('#actTree').innerHTML();
        const jobTags = [...treeHtml.matchAll(/tree-empty-tag[^>]*>(\d+)</g)].map(m => parseInt(m[1], 10));
        const maxJobs = jobTags.length ? Math.max(...jobTags) : 0;
        results.push({
            check: 'PMS GROUP Tree has job counts > 0',
            ok: maxJobs > 0,
            detail: { maxJobs, tagCount: jobTags.length },
        });

        const jobCodes = await page.evaluate(async () => {
            const jobs = await TVC_DB.getAll('maintenance_jobs');
            const eng = jobs.filter(j => j.department === 'ENGINE');
            return eng.slice(0, 5).map(j => j.job_code);
        });
        const codeOk = jobCodes.some(c => /^\d{2}-\d{2}-\d{3}$/.test(String(c || '')));
        results.push({
            check: 'maintenance jobs use GG-MM-III codes',
            ok: codeOk,
            detail: jobCodes,
        });

        const beforeCount = await page.evaluate(async () => {
            const jobs = await TVC_DB.getAll('maintenance_jobs');
            return jobs.filter(j => j.department === 'ENGINE').length;
        });
        const firstGroupKey = await page.evaluate(() => {
            const nodes = document.querySelectorAll('#actTree .tree-node');
            for (const el of nodes) {
                const tag = el.querySelector('.tree-empty-tag');
                const n = parseInt(tag?.textContent || '0', 10);
                if (n > 0) {
                    const onclick = el.getAttribute('onclick') || '';
                    const m = onclick.match(/selectGroup\('([^']+)'\)/);
                    if (m) return m[1];
                }
            }
            return null;
        });
        if (firstGroupKey) {
            await page.evaluate((key) => {
                window.TVC_App.selectGroup(key);
            }, firstGroupKey);
            await page.waitForTimeout(600);
        }
        const afterCount = await page.evaluate(() => {
            const label = document.getElementById('actCount')?.textContent || '';
            const m = label.match(/(\d+)/);
            return m ? parseInt(m[1], 10) : 0;
        });
        results.push({
            check: 'group click filters jobs (subset of all)',
            ok: firstGroupKey && afterCount > 0 && afterCount <= beforeCount,
            detail: { beforeCount, afterCount, firstGroupKey },
        });

        await page.screenshot({ path: path.join(ART, 'pms_tree_jobs_desktop.png'), fullPage: false });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(ART, 'pms_tree_jobs_mobile.png'), fullPage: false });

        const failed = results.filter(r => !r.ok);
        console.log(JSON.stringify({ passed: results.length - failed.length, total: results.length, results }, null, 2));
        if (failed.length) process.exit(1);
    } finally {
        await browser.close();
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
