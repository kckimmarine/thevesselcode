'use strict';

const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');

const INDEX_PATHS = [
    join(process.cwd(), 'public', 'data', 'impa-product-photos.json'),
    join(process.cwd(), 'data', 'impa-product-photos.json'),
];

const PRODUCT_PHOTO_BASE = '/data/product-photos';

let _indexCache = null;

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
    const entry = loadProductPhotoIndex().photos[code];
    if (!entry || typeof entry !== 'object') return null;
    const file = String(entry.file || '').trim();
    if (!file || /[/\\]/.test(file)) return null;
    return {
        url: `${PRODUCT_PHOTO_BASE}/${file}`,
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

function buildProductPhotoCreditHtml(meta) {
    if (!meta || typeof meta !== 'object') return '';
    const parts = [];
    const credit = String(meta.credit || meta.author || '').trim();
    const license = String(meta.license || '').trim();
    const sourcePage = String(meta.source_page || meta.source_url || '').trim();
    if (credit) parts.push(escapeText(credit));
    if (license) parts.push(escapeText(license));
    let inner = parts.join(' · ');
    if (sourcePage) {
        const href = escapeAttr(sourcePage);
        inner = inner
            ? `${inner} · <a href="${href}" rel="noopener noreferrer" target="_blank">Source</a>`
            : `<a href="${href}" rel="noopener noreferrer" target="_blank">Image source</a>`;
    }
    if (!inner) return '';
    return `<p class="impa-product-photo-credit">${inner}</p>`;
}

module.exports = {
    PRODUCT_PHOTO_BASE,
    loadProductPhotoIndex,
    getProductPhotoForCode,
    buildProductPhotoAlt,
    buildProductPhotoCreditHtml,
};
