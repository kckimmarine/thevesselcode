'use strict';

/**
 * Bridge Web Request / Netlify event → Vercel-style (req, res) handlers in api/.
 */
function vercelesqueResponse(resolve) {
    const headers = {};
    let statusCode = 200;
    const res = {
        statusCode: 200,
        setHeader(k, v) {
            headers[String(k).toLowerCase()] = v;
        },
        status(code) {
            statusCode = code;
            this.statusCode = code;
            return this;
        },
        end(body) {
            resolve(toWebResponse(statusCode, headers, body));
        },
        send(body) {
            this.end(body);
        },
        json(obj) {
            if (!headers['content-type']) {
                this.setHeader('Content-Type', 'application/json; charset=utf-8');
            }
            this.end(JSON.stringify(obj));
        },
    };
    return res;
}

function toWebResponse(statusCode, headers, body) {
    const init = { status: statusCode, headers: new Headers() };
    for (const [k, v] of Object.entries(headers)) {
        init.headers.set(k, String(v));
    }
    if (body === undefined || body === null) {
        return new Response(null, init);
    }
    if (Buffer.isBuffer(body)) {
        return new Response(body, init);
    }
    return new Response(String(body), init);
}

function parsePathSegments(pathname, prefix) {
    const rest = pathname.slice(prefix.length).replace(/^\/+/, '').replace(/\/+$/, '');
    if (!rest) return [];
    return rest.split('/').map((s) => decodeURIComponent(s)).filter(Boolean);
}

function buildMockReq({ method, url, headers, body, pathname, searchParams }) {
    const query = Object.fromEntries(searchParams.entries());
    const mock = {
        method,
        headers: headers || {},
        url: `${pathname}${searchParams.toString() ? `?${searchParams}` : ''}`,
        query,
        body,
    };

    if (pathname.startsWith('/api/billing/')) {
        mock.query.path = parsePathSegments(pathname, '/api/billing');
    } else if (pathname.startsWith('/api/sync/')) {
        mock.query.path = parsePathSegments(pathname, '/api/sync');
    }

    return mock;
}

function mockReqWithJsonBody(baseReq, jsonBody) {
    return Object.assign(Object.create(baseReq), {
        ...baseReq,
        body: jsonBody,
        on(event, listener) {
            if (event === 'data') {
                process.nextTick(() => listener(Buffer.from(JSON.stringify(jsonBody || {}))));
                return this;
            }
            if (event === 'end') {
                process.nextTick(listener);
                return this;
            }
            return this;
        },
    });
}

function mockReqWithRawBody(baseReq, rawBody) {
    const buf = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody || '');
    return Object.assign(Object.create(baseReq), {
        ...baseReq,
        on(event, listener) {
            if (event === 'data') {
                process.nextTick(() => listener(buf));
                return this;
            }
            if (event === 'end') {
                process.nextTick(listener);
                return this;
            }
            if (event === 'error') return this;
            return this;
        },
    });
}

module.exports = {
    vercelesqueResponse,
    buildMockReq,
    mockReqWithJsonBody,
    mockReqWithRawBody,
    toWebResponse,
};
