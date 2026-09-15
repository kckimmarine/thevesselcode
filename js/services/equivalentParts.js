/* Offline domestic equivalent parts lookup (KR MRO resilience pool) */
const TVC_EquivalentParts = (function () {
    const DATA_URL = 'data/equivalent-parts.json';
    const META_SEED = TVC_META_KEYS.EQUIVALENT_PARTS_SEED;

    /** In-memory fallback when fetch/IDB unavailable (vessel offline bundle) */
    const EMBEDDED_MAPPINGS = [
        {
            original_maker_pn: '51.06106-0066',
            maker_family: 'MAN',
            standard_spec: 'ISO 15550 / JIS F7305',
            domestic_equivalent: {
                maker: 'Busan Marine Parts Co.',
                equivalent_pn: 'BMP-V81',
                approval: 'KR / ClassNK Approved',
                est_lead_time_days: 2,
            },
        },
        {
            original_maker_pn: 'FF-2201',
            maker_family: 'OEM',
            standard_spec: 'ISO 4406',
            domestic_equivalent: {
                maker: 'Ulsan Filter Tech',
                equivalent_pn: 'UFT-FF2201-KR',
                approval: 'KR Approved',
                est_lead_time_days: 1,
            },
        },
        {
            original_maker_pn: 'SEAL-LOP-09',
            maker_family: 'OEM',
            standard_spec: 'JIS B2401',
            domestic_equivalent: {
                maker: 'Gyeongnam Precision MRO',
                equivalent_pn: 'GPM-SEAL-LOP09',
                approval: 'KR / ClassNK Approved',
                est_lead_time_days: 4,
            },
        },
    ];

    let memoryIndex = null;
    let loadPromise = null;

    function normalizePn(pn) {
        return String(pn || '')
            .toUpperCase()
            .replace(/[ÄÖÜ]/g, c => ({ Ä: 'A', Ö: 'O', Ü: 'U' }[c] || c))
            .replace(/WÄRTSILÄ/gi, 'WARTSILA')
            .replace(/WARTSILA/gi, 'WARTSILA')
            .replace(/[^A-Z0-9]+/g, '')
            .trim();
    }

    function canonRow(row) {
        const original = String(row.original_maker_pn || '').trim();
        if (!original) return null;
        return {
            original_maker_pn: original,
            pn_norm: normalizePn(original),
            maker_family: row.maker_family || '',
            standard_spec: row.standard_spec || '',
            domestic_equivalent: row.domestic_equivalent ? { ...row.domestic_equivalent } : null,
            sync_status: 'SYNCED',
            updated_at: new Date().toISOString(),
        };
    }

    function buildIndex(rows) {
        const map = new Map();
        for (const row of rows || []) {
            const c = canonRow(row);
            if (!c || !c.pn_norm) continue;
            map.set(c.pn_norm, c);
        }
        return map;
    }

    async function seedFromMappings(mappings) {
        const rows = (mappings || []).map(canonRow).filter(Boolean);
        memoryIndex = buildIndex(rows);
        if (typeof TVC_DB !== 'undefined' && TVC_DB.bulkPut) {
            try {
                await TVC_DB.bulkPut('equivalent_parts', rows);
            } catch (_) {
                for (const r of rows) {
                    try { await TVC_DB.put('equivalent_parts', r); } catch (_) {}
                }
            }
        }
        try {
            await TVC_DB.setMeta(META_SEED, new Date().toISOString());
        } catch (_) {}
        return rows.length;
    }

    async function ensureLoaded() {
        if (memoryIndex) return memoryIndex;
        if (loadPromise) return loadPromise;
        loadPromise = (async () => {
            try {
                const seeded = await TVC_DB.getMeta(META_SEED).catch(() => null);
                const stored = await TVC_DB.getAll('equivalent_parts').catch(() => []);
                if (seeded && stored.length) {
                    memoryIndex = buildIndex(stored);
                    return memoryIndex;
                }
            } catch (_) {}

            try {
                const res = await fetch(DATA_URL);
                if (res.ok) {
                    const data = await res.json();
                    await seedFromMappings(data.mappings || []);
                    return memoryIndex;
                }
            } catch (_) {}

            await seedFromMappings(EMBEDDED_MAPPINGS);
            return memoryIndex;
        })();
        return loadPromise;
    }

    async function lookup(partNo, altPartNo) {
        const idx = await ensureLoaded();
        const keys = [partNo, altPartNo].map(normalizePn).filter(Boolean);
        for (const k of keys) {
            const hit = idx.get(k);
            if (hit) return hit;
        }
        for (const k of keys) {
            for (const [norm, row] of idx.entries()) {
                if (k.includes(norm) || norm.includes(k)) return row;
            }
        }
        return null;
    }

    function badgeHtml() {
        return '<span class="badge-resilience">🛡️ Domestic Equivalent Available</span>';
    }

    function detailHtml(match) {
        if (!match?.domestic_equivalent) return '';
        const d = match.domestic_equivalent;
        return `<div class="equiv-part-detail muted">
            <b>Domestic equivalent:</b> ${escapeHtml(d.maker)} · P/N ${escapeHtml(d.equivalent_pn)}
            · ${escapeHtml(d.approval || '')} · ~${d.est_lead_time_days ?? '—'} days
            ${match.standard_spec ? `<br><span class="equiv-spec">Spec: ${escapeHtml(match.standard_spec)}</span>` : ''}
        </div>`;
    }

    function escapeHtml(s) {
        return String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    return {
        normalizePn,
        ensureLoaded,
        lookup,
        badgeHtml,
        detailHtml,
        seedFromMappings,
    };
})();
if (typeof window !== 'undefined') window.TVC_EquivalentParts = TVC_EquivalentParts;
