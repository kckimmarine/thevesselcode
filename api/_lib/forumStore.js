'use strict';

const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, '..', '_data', 'forum-mock-store.json');
const RATE_LIMIT_MS = 30_000;

/** @type {{ posts: object[], rateBySession: Record<string, number> } | null} */
let memory = null;

function defaultStore() {
    return { posts: seedPosts(), rateBySession: {} };
}

function seedPosts() {
    const now = Date.now();
    return [
        {
            id: 'seed-tech-1',
            category: 'technical',
            title: 'Main engine LO pressure fluctuation at slow ahead',
            body: 'We see 0.4 bar swing on the gauge when switching from half to slow ahead. Filters changed last month. Any checklist before opening the LO cooler?',
            displayName: 'J.K.',
            role: 'Engineer',
            createdAt: new Date(now - 86400000 * 2).toISOString(),
            comments: [
                {
                    id: 'seed-c1',
                    displayName: 'Chief Eng',
                    role: 'Engineer',
                    body: 'Log actual temperature at cooler outlet and verify differential across filter — often air ingress at suction side.',
                    createdAt: new Date(now - 86400000).toISOString(),
                },
            ],
        },
        {
            id: 'seed-reg-1',
            category: 'regulations',
            title: 'PSC focus on fire dampers documentation',
            body: 'Recent inspection asked for photos of each fire damper ID tag matching PMS record. How are you tracking closure tests?',
            displayName: 'Super',
            role: 'Superintendent',
            createdAt: new Date(now - 86400000 * 5).toISOString(),
            comments: [],
        },
    ];
}

function loadStore() {
    if (memory) return memory;
    try {
        if (fs.existsSync(STORE_PATH)) {
            const raw = fs.readFileSync(STORE_PATH, 'utf8');
            const parsed = JSON.parse(raw);
            memory = {
                posts: Array.isArray(parsed.posts) ? parsed.posts : seedPosts(),
                rateBySession: parsed.rateBySession && typeof parsed.rateBySession === 'object' ? parsed.rateBySession : {},
            };
            return memory;
        }
    } catch (e) {
        console.warn('[forumStore] load failed', e.message);
    }
    memory = defaultStore();
    return memory;
}

function persistStore() {
    if (!memory) return;
    try {
        const dir = path.dirname(STORE_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
            STORE_PATH,
            JSON.stringify({ posts: memory.posts, rateBySession: memory.rateBySession }, null, 2),
            'utf8',
        );
    } catch (e) {
        console.warn('[forumStore] persist skipped (read-only env?)', e.message);
    }
}

function listPosts(category) {
    const store = loadStore();
    let posts = store.posts.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    if (category) posts = posts.filter((p) => p.category === category);
    return posts;
}

function getPost(id) {
    return loadStore().posts.find((p) => p.id === id) || null;
}

function checkRateLimit(sessionId) {
    const sid = String(sessionId || '').trim();
    if (!sid) return { ok: false, code: 'SESSION', message: 'Session required.' };
    const store = loadStore();
    const last = store.rateBySession[sid] || 0;
    const now = Date.now();
    if (now - last < RATE_LIMIT_MS) {
        return { ok: false, code: 'RATE_LIMIT', message: 'Please wait 30 seconds between posts.' };
    }
    store.rateBySession[sid] = now;
    persistStore();
    return { ok: true };
}

function addPost(payload) {
    const post = {
        id: randomUUID(),
        category: payload.category,
        title: payload.title,
        body: payload.body,
        displayName: payload.displayName,
        role: payload.role,
        createdAt: new Date().toISOString(),
        comments: [],
    };
    const store = loadStore();
    store.posts.unshift(post);
    persistStore();
    return post;
}

function addComment(postId, payload) {
    const store = loadStore();
    const post = store.posts.find((p) => p.id === postId);
    if (!post) return null;
    const comment = {
        id: randomUUID(),
        displayName: payload.displayName,
        role: payload.role,
        body: payload.body,
        createdAt: new Date().toISOString(),
    };
    if (!Array.isArray(post.comments)) post.comments = [];
    post.comments.push(comment);
    persistStore();
    return comment;
}

module.exports = {
    listPosts,
    getPost,
    addPost,
    addComment,
    checkRateLimit,
    RATE_LIMIT_MS,
};
