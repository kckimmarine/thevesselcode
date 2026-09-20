/**
 * THE VESSEL CODE — in-app Tavily web search results (TVC branded, no third-party widgets).
 */
(function (global) {
    'use strict';

    const PANEL_ID = 'tvcSearchResultsPanel';
    const EYEBROW = 'THE VESSEL CODE MARITIME INTEL';

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function externalWebSearchUrl(query) {
        return `https://www.google.com/search?q=${encodeURIComponent(String(query || '').trim())}`;
    }

    function ensurePanel(anchor) {
        let panel = document.getElementById(PANEL_ID);
        if (panel) return panel;

        panel = document.createElement('section');
        panel.id = PANEL_ID;
        panel.className = 'tvc-search-results';
        panel.hidden = true;
        panel.setAttribute('aria-live', 'polite');
        panel.setAttribute('aria-label', 'TVC maritime search results');

        const mount = document.getElementById('homeHeroSearchMount');
        if (mount) {
            mount.appendChild(panel);
        } else {
            const mountAfter = anchor || document.getElementById('homeHeroSearchForm');
            if (mountAfter?.parentNode) {
                mountAfter.insertAdjacentElement('afterend', panel);
            } else {
                document.body.appendChild(panel);
            }
        }
        return panel;
    }

    function skeletonHtml() {
        return `
            <div class="tvc-search-skeleton" aria-hidden="true">
                <div class="tvc-search-skeleton__line tvc-search-skeleton__line--title"></div>
                <div class="tvc-search-skeleton__line tvc-search-skeleton__line--short"></div>
                <div class="tvc-search-skeleton__line"></div>
                <div class="tvc-search-skeleton__line"></div>
            </div>
            <div class="tvc-search-skeleton" aria-hidden="true">
                <div class="tvc-search-skeleton__line tvc-search-skeleton__line--title"></div>
                <div class="tvc-search-skeleton__line tvc-search-skeleton__line--short"></div>
                <div class="tvc-search-skeleton__line"></div>
            </div>
        `;
    }

    function renderShell(panel, query, metaLine) {
        panel.hidden = false;
        panel.innerHTML = `
            <header class="tvc-search-results__head">
                <p class="tvc-search-results__eyebrow">${escapeHtml(EYEBROW)}</p>
                <h2 class="tvc-search-results__title">${escapeHtml(query)}</h2>
                <p class="tvc-search-results__meta">${escapeHtml(metaLine || '')}</p>
            </header>
            <div class="tvc-search-results__body" id="tvcSearchResultsBody"></div>
        `;
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return panel.querySelector('#tvcSearchResultsBody');
    }

    function shouldPrioritizeInternal(classification) {
        if (!classification) return false;
        if (classification.type === 'impa' && classification.impa) return true;
        if (classification.type === 'vessel' && classification.imo) return true;
        return false;
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
            desc = 'Verified catalog plate, dimensions, and fast RFQ — served from TVC (no Gmail/Drive archive).';
            href = `/store/${classification.impa}`;
            cta = 'View IMPA plate ↗';
        } else if (classification.type === 'vessel' && classification.imo) {
            label = 'Vessel Particulars';
            title = `IMO ${classification.imo}`;
            desc = 'Fleet registry lookup on TVC — no legacy mail or drive ingestion.';
            href = `/toolkit?imo=${encodeURIComponent(classification.imo)}`;
            cta = 'Open vessel record ↗';
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
            return `
                <p class="tvc-search-results__empty">No indexed web matches for this query. Try an IMPA code, IMO number, or refine keywords.</p>
            `;
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
        const extUrl = externalWebSearchUrl(query);
        return `
            <p class="tvc-search-results__notice">Daily TVC in-app search quota reached (95/day UTC). Cached queries still work at no cost.</p>
            <a class="tvc-search-results__external-link" href="${escapeHtml(extUrl)}" target="_blank" rel="noopener noreferrer">Continue on the open web ↗</a>
        `;
    }

    function formatMetaLine(data, clientMs, itemCount) {
        const parts = [];
        const count = itemCount ?? data?.items?.length ?? 0;
        const elapsedSec = ((data?.executionMs ?? clientMs ?? 0) / 1000).toFixed(2);
        parts.push(`Found ${count} results in ${elapsedSec}s`);
        if (data?.cacheHit || data?.cached) parts.push('24h TVC cache · 0 API cost');
        else if (data?.dailyCount != null) parts.push(`API today ${data.dailyCount}/${data.dailyLimit || 95}`);
        return parts.join(' · ');
    }

    function isInternalIntercept(classification) {
        return shouldPrioritizeInternal(classification);
    }

    function showInternal(classification, query, opts = {}) {
        const panel = ensurePanel(opts.anchor);
        const body = renderShell(panel, query, 'TVC resolver — local catalog / fleet data');
        body.innerHTML = internalCardHtml(classification, query);
        return panel;
    }

    async function fetchSearchApi(query) {
        const url = `/api/search?q=${encodeURIComponent(String(query || '').trim())}`;
        const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
        const data = await res.json().catch(() => ({}));
        return { ok: res.ok, data };
    }

    async function showWebSearch(query, opts = {}) {
        return showUnifiedSearch(query, null, opts);
    }

    async function showUnifiedSearch(query, classification, opts = {}) {
        const q = String(query || '').trim();
        const panel = ensurePanel(opts.anchor);
        const body = renderShell(panel, q, 'Searching maritime web index…');
        body.innerHTML = skeletonHtml();

        const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const priorityInternal = classification && shouldPrioritizeInternal(classification)
            ? internalCardHtml(classification, q)
            : '';

        const { data } = await fetchSearchApi(q);
        const clientMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
        const metaEl = panel.querySelector('.tvc-search-results__meta');
        const itemCount = data?.items?.length ?? 0;
        if (metaEl) metaEl.textContent = formatMetaLine(data, clientMs, itemCount);

        if (data?.quotaExceeded) {
            body.innerHTML = `${priorityInternal}${quotaNoticeHtml(q)}`;
            return { ok: true, data };
        }

        if (data?.fallback && !data?.items?.length) {
            body.innerHTML = `
                ${priorityInternal}
                ${quotaNoticeHtml(q)}
                <p class="tvc-search-results__status">Configure TAVILY_API_KEY on the server to enable live maritime web results.</p>
            `;
            return { ok: false, data };
        }

        const webBlock = resultCardsHtml(data?.items || []);
        body.innerHTML = priorityInternal
            ? `${priorityInternal}<div class="tvc-search-results__web-block">${webBlock}</div>`
            : webBlock;

        if (opts.showBrainCta && global.TVC_BrainChat) {
            body.insertAdjacentHTML(
                'beforeend',
                '<button type="button" class="tvc-search-results__brain-btn" id="tvcSearchBrainCta">Ask TVC Brain (superintendent briefing — separate from web index)</button>',
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
        showUnifiedSearch,
        hide,
        isInternalIntercept,
        shouldPrioritizeInternal,
        googleSearchUrl: externalWebSearchUrl,
    };
})(typeof globalThis !== 'undefined' ? globalThis : window);
