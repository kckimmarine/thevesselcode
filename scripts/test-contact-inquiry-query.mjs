import { chromium } from '@playwright/test';

const BASE = process.env.TVC_BASE || 'http://127.0.0.1:3000';

const CASES = [
    { inquiry: 'poc', expected: 'poc' },
    { inquiry: 'sales', expected: 'sales' },
    { inquiry: 'enterprise', expected: 'enterprise' },
];

async function main() {
    const browser = await chromium.launch({ headless: true });
    const errors = [];
    for (const { inquiry, expected } of CASES) {
        const page = await browser.newPage();
        await page.goto(`${BASE}/contact-us?inquiry=${inquiry}`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#acInquiryType', { timeout: 60000 });
        const value = await page.locator('#acInquiryType').inputValue();
        if (value !== expected) {
            errors.push(`${inquiry}: expected select=${expected}, got ${value}`);
        }
        await page.close();
    }
    await browser.close();
    if (errors.length) {
        console.error('CONTACT INQUIRY QUERY TEST FAILED', errors);
        process.exit(1);
    }
    console.log('CONTACT INQUIRY QUERY TEST OK');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
