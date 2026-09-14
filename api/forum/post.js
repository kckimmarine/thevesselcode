'use strict';

const {
    validatePostPayload,
    validateCommentPayload,
    normalizePlainText,
} = require('../_lib/forumGuard.js');
const store = require('../_lib/forumStore.js');

const MAX_BODY_BYTES = 48 * 1024;

function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let total = 0;
        req.on('data', (chunk) => {
            total += chunk.length;
            if (total > MAX_BODY_BYTES) {
                reject(Object.assign(new Error('Payload too large'), { code: 'PAYLOAD_TOO_LARGE' }));
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => {
            try {
                const raw = Buffer.concat(chunks).toString('utf8');
                resolve(raw ? JSON.parse(raw) : {});
            } catch (e) {
                reject(e);
            }
        });
        req.on('error', reject);
    });
}

function sessionFromReq(req, body) {
    const header = req.headers['x-forum-session'] || req.headers['X-Forum-Session'];
    return String(header || body.clientSessionId || '').trim();
}

async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Forum-Session');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    if (req.method === 'GET') {
        const url = new URL(req.url, 'http://localhost');
        const category = String(url.searchParams.get('category') || '').trim();
        const posts = store.listPosts(category || null);
        return res.status(200).json({ ok: true, posts });
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'GET, POST, OPTIONS');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const body = await readJsonBody(req);
        const action = String(body.action || 'post').trim();
        const sessionId = sessionFromReq(req, body);

        if (action === 'comment') {
            const postId = String(body.postId || '').trim();
            const validation = validateCommentPayload(body);
            if (!validation.ok) {
                if (validation.silent) return res.status(204).end();
                return res.status(400).json({ ok: false, code: validation.code, error: validation.message });
            }
            const rate = store.checkRateLimit(sessionId);
            if (!rate.ok) {
                return res.status(429).json({ ok: false, code: rate.code, error: rate.message });
            }
            const comment = store.addComment(postId, {
                displayName: normalizePlainText(body.displayName),
                role: String(body.role || '').trim(),
                body: normalizePlainText(body.body),
            });
            if (!comment) {
                return res.status(404).json({ ok: false, error: 'Post not found.' });
            }
            return res.status(200).json({ ok: true, comment });
        }

        const validation = validatePostPayload(body);
        if (!validation.ok) {
            if (validation.silent) return res.status(204).end();
            return res.status(400).json({ ok: false, code: validation.code, error: validation.message });
        }

        const rate = store.checkRateLimit(sessionId);
        if (!rate.ok) {
            return res.status(429).json({ ok: false, code: rate.code, error: rate.message });
        }

        const post = store.addPost({
            category: String(body.category || '').trim(),
            title: normalizePlainText(body.title),
            body: normalizePlainText(body.body),
            displayName: normalizePlainText(body.displayName),
            role: String(body.role || '').trim(),
        });

        return res.status(200).json({ ok: true, post });
    } catch (e) {
        if (e.code === 'PAYLOAD_TOO_LARGE') {
            return res.status(413).json({ error: 'Payload too large' });
        }
        console.error('[forum/post]', e);
        return res.status(500).json({ error: 'FORUM_FAILED', message: e.message || String(e) });
    }
}

module.exports = handler;
