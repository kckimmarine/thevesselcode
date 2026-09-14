'use strict';

const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');

const CHAPTER_CATEGORY = {
    '33': 'Safety Equipment',
    '59': 'Safety Equipment',
    '61': 'Hand Tools',
    '75': 'Valves & Cocks',
    '79': 'Paints & Coatings',
    '81': 'Packing & Jointing',
};

const INDEX_PATHS = [
    join(process.cwd(), 'api', '_data', 'impa-seo-index.json'),
    join(process.cwd(), 'public', 'data', 'impa-seo-index.json'),
];

let _indexCache = null;

function storeSeoOrigin() {
    const fromEnv = String(process.env.STORE_SEO_ORIGIN || '').trim();
    if (fromEnv) return fromEnv.replace(/\/$/, '');
    return 'https://www.thevesselcode.com';
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function normalizeCode(value) {
    return String(value || '').trim().replace(/\D/g, '').padStart(6, '0').slice(-6);
}

function isValidImpaCode(value) {
    const code = String(value || '').trim();
    return /^\d{4,6}$/.test(code);
}

function expandCompactRow(raw, code) {
    if (!raw || typeof raw !== 'object') return null;
    const impaCode = normalizeCode(raw.c || raw.impa_code || raw.code || code);
    if (!impaCode || impaCode === '000000') return null;
    const chapter = String(raw.g || impaCode.slice(0, 2) || '').trim();
    const specs = raw.specs && typeof raw.specs === 'object' ? { ...raw.specs } : {};
    return {
        impa_code: impaCode,
        code: impaCode,
        name: String(raw.n || raw.name || '').trim(),
        unit: String(raw.u || raw.unit || 'PCS').trim() || 'PCS',
        category: raw.category || CHAPTER_CATEGORY[chapter] || `Chapter ${chapter}`,
        chapter,
        plate_id: String(raw.p || raw.plate_id || raw.plate_no || '').trim(),
        specs,
    };
}

function loadIndex() {
    if (_indexCache) return _indexCache;
    const path = INDEX_PATHS.find((p) => existsSync(p));
    if (!path) {
        throw new Error('IMPA SEO index missing. Run scripts/generate-impa-seo-index.mjs during build.');
    }
    _indexCache = JSON.parse(readFileSync(path, 'utf8'));
    return _indexCache;
}

function getItemByCode(code) {
    const normalized = normalizeCode(code);
    if (!isValidImpaCode(normalized)) return null;
    const index = loadIndex();
    const raw = index.items?.[normalized];
    if (!raw) return null;
    return expandCompactRow(raw, normalized);
}

/** Same-chapter siblings for internal linking (crawler equity, anti-orphan). */
function getRelatedItemsByChapter(impaCode, limit = 6) {
    const normalized = normalizeCode(impaCode);
    const index = loadIndex();
    const current = index.items?.[normalized];
    if (!current) return [];
    const chapter = String(current.g || normalized.slice(0, 2)).trim();
    const codes = Object.keys(index.items)
        .filter((c) => {
            if (c === normalized) return false;
            const row = index.items[c];
            const ch = String(row?.g || c.slice(0, 2)).trim();
            return ch === chapter;
        })
        .sort((a, b) => {
            const da = Math.abs(Number(a) - Number(normalized));
            const db = Math.abs(Number(b) - Number(normalized));
            if (da !== db) return da - db;
            return a.localeCompare(b);
        });
    return codes
        .slice(0, limit)
        .map((c) => expandCompactRow(index.items[c], c))
        .filter(Boolean);
}

const SEO_PRODUCT_CATEGORY = 'Marine Stores';

/** Default catalog plate dimensions (CLS guard when intrinsic size unknown). */
const PLATE_IMG_WIDTH = 560;
const PLATE_IMG_HEIGHT = 420;

function derivePlateAssetUrl(item) {
    const plateId = String(item?.plate_id || '').trim();
    if (plateId) {
        const safe = plateId.replace(/[^a-zA-Z0-9._-]/g, '');
        if (safe) return `/data/plates/${safe}.webp`;
    }
    const code = item?.impa_code || '';
    const chapter = code.slice(0, 2);
    const segment = code.slice(2, 4);
    if (chapter && segment) {
        return `/data/plates/PL-${chapter}-${segment}.webp`;
    }
    return '';
}

const PRIORITY_SPEC_KEYS = ['Rating', 'Material', 'Standard Unit', 'Standard'];

function specRows(item) {
    const specs = item.specs && typeof item.specs === 'object' ? item.specs : {};
    const used = new Set();
    const rows = [
        ['IMPA Code', item.impa_code],
        ['Product Name', item.name],
    ];

    PRIORITY_SPEC_KEYS.forEach((key) => {
        const value = specs[key];
        if (value != null && String(value).trim()) {
            rows.push([key, String(value)]);
            used.add(key);
        }
    });

    if (item.unit && !used.has('Standard Unit')) rows.push(['Standard Unit', item.unit]);
    if (item.category) rows.push(['Catalog Section', item.category]);
    if (item.plate_id) rows.push(['Plate Reference', item.plate_id]);

    Object.entries(specs).forEach(([key, value]) => {
        if (used.has(key)) return;
        if (value != null && String(value).trim()) rows.push([key, String(value)]);
    });

    return rows.filter(([, value]) => String(value || '').trim());
}

function buildOgTitle(item) {
    const name = item.name || 'Marine Store Item';
    return `IMPA CODE ${item.impa_code} - ${name}`;
}

function buildPageTitle(item) {
    const name = item.name || 'Marine Store Item';
    return `IMPA CODE ${item.impa_code} - ${name} | Technical Specs & Maritime Catalog | THE VESSEL CODE`;
}

function buildPrimaryHeading(item) {
    const name = item.name || 'Marine Store Item';
    return `IMPA CODE ${item.impa_code}: ${name}`;
}

function cleanProductTitle(item) {
    let name = String(item?.name || 'Marine Store Item');
    name = name.replace(/\s+\d+(?:\.\d+)?\s*(?:mm|cm|m|mtr|inch|in|")\s*(?:x\s*.+)?$/i, '');
    name = name.replace(/\s+\d+\s*(?:rolls?|rols|pcs|pieces?|boxes?|sets?)(?:\s*per\s*box)?.*$/i, '');
    return name.trim() || String(item?.name || 'Marine Store Item');
}

function buildOgDescription(item) {
    return `Technical specification, dimensions, unit, and maritime catalog plate illustration for IMPA ${item.impa_code}.`;
}

function buildMetaDescription(item) {
    const name = item.name || 'Marine Store Item';
    return `${buildOgDescription(item)} ${name}.`;
}

function buildDescription(item) {
    return buildMetaDescription(item);
}

function resolveMpn(item) {
    const specs = item.specs && typeof item.specs === 'object' ? item.specs : {};
    const fromSpecs = specs['Maker Part No'] || specs['Part No'] || specs.MPN;
    return String(fromSpecs || item.impa_code).trim();
}

function todayIsoDate() {
    return new Date().toISOString().slice(0, 10);
}

function offerPriceValidUntil() {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
}

function buildMerchantReturnPolicy(origin) {
    const contactUrl = `${origin.replace(/\/$/, '')}/contact-us`;
    return {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'US',
        returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted',
        merchantReturnLink: contactUrl,
        name: 'B2B marine stores — returns per quotation and purchase order terms. Contact for details.',
    };
}

function buildShippingDetails() {
    return {
        '@type': 'OfferShippingDetails',
        shippingRate: {
            '@type': 'MonetaryAmount',
            value: '0',
            currency: 'USD',
        },
        shippingDestination: {
            '@type': 'DefinedRegion',
            addressCountry: ['US', 'KR', 'SG', 'GB', 'DE', 'NL', 'JP'],
        },
        deliveryTime: {
            '@type': 'ShippingDeliveryTime',
            handlingTime: {
                '@type': 'QuantitativeValue',
                minValue: 1,
                maxValue: 14,
                unitCode: 'DAY',
            },
            transitTime: {
                '@type': 'QuantitativeValue',
                minValue: 3,
                maxValue: 60,
                unitCode: 'DAY',
            },
        },
    };
}

/** Default B2B catalog offer — quote on request (GSC Product / Merchant requires offers + seller). */
function buildB2bProductOffer(pageUrl) {
    const origin = storeSeoOrigin();
    return {
        '@type': 'Offer',
        price: '0.00',
        priceCurrency: 'USD',
        validFrom: todayIsoDate(),
        priceValidUntil: offerPriceValidUntil(),
        priceSpecification: {
            '@type': 'UnitPriceSpecification',
            priceType: 'https://schema.org/InvoicePrice',
            price: '0.00',
            priceCurrency: 'USD',
        },
        availability: 'https://schema.org/InStock',
        itemCondition: 'https://schema.org/NewCondition',
        url: pageUrl,
        seller: {
            '@type': 'Organization',
            name: 'THE VESSEL CODE (K-TECH)',
            url: origin,
        },
        hasMerchantReturnPolicy: buildMerchantReturnPolicy(origin),
        shippingDetails: buildShippingDetails(),
    };
}

function buildProductJsonLd(item, pageUrl, imageUrl) {
    return {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: item.name || `IMPA ${item.impa_code}`,
        sku: item.impa_code,
        mpn: resolveMpn(item),
        category: SEO_PRODUCT_CATEGORY,
        description: buildDescription(item),
        url: pageUrl,
        offers: buildB2bProductOffer(pageUrl),
        brand: {
            '@type': 'Brand',
            name: 'IMPA Marine Stores Guide',
        },
        manufacturer: {
            '@type': 'Organization',
            name: 'THE VESSEL CODE',
        },
        ...(imageUrl ? { image: [imageUrl] } : {}),
    };
}

function buildTechArticleJsonLd(item, pageUrl) {
    return {
        '@context': 'https://schema.org',
        '@type': 'TechArticle',
        headline: `IMPA CODE ${item.impa_code} Technical Specifications`,
        name: buildPrimaryHeading(item),
        description: buildDescription(item),
        url: pageUrl,
        author: {
            '@type': 'Organization',
            name: 'THE VESSEL CODE',
            url: storeSeoOrigin(),
        },
        about: {
            '@type': 'DefinedTerm',
            name: `IMPA ${item.impa_code}`,
            termCode: item.impa_code,
            description: item.name || `IMPA ${item.impa_code}`,
        },
    };
}

function buildJsonLd(item, pageUrl, imageUrl) {
    return [
        buildProductJsonLd(item, pageUrl, imageUrl),
        buildTechArticleJsonLd(item, pageUrl),
    ];
}

function buildRelatedItemsSectionHtml(item, related, base) {
    if (!related?.length) return '';
    const chapter = String(item.chapter || item.impa_code.slice(0, 2)).trim();
    const chapterLabel = item.category || CHAPTER_CATEGORY[chapter] || `Chapter ${chapter}`;
    const list = related.map((rel) => {
        const href = `${base}/store/${rel.impa_code}`;
        const name = rel.name || 'View technical specs';
        return `<li><a href="${escapeHtml(href)}">IMPA ${escapeHtml(rel.impa_code)}: ${escapeHtml(name)}</a></li>`;
    }).join('\n          ');
    return `
      <section class="related-items" aria-labelledby="related-heading">
        <h2 id="related-heading">Related Items in ${escapeHtml(chapterLabel)}</h2>
        <ul class="related-list">
          ${list}
        </ul>
        <p class="related-toolkit"><a href="${escapeHtml(`${base}/toolkit`)}">Maritime Toolkit — search all IMPA codes</a></p>
      </section>`;
}

function buildTvcSmConversionBannerHtml(base) {
    const demoUrl = `${base}/contact-us?inquiry=tvc-sm-demo`;
    const smUrl = `${base}/sm`;
    return `
      <section class="tvc-sm-banner" aria-label="TVC-SM ship management platform">
        <p class="tvc-sm-badge">&#9875; TVC-SM NEXT-GEN MARITIME OS</p>
        <h2 class="tvc-sm-title">Tired of managing vessel spares &amp; stores in disconnected Excels?</h2>
        <p class="tvc-sm-desc">TVC-SM connects vessel ROB tracking, PMS maintenance cycles, and 1-Click superintendent requisitions in one lightweight platform.</p>
        <ul class="tvc-sm-locks" aria-label="TVC-SM fleet features">
          <li><span class="lock-icon" aria-hidden="true">&#128274;</span> Live vessel ROB tracking &amp; automatic stock deduction</li>
          <li><span class="lock-icon" aria-hidden="true">&#128274;</span> 1-Click superintendent requisitions &amp; shore billing</li>
        </ul>
        <div class="tvc-sm-actions">
          <a class="btn btn-cta" href="${escapeHtml(demoUrl)}">&#128640; Request Free 30-Day Fleet Pilot / Demo</a>
          <a class="btn btn-secondary" href="${escapeHtml(smUrl)}">Explore TVC-SM</a>
        </div>
      </section>`;
}

function buildStoreItemHtml(item, { origin } = {}) {
    const base = (origin || storeSeoOrigin()).replace(/\/$/, '');
    const pageUrl = `${base}/store/${item.impa_code}`;
    const toolkitUrl = `${base}/toolkit?impa=${encodeURIComponent(item.impa_code)}`;
    const title = buildPageTitle(item);
    const ogTitle = buildOgTitle(item);
    const heading = buildPrimaryHeading(item);
    const description = buildMetaDescription(item);
    const ogDescription = buildOgDescription(item);
    const plateUrl = derivePlateAssetUrl(item);
    const imageUrl = plateUrl ? `${base}${plateUrl}` : '';
    const rows = specRows(item);
    const tableHtml = rows.map(([label, value]) => (
        `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`
    )).join('');
    const jsonLd = JSON.stringify(buildJsonLd(item, pageUrl, imageUrl || undefined));
    const related = getRelatedItemsByChapter(item.impa_code, 6);
    const relatedHtml = buildRelatedItemsSectionHtml(item, related, base);
    const tvcSmBannerHtml = buildTvcSmConversionBannerHtml(base);
    const displayTitle = cleanProductTitle(item);
    const plateSection = imageUrl
        ? `<section class="impa-shipserv-photo impa-plate-preview" aria-label="Catalog plate">
          <img class="impa-store-plate-img" src="${escapeHtml(plateUrl)}" data-plate-hires="${escapeHtml(plateUrl)}"
            data-plate-title="${escapeHtml(`IMPA ${item.impa_code} — ${displayTitle}`)}"
            alt="IMPA ${escapeHtml(item.impa_code)} catalog plate" width="${PLATE_IMG_WIDTH}" height="${PLATE_IMG_HEIGHT}" loading="lazy" decoding="async">
          <span class="impa-plate-zoom-hint">🔍 Click / Tap to view high-res full plate</span>
        </section>`
        : `<section class="impa-shipserv-photo impa-plate-preview" aria-label="Catalog plate">
          <div class="impa-shipserv-photo-fallback">Catalog plate reference: ${escapeHtml(item.plate_id || 'Not available')}</div>
        </section>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="preconnect" href="${escapeHtml(base)}">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${escapeHtml(pageUrl)}">
  <meta name="robots" content="index,follow">
  <meta property="og:type" content="product">
  <meta property="og:site_name" content="THE VESSEL CODE">
  <meta property="og:title" content="${escapeHtml(ogTitle)}">
  <meta property="og:description" content="${escapeHtml(ogDescription)}">
  <meta property="og:url" content="${escapeHtml(pageUrl)}">
  ${imageUrl ? `<meta property="og:image" content="${escapeHtml(imageUrl)}">` : ''}
  <meta name="twitter:card" content="${imageUrl ? 'summary_large_image' : 'summary'}">
  <meta name="twitter:title" content="${escapeHtml(ogTitle)}">
  <meta name="twitter:description" content="${escapeHtml(ogDescription)}">
  ${imageUrl ? `<meta name="twitter:image" content="${escapeHtml(imageUrl)}">` : ''}
  <script type="application/ld+json">${jsonLd}</script>
  <link rel="stylesheet" href="/css/store.css">
  <link rel="stylesheet" href="/css/store-public.css">
  <link rel="stylesheet" href="/css/impa-detail-unified.css">
</head>
<body class="impa-store-standalone">
  <main class="impa-store-detail wrap">
    <article class="impa-store-detail-card">
      <header class="impa-store-detail-head">
        <div class="impa-store-detail-head-main">
          <span class="impa-detail-unified-badge">IMPA ${escapeHtml(item.impa_code)}</span>
          <h1 class="impa-detail-unified-title">${escapeHtml(displayTitle)}</h1>
        </div>
      </header>
      <div class="impa-store-detail-body">
        ${plateSection}
        <section aria-label="Specifications">
          <div class="impa-shipserv-spec-wrap">
            <table class="impa-shipserv-spec-table spec-table">
              <tbody>${tableHtml}</tbody>
            </table>
          </div>
        </section>
        <div class="impa-detail-tvc-sm">${tvcSmBannerHtml}</div>
        <div class="impa-detail-actions">
          <button type="button" class="btn-share-spec" data-impa-share-code="${escapeHtml(item.impa_code)}">📋 Share Spec Link</button>
          <a class="btn-toolkit" href="${escapeHtml(toolkitUrl)}">Open Maritime Toolkit</a>
        </div>
        ${relatedHtml}
        <p class="footer-note">THE VESSEL CODE — offline-first PMS + SPICS and maritime toolkit for shipboard operations.</p>
      </div>
    </article>
  </main>
  <script src="/js/ui/impaDetailShared.js"></script>
  <script>TVC_ImpaDetailShared.initStandalonePage();</script>
</body>
</html>`;
}

function buildNotFoundHtml(code, { origin } = {}) {
    const base = (origin || storeSeoOrigin()).replace(/\/$/, '');
    const normalized = normalizeCode(code);
    const searchUrl = normalized && normalized !== '000000'
        ? `${base}/toolkit?impa=${encodeURIComponent(normalized)}`
        : `${base}/toolkit`;
    const title = `IMPA ${escapeHtml(code || 'Item')} Not Found | The Vessel Code`;
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <meta name="robots" content="noindex,follow">
  <link rel="canonical" href="${escapeHtml(`${base}/toolkit`)}">
</head>
<body style="font-family:system-ui,sans-serif;padding:32px;">
  <h1>IMPA item not found</h1>
  <p>No catalog entry matched code <strong>${escapeHtml(code || '')}</strong>.</p>
  <p><a href="${escapeHtml(searchUrl)}">Search catalog for IMPA ${escapeHtml(normalized || code || '')}</a></p>
  <p><a href="${escapeHtml(`${base}/toolkit`)}">Open Maritime Toolkit</a></p>
</body>
</html>`;
}

module.exports = {
    CHAPTER_CATEGORY,
    storeSeoOrigin,
    normalizeCode,
    isValidImpaCode,
    expandCompactRow,
    loadIndex,
    getItemByCode,
    getRelatedItemsByChapter,
    buildOgTitle,
    buildPageTitle,
    buildPrimaryHeading,
    buildOgDescription,
    buildMetaDescription,
    derivePlateAssetUrl,
    SEO_PRODUCT_CATEGORY,
    buildDescription,
    buildB2bProductOffer,
    buildProductJsonLd,
    buildTechArticleJsonLd,
    buildJsonLd,
    buildStoreItemHtml,
    buildNotFoundHtml,
};
