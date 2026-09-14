#!/usr/bin/env node
/**
 * Forum guard + API smoke — clean post vs blocked profanity/spam.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const guard = require('../api/_lib/forumGuard.js');
const handler = require('../api/forum/post.js');

function mockReq(method, { body, query, headers } = {}) {
    const q = query ? `?${new URLSearchParams(query)}` : '';
    return {
        method,
        url: `/api/forum/post${q}`,
        headers: headers || {},
        on(event, fn) {
            if (event === 'data' && body != null) {
                fn(Buffer.from(JSON.stringify(body)));
            }
            if (event === 'end') fn();
        },
    };
}

function mockRes() {
    const out = { statusCode: 0, body: null, headers: {} };
    return {
        out,
        setHeader(k, v) {
            out.headers[k] = v;
        },
        status(code) {
            out.statusCode = code;
            return this;
        },
        json(data) {
            out.body = data;
            return this;
        },
        end() {
            return this;
        },
    };
}

console.log('forum guard: clean post');
const clean = guard.validatePostPayload({
    displayName: 'Test User',
    role: 'Engineer',
    category: 'technical',
    title: 'LO filter differential',
    body: 'Normal technical question about LO system.',
    website_url_check: '',
});
assert.equal(clean.ok, true);

console.log('forum guard: block profanity');
const bad = guard.validatePostPayload({
    displayName: 'Bot',
    role: 'Other',
    category: 'technical',
    title: 'spam',
    body: 'this is shit content',
    website_url_check: '',
});
assert.equal(bad.ok, false);
assert.equal(bad.code, 'PROFANITY');

console.log('forum guard: honeypot silent fail');
const hp = guard.validatePostPayload({
    displayName: 'Bot',
    role: 'Other',
    category: 'technical',
    title: 'hello',
    body: 'nice post',
    website_url_check: 'http://spam.example',
});
assert.equal(hp.ok, false);
assert.equal(hp.code, 'HONEYPOT');

console.log('forum guard: malicious link');
const exe = guard.scanAbuse('See http://evil.example/payload.exe for fix');
assert.equal(exe.ok, false);
assert.equal(exe.code, 'MALICIOUS_LINK');

console.log('forum guard: linkify rel');
const html = guard.linkifyEscaped('Docs at https://classnk.or.jp and safe.');
assert.match(html, /rel="nofollow noopener noreferrer"/);
assert.match(html, /classnk/);

console.log('forum API: GET posts');
const getReq = mockReq('GET', { query: { category: 'technical' } });
const getRes = mockRes();
await handler(getReq, getRes);
assert.equal(getRes.out.statusCode, 200);
assert.ok(Array.isArray(getRes.out.body.posts));

console.log('forum API: POST blocked');
const postReq = mockReq('POST', {
    body: {
        action: 'post',
        displayName: 'X',
        role: 'Engineer',
        category: 'ops',
        title: 'Bad',
        body: 'casino bonus here',
        website_url_check: '',
        clientSessionId: 'test-session-1',
    },
    headers: { 'x-forum-session': 'test-session-1' },
});
const postRes = mockRes();
await handler(postReq, postRes);
assert.equal(postRes.out.statusCode, 400);
assert.equal(postRes.out.body.code, 'SPAM');

console.log('\nOK forum guard + API smoke');
