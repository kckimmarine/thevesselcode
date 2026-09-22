#!/usr/bin/env node
/**
 * DOUBLE-STRIKE Track B — toolkit data binding, photo headers, flange mobile, filter perf.
 * Run: node scripts/test-toolkit-e2e-suite.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { chromium } from '@playwright/test';
import { createRequire } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const BASE = process.env.TVC_BASE_URL || 'http://127.0.0.1:4317';

const TRACK_A_BATCH2 = [
    '812102', '812103', '591151', '591152', '231011', '232001', '790101', '617426',
];

const results = [];
function check(name, ok, detail = '') {
    results.push({ name, ok, detail });
    console.log(ok ? 'OK' : 'FAIL', name, detail ? `— ${detail}` : '');
}

function isWebpFile(path) {
    if (!existsSync(path)) return false;
    const head = readFileSync(path).subarray(0, 12);
    return head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46
        && head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50;
}

const index = JSON.parse(readFileSync(join(ROOT, 'public/data/impa-product-photos.json'), 'utf8'));

for (const code of TRACK_A_BATCH2) {
    const meta = index.photos?.[code];
    const file = meta?.file || `photo_${code}.webp`;
    const disk = join(ROOT, 'public/data/product-photos', file);
    check(`${code} schema v2 fields`, !!(meta?.photo_url && meta?.source_name && meta?.source_url && meta?.license && meta?.disclaimer));
    check(`${code} webp RIFF header`, isWebpFile(disk), file);
    check(`${code} disclaimer text`, String(meta?.disclaimer || '').includes('Reference photo'));
}

const bunkerSrc = readFileSync(join(ROOT, 'js/toolkit/bunkerCalc.js'), 'utf8');
const sandbox = { globalThis: {}, module: { exports: {} } };
sandbox.globalThis = sandbox;
vm.runInNewContext(bunkerSrc, sandbox, { filename: 'bunkerCalc.js' });
const Bunker = sandbox.globalThis.TVC_BunkerCalc;

const spot = Bunker.calcBunkerAstM54B({ volumeM3: 500, density15: 991, tempC: 40, fuelKey: 'VLSFO' });
check('ASTM live MT ~490.25', Math.abs(spot.mt - 490.251) < 0.02, `mt=${spot.mt.toFixed(3)}`);
check('ASTM VCF exponential form', Math.abs(spot.vcf - 0.9905) < 0.0002, `vcf=${spot.vcf.toFixed(6)}`);
check('weight-in-air density', Math.abs(spot.densityInAir - (991 * spot.vcf - 1.1)) < 0.001);

const flangeJson = JSON.parse(readFileSync(join(ROOT, 'data/flange-standards.json'), 'utf8'));
const flangeModule = require('../js/toolkit/flangeData.js');
flangeModule.initSync(flangeJson.rows || []);
const bound = flangeModule.getRow('JIS 10K', '50A');
check('flange data binding JIS 10K 50A', bound?.od === 155 && bound?.pcd === 120 && bound?.bolts === 4);

const toolkitSrc = readFileSync(join(ROOT, 'js/ui/maritimeToolkit.js'), 'utf8');
const lubeCount = (toolkitSrc.match(/\{ category: '/g) || []).length;
const paintCount = (toolkitSrc.match(/\{ type: '/g) || []).length;
check('lube cross-ref row count >= 24', lubeCount >= 24, `rows=${lubeCount}`);
check('paint cross-ref row count >= 14', paintCount >= 14, `rows=${paintCount}`);

function filterLubeRows(rows, cat, q) {
    const query = (q || '').trim().toLowerCase();
    return rows.filter((r) => {
        if (cat && r.category !== cat) return false;
        if (!query) return true;
        const hay = [r.category, r.grade, r.shell, r.mobil, r.castrol, r.total].join(' ').toLowerCase();
        return hay.includes(query);
    });
}

const lubeMatch = toolkitSrc.match(/const LUB_OIL_ROWS = (\[[\s\S]*?\]);/);
const lubeRows = lubeMatch ? vm.runInNewContext(lubeMatch[1]) : [];
const t0 = performance.now();
filterLubeRows(lubeRows, 'Hydraulic Oil', 'VG 46');
const lubeMs = performance.now() - t0;
check('lube filter under 50ms', lubeMs < 50, `${lubeMs.toFixed(2)}ms`);

const paintMatch = toolkitSrc.match(/const PAINT_ROWS = (\[[\s\S]*?\]);/);
const paintRows = paintMatch ? vm.runInNewContext(paintMatch[1]) : [];
const t1 = performance.now();
paintRows.filter((r) => {
    const q = 'barrier';
    const hay = [r.type, r.product, r.chugoku, r.jotun, r.hempel, r.ip].join(' ').toLowerCase();
    return hay.includes(q);
});
const paintMs = performance.now() - t1;
check('paint filter under 50ms', paintMs < 50, `${paintMs.toFixed(2)}ms`);

async function playwrightFlangeMobile() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    try {
        await page.goto(`${BASE}/toolkit.html`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        await page.locator('button.store-tool-chip[data-tool-tab="engineering"]').click();
        await page.locator('#flangeTableHost table').waitFor({ state: 'visible', timeout: 15_000 });
        const overflow = await page.locator('.maritime-table-wrap').first().evaluate((el) => {
            const style = getComputedStyle(el);
            return {
                scrollWidth: el.scrollWidth,
                clientWidth: el.clientWidth,
                overflowX: style.overflowX,
            };
        });
        check(
            'flange table mobile horizontal containment',
            overflow.overflowX === 'auto' && overflow.scrollWidth <= overflow.clientWidth + 4,
            JSON.stringify(overflow),
        );
        const rowsVisible = await page.locator('#flangeTableHost tbody tr').count();
        check('flange selector rows bound', rowsVisible >= 10, `rows=${rowsVisible}`);
    } finally {
        await browser.close();
    }
}

await playwrightFlangeMobile();

const failed = results.filter((r) => !r.ok);
if (failed.length) {
    console.error('\nToolkit E2E suite FAILED', failed.length);
    process.exit(1);
}
console.log('\nToolkit E2E suite passed.', results.length, 'checks');
