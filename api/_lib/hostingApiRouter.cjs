'use strict';

const {
    vercelesqueResponse,
    buildMockReq,
    mockReqWithRawBody,
} = require('./vercelesqueAdapter.cjs');

const askBrain = require('../ask-brain.js');
const searchApi = require('../search.js');
const rfqApi = require('../rfq.js');
const contactApi = require('../contact.js');
const feedbackApi = require('../feedback.js');
const revenuePipeline = require('../revenue-pipeline.js');
const vesselAis = require('../vessel-ais.js');
const forumPost = require('../forum/post.js');
const purgeVesselSync = require('../admin/purge-vessel-sync.js');
const billingRouter = require('../billing/[...path].js');
const syncRouter = require('../sync/[...path].js');
const storeHandler = require('../store/[code].js');

function storeCodeFromPath(pathname) {
    const m = pathname.match(/^\/store\/(\d{4,6})\/?$/);
    return m ? m[1] : null;
}

function resolveApiHandler(pathname, method) {
    const code = storeCodeFromPath(pathname);
    if (code && (method === 'GET' || method === 'HEAD')) {
        return {
            kind: 'store',
            code,
        };
    }

    if (pathname === '/api/ask-brain') return { kind: 'handler', handler: askBrain, rawBody: true };
    if (pathname === '/api/search' && method === 'GET') return { kind: 'handler', handler: searchApi };
    if (
        pathname === '/api/rfq'
        || pathname === '/api/rfq-draft'
        || pathname === '/api/rfq-submit'
    ) {
        return { kind: 'handler', handler: rfqApi, rawBody: method === 'POST', rfqBody: method === 'POST' };
    }
    if (pathname === '/api/contact') return { kind: 'handler', handler: contactApi, rawBody: true };
    if (pathname === '/api/feedback') return { kind: 'handler', handler: feedbackApi, rawBody: true };
    if (pathname === '/api/revenue-pipeline') return { kind: 'handler', handler: revenuePipeline };
    if (pathname === '/api/vessel-ais') return { kind: 'handler', handler: vesselAis };
    if (pathname === '/api/forum/post') return { kind: 'handler', handler: forumPost, rawBody: true };
    if (pathname === '/api/admin/purge-vessel-sync') {
        return { kind: 'handler', handler: purgeVesselSync, rawBody: true };
    }
    if (pathname.startsWith('/api/billing/')) {
        return { kind: 'handler', handler: billingRouter, rawBody: true };
    }
    if (pathname.startsWith('/api/sync/')) {
        return { kind: 'handler', handler: syncRouter, rawBody: true };
    }

    return null;
}

async function readRequestBody(request) {
    if (request.method === 'GET' || request.method === 'HEAD') return null;
    const buf = Buffer.from(await request.arrayBuffer());
    return buf.length ? buf : null;
}

async function dispatchHostingApi(request) {
    const url = new URL(request.url);
    const route = resolveApiHandler(url.pathname, request.method);
    if (!route) {
        return new Response('Not Found', { status: 404 });
    }

    const rawBody = await readRequestBody(request);
    const baseReq = buildMockReq({
        method: request.method,
        url: request.url,
        headers: Object.fromEntries(request.headers.entries()),
        pathname: url.pathname,
        searchParams: url.searchParams,
        body: undefined,
    });

    return new Promise((resolve) => {
        const res = vercelesqueResponse(resolve);

        if (route.kind === 'store') {
            const mockReq = { method: request.method, query: { code: route.code } };
            storeHandler(mockReq, res);
            return;
        }

        let mockReq = baseReq;
        if (route.rawBody && rawBody) {
            mockReq = mockReqWithRawBody(baseReq, rawBody);
            if (route.rfqBody) {
                try {
                    mockReq.body = JSON.parse(rawBody.toString('utf8'));
                } catch {
                    mockReq.body = {};
                }
            }
        } else if (route.rawBody && request.method === 'POST') {
            mockReq = mockReqWithRawBody(baseReq, Buffer.alloc(0));
        }

        Promise.resolve(route.handler(mockReq, res)).catch((err) => {
            console.error('[hosting-api]', err);
            resolve(new Response('Internal Server Error', { status: 500 }));
        });
    });
}

/** Netlify Functions (classic event shape). */
async function dispatchNetlifyEvent(event) {
    const host = event.headers?.host || event.headers?.Host || 'localhost';
    const rawUrl = event.rawUrl || `https://${host}${event.path}${event.rawQuery ? `?${event.rawQuery}` : ''}`;
    const headers = new Headers();
    for (const [k, v] of Object.entries(event.headers || {})) {
        if (v != null) headers.set(k, String(v));
    }
    const init = { method: event.httpMethod || 'GET', headers };
    if (event.body && event.httpMethod !== 'GET' && event.httpMethod !== 'HEAD') {
        init.body = event.isBase64Encoded
            ? Buffer.from(event.body, 'base64')
            : event.body;
    }
    const request = new Request(rawUrl, init);
    const response = await dispatchHostingApi(request);
    const body = await response.arrayBuffer();
    const outHeaders = {};
    response.headers.forEach((v, k) => {
        outHeaders[k] = v;
    });
    return {
        statusCode: response.status,
        headers: outHeaders,
        body: Buffer.from(body).toString('base64'),
        isBase64Encoded: true,
    };
}

function isApiOrStorePath(pathname) {
    return pathname.startsWith('/api/') || storeCodeFromPath(pathname) != null;
}

module.exports = {
    dispatchHostingApi,
    dispatchNetlifyEvent,
    isApiOrStorePath,
    resolveApiHandler,
};
