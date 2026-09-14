/**
 * Maritime & Industrial Exchange — open Q&A forum UI (offline-capable fallback).
 */
(function () {
    'use strict';

    const API = '/api/forum/post';
    const LS_KEY = 'tvc-forum-posts-v1';
    const LS_RATE = 'tvc-forum-last-post-at';
    const LS_SESSION = 'tvc-forum-session-id';
    const LS_IDENTITY = 'tvc-forum-identity-v1';

    const guard = () => globalThis.TVC_ForumGuard;
    const i18n = () => globalThis.TVC_MarketingI18n;

    function t(key) {
        const g = i18n();
        if (g?.t) return g.t(key, g.getLang()) || key;
        return key;
    }

    function categoryLabel(id) {
        const cat = guard()?.CATEGORIES?.find((c) => c.id === id);
        return cat ? t(cat.i18n) : id;
    }

    function getSessionId() {
        let id = sessionStorage.getItem(LS_SESSION);
        if (!id) {
            id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `s-${Date.now()}`;
            sessionStorage.setItem(LS_SESSION, id);
        }
        return id;
    }

    function loadIdentity() {
        try {
            const raw = localStorage.getItem(LS_IDENTITY);
            return raw ? JSON.parse(raw) : { displayName: '', role: 'Engineer' };
        } catch {
            return { displayName: '', role: 'Engineer' };
        }
    }

    function saveIdentity(data) {
        localStorage.setItem(LS_IDENTITY, JSON.stringify(data));
    }

    function clientRateOk() {
        const last = Number(sessionStorage.getItem(LS_RATE) || 0);
        const ms = guard()?.RATE_LIMIT_MS || 30000;
        return Date.now() - last >= ms;
    }

    function markClientRate() {
        sessionStorage.setItem(LS_RATE, String(Date.now()));
    }

    function loadLocalPosts() {
        try {
            const raw = localStorage.getItem(LS_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    function saveLocalPosts(posts) {
        localStorage.setItem(LS_KEY, JSON.stringify(posts));
    }

    async function fetchPosts(category) {
        const q = category ? `?category=${encodeURIComponent(category)}` : '';
        try {
            const res = await fetch(`${API}${q}`, { credentials: 'same-origin' });
            if (!res.ok) throw new Error('api');
            const data = await res.json();
            if (Array.isArray(data.posts)) return data.posts;
        } catch {
            /* local fallback */
        }
        let posts = loadLocalPosts();
        if (category) posts = posts.filter((p) => p.category === category);
        return posts.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    }

    async function submitPost(payload) {
        const G = guard();
        const validation = G.validatePostPayload(payload);
        if (!validation.ok) {
            if (validation.silent) return { ok: true, silent: true };
            return validation;
        }
        if (!clientRateOk()) {
            return { ok: false, code: 'RATE_LIMIT', message: t('forum.err.rate') };
        }

        const body = {
            action: 'post',
            clientSessionId: getSessionId(),
            category: payload.category,
            title: G.normalizePlainText(payload.title),
            body: G.normalizePlainText(payload.body),
            displayName: G.normalizePlainText(payload.displayName),
            role: payload.role,
            website_url_check: payload.website_url_check || '',
        };

        try {
            const res = await fetch(API, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Forum-Session': getSessionId(),
                },
                body: JSON.stringify(body),
            });
            if (res.status === 204) return { ok: true, silent: true };
            const data = await res.json();
            if (!res.ok) {
                return { ok: false, code: data.code, message: data.error || data.message };
            }
            markClientRate();
            return { ok: true, post: data.post };
        } catch {
            const post = {
                id: `local-${Date.now()}`,
                ...body,
                createdAt: new Date().toISOString(),
                comments: [],
            };
            delete post.action;
            delete post.clientSessionId;
            delete post.website_url_check;
            const posts = loadLocalPosts();
            posts.unshift(post);
            saveLocalPosts(posts);
            markClientRate();
            return { ok: true, post, local: true };
        }
    }

    async function submitComment(postId, payload) {
        const G = guard();
        const validation = G.validateCommentPayload(payload);
        if (!validation.ok) {
            if (validation.silent) return { ok: true, silent: true };
            return validation;
        }
        if (!clientRateOk()) {
            return { ok: false, code: 'RATE_LIMIT', message: t('forum.err.rate') };
        }

        const body = {
            action: 'comment',
            postId,
            clientSessionId: getSessionId(),
            displayName: G.normalizePlainText(payload.displayName),
            role: payload.role,
            body: G.normalizePlainText(payload.body),
            website_url_check: payload.website_url_check || '',
        };

        try {
            const res = await fetch(API, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Forum-Session': getSessionId(),
                },
                body: JSON.stringify(body),
            });
            if (res.status === 204) return { ok: true, silent: true };
            const data = await res.json();
            if (!res.ok) {
                return { ok: false, code: data.code, message: data.error || data.message };
            }
            markClientRate();
            return { ok: true, comment: data.comment };
        } catch {
            const posts = loadLocalPosts();
            const post = posts.find((p) => p.id === postId);
            if (!post) return { ok: false, message: 'Post not found.' };
            const comment = {
                id: `local-c-${Date.now()}`,
                displayName: body.displayName,
                role: body.role,
                body: body.body,
                createdAt: new Date().toISOString(),
            };
            post.comments = post.comments || [];
            post.comments.push(comment);
            saveLocalPosts(posts);
            markClientRate();
            return { ok: true, comment, local: true };
        }
    }

    function formatDate(iso) {
        try {
            return new Date(iso).toLocaleString(i18n()?.getLang?.() === 'ko' ? 'ko-KR' : 'en-GB', {
                dateStyle: 'medium',
                timeStyle: 'short',
            });
        } catch {
            return iso;
        }
    }

    function renderPostCard(post) {
        const G = guard();
        const commentCount = (post.comments || []).length;
        return `
        <article class="forum-post-card mkt-glass-card" data-post-id="${G.escapeHtml(post.id)}">
            <div class="forum-post-meta">
                <span class="forum-chip">${G.escapeHtml(categoryLabel(post.category))}</span>
                <span class="forum-role">${G.escapeHtml(post.role)} · ${G.escapeHtml(post.displayName)}</span>
                <time datetime="${G.escapeHtml(post.createdAt)}">${G.escapeHtml(formatDate(post.createdAt))}</time>
            </div>
            <h3 class="forum-post-title">${G.escapeHtml(post.title)}</h3>
            <p class="forum-post-excerpt">${G.linkifyEscaped(post.body.slice(0, 220))}${post.body.length > 220 ? '…' : ''}</p>
            <button type="button" class="forum-link-btn" data-forum-open="${G.escapeHtml(post.id)}">
                ${G.escapeHtml(t('forum.thread.open'))} (${commentCount})
            </button>
        </article>`;
    }

    function renderThread(post) {
        const G = guard();
        const comments = (post.comments || [])
            .map(
                (c) => `
            <li class="forum-comment">
                <div class="forum-comment-head">
                    <strong>${G.escapeHtml(c.displayName)}</strong>
                    <span>${G.escapeHtml(c.role)}</span>
                    <time datetime="${G.escapeHtml(c.createdAt)}">${G.escapeHtml(formatDate(c.createdAt))}</time>
                </div>
                <div class="forum-comment-body">${G.linkifyEscaped(c.body)}</div>
            </li>`,
            )
            .join('');

        return `
        <section class="forum-thread mkt-glass-card" aria-labelledby="forumThreadTitle">
            <button type="button" class="forum-back" id="forumBackBtn" data-i18n="forum.thread.back">← Back to channel</button>
            <div class="forum-post-meta">
                <span class="forum-chip">${G.escapeHtml(categoryLabel(post.category))}</span>
                <span class="forum-role">${G.escapeHtml(post.role)} · ${G.escapeHtml(post.displayName)}</span>
                <time datetime="${G.escapeHtml(post.createdAt)}">${G.escapeHtml(formatDate(post.createdAt))}</time>
            </div>
            <h2 id="forumThreadTitle">${G.escapeHtml(post.title)}</h2>
            <div class="forum-thread-body">${G.linkifyEscaped(post.body)}</div>
            <h3 data-i18n="forum.thread.replies">Replies</h3>
            <ul class="forum-comment-list">${comments || `<li class="forum-empty-replies" data-i18n="forum.thread.none">No replies yet — add a constructive tip.</li>`}</ul>
            ${renderCommentForm(post.id)}
        </section>`;
    }

    function roleOptions(selected) {
        const G = guard();
        return G.ALLOWED_ROLES.map(
            (r) => `<option value="${G.escapeHtml(r)}"${r === selected ? ' selected' : ''}>${G.escapeHtml(r)}</option>`,
        ).join('');
    }

    function honeypotField() {
        return `
        <div class="forum-hp" aria-hidden="true">
            <label for="website_url_check">Website</label>
            <input type="text" name="website_url_check" id="website_url_check" tabindex="-1" autocomplete="off">
        </div>`;
    }

    function renderComposeForm(category) {
        const id = loadIdentity();
        return `
        <form id="forumComposeForm" class="forum-form mkt-glass-card" novalidate>
            <h3 data-i18n="forum.compose.title">Start a discussion</h3>
            <p class="forum-form-note" data-i18n="forum.compose.note">No account required — display name and role only. Posts are moderated by automated safety filters.</p>
            ${honeypotField()}
            <div class="forum-field-row">
                <div class="forum-field">
                    <label for="forumDisplayName" data-i18n="forum.field.name">Display name</label>
                    <input id="forumDisplayName" name="displayName" type="text" maxlength="64" required value="${guard().escapeHtml(id.displayName)}">
                </div>
                <div class="forum-field">
                    <label for="forumRole" data-i18n="forum.field.role">Role</label>
                    <select id="forumRole" name="role" required>${roleOptions(id.role)}</select>
                </div>
            </div>
            <input type="hidden" name="category" value="${guard().escapeHtml(category)}">
            <div class="forum-field">
                <label for="forumTitle" data-i18n="forum.field.title">Title</label>
                <input id="forumTitle" name="title" type="text" maxlength="200" required>
            </div>
            <div class="forum-field">
                <label for="forumBody" data-i18n="forum.field.body">Question or tip</label>
                <textarea id="forumBody" name="body" rows="5" maxlength="8000" required></textarea>
            </div>
            <button type="submit" class="forum-btn-primary" data-i18n="forum.compose.submit">Post to channel</button>
            <p id="forumComposeStatus" class="forum-status" role="status" aria-live="polite"></p>
        </form>`;
    }

    function renderCommentForm(postId) {
        const id = loadIdentity();
        return `
        <form id="forumCommentForm" class="forum-form forum-comment-form" data-post-id="${guard().escapeHtml(postId)}" novalidate>
            <h4 data-i18n="forum.comment.title">Add a reply</h4>
            ${honeypotField()}
            <div class="forum-field-row">
                <div class="forum-field">
                    <label for="forumCommentName" data-i18n="forum.field.name">Display name</label>
                    <input id="forumCommentName" name="displayName" type="text" maxlength="64" required value="${guard().escapeHtml(id.displayName)}">
                </div>
                <div class="forum-field">
                    <label for="forumCommentRole" data-i18n="forum.field.role">Role</label>
                    <select id="forumCommentRole" name="role" required>${roleOptions(id.role)}</select>
                </div>
            </div>
            <div class="forum-field">
                <label for="forumCommentBody" data-i18n="forum.field.comment">Reply</label>
                <textarea id="forumCommentBody" name="body" rows="4" maxlength="4000" required></textarea>
            </div>
            <button type="submit" class="forum-btn-secondary" data-i18n="forum.comment.submit">Send reply</button>
            <p id="forumCommentStatus" class="forum-status" role="status" aria-live="polite"></p>
        </form>`;
    }

    function renderCategoryTabs(active) {
        const G = guard();
        return G.CATEGORIES.map((c) => {
            const on = c.id === active ? ' is-active' : '';
            return `<button type="button" class="forum-tab${on}" data-forum-category="${G.escapeHtml(c.id)}" data-i18n="${c.i18n}">${G.escapeHtml(t(c.i18n))}</button>`;
        }).join('');
    }

    const state = {
        category: 'technical',
        posts: [],
        viewPostId: null,
    };

    async function refreshList() {
        state.posts = await fetchPosts(state.category);
        const listEl = document.getElementById('forumPostList');
        if (!listEl) return;
        if (!state.posts.length) {
            listEl.innerHTML = `<p class="forum-empty" data-i18n="forum.list.empty">No threads yet — be the first to ask.</p>`;
        } else {
            listEl.innerHTML = state.posts.map(renderPostCard).join('');
        }
        i18n()?.applyLang?.(i18n().getLang());
        bindListActions();
    }

    function bindListActions() {
        document.querySelectorAll('[data-forum-open]').forEach((btn) => {
            btn.addEventListener('click', () => openThread(btn.getAttribute('data-forum-open')));
        });
    }

    async function openThread(postId) {
        state.viewPostId = postId;
        let post = state.posts.find((p) => p.id === postId);
        if (!post) {
            state.posts = await fetchPosts(null);
            post = state.posts.find((p) => p.id === postId);
        }
        const main = document.getElementById('forumMain');
        const listWrap = document.getElementById('forumListWrap');
        if (!post || !main || !listWrap) return;
        listWrap.hidden = true;
        main.innerHTML = renderThread(post);
        i18n()?.applyLang?.(i18n().getLang());
        document.getElementById('forumBackBtn')?.addEventListener('click', closeThread);
        document.getElementById('forumCommentForm')?.addEventListener('submit', onCommentSubmit);
    }

    function closeThread() {
        state.viewPostId = null;
        const main = document.getElementById('forumMain');
        const listWrap = document.getElementById('forumListWrap');
        if (main) main.innerHTML = '';
        if (listWrap) listWrap.hidden = false;
        refreshList();
    }

    function readForm(form) {
        const fd = new FormData(form);
        return {
            displayName: fd.get('displayName'),
            role: fd.get('role'),
            title: fd.get('title'),
            body: fd.get('body'),
            category: fd.get('category') || state.category,
            website_url_check: fd.get('website_url_check'),
        };
    }

    async function onComposeSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const status = document.getElementById('forumComposeStatus');
        const payload = readForm(form);
        saveIdentity({ displayName: payload.displayName, role: payload.role });
        const result = await submitPost(payload);
        if (result.silent) return;
        if (!result.ok) {
            if (status) {
                status.textContent = result.message || t('forum.err.generic');
                status.classList.add('is-error');
            }
            return;
        }
        if (status) {
            status.textContent = result.local ? t('forum.ok.local') : t('forum.ok.posted');
            status.classList.remove('is-error');
        }
        form.reset();
        document.getElementById('forumDisplayName').value = payload.displayName;
        document.getElementById('forumRole').value = payload.role;
        await refreshList();
    }

    async function onCommentSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const postId = form.getAttribute('data-post-id');
        const status = document.getElementById('forumCommentStatus');
        const payload = readForm(form);
        saveIdentity({ displayName: payload.displayName, role: payload.role });
        const result = await submitComment(postId, payload);
        if (result.silent) return;
        if (!result.ok) {
            if (status) {
                status.textContent = result.message || t('forum.err.generic');
                status.classList.add('is-error');
            }
            return;
        }
        if (status) {
            status.textContent = result.local ? t('forum.ok.local') : t('forum.ok.comment');
            status.classList.remove('is-error');
        }
        await openThread(postId);
    }

    function mountShell() {
        const tabsEl = document.getElementById('forumCategoryTabs');
        const composeEl = document.getElementById('forumComposeMount');
        if (tabsEl) tabsEl.innerHTML = renderCategoryTabs(state.category);
        if (composeEl) composeEl.innerHTML = renderComposeForm(state.category);

        tabsEl?.querySelectorAll('[data-forum-category]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                state.category = btn.getAttribute('data-forum-category');
                tabsEl.querySelectorAll('.forum-tab').forEach((b) => b.classList.toggle('is-active', b === btn));
                if (composeEl) composeEl.innerHTML = renderComposeForm(state.category);
                document.getElementById('forumComposeForm')?.addEventListener('submit', onComposeSubmit);
                await refreshList();
                i18n()?.applyLang?.(i18n().getLang());
            });
        });

        document.getElementById('forumComposeForm')?.addEventListener('submit', onComposeSubmit);
    }

    function init() {
        mountShell();
        refreshList();
        globalThis.addEventListener('tvc-mkt-lang', () => {
            mountShell();
            if (state.viewPostId) openThread(state.viewPostId);
            else refreshList();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    globalThis.TVC_ForumEngine = { submitPost, scanAbuse: () => guard().scanAbuse, validatePostPayload: () => guard().validatePostPayload };
})();
