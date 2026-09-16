/**
 * Chunked global fleet registry — lazy index + async chunk loads.
 * Search: IMO, current name, former names (ex-names).
 */
(function (global) {
    'use strict';

    const INDEX_URL = '/data/fleet/fleet-index.json';
    const PROFILES_URL = '/data/fleet/fleet-profiles.json';
    const OVERRIDES_URL = '/data/vessel-overrides.json';
    const EXNAME_INDEX_URL = '/data/fleet/fleet-exname-index.json';
    const MIN_QUERY_LEN = 3;
    const DEBOUNCE_MS = 150;
    const MAX_RESULTS = 10;
    const SCORE_IMO_EXACT = 1000;
    const SCORE_NAME_EXACT = 1200;
    const SCORE_EX_NAME_EXACT = 1180;
    const SCORE_NAME_PREFIX = 950;
    const SCORE_NAME_CONTAINS = 880;
    const SCORE_NAME_ALL_TOKENS = 900;
    const SCORE_SINGLE_TOKEN = 520;
    const SCORE_OVERRIDE_BOOST = 200;

    /** @type {object | null} */
    let _index = null;
    /** @type {Record<string, object> | null} */
    let _overrides = null;
    let _overridesLoadPromise = null;
    /** @type {Map<string, object[]>} */
    const _chunkCache = new Map();
    /** @type {Map<string, object>} */
    const _vesselCache = new Map();
    /** @type {Map<string, object>} */
    const _nameBucketCache = new Map();
    /** @type {object | null} */
    let _tokenIndex = null;
    let _tokenLoadPromise = null;
    /** @type {object | null} */
    let _exnameIndex = null;
    let _exnameLoadPromise = null;
    /** @type {object | null} */
    let _profiles = null;
    let _profilesLoadPromise = null;
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

    function normalizeExNameLabel(str) {
        return String(str || '').trim().replace(/\s+/g, ' ');
    }

    async function loadProfiles() {
        if (_profiles) return _profiles;
        if (_profilesLoadPromise) return _profilesLoadPromise;
        _profilesLoadPromise = fetch(PROFILES_URL)
            .then((res) => (res.ok ? res.json() : { vessels: {} }))
            .catch(() => ({ vessels: {} }))
            .then((data) => {
                _profiles = data;
                return data;
            });
        return _profilesLoadPromise;
    }

    async function loadOverrides() {
        if (_overrides) return _overrides;
        if (_overridesLoadPromise) return _overridesLoadPromise;
        _overridesLoadPromise = fetch(OVERRIDES_URL)
            .then((res) => (res.ok ? res.json() : {}))
            .catch(() => ({}))
            .then((data) => {
                _overrides = data && typeof data === 'object' ? data : {};
                for (const [imo, row] of Object.entries(_overrides)) {
                    const v = vesselFromOverride(imo, row);
                    if (v?.imo) _vesselCache.set(v.imo, v);
                }
                return _overrides;
            });
        return _overridesLoadPromise;
    }

    function vesselFromOverride(imo, row) {
        const imo7 = digitsOnly(imo);
        if (imo7.length !== 7 || !row) return null;
        const exNames = [...new Set((Array.isArray(row.x) ? row.x : [])
            .map((n) => String(n).trim().toUpperCase())
            .filter(Boolean))];
        return {
            imo: imo7,
            i: imo7,
            name: row.n || '',
            n: row.n || '',
            type: row.t || '',
            t: row.t || '',
            dwt: row.d ?? row.dwt,
            d: row.d ?? row.dwt,
            gt: row.g ?? row.gt,
            g: row.g ?? row.gt,
            built_year: row.y ?? row.built_year,
            y: row.y ?? row.built_year,
            flag: row.f || row.flag || '',
            f: row.f || row.flag || '',
            technical_manager: row.m || row.technical_manager || '',
            m: row.m || row.technical_manager || '',
            engine_model: row.e || row.engine_model || '',
            e: row.e || row.engine_model || '',
            mmsi: row.mmsi || row.s || '',
            s: row.mmsi || row.s || '',
            cargo: row.cargo || row.c || '',
            c: row.cargo || row.c || '',
            compliance: row.compliance || row.z || '',
            z: row.compliance || row.z || '',
            ex_names: exNames,
            _priorityOverride: true,
        };
    }

    function collectOverrideSearchHits(raw, queryNorm, queryImo) {
        const hits = [];
        const vessels = _overrides || {};
        for (const [imo, row] of Object.entries(vessels)) {
            const imo7 = digitsOnly(imo);
            if (imo7.length !== 7) continue;
            let score = 0;
            if (queryImo.length === 7 && imo7 === queryImo) {
                score = SCORE_IMO_EXACT + SCORE_OVERRIDE_BOOST;
            } else if (queryImo.length >= MIN_QUERY_LEN && imo7.startsWith(queryImo)) {
                score = 900 - (imo7.length - queryImo.length) + SCORE_OVERRIDE_BOOST;
            }
            const nameNorm = normalizeSearch(row.n || '');
            if (queryNorm && nameNorm) {
                if (nameNorm === queryNorm) score = Math.max(score, SCORE_NAME_EXACT + SCORE_OVERRIDE_BOOST);
                else if (nameNorm.startsWith(queryNorm)) score = Math.max(score, SCORE_NAME_PREFIX + SCORE_OVERRIDE_BOOST);
                else if (nameNorm.includes(queryNorm)) score = Math.max(score, SCORE_NAME_CONTAINS + SCORE_OVERRIDE_BOOST);
            }
            if (!isPureImoQuery(raw) && queryNorm) {
                for (const ex of row.x || []) {
                    const exNorm = normalizeSearch(ex);
                    if (exNorm === queryNorm) score = Math.max(score, SCORE_EX_NAME_EXACT + SCORE_OVERRIDE_BOOST);
                }
            }
            if (score > 0) hits.push({ imo: imo7, score });
        }
        return hits;
    }

    function profileForImo(imo) {
        return _profiles?.vessels?.[imo] || null;
    }

    function expandVessel(compact) {
        if (!compact) return null;
        const imo = compact.imo || compact.i;
        const profile = imo ? profileForImo(imo) : null;
        const exFromChunk = Array.isArray(compact.x) ? compact.x : [];
        const exFromProfile = profile?.ex_names || [];
        const exNames = [...new Set([...exFromChunk, ...exFromProfile]
            .map((n) => String(n).trim().toUpperCase())
            .filter(Boolean))];

        if (compact.imo) {
            return {
                ...compact,
                mmsi: compact.mmsi || compact.s,
                ex_names: exNames,
                voyage: profile?.voyage || compact.voyage || null,
            };
        }
        return {
            imo,
            name: profile?.name || compact.n,
            type: profile?.type || compact.t,
            dwt: profile?.dwt ?? compact.d,
            built_year: profile?.built_year ?? compact.y,
            flag: profile?.flag || compact.f,
            technical_manager: profile?.technical_manager || compact.m,
            engine_model: profile?.engine_model || compact.e,
            mmsi: profile?.mmsi || compact.s || compact.mmsi,
            ex_names: exNames,
            voyage: profile?.voyage || null,
        };
    }

    function applyProfileOverrides(vessel) {
        if (!vessel?.imo) return vessel;
        const imo7 = digitsOnly(vessel.imo);
        const ov = _overrides?.[imo7];
        if (ov) {
            const merged = vesselFromOverride(imo7, ov);
            return { ...vessel, ...merged, ex_names: merged.ex_names };
        }
        const profile = profileForImo(vessel.imo);
        if (!profile) return vessel;
        const exNames = [...new Set([...(vessel.ex_names || []), ...(profile.ex_names || [])]
            .map((n) => String(n).trim().toUpperCase())
            .filter(Boolean))];
        return {
            ...vessel,
            name: profile.name || vessel.name,
            type: profile.type || vessel.type,
            dwt: profile.dwt ?? vessel.dwt,
            built_year: profile.built_year ?? vessel.built_year,
            flag: profile.flag || vessel.flag,
            technical_manager: profile.technical_manager || vessel.technical_manager,
            engine_model: profile.engine_model || vessel.engine_model,
            mmsi: profile.mmsi || vessel.mmsi,
            ex_names: exNames,
            voyage: profile.voyage || vessel.voyage,
        };
    }

    function cacheVessel(v) {
        const full = applyProfileOverrides(expandVessel(v));
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
            .then(async (data) => {
                _index = data;
                await loadProfiles();
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
        await loadOverrides();
        await loadProfiles();
        if (_overrides?.[imo7]) return cacheVessel(vesselFromOverride(imo7, _overrides[imo7]));
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

    async function loadExnameIndex() {
        if (_exnameIndex) return _exnameIndex;
        if (_exnameLoadPromise) return _exnameLoadPromise;
        _exnameLoadPromise = fetch(EXNAME_INDEX_URL)
            .then((res) => (res.ok ? res.json() : { exact: {}, tokens: {} }))
            .catch(() => ({ exact: {}, tokens: {} }))
            .then((data) => {
                _exnameIndex = data;
                return data;
            });
        return _exnameLoadPromise;
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

    function isPureImoQuery(raw) {
        return /^\d{7}$/.test(String(raw || '').trim());
    }

    /** Returns former name label only when query explicitly matches vessel.x — never for IMO-only search. */
    function exNameMatchedByQuery(raw, vessel) {
        if (isPureImoQuery(raw)) return null;
        const queryNorm = normalizeSearch(raw);
        if (!queryNorm || /^\d+$/.test(queryNorm)) return null;

        const exNames = vessel?.ex_names || [];
        for (const ex of exNames) {
            const exNorm = normalizeSearch(ex);
            if (!exNorm) continue;
            if (exNorm === queryNorm) return normalizeExNameLabel(ex);
        }
        return null;
    }

    function queryTokens(queryNorm) {
        return queryNorm.split(/\s+/).filter(Boolean);
    }

    function nameMatchesAllTokens(nameNorm, tokens) {
        if (!tokens.length) return false;
        return tokens.every((tok) => nameNorm.includes(tok));
    }

    function scoreMatch(queryNorm, queryImo, item, vessel) {
        const name = item.s || normalizeSearch(item.n || vessel?.name);
        const imo = vessel?.imo || item.i;
        const tokens = queryTokens(queryNorm);
        let score = 0;
        if (queryImo.length >= 3) {
            if (imo === queryImo) score = SCORE_IMO_EXACT;
            else if (imo.startsWith(queryImo)) score = 900 - (imo.length - queryImo.length);
        }
        if (queryNorm) {
            if (name === queryNorm) score = Math.max(score, SCORE_NAME_EXACT);
            else if (name.startsWith(queryNorm)) score = Math.max(score, SCORE_NAME_PREFIX);
            else if (name.includes(queryNorm)) score = Math.max(score, SCORE_NAME_CONTAINS);
            else if (tokens.length > 1) {
                if (nameMatchesAllTokens(name, tokens)) {
                    const nameTokCount = name.split(/\s+/).filter(Boolean).length;
                    const tightness = tokens.length / Math.max(nameTokCount, tokens.length);
                    score = Math.max(score, SCORE_NAME_ALL_TOKENS + Math.round(tightness * 80));
                }
            } else if (tokens.length === 1 && name.includes(tokens[0])) {
                score = Math.max(score, SCORE_SINGLE_TOKEN);
            }
            const imoOnlyQuery = queryImo.length === 7 && queryNorm === queryImo;
            if (!imoOnlyQuery) {
                const exNames = vessel?.ex_names || [];
                for (const ex of exNames) {
                    const exNorm = normalizeSearch(ex);
                    if (exNorm === queryNorm) score = Math.max(score, SCORE_EX_NAME_EXACT);
                }
            }
        }
        return score;
    }

    function collectProfileNameHits(queryNorm) {
        const hits = [];
        const vessels = _profiles?.vessels || {};
        for (const [imo, profile] of Object.entries(vessels)) {
            const nameNorm = normalizeSearch(profile?.name || '');
            if (!nameNorm) continue;
            if (nameNorm === queryNorm) {
                hits.push({ imo, score: SCORE_NAME_EXACT });
            } else if (nameNorm.startsWith(queryNorm)) {
                hits.push({ imo, score: SCORE_NAME_PREFIX });
            }
        }
        return hits;
    }

    async function searchFleet(query) {
        const raw = String(query || '').trim();
        if (raw.length < MIN_QUERY_LEN) return [];

        const cacheKey = normalizeSearch(raw);
        const cached = _searchResultCache.get(cacheKey);
        if (cached) return cached;

        await loadOverrides();
        await loadProfiles();
        const idx = await loadIndex();
        const queryNorm = normalizeSearch(raw);
        const queryImo = digitsOnly(raw);

        if (queryImo.length === 7 && _overrides?.[queryImo]) {
            const vessel = cacheVessel(vesselFromOverride(queryImo, _overrides[queryImo]));
            const results = [vessel];
            _searchResultCache.set(cacheKey, results);
            return results;
        }

        const overrideHits = collectOverrideSearchHits(raw, queryNorm, queryImo);

        const imoHits = [];
        if (queryImo.length >= MIN_QUERY_LEN && idx?.imo) {
            for (const [imo, partition] of Object.entries(idx.imo)) {
                if (!imo.startsWith(queryImo)) continue;
                imoHits.push({ imo, partition, score: imo === queryImo ? 1000 : 900 });
                if (imoHits.length > 40) break;
            }
        }

        const profileNameHits = collectProfileNameHits(queryNorm);

        const exNameHits = [];
        if (!isPureImoQuery(raw)) {
            const exIndex = await loadExnameIndex();
            const exactImo = exIndex.exact?.[queryNorm];
            if (exactImo) {
                exNameHits.push({ imo: exactImo, score: SCORE_EX_NAME_EXACT });
            }
            const multiWord = queryTokens(queryNorm).length > 1;
            const exKeys = tokenCandidates(queryNorm);
            for (const key of exKeys) {
                if (multiWord && key !== queryNorm) continue;
                const list = exIndex.tokens?.[key];
                if (!Array.isArray(list)) continue;
                for (const imo of list) {
                    exNameHits.push({ imo, score: SCORE_EX_NAME_EXACT - 40 });
                }
            }
        }

        const nameHits = [];
        const tokenIndex = await loadTokenIndex();
        const keys = tokenCandidates(queryNorm);
        const wordTokens = queryTokens(queryNorm);
        const tokenKeysOnly = wordTokens.filter((t) => t.length >= MIN_QUERY_LEN);
        const lists = tokenKeysOnly
            .map((key) => tokenIndex[key])
            .filter((list) => Array.isArray(list) && list.length);
        const candidateImos = new Set();
        if (lists.length > 1) {
            let intersection = new Set(lists[0]);
            for (let i = 1; i < lists.length; i++) {
                const next = new Set(lists[i]);
                intersection = new Set([...intersection].filter((imo) => next.has(imo)));
            }
            if (intersection.size > 0) {
                intersection.forEach((imo) => candidateImos.add(imo));
            } else {
                const union = new Set();
                lists.forEach((list) => list.forEach((imo) => union.add(imo)));
                for (const imo of union) {
                    let cachedV = _vesselCache.get(imo);
                    if (!cachedV) {
                        // eslint-disable-next-line no-await-in-loop
                        cachedV = await getVesselByImo(imo);
                    }
                    const nameNorm = normalizeSearch(cachedV?.name || '');
                    if (nameMatchesAllTokens(nameNorm, wordTokens)) candidateImos.add(imo);
                }
            }
        } else if (lists.length === 1) {
            lists[0].forEach((imo) => candidateImos.add(imo));
        } else if (wordTokens.length === 1) {
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
                let cachedV = _vesselCache.get(imo);
                if (!cachedV) {
                    // eslint-disable-next-line no-await-in-loop
                    cachedV = await getVesselByImo(imo);
                }
                const name = cachedV?.name || '';
                const item = { i: imo, n: name, s: normalizeSearch(name) };
                const score = scoreMatch(queryNorm, queryImo, item, cachedV);
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
        for (const h of exNameHits) {
            combined.set(h.imo, Math.max(combined.get(h.imo) || 0, h.score));
        }
        for (const h of profileNameHits) {
            combined.set(h.imo, Math.max(combined.get(h.imo) || 0, h.score));
        }
        for (const h of overrideHits) {
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
            if (!v && _overrides?.[imo]) {
                v = cacheVessel(vesselFromOverride(imo, _overrides[imo]));
            }
            if (!v) v = await getVesselByImo(imo);
            if (!v) continue;
            const exLabel = exNameMatchedByQuery(raw, v);
            if (exLabel) {
                v = { ...v, _exNameMatch: exLabel };
            }
            vessels.push({ vessel: v, score });
        }

        const results = vessels
            .sort((a, b) => b.score - a.score)
            .map((r) => r.vessel);

        _searchResultCache.set(cacheKey, results);
        return results;
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
        loadOverrides,
        searchFleet,
        searchVessels: searchFleet,
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
