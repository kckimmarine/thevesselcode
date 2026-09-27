#!/usr/bin/env node
/**
 * Smoke test: marketing site shell, routing, and shared header
 * Run: node scripts/test-home-landing.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const results = [];

function check(name, ok, detail = '') {
    results.push({ name, ok, detail });
    console.log(ok ? 'OK' : 'FAIL', name, detail ? `— ${detail}` : '');
}

check('home/index.html exists', existsSync(join(ROOT, 'home/index.html')));
check('services/index.html exists', existsSync(join(ROOT, 'services/index.html')));
check('sm/index.html exists', existsSync(join(ROOT, 'sm/index.html')));
check('contact-us/index.html exists', existsSync(join(ROOT, 'contact-us/index.html')));
check('js/marketing-shell.js exists', existsSync(join(ROOT, 'js/marketing-shell.js')));
check('css/marketing-shell.css exists', existsSync(join(ROOT, 'css/marketing-shell.css')));

const vercel = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'));
const redirects = vercel.redirects || [];
const rewrites = vercel.rewrites || [];

check('home redirect to root', redirects.some((r) => r.source === '/home/' && r.destination === '/'));
check('about-contact redirect', redirects.some((r) => r.source === '/about-contact/' && r.destination === '/contact-us'));
check('no / -> /home/ redirect', !redirects.some((r) => r.destination === '/home/'));
check('app host root rewrite', rewrites.some((r) => r.source === '/' && r.destination === '/app.html'));
check('marketing host root rewrite', rewrites.some((r) => r.source === '/' && r.destination === '/home/index.html'));
check('services rewrite', rewrites.some((r) => r.destination === '/services/index.html'));
check('sm rewrite', rewrites.some((r) => r.destination === '/sm/index.html'));
check('no pms redirect to sm', !redirects.some((r) => r.source === '/pms' || r.source === '/pms/'));
check('pms not rewritten to app', !rewrites.some((r) => r.destination === '/pms/index.html'));
check('contact-us rewrite', rewrites.some((r) => r.destination === '/contact-us/index.html'));
check('mro valves rewrite', rewrites.some((r) => r.source === '/mro/valves' && r.destination === '/mro/valves/index.html'));
check('mro pipes-fittings rewrite', rewrites.some((r) => r.source === '/mro/pipes-fittings' && r.destination === '/mro/pipes-fittings/index.html'));
check('mro bearings rewrite', rewrites.some((r) => r.source === '/mro/bearings' && r.destination === '/mro/bearings/index.html'));
check('mro tools rewrite', rewrites.some((r) => r.source === '/mro/tools' && r.destination === '/mro/tools/index.html'));

const shell = readFileSync(join(ROOT, 'js/marketing-shell.js'), 'utf8');
const home = readFileSync(join(ROOT, 'home/index.html'), 'utf8');
check('marketing topbar mount', home.includes('id="marketing-topbar"'));
check('marketing shell script', home.includes('marketing-shell.js'));
check('home uses relative marketing css', /href="\.\.\/css\/marketing-theme\.css/.test(home));
check('home uses relative marketing js', /src="\.\.\/js\/marketing-shell\.js/.test(home));
check('hero benefit headline', home.includes('THE VESSEL CODE (TVC-SM)') && home.includes('data-i18n="home.headline"'));
check('hero subheadline', home.includes('home.subheadline') && home.includes('Maritime AX'));
check('home core capabilities section', home.includes('id="core-capabilities"') && home.includes('home.capabilities.title'));
check('home pricing section', home.includes('id="pricing-plans"') && home.includes('home.pricing.title'));
check('home domain authority section', home.includes('id="domain-authority"') && home.includes('home.authority.title'));
check('hero headline i18n key', home.includes('data-i18n="home.headline"'));
check('marketing i18n persistence key', readFileSync(join(ROOT, 'js/marketing-i18n.js'), 'utf8').includes("STORAGE_KEY = 'tvc-mkt-lang'"));
check('hero search form', home.includes('id="homeHeroSearchForm"') && home.includes('homeHeroSearchInput'));
check('unified search copy', home.includes('home.search.subtitle') && home.includes('Maritime Intelligence'));
check('hero utility badges', home.includes('home-utility-badge') && home.includes('/toolkit?tool=bunker') && home.includes('tool=compliance'));
check('hero brain chip', home.includes('data-home-route="brain"'));
check('unified search script', home.includes('home-hero-search.js'));
check('home benefits grid', home.includes('home-benefits-section') && home.includes('home-grid-4'));
check('home product showcase', home.includes('home-showcase-section') && home.includes('/toolkit') && home.includes('Launch Free Toolkit'));
check(
    'home impa card strip',
    home.includes('high-intent-impa-grid') && home.includes('href="/store/812101"'),
);
check('topbar launch pill i18n', shell.includes('nav.launchPill') && shell.includes('Launch App'));
check('hero search-first layout', home.includes('hero-search-first') && !home.includes('hero-realistic-canvas'));
check('hero ocean chevron layout', home.includes('hero-ocean-chevron') && home.includes('home-ocean-hero-horizon.webp'));
check(
    'home featured suite section',
    home.includes('home-featured-suite-wrap') && home.includes('TVC_TotalServiceBar.buildHomeFeaturedSuiteHtml'),
);
check('home featured carousel script', home.includes('homeFeaturedCarousel.js'));
check('featured carousel markup', existsSync(join(ROOT, 'js/ui/homeFeaturedCarousel.js')));
check(
    'hero ocean image asset exists',
    existsSync(join(ROOT, 'public/assets/images/home-ocean-hero-horizon.webp')),
);
check('marketing readability css', home.includes('marketing-readability.css'));
const toolkitHtml = readFileSync(join(ROOT, 'toolkit.html'), 'utf8');
check('toolkit no promo clutter', !toolkitHtml.includes('mkt-pricing-band') && !toolkitHtml.includes('toolkit-plg-band') && !toolkitHtml.includes('toolkit-popular-impa') && !toolkitHtml.includes('mkt-plg-locks'));
check('toolkit no enterprise slate in hero', !toolkitHtml.includes('impa-enterprise-preview-slate'));
check(
    'toolkit industrial specs hub links',
    toolkitHtml.includes('mro-industrial-specs-list')
        && toolkitHtml.includes('href="/mro/valves"')
        && toolkitHtml.includes('href="/mro/pipes-fittings"')
        && toolkitHtml.includes('href="/mro/bearings"')
        && toolkitHtml.includes('href="/mro/tools"'),
);
check(
    'toolkit pipe schedule section',
    toolkitHtml.includes('id="pipe-schedule"')
        && toolkitHtml.includes('pipeScheduleData.js')
        && toolkitHtml.includes('pipeScheduleRenderer.js')
        && toolkitHtml.includes('TechArticle'),
);
check(
    'toolkit eca map section',
    toolkitHtml.includes('id="eca-map"')
        && toolkitHtml.includes('ecaMapRenderer.js')
        && toolkitHtml.includes('SOx ECA boundaries map'),
);
const maritimeRegsPath = join(ROOT, 'data/maritime-regulations.json');
check('maritime-regulations.json exists', existsSync(maritimeRegsPath));
if (existsSync(maritimeRegsPath)) {
    const maritimeRegs = JSON.parse(readFileSync(maritimeRegsPath, 'utf8'));
    check(
        'maritime ECA region datasets',
        Array.isArray(maritimeRegs.ecaRegions) && maritimeRegs.ecaRegions.length >= 7,
        String(maritimeRegs.ecaRegions?.length),
    );
    check(
        'maritime port dossiers',
        Array.isArray(maritimeRegs.ports) && maritimeRegs.ports.length >= 6,
        String(maritimeRegs.ports?.length),
    );
    maritimeRegs.ecaRegions.forEach((region) => {
        const rings = region.polygons?.length ? region.polygons : [region.polygon];
        const verts = rings.reduce((n, ring) => n + (ring?.length || 0), 0);
        check(
            `ECA polygon ${region.id}`,
            rings.every((ring) => Array.isArray(ring) && ring.length >= 3) && verts >= 8,
            `${rings.length} ring(s), ${verts} vertices`,
        );
    });
}
const ecaRendererSrc = readFileSync(join(ROOT, 'js/toolkit/ecaMapRenderer.js'), 'utf8');
check('eca map renderer exports', ecaRendererSrc.includes('TVC_EcaMapRenderer') && ecaRendererSrc.includes('maritime-regulations.json'));
check('korea ports hub page', existsSync(join(ROOT, 'services/korea-ports-hub/index.html')));
check(
    'vercel korea ports hub rewrite',
    rewrites.some((r) => r.source === '/services/korea-ports-hub' && r.destination === '/services/korea-ports-hub/index.html'),
);

function extractJsonLdBlocks(html) {
    const blocks = [];
    const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
        try {
            const parsed = JSON.parse(m[1].trim());
            if (Array.isArray(parsed)) blocks.push(...parsed);
            else blocks.push(parsed);
        } catch {
            /* skip malformed */
        }
    }
    return blocks;
}

function validateGoogleDataset(node, label) {
    if (!node || node['@type'] !== 'Dataset') return false;
    const desc = String(node.description || '');
    const creator = node.creator;
    const publisher = node.publisher;
    const creatorOk = creator?.['@type'] === 'Organization' && creator.name && creator.url;
    const publisherOk = publisher?.['@type'] === 'Organization' && publisher.name && publisher.url;
    const licenseOk = typeof node.license === 'string' && node.license.startsWith('https://');
    const spatialOk = Boolean(node.spatialCoverage || node.variableMeasured);
    return Boolean(
        node.name
            && desc.length >= 50
            && node.url
            && creatorOk
            && publisherOk
            && licenseOk
            && node.isAccessibleForFree === true
            && spatialOk,
    );
}

const toolkitLd = extractJsonLdBlocks(toolkitHtml);
const toolkitDataset = toolkitLd.find((n) => n['@type'] === 'Dataset');
check('toolkit Dataset JSON-LD valid for GSC', validateGoogleDataset(toolkitDataset, 'toolkit'));
const koreaHubHtml = existsSync(join(ROOT, 'services/korea-ports-hub/index.html'))
    ? readFileSync(join(ROOT, 'services/korea-ports-hub/index.html'), 'utf8')
    : '';
const koreaDataset = extractJsonLdBlocks(koreaHubHtml).find((n) => n['@type'] === 'Dataset');
check('korea ports hub Dataset JSON-LD valid for GSC', validateGoogleDataset(koreaDataset, 'korea-ports-hub'));
const pipeScheduleSandbox = { globalThis: {}, module: { exports: {} } };
pipeScheduleSandbox.globalThis = pipeScheduleSandbox;
vm.runInNewContext(
    readFileSync(join(ROOT, 'js/toolkit/pipeScheduleData.js'), 'utf8'),
    pipeScheduleSandbox,
    { filename: 'pipeScheduleData.js' },
);
const pipeRows = pipeScheduleSandbox.globalThis.TVC_PipeScheduleData?.allRows?.() || [];
check('pipe schedule data row count', pipeRows.length >= 10, String(pipeRows.length));
check(
    'mro pipes-fittings pipe schedule cross-link',
    readFileSync(join(ROOT, 'mro/pipes-fittings/index.html'), 'utf8').includes('/toolkit#pipe-schedule'),
);
const MRO_HUB_SLUGS = ['valves', 'pipes-fittings', 'bearings', 'tools'];
MRO_HUB_SLUGS.forEach((slug) => {
    const hubPath = join(ROOT, 'mro', slug, 'index.html');
    check(`mro/${slug}/index.html exists`, existsSync(hubPath));
    if (!existsSync(hubPath)) return;
    const hubHtml = readFileSync(hubPath, 'utf8');
    check(`mro/${slug} has h1`, /<h1[^>]*>[\s\S]+<\/h1>/.test(hubHtml));
    check(`mro/${slug} spec table`, hubHtml.includes('mro-hub-spec-table'));
    check(
        `mro/${slug} rfq triggers`,
        hubHtml.includes('btn-action-rfq') && hubHtml.includes('Multi-Item RFQ') && hubHtml.includes('btn-action-wa'),
    );
    check(`mro/${slug} marketing shell`, hubHtml.includes('marketing-shell.js'));
});
check('toolkit engineering modules', toolkitHtml.includes('mkt-engineering-modules') && toolkitHtml.includes('data-tool-tab="electrical"'));
check('toolkit hero condensed (no top search)', toolkitHtml.includes('toolkit-hero-desc') && !toolkitHtml.includes('mktEngSearchInput'));
check('footer engineer signature', shell.includes('footer-engineer-signature') && shell.includes('1st Class Marine Engineer License'));
check('home no abstract trio grid', !home.includes('mkt-trio-grid') && !home.includes('home-edge-section'));
check('nav four core tabs only', shell.includes("id: 'toolkit'") && shell.includes("id: 'sm'") && !shell.includes("id: 'forum'"));
check('home hero no photo background', !home.includes('mkt-hero-smart-vessel') && !home.includes('home-hero-variant-picker'));
check('sync-public-assets script exists', existsSync(join(ROOT, 'scripts/sync-public-assets.mjs')));
check('home hero eyebrow removed', !home.includes('Former C/E') && !home.includes('home-eyebrow'));
check('services link in marketing shell', shell.includes("href: '/services'"));
check('services in primary nav', shell.includes("id: 'services'") && shell.includes("i18n: 'nav.services'"));
check('sm nav internal route', shell.includes("href: '/sm'") && shell.includes("id: 'sm'"));
check('contact us link in marketing footer', shell.includes("href: '/contact-us'"));
check('no inline services section on home', !home.includes('id="service-superintendent"'));
check('canonical root www', home.includes('https://www.thevesselcode.com/'));

const services = readFileSync(join(ROOT, 'services/index.html'), 'utf8');
check('services page concise cards', services.includes('Technical Superintendent Oversight') && services.includes('TVC-SM Fleet Integration'));
check('services metric cards not bullet walls', services.includes('mkt-metric-row') && !services.includes('home-service-takeaways'));
check('services active nav', services.includes('data-mkt-active="services"'));
check('services no photo card classes', !services.includes('home-service-card--photo'));

const sm = readFileSync(join(ROOT, 'sm/index.html'), 'utf8');
check('sm page hero title', sm.includes('Integrated Ship Management Platform'));
check('sm active nav', sm.includes('data-mkt-active="sm"'));
check('sm launch app CTA', sm.includes('Launch TVC-SM') && sm.includes('href="https://app.thevesselcode.com"'));
check('sm fleet demo CTA', sm.includes('Request Fleet Demo') && sm.includes('href="/contact-us'));
check('sm essentials section', sm.includes('smEssentials') && sm.includes('mkt-trio-grid') && !sm.includes('Automated RFQ workflows'));
check('home explore sm internal', home.includes('href="/sm"') && home.includes('Test TVC-SM Fleet OS'));

check('pms marketing page removed', !existsSync(join(ROOT, 'pms/index.html')));

const contact = readFileSync(join(ROOT, 'contact-us/index.html'), 'utf8');
check('contact us title', contact.includes('Contact Us | THE VESSEL CODE'));
check('contact form', contact.includes('id="acContactForm"'));

const toolkit = readFileSync(join(ROOT, 'toolkit.html'), 'utf8');
check('toolkit shared header', toolkit.includes('marketing-topbar'));
check('toolkit no legacy header', !toolkit.includes('store-public-header'));

check('nav contact us in topbar', shell.includes("i18n: 'nav.contact'"));
check('marketing i18n module', existsSync(join(ROOT, 'js/marketing-i18n.js')));
check('header contact CTA removed', !shell.includes('home-topbar-cta'));

const marketingCss = [
    join(ROOT, 'css/marketing-theme.css'),
    join(ROOT, 'home/index.html'),
    join(ROOT, 'services/index.html'),
    join(ROOT, 'sm/index.html'),
    join(ROOT, 'contact-us/index.html'),
].map((p) => readFileSync(p, 'utf8')).join('\n');
check('no unsplash on marketing pages', !/unsplash\.com/i.test(marketingCss));
check('marketing theme css exists', existsSync(join(ROOT, 'css/marketing-theme.css')));
const themeCss = readFileSync(join(ROOT, 'css/marketing-theme.css'), 'utf8');
check('no hero photo background css', !themeCss.includes('hero-smart-vessel') && !themeCss.includes('home-service-card--photo'));
check('no marketing-photography css', !existsSync(join(ROOT, 'css/marketing-photography.css')));

check('build skips dist/index.html', !existsSync(join(ROOT, 'dist/index.html')));
check('build outputs pms app shell', existsSync(join(ROOT, 'dist/app.html')));
check('build outputs marketing home', existsSync(join(ROOT, 'dist/home/index.html')));
if (existsSync(join(ROOT, 'dist/app.html'))) {
    const distApp = readFileSync(join(ROOT, 'dist/app.html'), 'utf8');
    check('dist/app.html is PMS', distApp.includes('TVC_App') || distApp.includes('TVC-PMS'));
}
if (existsSync(join(ROOT, 'dist/home/index.html'))) {
    const distHome = readFileSync(join(ROOT, 'dist/home/index.html'), 'utf8');
    check('dist/home/index.html is marketing', distHome.includes('marketing-shell.js'));
}
if (existsSync(join(ROOT, 'dist/sm/index.html'))) {
    const distSm = readFileSync(join(ROOT, 'dist/sm/index.html'), 'utf8');
    check('dist/sm/index.html is TVC-SM intro', distSm.includes('Integrated Ship Management Platform'));
}
check('dist has no pms route', !existsSync(join(ROOT, 'dist/pms/index.html')));

const failed = results.filter((r) => !r.ok);
if (failed.length) {
    console.error('\nMarketing site tests FAILED');
    process.exit(1);
}
console.log('\nMarketing site tests passed.');
