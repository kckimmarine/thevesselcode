#!/usr/bin/env node
/**
 * Validate IMPA programmatic SEO artifacts and HTML renderer.
 * Run: node scripts/test-store-seo.mjs
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const root = process.cwd();
const require = createRequire(import.meta.url);

function run(label, cmd, args) {
    const result = spawnSync(cmd, args, { cwd: root, stdio: 'inherit' });
    if (result.status !== 0) {
        throw new Error(`${label} failed`);
    }
}

const results = [];
function check(name, ok, detail = '') {
    results.push({ name, ok, detail });
    console.log(ok ? 'OK' : 'FAIL', name, detail ? `— ${detail}` : '');
}

run('merge', 'node', ['scripts/merge-impa-chapters.mjs']);
run('seo-index', 'node', ['scripts/generate-impa-seo-index.mjs']);
run('sitemap', 'node', ['scripts/generate-sitemap.mjs']);

const indexPath = join(root, 'api', '_data', 'impa-seo-index.json');
check('seo index exists', existsSync(indexPath));
const index = JSON.parse(readFileSync(indexPath, 'utf8'));
check('seo index has items', index.count > 0, String(index.count));

const sampleCode = Object.keys(index.items).sort()[0];
const impaSeo = require('../api/_lib/impaSeo.js');
const item = impaSeo.getItemByCode(sampleCode);
check('lookup sample item', !!item?.name, sampleCode);

const html = impaSeo.buildStoreItemHtml(item, { origin: 'https://app.thevesselcode.com' });
const pageTitle = impaSeo.buildPageTitle(item);
check('title has drawing specs hook', pageTitle.includes('[Drawing & Specs]') && pageTitle.includes('Fast RFQ'));
check('title length serp budget', pageTitle.length <= impaSeo.SERP_TITLE_MAX_LEN, String(pageTitle.length));
check('html has title', html.includes(`<title>${pageTitle.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</title>`));
check('html has canonical', html.includes(`/store/${sampleCode}`));
check('html has description meta', html.includes('View verified technical drawing') && html.includes('Instant quotation available at Busan'));
check('html plate alt drawing', html.includes('Technical Drawing and Catalog Plate'));
check('html json-ld breadcrumb', html.includes('BreadcrumbList'));
check('html json-ld order action', html.includes('OrderAction'));
check('html has og:image', html.includes('property="og:image"'));
check('html has spec table', html.includes('spec-table'));
check('html has toolkit link', html.includes('toolkit?impa='));
check('html has json-ld', html.includes('application/ld+json'));
check('html has tvc-sm banner', html.includes('class="tvc-sm-banner"'));
check('html has rfq lead block', html.includes('store-rfq-lead'));
check('html has rfq contact link', html.includes('inquiry=rfq'));
check('html has fleet poc cta', html.includes('inquiry=poc'));
check('html has turnkey port hub', html.includes('class="turnkey-port-hub"') && html.includes('Turnkey Port Solution'));
check('html has turnkey inquiry cta', html.includes('data-turnkey-inquiry-open'));
check('html has install overhaul funnel', html.includes('class="turnkey-install-funnel"') && html.includes('Turnkey Port Installation'));
check(
    'html install funnel links ship repair with impa',
    html.includes('/ship-repair-korea?') && html.includes(`impa=${sampleCode}`),
);
check('html has tvc-sm retention banner', html.includes('class="tvc-sm-retention-banner"') && html.includes('/sm#pricing'));
check(
    'html has total service suite bar',
    html.includes('class="total-service-bar"')
        && html.includes('Complete Port Call &amp; Technical Care in Korea · China · Singapore'),
);
check(
    'html store bridge turnkey cta',
    html.includes('cross-bridge-cta--store')
        && html.includes('Book Turnkey Port Call')
        && html.includes('/ship-repair-korea?')
        && html.includes(`impa=${sampleCode}`),
);
check('html has related items section', html.includes('class="related-items"'));

const turnkey = require('../js/ui/turnkeyPortHub.js');
const modalProbe = turnkey.buildContactTurnkeyUrl({
    vessel: 'MV Test',
    portEta: 'Busan',
    needs: 'Valve job',
    includeHusbandry: true,
    includeImpaSourcing: true,
    includeSuperintendent: true,
});
const modalMsg = new URL(modalProbe, 'https://thevesselcode.com').searchParams.get('message') || '';
check(
    'turnkey contact url includes superintendent scope',
    modalMsg.includes('Technical superintendent attendance: YES'),
);

const sitemap = readFileSync(join(root, 'public', 'sitemap.xml'), 'utf8');
check('sitemap index exists', sitemap.includes('<sitemapindex'));
check('sitemap references core pages', sitemap.includes('sitemap-core.xml'));
check('sitemap references store chunk', sitemap.includes('sitemap-store-1.xml'));

let storeUrlCount = 0;
for (let n = 1; n <= 20; n += 1) {
    const chunkPath = join(root, 'public', `sitemap-store-${n}.xml`);
    if (!existsSync(chunkPath)) break;
    storeUrlCount += (readFileSync(chunkPath, 'utf8').match(/<loc>/g) || []).length;
}
check('store sitemap url count matches index', storeUrlCount === index.count, `${storeUrlCount} urls`);

const robots = readFileSync(join(root, 'public', 'robots.txt'), 'utf8');
check('robots references sitemap', robots.includes('Sitemap:'));

const failed = results.filter((r) => !r.ok);
if (failed.length) {
    console.error('\nStore SEO tests FAILED:', failed.map((f) => f.name).join(', '));
    process.exit(1);
}
console.log('\nStore SEO tests passed.');
