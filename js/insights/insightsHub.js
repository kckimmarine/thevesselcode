/**
 * Maritime Insights — loads /data/insights.json (list + article views).
 */
(function (global) {
    'use strict';

    const DATA_URL = '/data/insights.json';

    function esc(text) {
        return String(text ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatDate(iso) {
        if (!iso) return '';
        try {
            return new Date(iso).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                timeZone: 'UTC',
            });
        } catch {
            return iso;
        }
    }

    async function loadInsights() {
        const res = await fetch(DATA_URL);
        if (!res.ok) throw new Error(`insights fetch ${res.status}`);
        return res.json();
    }

    function postFromSlug(data, slug) {
        const posts = data?.posts || [];
        return posts.find((p) => p.slug === slug || p.id === slug) || null;
    }

    function renderPostCard(post) {
        const href = `/insights?post=${encodeURIComponent(post.slug)}`;
        return `<article class="insights-card mkt-glass-card">
            <p class="insights-card-category">${esc(post.category)}</p>
            <h2 class="insights-card-title"><a href="${href}">${esc(post.title)}</a></h2>
            <p class="insights-card-excerpt">${esc(post.excerpt)}</p>
            <p class="insights-card-meta"><time datetime="${esc(post.published)}">${esc(formatDate(post.published))}</time></p>
            <a class="insights-card-link" href="${href}">Read analysis →</a>
        </article>`;
    }

    function renderList(data) {
        const posts = [...(data?.posts || [])].sort(
            (a, b) => String(b.published).localeCompare(String(a.published))
        );
        const cards = posts.map(renderPostCard).join('');
        return `<div class="insights-grid">${cards || '<p class="insights-empty">No posts yet.</p>'}</div>`;
    }

    function renderArticle(post) {
        const sections = (post.sections || [])
            .map(
                (s) => `<section class="insights-article-section">
            <h2>${esc(s.heading)}</h2>
            <p>${esc(s.body)}</p>
        </section>`
            )
            .join('');
        const cta = post.cta || {};
        const ctaBlock = cta.title
            ? `<aside class="insights-cta-band mkt-glass-card" aria-label="Call to action">
            <h2>${esc(cta.title)}</h2>
            <p>${esc(cta.body || '')}</p>
            <div class="insights-cta-actions">
                <a class="insights-cta-primary" href="${esc(cta.primaryHref || '/sm')}">${esc(cta.primaryLabel || 'Start trial')}</a>
                ${cta.secondaryHref ? `<a class="insights-cta-secondary" href="${esc(cta.secondaryHref)}">${esc(cta.secondaryLabel || 'Learn more')}</a>` : ''}
            </div>
        </aside>`
            : '';
        return `<article class="insights-article">
            <header class="insights-article-head">
                <p class="insights-card-category">${esc(post.category)}</p>
                <h1 class="insights-article-title">${esc(post.title)}</h1>
                <p class="insights-article-excerpt">${esc(post.excerpt)}</p>
                <p class="insights-article-meta">
                    <time datetime="${esc(post.published)}">${esc(formatDate(post.published))}</time>
                    ${post.author ? `<span> · ${esc(post.author)}</span>` : ''}
                </p>
            </header>
            <div class="insights-article-body">${sections}</div>
            ${ctaBlock}
            <p class="insights-back"><a href="/insights">← All insights</a></p>
        </article>`;
    }

    async function init() {
        const listEl = document.getElementById('insightsMain');
        if (!listEl) return;

        const params = new URLSearchParams(global.location?.search || '');
        const slug = params.get('post') || params.get('slug');

        listEl.innerHTML = '<p class="insights-loading">Loading insights…</p>';

        try {
            const data = await loadInsights();
            const heroTitle = document.getElementById('insightsHeroTitle');
            const heroLead = document.getElementById('insightsHeroLead');
            if (slug) {
                const post = postFromSlug(data, slug);
                if (!post) {
                    listEl.innerHTML = '<p class="insights-empty">Article not found.</p>';
                    return;
                }
                if (heroTitle) heroTitle.textContent = post.category || 'Insight';
                if (heroLead) heroLead.textContent = post.title;
                document.title = `${post.title} | Maritime Insights | THE VESSEL CODE`;
                listEl.innerHTML = renderArticle(post);
            } else {
                if (heroTitle && data?.meta?.title) heroTitle.textContent = data.meta.title;
                if (heroLead && data?.meta?.description) heroLead.textContent = data.meta.description;
                listEl.innerHTML = renderList(data);
            }
        } catch (err) {
            console.warn('[insights]', err);
            listEl.innerHTML = '<p class="insights-empty">Unable to load insights. Try again later.</p>';
        }
    }

    global.TVC_InsightsHub = { init, loadInsights };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(typeof globalThis !== 'undefined' ? globalThis : window);
