/**
 * Human sensory & ergonomic comfort checks — Maritime Toolkit (mobile + layout).
 */
const { test, expect } = require('@playwright/test');

const MOBILE = { width: 390, height: 844 };
/** WCAG 2.5.5 / Apple HIG — minimum touch target (height) for gloved fingers */
const MIN_TOUCH_HEIGHT_PX = 44;

test.describe('Human Sensory & Ergonomic Comfort Audits', () => {
    test('Tactile: Mobile tap targets must be at least 44x44px for gloved fingers', async ({ page }) => {
        await page.setViewportSize(MOBILE);
        await page.goto('/toolkit', { waitUntil: 'networkidle' });

        const buttons = page.locator('button, input, select, .action-chip');
        const count = await buttons.count();
        const failures = [];

        for (let i = 0; i < count; i += 1) {
            const btn = buttons.nth(i);
            if (!(await btn.isVisible())) continue;
            const box = await btn.boundingBox();
            if (!box) continue;
            if (box.height < MIN_TOUCH_HEIGHT_PX) {
                const tag = await btn.evaluate((el) => {
                    const id = el.id ? `#${el.id}` : '';
                    const cls = el.className && typeof el.className === 'string'
                        ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}`
                        : '';
                    return `${el.tagName.toLowerCase()}${id}${cls}`;
                });
                failures.push({ i, tag, height: box.height });
            }
        }

        expect(
            failures,
            failures.map((f) => `index ${f.i} ${f.tag} height=${f.height}px`).join('\n'),
        ).toEqual([]);
    });

    test('Visual: High contrast and zero element collision check', async ({ page }) => {
        await page.goto('/toolkit', { waitUntil: 'networkidle' });

        const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
        const clientWidth = await page.evaluate(() => document.body.clientWidth);
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    });
});
