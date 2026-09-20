#!/usr/bin/env node
/**
 * Verify IMPA programmatic SEO pages and chunked sitemaps.
 * Run: node scripts/test-seo-sitemap.mjs
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const root = process.cwd();
const require = createRequire(import.meta.url);
const TEST_CODE = '812101';
const CANONICAL_ORIGIN = 'https://www.thevesselcode.com';
const HUB_CODES = [
    '812101', '812105', '812204', '812312', '812851',
    '590101', '590203', '590705', '590102', '590105',
    '791201', '791301',
];

function run(label, cmd, args) {
    const result = spawnSync(cmd, args, { cwd: root, stdio: 'inherit' });
    if (result.status !== 0) throw new Error(`${label} failed`);
}

const results = [];
function check(name, ok, detail = '') {
    results.push({ name, ok, detail });
    console.log(ok ? 'OK' : 'FAIL', name, detail ? `— ${detail}` : '');
}

function assertValidXml(label, xml) {
    check(`${label} is well-formed xml`, xml.startsWith('<?xml'));
    check(`${label} has closing root`, /(<\/urlset>|<\/sitemapindex>)\s*$/.test(xml.trim()));
}

run('merge', 'node', ['scripts/merge-impa-chapters.mjs']);
run('seo-index', 'node', ['scripts/generate-impa-seo-index.mjs']);
run('sitemap', 'node', ['scripts/generate-sitemap.mjs']);

const impaSeo = require('../api/_lib/impaSeo.js');
const item = impaSeo.getItemByCode(TEST_CODE);
check(`${TEST_CODE} exists in seo index`, !!item?.name, item?.name || 'missing');

const html = impaSeo.buildStoreItemHtml(item);
check('default seo origin is www', impaSeo.storeSeoOrigin() === CANONICAL_ORIGIN);
const pageTitle = impaSeo.buildPageTitle(item);
const escTitle = pageTitle.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cleanName = impaSeo.buildPlateImageAlt(item).split(`${TEST_CODE} `)[1]?.replace(' Technical Drawing and Catalog Plate', '') || item.name;
const escClean = cleanName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
check('html title format', html.includes(`<title>${escTitle}</title>`));
check('title serp max length', pageTitle.length <= impaSeo.SERP_TITLE_MAX_LEN, String(pageTitle.length));
check(
    'html h1 format',
    html.includes(`<span class="impa-detail-unified-badge">IMPA ${TEST_CODE}</span>`)
        && html.includes('<h1 class="impa-detail-unified-title">')
        && html.includes(`<h1 class="impa-detail-unified-title">${escClean}</h1>`),
);
check('html no duplicate microdata product', !html.includes('itemtype="https://schema.org/Product"'));
check('html json-ld seller', html.includes('"seller"'));
check('html json-ld validFrom', html.includes('"validFrom"'));
check('html json-ld merchant return policy', html.includes('MerchantReturnPolicy') || html.includes('hasMerchantReturnPolicy'));
check('html json-ld shipping details', html.includes('OfferShippingDetails') || html.includes('shippingDetails'));
const ogTitle = impaSeo.buildOgTitle(item);
const escOgTitle = ogTitle.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
check('html og:title format', html.includes(`<meta property="og:title" content="${escOgTitle}">`));
check('html og:description rfq copy', html.includes('Instant quotation availa'));
check('html og:image plate url', html.includes('<meta property="og:image" content="https://www.thevesselcode.com/data/plates/'));
check('html json-ld mpn', html.includes('"mpn"'));
check('html json-ld offers', html.includes('"offers"') && (html.includes('"@type":"Offer"') || html.includes('"@type": "Offer"')));
check('html json-ld offer price', html.includes('"price":"0.00"') || html.includes('"price": "0.00"'));
check('html json-ld offer currency', html.includes('"priceCurrency":"USD"') || html.includes('"priceCurrency": "USD"'));
check('html json-ld offer availability', html.includes('schema.org/InStock'));
check('html json-ld invoice price type', html.includes('schema.org/InvoicePrice'));
check('html json-ld marine category', html.includes('"Marine Stores"'));
check('html json-ld product', html.includes('"@type":"Product"') || html.includes('"@type": "Product"'));
check('html json-ld techarticle', html.includes('"@type":"TechArticle"') || html.includes('"@type": "TechArticle"'));
check('html canonical uses www', html.includes(`<link rel="canonical" href="${CANONICAL_ORIGIN}/store/${TEST_CODE}">`));
check('html og:url uses www', html.includes(`<meta property="og:url" content="${CANONICAL_ORIGIN}/store/${TEST_CODE}">`));
check('html meta description', html.includes('View verified technical drawing, flange/thread dimensions'));
check('html plate alt', html.includes('Technical Drawing and Catalog Plate'));
check('html json-ld breadcrumb', html.includes('BreadcrumbList'));
check(
    'html spec table',
    html.includes('impa-shipserv-spec-wrap')
        && html.includes('<table class="impa-shipserv-spec-table spec-table">'),
);
check('html rating row', html.includes('<th scope="row">Rating</th>'));
check('html material row', html.includes('<th scope="row">Material</th>'));
check('html standard unit row', html.includes('<th scope="row">Standard Unit</th>'));
check(
    'html toolkit cta',
    html.includes('class="btn-toolkit"')
        && html.includes(`href="https://www.thevesselcode.com/toolkit?impa=${TEST_CODE}"`)
        && html.includes('Open Maritime Toolkit'),
);
check('html tvc-sm conversion banner', html.includes('class="tvc-sm-banner"'));
check('html fleet pilot cta', html.includes('inquiry=poc') || html.includes('14-Day Free PoC'));
check('html related items links', html.includes('class="related-items"') && html.includes(`href="https://www.thevesselcode.com/store/`));
check('html plate img dimensions', html.includes('width="560"') && html.includes('height="420"'));
check('html preconnect', html.includes('rel="preconnect"'));

const handler = require('../api/store/[code].js');
const mockRes = {
    statusCode: 200,
    headers: {},
    setHeader(key, value) {
        this.headers[key.toLowerCase()] = value;
    },
    status(code) {
        this.statusCode = code;
        return this;
    },
    send(body) {
        this.body = body;
        return this;
    },
    end() {
        return this;
    },
};

await handler({ method: 'GET', query: { code: TEST_CODE } }, mockRes);
check('/store handler returns 200', mockRes.statusCode === 200, String(mockRes.statusCode));
check('/store handler html body', typeof mockRes.body === 'string' && mockRes.body.includes('spec-table'));

const notFoundRes = {
    statusCode: 200,
    headers: {},
    setHeader(key, value) {
        this.headers[key.toLowerCase()] = value;
    },
    status(code) {
        this.statusCode = code;
        return this;
    },
    send(body) {
        this.body = body;
        return this;
    },
};
await handler({ method: 'GET', query: { code: '999999' } }, notFoundRes);
check('/store missing code returns 404', notFoundRes.statusCode === 404);
check('/store missing code has search link', String(notFoundRes.body).includes('Search catalog for IMPA'));

const sitemapIndex = readFileSync(join(root, 'public', 'sitemap.xml'), 'utf8');
assertValidXml('sitemap.xml', sitemapIndex);
check('sitemap index references core pages', sitemapIndex.includes('sitemap-core.xml'));
check('sitemap index references store chunk', sitemapIndex.includes('sitemap-store-1.xml'));
const seoIndex = JSON.parse(readFileSync(join(root, 'api', '_data', 'impa-seo-index.json'), 'utf8'));
const seoCount = Number(seoIndex.count) || Object.keys(seoIndex.items || {}).length;
if (seoCount > 10_000) {
    check('sitemap index references store chunk 2', sitemapIndex.includes('sitemap-store-2.xml'));
    const storeChunk2Path = join(root, 'public', 'sitemap-store-2.xml');
    check('sitemap-store-2.xml exists', existsSync(storeChunk2Path));
    if (existsSync(storeChunk2Path)) {
        const storeChunk2 = readFileSync(storeChunk2Path, 'utf8');
        assertValidXml('sitemap-store-2.xml', storeChunk2);
        const chunk2Count = Math.min(10_000, Math.max(0, seoCount - 10_000));
        check('store chunk 2 url count', (storeChunk2.match(/<loc>/g) || []).length === chunk2Count);
    }
}
if (seoCount > 20_000) {
    check('sitemap index references store chunk 3', sitemapIndex.includes('sitemap-store-3.xml'));
    const storeChunk3Path = join(root, 'public', 'sitemap-store-3.xml');
    check('sitemap-store-3.xml exists', existsSync(storeChunk3Path));
    if (existsSync(storeChunk3Path)) {
        const storeChunk3 = readFileSync(storeChunk3Path, 'utf8');
        assertValidXml('sitemap-store-3.xml', storeChunk3);
        const chunk3Count = Math.min(10_000, Math.max(0, seoCount - 20_000));
        check('store chunk 3 url count', (storeChunk3.match(/<loc>/g) || []).length === chunk3Count);
    }
}
if (seoCount > 30_000) {
    check('sitemap index references store chunk 4', sitemapIndex.includes('sitemap-store-4.xml'));
    const storeChunk4Path = join(root, 'public', 'sitemap-store-4.xml');
    check('sitemap-store-4.xml exists', existsSync(storeChunk4Path));
    if (existsSync(storeChunk4Path)) {
        const storeChunk4 = readFileSync(storeChunk4Path, 'utf8');
        assertValidXml('sitemap-store-4.xml', storeChunk4);
        const chunk4Count = Math.min(10_000, Math.max(0, seoCount - 30_000));
        check('store chunk 4 url count', (storeChunk4.match(/<loc>/g) || []).length === chunk4Count);
    }
}
if (seoCount > 40_000) {
    check('sitemap index references store chunk 5', sitemapIndex.includes('sitemap-store-5.xml'));
    const storeChunk5Path = join(root, 'public', 'sitemap-store-5.xml');
    check('sitemap-store-5.xml exists', existsSync(storeChunk5Path));
    if (existsSync(storeChunk5Path)) {
        const storeChunk5 = readFileSync(storeChunk5Path, 'utf8');
        assertValidXml('sitemap-store-5.xml', storeChunk5);
        const chunk5Count = Math.min(10_000, Math.max(0, seoCount - 40_000));
        check('store chunk 5 url count', (storeChunk5.match(/<loc>/g) || []).length === chunk5Count);
    }
}
if (seoCount > 50_000) {
    check('sitemap index references store chunk 6', sitemapIndex.includes('sitemap-store-6.xml'));
    const storeChunk6Path = join(root, 'public', 'sitemap-store-6.xml');
    check('sitemap-store-6.xml exists', existsSync(storeChunk6Path));
    if (existsSync(storeChunk6Path)) {
        const storeChunk6 = readFileSync(storeChunk6Path, 'utf8');
        assertValidXml('sitemap-store-6.xml', storeChunk6);
        const chunk6Count = Math.max(0, seoCount - 50_000);
        check('store chunk 6 url count', (storeChunk6.match(/<loc>/g) || []).length === chunk6Count);
    }
}

const coreSitemap = readFileSync(join(root, 'public', 'sitemap-core.xml'), 'utf8');
assertValidXml('sitemap-core.xml', coreSitemap);
check('core sitemap has home', coreSitemap.includes('<loc>https://www.thevesselcode.com/</loc>'));
check('core sitemap has toolkit', coreSitemap.includes('<loc>https://www.thevesselcode.com/toolkit</loc>'));
check('core sitemap has contact-us', coreSitemap.includes('<loc>https://www.thevesselcode.com/contact-us</loc>'));
check('core sitemap has ship-repair-korea', coreSitemap.includes('<loc>https://www.thevesselcode.com/ship-repair-korea</loc>'));
check('core sitemap has sm', coreSitemap.includes('<loc>https://www.thevesselcode.com/sm</loc>'));
check('core sitemap has services', coreSitemap.includes('<loc>https://www.thevesselcode.com/services</loc>'));
check('core sitemap has insights', coreSitemap.includes('<loc>https://www.thevesselcode.com/insights</loc>'));

const storeChunk = readFileSync(join(root, 'public', 'sitemap-store-1.xml'), 'utf8');
assertValidXml('sitemap-store-1.xml', storeChunk);
const storeChunk2Path = join(root, 'public', 'sitemap-store-2.xml');
const storeChunk2 = existsSync(storeChunk2Path) ? readFileSync(storeChunk2Path, 'utf8') : '';
const storeChunk3Path = join(root, 'public', 'sitemap-store-3.xml');
const storeChunk3 = existsSync(storeChunk3Path) ? readFileSync(storeChunk3Path, 'utf8') : '';
const storeChunk4Path = join(root, 'public', 'sitemap-store-4.xml');
const storeChunk4 = existsSync(storeChunk4Path) ? readFileSync(storeChunk4Path, 'utf8') : '';
const storeChunk5Path = join(root, 'public', 'sitemap-store-5.xml');
const storeChunk5 = existsSync(storeChunk5Path) ? readFileSync(storeChunk5Path, 'utf8') : '';
let testCodeInSitemap = false;
for (let n = 1; n <= 20; n += 1) {
    const chunkPath = join(root, 'public', `sitemap-store-${n}.xml`);
    if (!existsSync(chunkPath)) break;
    const chunkXml = readFileSync(chunkPath, 'utf8');
    if (chunkXml.includes(`/store/${TEST_CODE}`)) {
        testCodeInSitemap = true;
        break;
    }
}
check('store sitemap includes test code', testCodeInSitemap);
check('store chunk uses www origin', storeChunk.includes('<loc>https://www.thevesselcode.com/store/'));
check('robots references www sitemap', readFileSync(join(root, 'public', 'robots.txt'), 'utf8').includes('Sitemap: https://www.thevesselcode.com/sitemap.xml'));
const robotsTxt = readFileSync(join(root, 'public', 'robots.txt'), 'utf8');
const storeChunks = (sitemapIndex.match(/sitemap-store-\d+\.xml/g) || []).filter((v, i, a) => a.indexOf(v) === i);
storeChunks.forEach((fileName) => {
  check(`robots allow ${fileName}`, robotsTxt.includes(`Allow: /${fileName}`));
  check(`robots sitemap ${fileName}`, robotsTxt.includes(`Sitemap: https://www.thevesselcode.com/${fileName}`));
});
check('robots references sitemap core', robotsTxt.includes('Sitemap: https://www.thevesselcode.com/sitemap-core.xml'));
check('robots sitemap count matches index', (robotsTxt.match(/^Sitemap: /gm) || []).length === storeChunks.length + 2);

const GSC_HUB_CODES = [
    '231016', '790669', '790228', '812101', '617425', '331197', '591150', '190123', '614273',
];

const home = readFileSync(join(root, 'home', 'index.html'), 'utf8');
check('home high-intent impa grid', home.includes('class="high-intent-impa-grid"'));
check('home store spec index link', home.includes('<a href="/store/812101">Marine Store Spec Index (IMPA 812101)</a>'));
check('home ship repair korea pillar link', home.includes('href="/ship-repair-korea"') && home.includes('Ship Repair in Korea'));
GSC_HUB_CODES.forEach((code) => {
    check(`home links /store/${code}`, home.includes(`href="/store/${code}"`));
});

const toolkit = readFileSync(join(root, 'toolkit.html'), 'utf8');
check('toolkit high-intent impa grid', toolkit.includes('class="high-intent-impa-grid"'));
GSC_HUB_CODES.forEach((code) => {
    check(`toolkit links /store/${code}`, toolkit.includes(`href="/store/${code}"`));
});
check(
    'toolkit catalog tab',
    toolkit.includes('data-tool-tab="catalog"') || toolkit.includes('mkt-module-card--catalog'),
);
check('toolkit canonical', toolkit.includes('rel="canonical" href="https://www.thevesselcode.com/toolkit"'));
check('toolkit ship repair korea pillar link', toolkit.includes('href="/ship-repair-korea"') && toolkit.includes('Ship Repair in Korea'));
check(
    'store page ship repair korea footer link',
    html.includes('href="https://www.thevesselcode.com/ship-repair-korea"')
        && html.includes('Ship Repair in Korea (Busan · Ulsan · Yeosu)'),
);

const srkPage = readFileSync(join(root, 'ship-repair-korea', 'index.html'), 'utf8');
check('ship repair korea page title', srkPage.includes('Ship Repair in Korea | 24/7 Turnkey Afloat &amp; Port Service'));
check('ship repair korea meta description', srkPage.includes('Certified 24/7 ship repair, technical husbandry, and drydock attendance across Busan, Ulsan, and Yeosu'));
check('ship repair korea h1', srkPage.includes('Turnkey Ship Repair &amp; Technical Husbandry in South Korea'));
check('ship repair korea port table', srkPage.includes('srk-port-table') && srkPage.includes('Busan') && srkPage.includes('Yeosu'));
check('ship repair korea json-ld professional service', srkPage.includes('"@type": "ProfessionalService"'));

HUB_CODES.forEach((code) => {
    const hubItem = impaSeo.getItemByCode(code);
    check(`hub code in seo index ${code}`, !!hubItem?.name, hubItem?.name || 'missing');
});

const failed = results.filter((r) => !r.ok);
if (failed.length) {
    console.error('\nSEO sitemap tests FAILED:', failed.map((f) => f.name).join(', '));
    process.exit(1);
}
console.log('\nSEO sitemap tests passed.');
