import { chromium } from '@playwright/test';

const BASE = process.env.TVC_BASE || 'http://127.0.0.1:3000';

async function main() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.login-card', { timeout: 60000 });
    const order = await page.evaluate(() => {
        const card = document.querySelector('.login-card');
        const link = document.querySelector('.login-site-link-below');
        if (!card || !link) return { ok: false, reason: 'missing nodes' };
        const cardBottom = card.getBoundingClientRect().bottom;
        const linkTop = link.getBoundingClientRect().top;
        return {
            ok: linkTop >= cardBottom - 2,
            linkBelowCard: linkTop >= cardBottom - 2,
            hasBelowClass: link.classList.contains('login-site-link-below'),
        };
    });
    await browser.close();
    if (!order.ok || !order.linkBelowCard || !order.hasBelowClass) {
        console.error('LOGIN SITE LINK TEST FAILED', order);
        process.exit(1);
    }
    console.log('LOGIN SITE LINK TEST OK');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
