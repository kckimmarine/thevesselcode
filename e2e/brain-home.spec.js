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

    test('iOS Safari banner shows Add to Home Screen steps (no fake Install)', async ({ browser }) => {
        const context = await browser.newContext({
            viewport: { width: 390, height: 844 },
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        });
        const page = await context.newPage();
        await page.addInitScript(() => {
            try { localStorage.removeItem('tvc-brain-a2hs-dismissed-v1'); } catch (_) { /* ignore */ }
        });
        await page.goto('/home/index.html', { waitUntil: 'domcontentloaded' });
        const bar = page.locator('#tvcBrainA2hs');
        await expect(bar).toBeVisible();
        await expect(bar.locator('.tvc-brain-a2hs-steps')).toContainText(/홈 화면에 추가|Add to Home Screen/);
        await expect(bar.locator('.tvc-brain-a2hs-install')).toHaveCount(0);
        await context.close();
    });

    test('hero voice and camera controls are present with touch targets', async ({ page }) => {
        await page.goto('/home/index.html', { waitUntil: 'domcontentloaded' });
        const voice = page.locator('#btn-voice-input');
        const camera = page.locator('#btn-camera-input');
        await expect(voice).toBeVisible();
        await expect(page.locator('label[for="btn-camera-input"]')).toBeVisible();
        await expect(camera).toHaveAttribute('accept', 'image/*');
        const box = await voice.boundingBox();
        expect(box).toBeTruthy();
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.width).toBeGreaterThanOrEqual(44);
    });
});
