/**
 * Resilient maritime data normalizer — IMO validation, source hierarchy, UI-safe fields.
 */
import { digitsOnlyImo, isValidImoNumber } from '../../lib/imo-checksum.mjs';

/** Higher number wins on field conflicts. */
export const SOURCE_CONFIDENCE = {
    VERIFIED_REGISTRY: 90,
    PORT_CLEARANCE: 60,
    OPEN_CRAWL: 30,
};

const PLACEHOLDER_RE = /^[\s—\-–.]+$/;

export function normalizeImo(value) {
    const imo = digitsOnlyImo(value);
    return isValidImoNumber(imo) ? imo : '';
}

export function isDisplayEmpty(value) {
    if (value === null || value === undefined) return true;
    if (typeof value === 'number') return !(value > 0);
    const s = String(value).trim();
    if (!s) return true;
    if (PLACEHOLDER_RE.test(s)) return true;
    if (s === 'n/a' || s === 'N/A' || s === 'null' || s === 'undefined') return true;
    return false;
}

/** Drop empty / placeholder values so UI cards do not render "—". */
export function cleanDisplayFields(record, keys) {
    const out = { ...record };
    for (const key of keys) {
        if (isDisplayEmpty(out[key])) delete out[key];
    }
    return out;
}

export function normalizeConfidenceTier(tier) {
    const t = String(tier || 'OPEN_CRAWL').toUpperCase().replace(/\s+/g, '_');
    if (t in SOURCE_CONFIDENCE) return t;
    if (t.includes('REGISTRY') || t.includes('VERIFIED')) return 'VERIFIED_REGISTRY';
    if (t.includes('PORT') || t.includes('CLEARANCE')) return 'PORT_CLEARANCE';
    return 'OPEN_CRAWL';
}

/**
 * Merge partial vessel records; higher-confidence source wins per field.
 * @param {Array<{ tier?: string, confidence?: number, record: object }>} layers
 */
export function mergeVesselByConfidence(layers) {
    const sorted = [...layers].sort((a, b) => {
        const ca = a.confidence ?? SOURCE_CONFIDENCE[normalizeConfidenceTier(a.tier)] ?? 0;
        const cb = b.confidence ?? SOURCE_CONFIDENCE[normalizeConfidenceTier(b.tier)] ?? 0;
        return cb - ca;
    });

    const imoCandidates = sorted.map((l) => normalizeImo(l.record?.imo || l.record?.i)).filter(Boolean);
    const imo = imoCandidates[0] || '';
    const merged = { imo };

    const fieldMap = [
        ['name', ['name', 'n']],
        ['type', ['type', 't']],
        ['flag', ['flag', 'f']],
        ['technical_manager', ['technical_manager', 'm']],
        ['engine_model', ['engine_model', 'e']],
        ['mmsi', ['mmsi', 's']],
        ['dwt', ['dwt', 'd']],
        ['built_year', ['built_year', 'y']],
    ];

    for (const [, aliases] of fieldMap) {
        for (const layer of sorted) {
            const rec = layer.record || {};
            for (const key of aliases) {
                const val = rec[key];
                if (isDisplayEmpty(val)) continue;
                const targetKey = aliases[0] === 'n' ? 'name' : fieldMap.find((f) => f[1].includes(key))?.[0];
                if (!targetKey) continue;
                if (targetKey === 'dwt' || targetKey === 'built_year') {
                    const n = Number(val);
                    if (n > 0) merged[targetKey] = n;
                } else if (targetKey === 'mmsi') {
                    merged.mmsi = String(val).replace(/\D/g, '');
                } else {
                    merged[targetKey] = String(val).trim();
                }
                break;
            }
        }
    }

    return cleanDisplayFields(merged, [
        'name', 'type', 'flag', 'technical_manager', 'engine_model', 'mmsi', 'dwt', 'built_year',
    ]);
}

/** Compact fleet chunk row (i,n,t,d,y,f,m,e,s). */
export function normalizeFleetChunkShip(raw, tier = 'OPEN_CRAWL') {
    const imo = normalizeImo(raw?.i || raw?.imo);
    if (!imo) return null;

    const merged = mergeVesselByConfidence([{
        tier,
        record: {
            imo,
            name: raw?.n || raw?.name,
            type: raw?.t || raw?.type,
            flag: raw?.f || raw?.flag,
            technical_manager: raw?.m,
            engine_model: raw?.e,
            mmsi: raw?.s || raw?.mmsi,
            dwt: raw?.d || raw?.dwt,
            built_year: raw?.y || raw?.built_year,
        },
    }]);

    const out = {
        i: imo,
        n: merged.name ? String(merged.name).toUpperCase() : (raw?.n || '').toString().trim().toUpperCase(),
        t: merged.type || raw?.t || 'Merchant Vessel',
        d: Number(merged.dwt) || 0,
        y: Number(merged.built_year) || 0,
        f: merged.flag || raw?.f || '—',
        m: merged.technical_manager || '',
        e: merged.engine_model || '',
    };
    if (merged.mmsi) out.s = merged.mmsi;

    if (isDisplayEmpty(out.m)) delete out.m;
    if (isDisplayEmpty(out.e)) delete out.e;
    if (!out.d) delete out.d;
    if (!out.y) delete out.y;
    if (!out.s) delete out.s;
    if (isDisplayEmpty(out.f) || out.f === '—') out.f = out.f === '—' ? '—' : out.f;

    return out;
}

export function normalizeMarketFeed(feed) {
    if (!feed || typeof feed !== 'object') return feed;
    const out = { ...feed };
    if (Array.isArray(out.news)) {
        out.news = out.news
            .filter((item) => item && !isDisplayEmpty(item.title))
            .map((item) => cleanDisplayFields(item, ['title', 'summary', 'url', 'imageUrl', 'source']));
    }
    return out;
}
