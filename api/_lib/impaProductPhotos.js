'use strict';

const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');

const INDEX_PATHS = [
    join(process.cwd(), 'public', 'data', 'impa-product-photos.json'),
    join(process.cwd(), 'data', 'impa-product-photos.json'),
];

const PRODUCT_PHOTO_BASE = '/data/product-photos';

const DEFAULT_DISCLAIMER =
    'Reference photo for industrial/commercial specification. Actual maritime supply brand/finish may vary.';

let _indexCache = null;

function normalizePhotoEntry(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const file = String(raw.file || '').trim();
    if (!file || /[/\\]/.test(file)) return null;
    const photoUrl = String(raw.photo_url || '').trim() || `${PRODUCT_PHOTO_BASE}/${file}`;
    return {
        ...raw,
        file,
        photo_url: photoUrl,
        source_name: String(raw.source_name || raw.credit || '').trim(),
        source_url: String(raw.source_url || raw.source_page || '').trim(),
        license: String(raw.license || '').trim(),
        disclaimer: String(raw.disclaimer || DEFAULT_DISCLAIMER).trim(),
    };
}

function normalizeCode(value) {
    return String(value || '').trim().replace(/\D/g, '').padStart(6, '0').slice(-6);
}

function loadProductPhotoIndex() {
    if (_indexCache) return _indexCache;
    for (const path of INDEX_PATHS) {
        if (!existsSync(path)) continue;
        try {
            const raw = JSON.parse(readFileSync(path, 'utf8'));
            const photos = raw?.photos && typeof raw.photos === 'object' ? raw.photos : {};
            _indexCache = { version: raw?.version || 1, photos };
            return _indexCache;
        } catch {
            /* try next path */
        }
    }
    _indexCache = { version: 1, photos: {} };
    return _indexCache;
}

/**
 * @returns {{ url: string, meta: object } | null}
 */
function getProductPhotoForCode(impaCode) {
    const code = normalizeCode(impaCode);
    if (!code || code === '000000') return null;
    const entry = normalizePhotoEntry(loadProductPhotoIndex().photos[code]);
    if (!entry) return null;
    return {
        url: entry.photo_url,
        meta: entry,
    };
}

function buildProductPhotoAlt(item) {
    const cleanName = String(item?.name || 'IMPA item').trim();
    const code = normalizeCode(item?.impa_code || item?.code);
    return `IMPA ${code} ${cleanName} — reference product photo (illustrative)`;
}

function escapeAttr(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/"/g, '&quot;');
}

function escapeText(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function buildProductPhotoAttributionHtml(meta) {
    const entry = normalizePhotoEntry(meta);
    if (!entry) return '';

    const parts = [];
    if (entry.source_name) parts.push(escapeText(entry.source_name));
    let creditLine = parts.join(' · ');
    if (entry.source_url) {
        const href = escapeAttr(entry.source_url);
        creditLine = creditLine
            ? `${creditLine} · <a href="${href}" rel="noopener noreferrer" target="_blank">Source</a>`
            : `<a href="${href}" rel="noopener noreferrer" target="_blank">Image source</a>`;
    }

    const licenseBadge = entry.license
        ? `<span class="impa-photo-license-badge">${escapeText(entry.license)}</span>`
        : '';

    const disclaimer = escapeText(entry.disclaimer || DEFAULT_DISCLAIMER);

    return `
            <div class="impa-product-photo-attribution" role="note">
                ${licenseBadge}
                ${creditLine ? `<p class="impa-product-photo-credit">${creditLine}</p>` : ''}
                <p class="impa-product-photo-disclaimer">${disclaimer}</p>
            </div>`;
}

/** @deprecated use buildProductPhotoAttributionHtml */
function buildProductPhotoCreditHtml(meta) {
    return buildProductPhotoAttributionHtml(meta);
}

module.exports = {
    PRODUCT_PHOTO_BASE,
    DEFAULT_DISCLAIMER,
    loadProductPhotoIndex,
    normalizePhotoEntry,
    getProductPhotoForCode,
    buildProductPhotoAlt,
    buildProductPhotoAttributionHtml,
    buildProductPhotoCreditHtml,
};
