'use strict';

/** Matches browser `TVC_ImpaSchema` plate id pattern (PL-59-11, 61-471-01, berth-123456). */
const PLATE_ID_PATTERN = /^(PL-\d{2}-\d{2}|berth-\d{6}|\d{2}-\d{3}-\d{2})$/i;

const PLATE_ASSET_BASE = '/data/plates';

function normalizePlateId(explicit, impaCode) {
    const raw = String(explicit ?? '').trim();
    if (raw) {
        const legacy = raw.replace(/\.(jpg|jpeg|png|webp)$/i, '');
        if (/^\d{2}-\d{3}-\d{2}$/i.test(legacy)) return legacy;
        if (/^berth-\d{6}$/i.test(raw)) return raw.toLowerCase();
        const cleaned = raw.replace(/\s+/g, '').toUpperCase();
        if (PLATE_ID_PATTERN.test(cleaned)) return cleaned;
    }
    const c = String(impaCode || '').replace(/\D/g, '').padStart(6, '0').slice(-6);
    if (c.length >= 4) return `PL-${c.slice(0, 2)}-${c.slice(2, 4)}`;
    return '';
}

/**
 * Static URL for a catalog plate webp under public/data/plates.
 * @param {string} plateId
 * @returns {string} path starting with /data/plates/ or ''
 */
function resolvePlateAssetUrl(plateId) {
    const raw = String(plateId || '').trim();
    if (!raw) return '';

    if (/^berth-\d{6}$/i.test(raw)) {
        return `${PLATE_ASSET_BASE}/${raw.toLowerCase()}.webp`;
    }

    const legacy = raw.replace(/\.(jpg|jpeg|png|webp)$/i, '');
    if (/^\d{2}-\d{3}-\d{2}$/i.test(legacy)) {
        return `${PLATE_ASSET_BASE}/${legacy}.webp`;
    }

    const id = normalizePlateId(raw, '');
    if (!id || !PLATE_ID_PATTERN.test(id)) return '';
    return `${PLATE_ASSET_BASE}/${id}.webp`;
}

/**
 * @param {{ plate_id?: string, impa_code?: string, code?: string }} item
 */
function deriveCatalogPlateUrlFromItem(item) {
    const plateId = String(item?.plate_id || '').trim();
    if (plateId) {
        const url = resolvePlateAssetUrl(plateId);
        if (url) return url;
    }
    const code = item?.impa_code || item?.code || '';
    const chapter = String(code).replace(/\D/g, '').padStart(6, '0').slice(0, 2);
    const segment = String(code).replace(/\D/g, '').padStart(6, '0').slice(2, 4);
    if (chapter && segment) {
        return `${PLATE_ASSET_BASE}/PL-${chapter}-${segment}.webp`;
    }
    return '';
}

module.exports = {
    PLATE_ASSET_BASE,
    PLATE_ID_PATTERN,
    normalizePlateId,
    resolvePlateAssetUrl,
    deriveCatalogPlateUrlFromItem,
};
