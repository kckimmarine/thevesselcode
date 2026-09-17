/**
 * Verifies login succeeds when users store has duplicate username rows (ConstraintError scenario).
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PORT = 4174;
const BASE = `http://127.0.0.1:${PORT}`;

function serveStatic() {
    return spawn('npx', ['--yes', 'serve', '.', '-l', String(PORT)], {
        cwd: REPO_ROOT,
        stdio: 'ignore',
        detached: false,
    });
}

async function waitForServer(url, attempts = 40) {
    for (let i = 0; i < attempts; i++) {
        try {
            const r = await fetch(url);
            if (r.ok) return;
        } catch (_) { /* retry */ }
        await delay(500);
    }
    throw new Error(`Server not ready: ${url}`);
}

/** Legacy row id ≠ seed id — initUsers used to throw ConstraintError on canonical seed put. */
async function seedLegacyGfsmRow(page) {
    await page.evaluate(async () => {
        await TVC_DB.open();
        const demoHash = await TVC_Auth.hashPasswordForProvision('0000');
        const rows = await TVC_DB.getAll('users');
        for (const row of rows) {
            if (String(row.username || '').toLowerCase() === 'gfsm') {
                await TVC_DB.del('users', row.id);
            }
        }
        await TVC_DB.put('users', {
            id: 'dup-gfsm-legacy',
            username: 'gfsm',
            display_name: 'Legacy GFSM',
            password_hash: demoHash,
            account_type: 'SM',
            role: 'SM_SUPERINTENDENT',
            is_active: true,
            company_id: 'GFSM',
        });
        const initResult = await TVC_Auth.initUsers();
        if (initResult?.error) throw new Error(initResult.error);
    });
}

async function waitForLoginReady(page) {
    await page.waitForFunction(() => typeof TVC_Auth !== 'undefined' && typeof TVC_DB !== 'undefined', null, { timeout: 60_000 });
    await page.waitForFunction(() => {
        const btn = document.querySelector('.login-submit');
        return btn && !btn.disabled;
    }, null, { timeout: 90_000 });
}

async function tryLogin(page, username, password) {
    await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
    await waitForLoginReady(page);
    await page.fill('#loginUser', username);
    await page.fill('#loginPass', password);
    await page.click('.login-submit');
    await page.waitForTimeout(3000);
    const err = (await page.locator('#loginErr').textContent().catch(() => '')) || '';
    const loginVisible = await page.locator('#loginScreen').isVisible().catch(() => true);
    const appVisible = await page.locator('#appScreen').isVisible().catch(() => false);
    return { err, loginVisible: loginVisible && !appVisible };
}

async function main() {
    process.chdir(REPO_ROOT);
    const server = serveStatic();
    try {
        await waitForServer(`${BASE}/index.html`);
        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext();
        const page = await context.newPage();

        await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
        await waitForLoginReady(page);
        await seedLegacyGfsmRow(page);

        const cases = [
            ['gfsm', '0000'],
            ['gfsm-sq', '0000'],
            ['admin', 'admin'],
            ['tvc', 'tvc1234'],
        ];

        const failures = [];
        for (const [user, pass] of cases) {
            const r = await tryLogin(page, user, pass);
            const constraint = /Unable to add key|Index key is not unique|uniqueness requirements/i.test(r.err);
            if (constraint || r.loginVisible) {
                failures.push({ user, err: r.err, loginVisible: r.loginVisible });
            }
        }

        await browser.close();
        if (failures.length) {
            console.error('AUTH LOGIN RESILIENCE FAILED', JSON.stringify(failures, null, 2));
            process.exit(1);
        }
        console.log('AUTH LOGIN RESILIENCE OK — gfsm, gfsm-sq, admin signed in without username index errors');
    } finally {
        server.kill('SIGTERM');
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
