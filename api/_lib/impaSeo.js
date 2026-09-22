'use strict';

const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const { deriveCatalogPlateUrlFromItem, resolvePlateAssetUrl: resolvePlateAssetUrlFromId } = require('./plateAssetUrl');
const {
    getProductPhotoForCode,
    buildProductPhotoAlt,
    buildProductPhotoAttributionHtml,
} = require('./impaProductPhotos');
const layout = require('../../js/ui/impaStoreDetailLayout.js');

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
    return deriveCatalogPlateUrlFromItem(item);
}

/** Prefer land/industrial product photo, then catalog plate drawing. */
function resolveStoreHeroImage(item) {
    const product = getProductPhotoForCode(item?.impa_code || item?.code);
    if (product?.url) {
        return {
            kind: 'product',
            path: product.url,
            meta: product.meta,
            alt: buildProductPhotoAlt(item),
        };
    }
    const platePath = deriveCatalogPlateUrlFromItem(item);
    if (platePath) {
        return {
            kind: 'plate',
            path: platePath,
            alt: buildPlateImageAlt(item),
        };
    }
    return { kind: 'none', path: '', alt: '' };
}

const PRIORITY_SPEC_KEYS = ['Rating', 'Material', 'Standard Unit', 'Standard'];

/** Google SERP title — aim ≤60 chars when truncating long product names. */
const SERP_TITLE_MAX_LEN = 60;
const SERP_META_DESC_MAX_LEN = 160;

function truncateSerpText(text, maxLen) {
    const raw = String(text || '').trim();
    if (raw.length <= maxLen) return raw;
    if (maxLen <= 1) return raw.slice(0, maxLen);
    return `${raw.slice(0, maxLen - 1).trimEnd()}…`;
}

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
    const cleanName = cleanProductTitle(item);
    return `[Drawing & Specs] IMPA ${item.impa_code} — ${cleanName}`;
}

function buildPageTitle(item) {
    const code = item.impa_code;
    const cleanName = cleanProductTitle(item);
    const suffixLong = ' | Dimensions, Weight & Fast RFQ';
    const suffixShort = ' | Fast RFQ';
    const prefix = `[Drawing & Specs] IMPA ${code} : `;
    let title = `${prefix}${cleanName}${suffixLong}`;
    if (title.length > SERP_TITLE_MAX_LEN) {
        const nameBudget = SERP_TITLE_MAX_LEN - prefix.length - suffixLong.length;
        const shortName = nameBudget >= 6
            ? truncateSerpText(cleanName, nameBudget)
            : truncateSerpText(cleanName, Math.max(4, SERP_TITLE_MAX_LEN - prefix.length - suffixShort.length));
        title = `${prefix}${shortName}${suffixLong}`;
    }
    if (title.length > SERP_TITLE_MAX_LEN) {
        const nameBudget = SERP_TITLE_MAX_LEN - prefix.length - suffixShort.length;
        title = `${prefix}${truncateSerpText(cleanName, Math.max(4, nameBudget))}${suffixShort}`;
    }
    return title;
}

function buildPrimaryHeading(item) {
    const name = item.name || 'Marine Store Item';
    return `IMPA CODE ${item.impa_code}: ${name}`;
}

function cleanProductTitle(item) {
    return layout.cleanProductTitle(item);
}

function buildMetaDescription(item) {
    const code = item.impa_code;
    const cleanName = cleanProductTitle(item);
    const desc = `View verified technical drawing, flange/thread dimensions, and equivalent specs for IMPA ${code} (${cleanName}). Instant quotation available at Busan, Singapore & Global ports.`;
    return truncateSerpText(desc, SERP_META_DESC_MAX_LEN);
}

function buildOgDescription(item) {
    return buildMetaDescription(item);
}

function buildDescription(item) {
    return buildMetaDescription(item);
}

function buildPlateImageAlt(item) {
    const cleanName = cleanProductTitle(item);
    return `IMPA CODE ${item.impa_code} ${cleanName} Technical Drawing and Catalog Plate`;
}

function buildSpecAdditionalProperties(item) {
    const specs = item.specs && typeof item.specs === 'object' ? item.specs : {};
    const rows = [];
    PRIORITY_SPEC_KEYS.forEach((key) => {
        const value = specs[key];
        if (value != null && String(value).trim()) {
            rows.push({
                '@type': 'PropertyValue',
                name: key,
                value: String(value).trim(),
            });
        }
    });
    if (item.unit && !rows.some((r) => r.name === 'Standard Unit')) {
        rows.push({ '@type': 'PropertyValue', name: 'Standard Unit', value: String(item.unit).trim() });
    }
    return rows;
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

function buildProductJsonLd(item, pageUrl, imageUrl, base) {
    const cleanName = cleanProductTitle(item);
    const rfqUrl = buildContactInquiryUrl(base, {
        inquiry: 'rfq',
        code: item.impa_code,
        name: cleanName,
        ref: `/store/${item.impa_code}`,
    });
    const additionalProperty = buildSpecAdditionalProperties(item);
    return {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: `IMPA ${item.impa_code} ${cleanName} — Drawing, Dimensions & Fast RFQ`,
        sku: item.impa_code,
        mpn: resolveMpn(item),
        category: SEO_PRODUCT_CATEGORY,
        description: buildDescription(item),
        url: pageUrl,
        offers: {
            ...buildB2bProductOffer(pageUrl),
            name: 'Fast RFQ — Busan, Singapore & global delivery',
            description: 'Instant B2B quotation on request. Invoice pricing per PO.',
        },
        brand: {
            '@type': 'Brand',
            name: 'IMPA Marine Stores Guide',
        },
        manufacturer: {
            '@type': 'Organization',
            name: 'THE VESSEL CODE',
        },
        ...(imageUrl ? { image: [imageUrl] } : {}),
        ...(additionalProperty.length ? { additionalProperty } : {}),
        potentialAction: {
            '@type': 'OrderAction',
            target: rfqUrl,
            name: 'Request instant quotation',
        },
    };
}

function buildTechArticleJsonLd(item, pageUrl, imageUrl) {
    const cleanName = cleanProductTitle(item);
    return {
        '@context': 'https://schema.org',
        '@type': 'TechArticle',
        headline: `[Drawing & Specs] IMPA ${item.impa_code} Technical Drawing & Dimensions`,
        name: buildPrimaryHeading(item),
        description: buildDescription(item),
        url: pageUrl,
        ...(imageUrl ? { image: imageUrl } : {}),
        author: {
            '@type': 'Organization',
            name: 'THE VESSEL CODE',
            url: storeSeoOrigin(),
        },
        about: {
            '@type': 'DefinedTerm',
            name: `IMPA ${item.impa_code}`,
            termCode: item.impa_code,
            description: cleanName,
        },
    };
}

function buildBreadcrumbJsonLd(item, pageUrl, base) {
    const toolkit = `${base.replace(/\/$/, '')}/toolkit`;
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Maritime Toolkit', item: toolkit },
            { '@type': 'ListItem', position: 2, name: `IMPA ${item.impa_code}`, item: pageUrl },
        ],
    };
}

function buildJsonLd(item, pageUrl, imageUrl, base) {
    return [
        buildProductJsonLd(item, pageUrl, imageUrl, base),
        buildTechArticleJsonLd(item, pageUrl, imageUrl),
        buildBreadcrumbJsonLd(item, pageUrl, base),
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

function buildContactInquiryUrl(base, params) {
    const merged = { ...(params || {}) };
    const code = String(merged.code || '').trim();
    if (!merged.utm_source) merged.utm_source = 'store_seo';
    if (!merged.utm_medium) merged.utm_medium = 'organic';
    if (!merged.utm_campaign) merged.utm_campaign = 'impa_rfq';
    if (code && !merged.utm_content) merged.utm_content = code;
    const q = new URLSearchParams();
    Object.entries(merged).forEach(([key, val]) => {
        const s = String(val ?? '').trim();
        if (s) q.set(key, s);
    });
    const qs = q.toString();
    return `${base.replace(/\/$/, '')}/contact-us${qs ? `?${qs}` : ''}`;
}

const {
    buildTurnkeyPortHubHtml,
    buildTurnkeyInstallFunnelHtml,
    buildTvcSmRetentionBannerHtml,
} = require('../../js/ui/turnkeyPortHub.js');
const {
    buildTotalServiceBarHtml,
    buildStoreRepairBridgeCtaHtml,
} = require('../../js/ui/totalServiceBar.js');

const {
    buildImpaCommerceTrustHtml,
    buildImpaStockSlaHtml,
    buildImpaCommerceActionsHtml,
    buildRfqLeadBlockHtml,
    isTopRequisitionedItem,
} = layout;

function buildTvcSmConversionBannerHtml(base) {
    const demoUrl = buildContactInquiryUrl(base, { inquiry: 'poc' });
    const smUrl = `${base}/sm`;
    return `
      <section class="tvc-sm-banner" aria-label="TVC-SM ship management platform">
        <p class="tvc-sm-badge">&#9875; TVC-SM · Fleet OS</p>
        <h2 class="tvc-sm-title">Managing spares in Excel? Connect ROB, PMS, and superintendent RFQs in one place.</h2>
        <p class="tvc-sm-desc">TVC-SM connects vessel ROB tracking, PMS maintenance cycles, and 1-Click superintendent requisitions in one lightweight platform.</p>
        <ul class="tvc-sm-locks" aria-label="TVC-SM fleet features">
          <li><span class="lock-icon" aria-hidden="true">&#128274;</span> Live vessel ROB tracking &amp; automatic stock deduction</li>
          <li><span class="lock-icon" aria-hidden="true">&#128274;</span> 1-Click superintendent requisitions &amp; shore billing</li>
        </ul>
        <div class="tvc-sm-actions">
          <a class="btn btn-cta" href="${escapeHtml(demoUrl)}">&#128640; 14-Day Free PoC (1 ship)</a>
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
    const heroImage = resolveStoreHeroImage(item);
    const heroPath = heroImage.path || '';
    const imageUrl = heroPath ? `${base}${heroPath}` : '';
    const rows = layout.specRows(item);
    const tableHtml = rows.map(([label, value]) => (
        `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`
    )).join('');
    const plateAlt = heroImage.alt || buildPlateImageAlt(item);
    const jsonLd = JSON.stringify(buildJsonLd(item, pageUrl, imageUrl || undefined, base));
    const related = getRelatedItemsByChapter(item.impa_code, 6);
    const relatedHtml = buildRelatedItemsSectionHtml(item, related, base);
    const rfqLeadHtml = buildRfqLeadBlockHtml(item, base);
    const tvcSmBannerHtml = buildTvcSmConversionBannerHtml(base);
    const turnkeyHubHtml = buildTurnkeyPortHubHtml({
        impaCode: item.impa_code,
        itemName: cleanProductTitle(item),
    });
    const installFunnelHtml = buildTurnkeyInstallFunnelHtml({
        impaCode: item.impa_code,
        itemName: cleanProductTitle(item),
    });
    const tvcSmRetentionHtml = buildTvcSmRetentionBannerHtml();
    const displayTitle = cleanProductTitle(item);
    const storeCtx = { impaCode: item.impa_code, itemName: displayTitle };
    const totalServiceBarHtml = buildTotalServiceBarHtml({ ...storeCtx, activePillar: 'impa' });
    const storeBridgeCtaHtml = buildStoreRepairBridgeCtaHtml(storeCtx);
    const heroAria = heroImage.kind === 'product' ? 'Product reference photo' : 'Catalog plate';
    const heroHint = heroImage.kind === 'product'
        ? '🔍 Click / Tap to enlarge reference photo'
        : '🔍 Click / Tap to view high-res full plate';
    const photoCredit = heroImage.kind === 'product'
        ? buildProductPhotoAttributionHtml(heroImage.meta)
        : '';
    const plateSection = imageUrl
        ? `<section class="impa-shipserv-photo impa-plate-preview impa-hero-${escapeHtml(heroImage.kind)}" aria-label="${escapeHtml(heroAria)}">
          <img class="impa-store-plate-img" src="${escapeHtml(heroPath)}" data-plate-hires="${escapeHtml(heroPath)}"
            data-plate-title="${escapeHtml(`IMPA ${item.impa_code} — ${displayTitle}`)}"
            alt="${escapeHtml(plateAlt)}" width="${PLATE_IMG_WIDTH}" height="${PLATE_IMG_HEIGHT}" loading="lazy" decoding="async">
          <span class="impa-plate-zoom-hint">${heroHint}</span>
          ${photoCredit}
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
  <link rel="stylesheet" href="/css/impa-detail.css">
</head>
<body class="impa-store-standalone">
  <main class="impa-store-detail wrap">
    <article class="impa-store-detail-card">
      <header class="impa-store-detail-head">
        <div class="impa-store-detail-head-main">
          <span class="impa-detail-unified-badge">IMPA ${escapeHtml(item.impa_code)}</span>
          <h1 class="impa-detail-unified-title">${escapeHtml(displayTitle)}</h1>
          ${buildImpaCommerceTrustHtml(item)}
        </div>
      </header>
      <div class="impa-store-detail-body" data-impa-item-code="${escapeHtml(item.impa_code)}" data-impa-item-name="${escapeHtml(displayTitle)}">
        ${rfqLeadHtml}
        ${plateSection}
        ${buildImpaStockSlaHtml()}
        <section aria-label="Specifications">
          <div class="impa-shipserv-spec-wrap">
            <table class="impa-shipserv-spec-table spec-table">
              <tbody>${tableHtml}</tbody>
            </table>
          </div>
        </section>
        ${totalServiceBarHtml}
        ${storeBridgeCtaHtml}
        ${installFunnelHtml}
        ${turnkeyHubHtml}
        <div class="impa-detail-tvc-sm">${tvcSmBannerHtml}</div>
        ${buildImpaCommerceActionsHtml(item)}
        <div class="impa-detail-actions">
          <button type="button" class="btn-share-spec" data-impa-share-code="${escapeHtml(item.impa_code)}">📋 Share Spec Link</button>
          <a class="btn-toolkit" href="${escapeHtml(toolkitUrl)}">Open Maritime Toolkit</a>
        </div>
        ${relatedHtml}
        ${tvcSmRetentionHtml}
        <p class="store-pillar-crosslink"><a href="${escapeHtml(`${base}/ship-repair-chandler-korea`)}">⚓ Ship Repair, Ship Chandler &amp; Ship Supply — all Korea ports (Busan · Ulsan · Yeosu · Pohang · Daesan · Pyeongtaek · Incheon · Donghae)</a></p>
        <p class="store-pillar-crosslink"><a href="${escapeHtml(`${base}/services#ship-repair-korea`)}">🛠️ Ship Repair in Korea (Busan · Ulsan · Yeosu focus)</a></p>
        <p class="footer-note">THE VESSEL CODE — offline-first PMS + SPICS and maritime toolkit for shipboard operations.</p>
      </div>
    </article>
  </main>
  <script src="/js/marketing-attribution.js" defer></script>
  <script src="/js/ui/turnkeyPortHub.js"></script>
  <script src="/js/ui/impaDetailShared.js"></script>
  <script src="/js/store-lead.js" defer></script>
  <script>TVC_TurnkeyPortHub.initDocument(); TVC_ImpaDetailShared.initStandalonePage();</script>
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
    buildPlateImageAlt,
    truncateSerpText,
    SERP_TITLE_MAX_LEN,
    derivePlateAssetUrl,
    resolvePlateAssetUrlFromId,
    resolveStoreHeroImage,
    SEO_PRODUCT_CATEGORY,
    buildDescription,
    buildB2bProductOffer,
    buildProductJsonLd,
    buildTechArticleJsonLd,
    buildJsonLd,
    buildStoreItemHtml,
    buildNotFoundHtml,
};
