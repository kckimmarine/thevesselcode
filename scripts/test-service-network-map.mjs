/**
 * Smoke test: Global Operational Hubs map (services page)
 * Run: TVC_BASE_URL=http://127.0.0.1:3000 node scripts/test-service-network-map.mjs
 */
import { chromium } from '@playwright/test';

const BASE = process.env.TVC_BASE_URL || 'http://127.0.0.1:3000';

async function checkViewport(page, label, width, height) {
  await page.setViewportSize({ width, height });
  await page.goto(`${BASE}/services`, { waitUntil: 'networkidle' });
  await page.locator('#tvc-service-network-map.tvc-service-network-map--ready').waitFor({
    state: 'attached',
    timeout: 45_000,
  });
  await page.waitForTimeout(800);
  const metrics = await page.evaluate(() => {
    const mapEl = document.getElementById('tvc-service-network-map');
    const tile = mapEl?.querySelector('.leaflet-tile');
    const hubs = document.querySelectorAll('.tvc-network-hub-marker').length;
    const overflow = {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    };
    return { hubs, hasTile: !!tile, overflow, mapHeight: mapEl?.offsetHeight || 0 };
  });
  return { label, width, height, ...metrics };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = [];

  try {
    const page = await browser.newPage();
    const desktop = await checkViewport(page, 'desktop', 1920, 1080);
    results.push({
      check: 'desktop map ready with tiles',
      ok: desktop.hasTile && desktop.mapHeight >= 400,
      detail: desktop,
    });
    results.push({
      check: 'desktop no horizontal overflow',
      ok: desktop.overflow.scrollWidth <= desktop.overflow.clientWidth + 1,
    });
    results.push({
      check: 'seven hub markers rendered',
      ok: desktop.hubs >= 7,
      detail: { hubs: desktop.hubs },
    });

    await page.locator('.leaflet-marker-icon').first().click();
    await page.locator('.tvc-network-popup-card').waitFor({ state: 'visible', timeout: 5_000 });
    const rfqHref = await page.locator('.tvc-network-popup-rfq').first().getAttribute('href');
    const waHref = await page.locator('.tvc-network-popup-wa').first().getAttribute('href');
    results.push({
      check: 'HQ popup RFQ link',
      ok: rfqHref && rfqHref.includes('inquiry=rfq') && rfqHref.includes('port='),
      detail: { rfqHref },
    });
    results.push({
      check: 'HQ popup WhatsApp encoded',
      ok: waHref && waHref.includes('wa.me') && waHref.includes('text=Hello'),
      detail: { waHref },
    });

    const mobile = await checkViewport(page, 'mobile', 390, 844);
    results.push({
      check: 'mobile map height',
      ok: mobile.mapHeight >= 300 && mobile.hasTile,
      detail: mobile,
    });
    results.push({
      check: 'mobile no horizontal overflow',
      ok: mobile.overflow.scrollWidth <= mobile.overflow.clientWidth + 1,
    });

    const failed = results.filter((r) => !r.ok);
    console.log(JSON.stringify({ passed: results.length - failed.length, total: results.length, results }, null, 2));
    if (failed.length) process.exit(1);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
