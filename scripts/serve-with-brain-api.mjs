#!/usr/bin/env node
/**
 * Static file server + POST /api/ask-brain for local npm start.
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const askBrain = require('../api/ask-brain.js');
const searchApi = require('../api/search.js');
const rfqSubmit = require('../api/rfq-submit.js');

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const PORT = Number(process.env.PORT || 3000);

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
};

function safePath(urlPath) {
    const decoded = decodeURIComponent(urlPath.split('?')[0]);
    const rel = decoded.replace(/^\/+/, '');
    const abs = normalize(join(ROOT, rel));
    if (!abs.startsWith(ROOT)) return null;
    return abs;
}

function sendStatic(res, absPath) {
    if (!existsSync(absPath) || !statSync(absPath).isFile()) {
        res.writeHead(404);
        res.end('Not found');
        return;
    }
    const ext = extname(absPath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
    res.end(readFileSync(absPath));
}

function vercelStyleResponse(res) {
    return {
        setHeader(k, v) {
            res.setHeader(k, v);
        },
        status(code) {
            res.statusCode = code;
            return this;
        },
        end(body) {
            res.end(body);
        },
        json(obj) {
            if (!res.getHeader('Content-Type')) {
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
            }
            res.end(JSON.stringify(obj));
        },
    };
}

function invokeAskBrain(req, res) {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
        const body = Buffer.concat(chunks);
        const mockReq = Object.assign(Object.create(req), {
            method: req.method,
            headers: req.headers,
            on(event, listener) {
                if (event === 'data') {
                    process.nextTick(() => listener(body));
                    return mockReq;
                }
                if (event === 'end') {
                    process.nextTick(listener);
                    return mockReq;
                }
                if (event === 'error') return mockReq;
                return req.on(event, listener);
            },
        });
        askBrain(mockReq, vercelStyleResponse(res));
    });
}

const server = createServer((req, res) => {
    const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);

    if (url.pathname === '/api/ask-brain') {
        invokeAskBrain(req, res);
        return;
    }

    if (url.pathname === '/api/search' && req.method === 'GET') {
        searchApi(req, vercelStyleResponse(res));
        return;
    }

    if (url.pathname === '/api/rfq-submit' && req.method === 'POST') {
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => {
            const body = Buffer.concat(chunks).toString('utf8');
            let parsed = {};
            try {
                parsed = body ? JSON.parse(body) : {};
            } catch {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: false, error: 'invalid_json' }));
                return;
            }
            const mockReq = Object.assign(Object.create(req), {
                method: 'POST',
                headers: req.headers,
                body: parsed,
            });
            rfqSubmit(mockReq, vercelStyleResponse(res));
        });
        return;
    }

    let abs = safePath(url.pathname);
    if (abs && existsSync(abs) && statSync(abs).isDirectory()) {
        abs = join(abs, 'index.html');
    }
    if (!abs || !existsSync(abs)) {
        if (url.pathname === '/') {
            sendStatic(res, join(ROOT, 'home', 'index.html'));
            return;
        }
        res.writeHead(404);
        res.end('Not found');
        return;
    }
    sendStatic(res, abs);
});

server.listen(PORT, () => {
    console.log(`TVC web + Brain API → http://127.0.0.1:${PORT} (POST /api/ask-brain, GET /api/search)`);
});
