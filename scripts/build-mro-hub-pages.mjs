#!/usr/bin/env node
/**
 * Generate static MRO category hub pages under mro/{slug}/index.html
 * Usage: node scripts/build-mro-hub-pages.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://www.thevesselcode.com';
const WA = '821038894291';

const HUBS = [
    {
        slug: 'valves',
        categoryTitle: 'Industrial & Marine Valves',
        metaDescription:
            'JIS, DIN, and ANSI valve specifications — globe, gate, ball, butterfly, and safety valves for plant MRO and marine superintendents. Dimensions, PCD, and fast B2B RFQ.',
        h1: 'Industrial & Marine Valves — JIS · DIN · ANSI · ISO Cross-Reference',
        intro:
            'Compare nominal sizes, pressure ratings, and bolt circles for globe, gate, ball, and butterfly valves used in shore plants and shipboard piping (IMPA Chapter 75). Each row links to verified IMPA drawings and dimensions.',
        standards: ['JIS 5K/10K', 'DIN PN16', 'ANSI 150#', 'ISO'],
        rows: [
            { nominal: '50A', rating: 'JIS 10K', face: '180 mm', pcd: '155 mm', bolts: '4', code: '750231', name: 'Globe Valve JIS 10K 50A' },
            { nominal: '50A', rating: 'JIS 10K', face: '—', pcd: '155 mm', bolts: '4', code: '750101', name: 'Bronze Globe Valve 50A' },
            { nominal: '15A', rating: 'Ring joint', face: '—', pcd: '—', bolts: '—', code: '752106', name: 'Brass Needle Valve' },
            { nominal: 'DN50', rating: 'PN16', face: '180 mm', pcd: '165 mm', bolts: '4', code: '812101', name: 'Gate Valve Bronze DN50' },
            { nominal: 'DN40', rating: 'Bronze', face: '170 mm', pcd: '—', bolts: '4', code: '812105', name: 'Globe Valve Bronze DN40' },
            { nominal: 'DN80', rating: 'Lug', face: '—', pcd: '—', bolts: '—', code: '812204', name: 'Butterfly Valve DN80' },
            { nominal: 'DN25', rating: 'Full bore', face: '—', pcd: '—', bolts: '—', code: '812851', name: 'Ball Valve Stainless DN25' },
            { nominal: '50A', rating: 'DIN PN16', face: '—', pcd: '165 mm', bolts: '4', code: '755601', name: 'Gate Valve DIN CI 50A' },
        ],
    },
    {
        slug: 'pipes-fittings',
        categoryTitle: 'Pipes, Flanges & Fittings',
        metaDescription:
            'Flanges, gaskets, couplings, and expansion joints — industrial and marine piping specs (IMPA Ch 81). JIS/DIN/ANSI dimensions with instant RFQ for plant and port delivery.',
        h1: 'Pipes & Fittings — Flanges, Gaskets, Couplings (JIS · DIN · ANSI)',
        intro:
            'High-intent reference for flange-facing, gasket sheets, and packaged valves tied to piping systems (IMPA Chapters 75/81). Use for shore MRO requisitions and bonded marine stores.',
        standards: ['JIS 10K', 'DIN PN16', 'ANSI 150LB', 'ISO'],
        rows: [
            { nominal: 'DN50', rating: 'PN16', face: '180 mm', pcd: '165 mm', bolts: '4', code: '812101', name: 'Gate Valve Bronze Flanged DN50' },
            { nominal: 'DN80', rating: 'Lug type', face: '—', pcd: '—', bolts: '—', code: '812204', name: 'Butterfly Valve DN80' },
            { nominal: 'Sheet', rating: 'Steam std', face: '—', pcd: '—', bolts: '—', code: '811010', name: 'Gasket Steam Standard' },
            { nominal: '0.5 mm', rating: '5611 sheet', face: '—', pcd: '—', bolts: '—', code: '811040', name: 'Gasket Joint Sheet 0.5 mm' },
            { nominal: 'DN25', rating: 'SS full bore', face: '—', pcd: '—', bolts: '—', code: '812851', name: 'Ball Valve DN25' },
            { nominal: '50A', rating: 'DIN CI', face: '—', pcd: '165 mm', bolts: '4', code: '755601', name: 'Gate Valve DIN 50A' },
            { nominal: 'DN40', rating: 'Bronze', face: '170 mm', pcd: '—', bolts: '4', code: '812105', name: 'Globe Valve DN40' },
            { nominal: '50A', rating: 'JIS 10K', face: '180 mm', pcd: '155 mm', bolts: '4', code: '750231', name: 'Globe Valve JIS 10K 50A' },
        ],
    },
    {
        slug: 'bearings',
        categoryTitle: 'Bearings & Power Transmission',
        metaDescription:
            'Ball and roller bearings, pillow blocks, and bushings for industrial plant and marine machinery (IMPA Ch 77). SKF-class references with IMPA store links and RFQ.',
        h1: 'Bearings — Ball, Roller & Marine Machinery (ISO · DIN · JIS)',
        intro:
            'Deep-groove and sealed ball bearings commonly cross-referenced between shore MRO catalogs and IMPA marine stores (Chapter 77). Link through to drawings and RFQ.',
        standards: ['ISO', 'DIN', 'JIS', 'ABEC'],
        rows: [
            { nominal: '6205', rating: 'Open', face: '—', pcd: '—', bolts: '—', code: '770201', name: 'Ball Bearing 6205 Open' },
            { nominal: '6205', rating: '2RS sealed', face: '—', pcd: '—', bolts: '—', code: '770301', name: 'Ball Bearing 6205 2RS' },
            { nominal: '6308', rating: 'Open', face: '—', pcd: '—', bolts: '—', code: '770401', name: 'Ball Bearing 6308' },
            { nominal: '6308', rating: '2RS', face: '—', pcd: '—', bolts: '—', code: '770501', name: 'Ball Bearing 6308 2RS' },
            { nominal: '6204', rating: 'Open', face: '—', pcd: '—', bolts: '—', code: '770101', name: 'Ball Bearing 6204' },
            { nominal: '6206', rating: 'Open', face: '—', pcd: '—', bolts: '—', code: '770601', name: 'Ball Bearing 6206' },
        ],
    },
    {
        slug: 'tools',
        categoryTitle: 'Industrial & Marine Tools',
        metaDescription:
            'Pneumatic, hydraulic, cutting, and hand tools for plant maintenance and shipboard MRO (IMPA Ch 61). Fast multi-line RFQ and WhatsApp quotes for superintendents.',
        h1: 'Tools — Pneumatic, Hydraulic & Hand (Marine Ch 61 · Plant MRO)',
        intro:
            'Impact wrenches, crimpers, lubrication pumps, and portable shop tools with IMPA catalog plates. Built for shore storerooms and vessel spare requisitions.',
        standards: ['ISO', 'DIN', 'ANSI drive'],
        rows: [
            { nominal: '1/2" sq', rating: 'Pneumatic', face: '—', pcd: '—', bolts: '—', code: '590101', name: 'Impact Wrench 12.7 mm sq' },
            { nominal: '3/4" sq', rating: 'Pneumatic', face: '—', pcd: '—', bolts: '—', code: '590102', name: 'Impact Wrench 15.9 mm sq' },
            { nominal: '14 mm', rating: 'Battery', face: '—', pcd: '—', bolts: '—', code: '591150', name: 'Crimping Tool Battery' },
            { nominal: '2" air', rating: 'Grease', face: '—', pcd: '—', bolts: '—', code: '617425', name: 'Lubrication Piston Pump' },
            { nominal: '8 mm', rating: 'Socket', face: '—', pcd: '—', bolts: '—', code: '590203', name: 'Impact Socket 8 mm' },
            { nominal: '19 mm', rating: 'Saw blade', face: '—', pcd: '—', bolts: '—', code: '590705', name: 'Pneumatic Saw Blade' },
        ],
    },
];

function escapeHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function buildJsonLd(hub) {
    const pageUrl = `${ORIGIN}/mro/${hub.slug}`;
    const items = hub.rows.slice(0, 12).map((row, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${ORIGIN}/store/${row.code}`,
        name: `IMPA ${row.code} ${row.name}`,
    }));
    return JSON.stringify([
        {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: hub.categoryTitle,
            description: hub.metaDescription,
            url: pageUrl,
            isPartOf: { '@type': 'WebSite', name: 'THE VESSEL CODE', url: ORIGIN },
        },
        {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: `${hub.categoryTitle} — representative IMPA items`,
            itemListElement: items,
        },
    ]);
}

function buildHubHtml(hub) {
    const path = `/mro/${hub.slug}`;
    const pageUrl = `${ORIGIN}${path}`;
    const title = `${hub.categoryTitle} Industrial & Marine Specifications & Dimensions | The Vessel Code`;
    const rfqUrl = `${ORIGIN}/contact-us?inquiry=rfq&ref=${encodeURIComponent(path)}&utm_source=mro_hub&utm_medium=organic&utm_campaign=multi_rfq`;
    const trialUrl = `${ORIGIN}/contact-us?inquiry=fleet-trial&ref=${encodeURIComponent(path)}`;
    const waText = encodeURIComponent(`RFQ — ${hub.categoryTitle} multi-line spec quote (plant / port delivery): `);
    const waUrl = `https://wa.me/${WA}?text=${waText}`;

    const tableRows = hub.rows.map((row) => `
            <tr>
              <td>${escapeHtml(row.nominal)}</td>
              <td>${escapeHtml(row.rating)}</td>
              <td>${escapeHtml(row.face)}</td>
              <td>${escapeHtml(row.pcd)}</td>
              <td>${escapeHtml(row.bolts)}</td>
              <td><a href="/store/${escapeHtml(row.code)}">IMPA ${escapeHtml(row.code)}</a><br><span class="muted">${escapeHtml(row.name)}</span></td>
            </tr>`).join('');

    const standardsLi = hub.standards.map((s) => `<li>${escapeHtml(s)}</li>`).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-XB1B5NY3NB"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-XB1B5NY3NB');
  </script>
  <script async src="/js/marketing-analytics.js?v=20260920-ga4-live"></script>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="#f1f5f9">
  <meta name="description" content="${escapeHtml(hub.metaDescription)}">
  <title>${escapeHtml(title)}</title>
  <link rel="canonical" href="${pageUrl}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="THE VESSEL CODE">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(hub.metaDescription)}">
  <meta property="og:url" content="${pageUrl}">
  <link rel="icon" type="image/png" href="/icons/company-logo.png">
  <link rel="stylesheet" href="/css/marketing-shell.css?v=20260919-conversion-network">
  <link rel="stylesheet" href="/css/marketing-theme.css?v=20260914-contrast-pricing">
  <link rel="stylesheet" href="/css/marketing-readability.css?v=20260919-conversion-network">
  <link rel="stylesheet" href="/css/mro-hub.css?v=20260927-hubs">
  <link rel="stylesheet" href="/css/impa-detail.css?v=20260927-hubs">
  <script type="application/ld+json">${buildJsonLd(hub)}</script>
</head>
<body class="tvc-marketing-body mkt-page mro-hub-page" data-mkt-active="toolkit">
  <div class="mkt-site-wrap">
    <div id="marketing-topbar"></div>
    <main class="home-shell">
      <article class="mro-hub-hero">
        <p class="mkt-section-label">Industrial &amp; Marine MRO</p>
        <h1>${escapeHtml(hub.h1)}</h1>
        <p class="mro-hub-lead">${escapeHtml(hub.intro)}</p>
        <ul class="mro-hub-standards">${standardsLi}</ul>
      </article>
      <section aria-label="Standard specification cross-reference">
        <h2 class="mkt-section-label">Specification cross-reference (top IMPA links)</h2>
        <div class="mro-hub-spec-wrap">
          <table class="mro-hub-spec-table spec-table">
            <thead>
              <tr>
                <th scope="col">Nominal</th>
                <th scope="col">Rating / type</th>
                <th scope="col">Face-to-face</th>
                <th scope="col">PCD</th>
                <th scope="col">Bolts</th>
                <th scope="col">IMPA store</th>
              </tr>
            </thead>
            <tbody>${tableRows}
            </tbody>
          </table>
        </div>
      </section>
      <div class="mro-hub-commerce impa-detail-commerce-actions">
        <a class="btn-action-rfq" href="${rfqUrl}">📋 1-Click Multi-Item RFQ</a>
        <a class="btn-action-wa" href="${waUrl}" target="_blank" rel="noopener noreferrer">🟢 Instant Port &amp; Plant Quote</a>
      </div>
      <div class="impa-enterprise-preview-slate" aria-label="TVC-SM fleet features preview">
        <div class="enterprise-preview-row">
          <span class="preview-badge">⚓ TVC-SM Fleet OS</span>
          <span class="preview-text">Live Vessel ROB Auto-Deduction &amp; 1-Click Requisition are managed via TVC-SM.</span>
        </div>
        <div class="enterprise-preview-action">
          <a href="${trialUrl}" class="preview-link" data-analytics="poc_cta_click">Start 30-Day Fleet Trial ↗</a>
        </div>
      </div>
      <p class="mro-hub-links"><a href="/toolkit">← Maritime Toolkit &amp; IMPA catalog</a> · <a href="/">THE VESSEL CODE home</a></p>
    </main>
  </div>
  <script src="/js/marketing-shell.js?v=20260919-conversion-network"></script>
</body>
</html>
`;
}

function main() {
    for (const hub of HUBS) {
        const dir = join(ROOT, 'mro', hub.slug);
        mkdirSync(dir, { recursive: true });
        const out = join(dir, 'index.html');
        writeFileSync(out, buildHubHtml(hub));
        console.log('OK', out.replace(`${ROOT}/`, ''));
    }
}

main();
