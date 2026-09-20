#!/usr/bin/env node
/**
 * Unit tests: /api/search cache + daily quota guard (no live Tavily calls).
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const searchHandler = require('../api/search.js');
const { _testing } = searchHandler;

function check(name, ok, detail = '') {
    console.log(ok ? 'OK' : 'FAIL', name, detail ? `— ${detail}` : '');
    if (!ok) process.exitCode = 1;
}

_testing.clearCache();
_testing.setDailyCount(0);

const originalFetch = globalThis.fetch;
let fetchCalls = 0;
globalThis.fetch = async (url, init) => {
    fetchCalls += 1;
    check('fetch targets Tavily', String(url).includes('api.tavily.com/search'));
    check('fetch uses POST', init?.method === 'POST');
    return {
        ok: true,
        status: 200,
        json: async () => ({
            results: [
                {
                    title: 'Mock Result',
                    url: 'https://example.com/a',
                    content: 'Snippet',
                },
            ],
        }),
    };
};

process.env.TAVILY_API_KEY = 'test-tavily-key';
delete process.env.GOOGLE_SEARCH_API_KEY;
delete process.env.GOOGLE_SEARCH_CX;

async function invokeDirect(q) {
    return new Promise((resolve) => {
        const mockRes = {
            statusCode: 200,
            headers: {},
            setHeader(k, v) {
                this.headers[k] = v;
            },
            end(raw) {
                resolve({ status: this.statusCode, body: JSON.parse(raw) });
            },
        };
        searchHandler({ method: 'GET', url: `/api/search?q=${encodeURIComponent(q)}` }, mockRes);
    });
}

const q1 = 'bunker fuel viscosity table';
fetchCalls = 0;
const first = await invokeDirect(q1);
check('first query returns items', (first.body.items || []).length === 1);
check('first item maps Tavily fields', first.body.items[0]?.link === 'https://example.com/a');
check('first query hits Tavily once', fetchCalls === 1);
check('daily counter increments', _testing.getDailyCount() === 1);

fetchCalls = 0;
const second = await invokeDirect(q1);
check('repeat query served from cache', second.body.cacheHit === true || second.body.cached === true);
check('repeat query skips Tavily fetch', fetchCalls === 0);
check('cache hit does not increment counter', _testing.getDailyCount() === 1);

_testing.setDailyCount(95);
fetchCalls = 0;
const blocked = await invokeDirect('fresh query after quota');
check('quota guard blocks API at 95', blocked.body.quotaExceeded === true && blocked.body.fallback === true);
check('quota block skips Tavily fetch', fetchCalls === 0);

_testing.setDailyCount(0);
_testing.clearCache();
fetchCalls = 0;
globalThis.fetch = async () => ({
    ok: false,
    status: 429,
    json: async () => ({}),
});
const rateLimited = await invokeDirect('rate limit probe');
check('HTTP 429 returns fallback', rateLimited.body.fallback === true);

_testing.clearCache();
delete process.env.TAVILY_API_KEY;
fetchCalls = 0;
const missing = await invokeDirect('missing key probe');
check('missing TAVILY_API_KEY returns fallback', missing.body.fallback === true);
check('missing key skips Tavily fetch', fetchCalls === 0);

globalThis.fetch = originalFetch;

if (process.exitCode) {
    console.error('\nTavily search API tests FAILED');
    process.exit(1);
}
console.log('\nTavily search API tests passed.');
