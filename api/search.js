'use strict';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const DAILY_QUOTA_LIMIT = 95;
const MAX_QUERY_CHARS = 512;
const TAVILY_SEARCH_URL = 'https://api.tavily.com/search';
const TAVILY_MAX_RESULTS = 8;

/** @type {Map<string, { expiresAt: number, payload: object }>} */
const queryCache = new Map();

let dailyUtcKey = '';
let dailyApiCallCount = 0;

function utcDayKey(date = new Date()) {
    return date.toISOString().slice(0, 10);
}

function resetDailyCounterIfNeeded() {
    const key = utcDayKey();
    if (key !== dailyUtcKey) {
        dailyUtcKey = key;
        dailyApiCallCount = 0;
    }
}

function normalizeQuery(raw) {
    return String(raw || '').trim().replace(/\s+/g, ' ').slice(0, MAX_QUERY_CHARS);
}

function cacheKey(q) {
    return normalizeQuery(q).toLowerCase();
}

function getCached(q) {
    const key = cacheKey(q);
    const entry = queryCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        queryCache.delete(key);
        return null;
    }
    return entry.payload;
}

function setCache(q, payload) {
    const key = cacheKey(q);
    queryCache.set(key, {
        expiresAt: Date.now() + CACHE_TTL_MS,
        payload: { ...payload, cached: true, cachedAt: new Date().toISOString() },
    });
}

function hostnameFromUrl(url) {
    try {
        return new URL(String(url || '').trim()).hostname.replace(/^www\./, '');
    } catch {
        return '';
    }
}

function mapTavilyItems(data) {
    const results = Array.isArray(data?.results) ? data.results : [];
    return results.slice(0, TAVILY_MAX_RESULTS).map((item) => {
        const link = String(item.url || '').trim();
        return {
            title: String(item.title || '').trim(),
            snippet: String(item.content || '').trim(),
            link,
            displayLink: hostnameFromUrl(link) || String(item.url || '').trim(),
        };
    });
}

async function fetchTavilySearch(q) {
    const apiKey = String(process.env.TAVILY_API_KEY || '').trim();
    if (!apiKey) {
        return { ok: false, reason: 'missing-config' };
    }

    const res = await fetch(TAVILY_SEARCH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            api_key: apiKey,
            query: q,
            search_depth: 'basic',
            include_answer: false,
            max_results: TAVILY_MAX_RESULTS,
        }),
    });

    if (res.status === 429) {
        return { ok: false, reason: 'rate-limited', status: 429 };
    }
    if (!res.ok) {
        return { ok: false, reason: 'http-error', status: res.status };
    }
    const data = await res.json();
    const items = mapTavilyItems(data);
    return { ok: true, items, responseTime: data.response_time };
}

function fallbackPayload(q, extra = {}) {
    return {
        query: q,
        items: [],
        fallback: true,
        ...extra,
    };
}

async function handler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store');

    if (req.method !== 'GET') {
        res.statusCode = 405;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
    }

    const url = new URL(req.url || '/', 'http://localhost');
    const q = normalizeQuery(url.searchParams.get('q') || '');

    if (!q) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'Missing query parameter q', fallback: true }));
        return;
    }

    resetDailyCounterIfNeeded();

    const cached = getCached(q);
    if (cached) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ ...cached, query: q, cacheHit: true }));
        return;
    }

    if (dailyApiCallCount >= DAILY_QUOTA_LIMIT) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(fallbackPayload(q, { quotaExceeded: true })));
        return;
    }

    try {
        const startedMs = Date.now();
        const result = await fetchTavilySearch(q);
        const executionMs = Date.now() - startedMs;
        if (!result.ok) {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(
                JSON.stringify(
                    fallbackPayload(q, {
                        quotaExceeded: result.reason === 'rate-limited',
                        error: result.reason,
                    }),
                ),
            );
            return;
        }

        dailyApiCallCount += 1;

        const payload = {
            query: q,
            items: result.items,
            resultCount: result.items.length,
            totalResults: result.items.length ? String(result.items.length) : undefined,
            executionMs,
            fallback: false,
            quotaExceeded: false,
            cached: false,
            dailyCount: dailyApiCallCount,
            dailyLimit: DAILY_QUOTA_LIMIT,
            provider: 'tavily',
            responseTime: result.responseTime,
        };

        setCache(q, payload);

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(payload));
    } catch (err) {
        console.error('[api/search]', err);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(fallbackPayload(q, { error: String(err.message || err).slice(0, 120) })));
    }
}

module.exports = handler;

module.exports._testing = {
    DAILY_QUOTA_LIMIT,
    CACHE_TTL_MS,
    TAVILY_MAX_RESULTS,
    normalizeQuery,
    getCached,
    setCache,
    resetDailyCounterIfNeeded,
    getDailyCount: () => {
        resetDailyCounterIfNeeded();
        return dailyApiCallCount;
    },
    setDailyCount: (n) => {
        resetDailyCounterIfNeeded();
        dailyApiCallCount = Math.max(0, Number(n) || 0);
    },
    clearCache: () => queryCache.clear(),
    mapTavilyItems,
};
