/** Marketing home — TVC Brain modal smoke */
const { test, expect } = require('@playwright/test');

test.describe('TVC Brain marketing home', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('hero Ask Brain opens modal with fallback answer', async ({ page }) => {
        await page.goto('/home/index.html', { waitUntil: 'domcontentloaded' });
        await expect(page.locator('#homeHeroSearchInput')).toBeVisible();
        await page.locator('#homeHeroSearchInput').fill('JIS 10K 80A flange PCD');
        await page.locator('#homeHeroSearchForm button[type="submit"]').click();
        const modal = page.locator('#modal-tvc-brain');
        await expect(modal).toBeVisible();
        await expect(modal.locator('.tvc-brain-answer').first()).toContainText(/Core conclusion|핵심 결론/, { timeout: 20000 });
        await page.keyboard.press('Escape');
        await expect(modal).toBeHidden();
    });
});
