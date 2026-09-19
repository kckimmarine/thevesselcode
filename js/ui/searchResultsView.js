/**
 * THE VESSEL CODE — in-app Google Custom Search results (TVC branded).
 */
(function (global) {
    'use strict';

    const PANEL_ID = 'tvcSearchResultsPanel';
    const GOOGLE_SEARCH_URL = 'https://www.google.com/search?q=';

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function googleSearchUrl(query) {
        return GOOGLE_SEARCH_URL + encodeURIComponent(String(query || '').trim());
    }

    function ensurePanel(anchor) {
        let panel = document.getElementById(PANEL_ID);
        if (panel) return panel;

        panel = document.createElement('section');
        panel.id = PANEL_ID;
        panel.className = 'tvc-search-results';
        panel.hidden = true;
        panel.setAttribute('aria-live', 'polite');
        panel.setAttribute('aria-label', 'Maritime search results');

        const mountAfter = anchor || document.getElementById('homeHeroSearchForm');
        if (mountAfter?.parentNode) {
            mountAfter.insertAdjacentElement('afterend', panel);
        } else {
            document.body.appendChild(panel);
        }
        return panel;
    }

    function renderShell(panel, query, metaLine) {
        panel.hidden = false;
        panel.innerHTML = `
            <header class="tvc-search-results__head">
                <p class="tvc-search-results__eyebrow">THE VESSEL CODE MARITIME SEARCH</p>
                <h2 class="tvc-search-results__title">${escapeHtml(query)}</h2>
                <p class="tvc-search-results__meta">${escapeHtml(metaLine || '')}</p>
            </header>
            <div class="tvc-search-results__body" id="tvcSearchResultsBody"></div>
        `;
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return panel.querySelector('#tvcSearchResultsBody');
    }

    function internalCardHtml(classification, query) {
        const R = global.TVC_SearchResolver;
        const q = String(query || '').trim();
        let label = 'TVC Intelligence';
        let title = q;
        let desc = 'Open the matching TVC maritime module for specs, plates, or fleet data.';
        let href = R?.destinationForQuery?.(q) || '/toolkit';
        let cta = 'Open in TVC Toolkit ↗';

        if (classification.type === 'impa' && classification.impa) {
            label = 'IMPA Plate';
            title = `IMPA ${classification.impa}`;
            desc = 'Direct IMPA catalog plate — no external search quota used.';
            href = `/store/${classification.impa}`;
            cta = 'View IMPA plate ↗';
        } else if (classification.type === 'vessel') {
            label = 'Vessel Particulars';
            title = classification.imo ? `IMO ${classification.imo}` : q;
            desc = 'Fleet registry lookup — resolved locally without Google API.';
            href = classification.imo
                ? `/toolkit?imo=${encodeURIComponent(classification.imo)}`
                : `/toolkit?vessel=${encodeURIComponent(q)}`;
            cta = 'Open vessel record ↗';
        } else if (classification.type === 'toolkit') {
            label = 'Maritime Toolkit';
            title = q;
            desc = 'Engineering calculator, flange spec, bunker 54B, or compliance module.';
            const route = R?.routeHeroQuery?.(q);
            href = route?.href || `/toolkit?q=${encodeURIComponent(q)}`;
            cta = 'Launch toolkit module ↗';
        }

        return `
            <article class="tvc-search-internal-card">
                <span class="tvc-search-internal-card__label">${escapeHtml(label)}</span>
                <h3 class="tvc-search-internal-card__title">${escapeHtml(title)}</h3>
                <p class="tvc-search-internal-card__desc">${escapeHtml(desc)}</p>
                <a class="tvc-search-internal-card__cta" href="${escapeHtml(href)}">${escapeHtml(cta)}</a>
            </article>
        `;
    }

    function resultCardsHtml(items) {
        if (!items?.length) {
            return '<p class="tvc-search-results__status">No web results returned for this query.</p>';
        }
        return items
            .map((item) => {
                const domain = item.displayLink || '';
                let host = domain;
                try {
                    host = new URL(item.link).hostname.replace(/^www\./, '');
                } catch {
                    /* keep displayLink */
                }
                return `
                    <article class="tvc-search-result-card">
                        <h3 class="tvc-search-result-card__title">
                            <a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title || item.link)}</a>
                        </h3>
                        <span class="tvc-search-result-card__domain">${escapeHtml(host || domain)}</span>
                        <p class="tvc-search-result-card__snippet">${escapeHtml(item.snippet || '')}</p>
                    </article>
                `;
            })
            .join('');
    }

    function quotaNoticeHtml(query) {
        const gUrl = googleSearchUrl(query);
        return `
            <p class="tvc-search-results__notice">Daily in-app search quota reached for today.</p>
            <a class="tvc-search-results__google-btn" href="${escapeHtml(gUrl)}" target="_blank" rel="noopener noreferrer">[ ↗ Continue Search on Google in New Tab ]</a>
        `;
    }

    function isInternalIntercept(classification) {
        if (!classification?.direct) return false;
        return ['impa', 'vessel', 'toolkit'].includes(classification.type);
    }

    function showInternal(classification, query, opts = {}) {
        const panel = ensurePanel(opts.anchor);
        const body = renderShell(
            panel,
            query,
            'Local TVC resolver — zero Google API cost',
        );
        body.innerHTML = internalCardHtml(classification, query);
        if (opts.alsoWebSearch) {
            body.insertAdjacentHTML('beforeend', '<p class="tvc-search-results__status">Loading supplemental web results…</p>');
        }
        return panel;
    }

    async function fetchSearchApi(query) {
        const url = `/api/search?q=${encodeURIComponent(String(query || '').trim())}`;
        const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
        const data = await res.json().catch(() => ({}));
        return { ok: res.ok, data };
    }

    async function showWebSearch(query, opts = {}) {
        const q = String(query || '').trim();
        const panel = ensurePanel(opts.anchor);
        const body = renderShell(panel, q, 'Fetching indexed maritime web results…');
        body.innerHTML = '<p class="tvc-search-results__loading">Searching…</p>';

        const { data } = await fetchSearchApi(q);
        const metaParts = [];
        if (data?.cacheHit || data?.cached) metaParts.push('Served from 24h edge cache (0 API cost)');
        else if (data?.dailyCount != null) metaParts.push(`API usage today: ${data.dailyCount}/${data.dailyLimit || 95}`);
        else metaParts.push('Maritime web index');

        panel.querySelector('.tvc-search-results__meta').textContent = metaParts.join(' · ');

        if (data?.quotaExceeded) {
            body.innerHTML = quotaNoticeHtml(q);
            return { ok: true, data };
        }

        if (data?.fallback) {
            body.innerHTML = `
                ${quotaNoticeHtml(q)}
                <p class="tvc-search-results__status">In-app search is temporarily unavailable.</p>
            `;
            return { ok: false, data };
        }

        body.innerHTML = resultCardsHtml(data?.items || []);

        if (opts.showBrainCta && global.TVC_BrainChat) {
            body.insertAdjacentHTML(
                'beforeend',
                '<button type="button" class="tvc-search-results__brain-btn" id="tvcSearchBrainCta">Ask TVC Brain for an AI superintendent briefing</button>',
            );
            body.querySelector('#tvcSearchBrainCta')?.addEventListener('click', () => {
                if (global.TVC_SearchPortal?.openBrainModal) {
                    global.TVC_SearchPortal.openBrainModal(q, { briefing: true });
                } else if (global.TVC_BrainChat?.openModal) {
                    global.TVC_BrainChat.openModal(q, { briefing: true });
                }
            });
        }

        return { ok: true, data };
    }

    function hide() {
        const panel = document.getElementById(PANEL_ID);
        if (panel) panel.hidden = true;
    }

    global.TVC_SearchResultsView = {
        ensurePanel,
        showInternal,
        showWebSearch,
        hide,
        isInternalIntercept,
        googleSearchUrl,
    };
})(typeof globalThis !== 'undefined' ? globalThis : window);
