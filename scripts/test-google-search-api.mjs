#!/usr/bin/env node
/**
 * Unit tests: /api/search cache + daily quota guard (no live Google calls).
 */
import { createServer } from 'node:http';
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
globalThis.fetch = async () => {
    fetchCalls += 1;
    return {
        ok: true,
        status: 200,
        json: async () => ({
            items: [{ title: 'Mock Result', link: 'https://example.com/a', displayLink: 'example.com', snippet: 'Snippet' }],
        }),
    };
};

process.env.GOOGLE_SEARCH_API_KEY = 'test-key';
process.env.GOOGLE_SEARCH_CX = 'test-cx';

function requestSearch(q) {
    return new Promise((resolve, reject) => {
        const server = createServer((req, res) => {
            const mockRes = {
                statusCode: 200,
                headers: {},
                setHeader(k, v) {
                    this.headers[k] = v;
                },
                end(body) {
                    resolve({ status: this.statusCode, body: JSON.parse(body) });
                    server.close();
                },
            };
            searchHandler({ method: 'GET', url: `/api/search?q=${encodeURIComponent(q)}` }, mockRes);
        });
        server.listen(0, () => {
            const port = server.address().port;
            fetch(`http://127.0.0.1:${port}/api/search?q=${encodeURIComponent(q)}`)
                .then((r) => r.json())
                .then((body) => {
                    resolve({ status: 200, body });
                    server.close();
                })
                .catch(reject);
        });
    });
}

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
check('first query hits Google once', fetchCalls === 1);
check('daily counter increments', _testing.getDailyCount() === 1);

fetchCalls = 0;
const second = await invokeDirect(q1);
check('repeat query served from cache', second.body.cacheHit === true || second.body.cached === true);
check('repeat query skips Google fetch', fetchCalls === 0);
check('cache hit does not increment counter', _testing.getDailyCount() === 1);

_testing.setDailyCount(95);
fetchCalls = 0;
const blocked = await invokeDirect('fresh query after quota');
check('quota guard blocks API at 95', blocked.body.quotaExceeded === true && blocked.body.fallback === true);
check('quota block skips Google fetch', fetchCalls === 0);

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

globalThis.fetch = originalFetch;

if (process.exitCode) {
    console.error('\nGoogle search API tests FAILED');
    process.exit(1);
}
console.log('\nGoogle search API tests passed.');
