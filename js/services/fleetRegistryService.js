/**
 * Chunked global fleet registry — lazy index + async chunk loads.
 */
(function (global) {
    'use strict';

    const INDEX_URL = '/data/fleet/fleet-index.json';
    const MIN_QUERY_LEN = 3;
    const DEBOUNCE_MS = 150;
    const MAX_RESULTS = 10;

    /** @type {object | null} */
    let _index = null;
    /** @type {Map<string, object[]>} */
    const _chunkCache = new Map();
    /** @type {Map<string, object>} */
    const _vesselCache = new Map();
    /** @type {Map<string, object>} */
    const _nameBucketCache = new Map();
    /** @type {object | null} */
    let _tokenIndex = null;
    let _tokenLoadPromise = null;
    /** @type {Map<string, Promise<object[]>>} */
    const _chunkInflight = new Map();
    /** @type {Map<string, Promise<object>>} */
    const _nameInflight = new Map();

    let _loadIndexPromise = null;

    function digitsOnly(str) {
        return String(str || '').replace(/\D/g, '');
    }

    function normalizeSearch(str) {
        return String(str || '')
            .trim()
            .normalize('NFKC')
            .replace(/[^a-zA-Z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .toLowerCase();
    }

    function expandVessel(compact) {
        if (!compact) return null;
        if (compact.imo) {
            return { ...compact, mmsi: compact.mmsi || compact.s };
        }
        return {
            imo: compact.i,
            name: compact.n,
            type: compact.t,
            dwt: compact.d,
            built_year: compact.y,
            flag: compact.f,
            technical_manager: compact.m,
            engine_model: compact.e,
            mmsi: compact.s || compact.mmsi,
        };
    }

    function cacheVessel(v) {
        const full = expandVessel(v);
        if (full?.imo) _vesselCache.set(full.imo, full);
        return full;
    }

    async function loadIndex() {
        if (_index) return _index;
        if (_loadIndexPromise) return _loadIndexPromise;
        _loadIndexPromise = fetch(INDEX_URL)
            .then((res) => {
                if (!res.ok) throw new Error(`fleet index fetch failed: ${res.status}`);
                return res.json();
            })
            .then((data) => {
                _index = data;
                return data;
            });
        return _loadIndexPromise;
    }

    async function fetchChunk(partitionKey) {
        if (_chunkCache.has(partitionKey)) {
            return _chunkCache.get(partitionKey);
        }
        if (_chunkInflight.has(partitionKey)) {
            return _chunkInflight.get(partitionKey);
        }
        const idx = await loadIndex();
        const meta = idx?.chunks?.[partitionKey];
        if (!meta?.file) return [];
        const promise = fetch(meta.file)
            .then((res) => {
                if (!res.ok) throw new Error(`chunk ${partitionKey}: ${res.status}`);
                return res.json();
            })
            .then((payload) => {
                const ships = payload.ships || [];
                _chunkCache.set(partitionKey, ships);
                for (const s of ships) cacheVessel(s);
                return ships;
            })
            .finally(() => {
                _chunkInflight.delete(partitionKey);
            });
        _chunkInflight.set(partitionKey, promise);
        return promise;
    }

    async function getVesselByImo(imo) {
        const imo7 = digitsOnly(imo);
        if (imo7.length !== 7) return null;
        if (_vesselCache.has(imo7)) return _vesselCache.get(imo7);

        const idx = await loadIndex();
        const partition = idx?.imo?.[imo7];
        if (!partition) return null;

        const ships = await fetchChunk(partition);
        const hit = ships.find((s) => s.i === imo7);
        return hit ? cacheVessel(hit) : null;
    }

    async function loadTokenIndex() {
        if (_tokenIndex) return _tokenIndex;
        if (_tokenLoadPromise) return _tokenLoadPromise;
        const idx = await loadIndex();
        const url = idx?.tokensFile || '/data/fleet/fleet-tokens.json';
        _tokenLoadPromise = fetch(url)
            .then((res) => {
                if (!res.ok) throw new Error(`fleet tokens fetch failed: ${res.status}`);
                return res.json();
            })
            .then((data) => {
                _tokenIndex = data.tokens || data;
                return _tokenIndex;
            });
        return _tokenLoadPromise;
    }

    function tokenCandidates(queryNorm) {
        const tokens = queryNorm.split(/\s+/).filter(Boolean);
        const keys = new Set();
        if (queryNorm.length >= MIN_QUERY_LEN) keys.add(queryNorm);
        for (const t of tokens) {
            if (t.length >= MIN_QUERY_LEN) keys.add(t);
        }
        return [...keys];
    }

    async function loadNameBucket(letter) {
        const key = letter || '_';
        if (_nameBucketCache.has(key)) return _nameBucketCache.get(key);
        if (_nameInflight.has(key)) return _nameInflight.get(key);

        const idx = await loadIndex();
        const meta = idx?.nameIndex?.[key];
        if (!meta?.file) {
            _nameBucketCache.set(key, { items: [] });
            return _nameBucketCache.get(key);
        }

        const promise = fetch(meta.file)
            .then((res) => {
                if (!res.ok) throw new Error(`name index ${key}: ${res.status}`);
                return res.json();
            })
            .then((payload) => {
                const bucket = { items: payload.items || [] };
                _nameBucketCache.set(key, bucket);
                return bucket;
            })
            .finally(() => {
                _nameInflight.delete(key);
            });
        _nameInflight.set(key, promise);
        return promise;
    }

    function scoreMatch(queryNorm, queryImo, item, vessel) {
        const name = item.s || normalizeSearch(item.n || vessel?.name);
        const imo = vessel?.imo || item.i;
        let score = 0;
        if (queryImo.length >= 3) {
            if (imo === queryImo) score = 1000;
            else if (imo.startsWith(queryImo)) score = 900 - (imo.length - queryImo.length);
        }
        if (queryNorm) {
            if (name === queryNorm) score = Math.max(score, 850);
            else if (name.startsWith(queryNorm)) score = Math.max(score, 800);
            else if (name.includes(queryNorm)) score = Math.max(score, 700);
            else {
                const tokens = queryNorm.split(/\s+/).filter(Boolean);
                for (const tok of tokens) {
                    if (name.includes(tok)) score = Math.max(score, 500);
                }
            }
        }
        return score;
    }

    async function searchFleet(query) {
        const raw = String(query || '').trim();
        if (raw.length < MIN_QUERY_LEN) return [];

        const cacheKey = normalizeSearch(raw);
        const cached = _searchResultCache.get(cacheKey);
        if (cached) return cached;

        const idx = await loadIndex();
        const queryNorm = normalizeSearch(raw);
        const queryImo = digitsOnly(raw);

        const imoHits = [];
        if (queryImo.length >= MIN_QUERY_LEN && idx?.imo) {
            for (const [imo, partition] of Object.entries(idx.imo)) {
                if (!imo.startsWith(queryImo)) continue;
                imoHits.push({ imo, partition, score: imo === queryImo ? 1000 : 900 });
                if (imoHits.length > 40) break;
            }
        }

        const nameHits = [];
        const tokenIndex = await loadTokenIndex();
        const keys = tokenCandidates(queryNorm);
        const lists = keys.map((key) => tokenIndex[key]).filter((list) => Array.isArray(list) && list.length);
        const candidateImos = new Set();
        if (lists.length > 1) {
            let intersection = new Set(lists[0]);
            for (let i = 1; i < lists.length; i++) {
                const next = new Set(lists[i]);
                intersection = new Set([...intersection].filter((imo) => next.has(imo)));
            }
            intersection.forEach((imo) => candidateImos.add(imo));
        } else if (lists.length === 1) {
            lists[0].forEach((imo) => candidateImos.add(imo));
        } else {
            for (const key of keys) {
                const list = tokenIndex[key];
                if (Array.isArray(list)) list.forEach((imo) => candidateImos.add(imo));
            }
        }
        if (candidateImos.size === 0) {
            const firstChar = queryNorm[0] && /[a-z0-9]/.test(queryNorm[0]) ? queryNorm[0] : '_';
            const bucket = await loadNameBucket(firstChar);
            for (const item of bucket.items || []) {
                const score = scoreMatch(queryNorm, queryImo, item, null);
                if (score > 0) nameHits.push({ imo: item.i, score, name: item.n });
            }
        } else {
            for (const imo of candidateImos) {
                let cached = _vesselCache.get(imo);
                if (!cached) {
                    // eslint-disable-next-line no-await-in-loop
                    cached = await getVesselByImo(imo);
                }
                const name = cached?.name || '';
                const item = { i: imo, n: name, s: normalizeSearch(name) };
                const score = scoreMatch(queryNorm, queryImo, item, cached);
                if (score > 0) nameHits.push({ imo, score, name });
            }
        }

        const combined = new Map();
        for (const h of imoHits) {
            combined.set(h.imo, Math.max(combined.get(h.imo) || 0, h.score));
        }
        for (const h of nameHits) {
            combined.set(h.imo, Math.max(combined.get(h.imo) || 0, h.score));
        }

        const ranked = [...combined.entries()]
            .map(([imo, score]) => ({ imo, score }))
            .sort((a, b) => b.score - a.score || a.imo.localeCompare(b.imo))
            .slice(0, MAX_RESULTS);

        const partitionsNeeded = new Set();
        for (const { imo } of ranked) {
            const p = idx.imo?.[imo];
            if (p) partitionsNeeded.add(p);
        }

        await Promise.all([...partitionsNeeded].map((p) => fetchChunk(p)));

        const vessels = [];
        for (const { imo, score } of ranked) {
            let v = _vesselCache.get(imo);
            if (!v) v = await getVesselByImo(imo);
            if (v) vessels.push({ vessel: v, score });
        }

        const results = vessels
            .sort((a, b) => b.score - a.score)
            .map((r) => r.vessel);

        _searchResultCache.set(cacheKey, results);
        return results;
    }

    /** @type {Map<string, object[]>} */
    const _searchResultCache = new Map();

    function createDebouncedSearch(fn) {
        let timer = null;
        let lastGen = 0;
        return function debounced(query, onResult) {
            const gen = ++lastGen;
            clearTimeout(timer);
            timer = setTimeout(async () => {
                try {
                    const results = await fn(query);
                    if (gen === lastGen) onResult(results, null);
                } catch (err) {
                    if (gen === lastGen) onResult([], err);
                }
            }, DEBOUNCE_MS);
        };
    }

    const debouncedSearch = createDebouncedSearch(searchFleet);

    function clearCaches() {
        _searchResultCache.clear();
    }

    const api = {
        loadIndex,
        searchFleet,
        debouncedSearch,
        getVesselByImo,
        expandVessel,
        clearCaches,
        MIN_QUERY_LEN,
        DEBOUNCE_MS,
        MAX_RESULTS,
    };

    global.TVC_FleetRegistry = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
