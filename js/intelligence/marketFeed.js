/**
 * THE VESSEL CODE — Commercial maritime intelligence (loads /data/market-feed.json).
 */
(function (global) {
    'use strict';

    const DATA_URL = '/data/market-feed.json';
    const LEGACY_URL = '/data/market-indices.json';
    let marketData = null;
    let loadPromise = null;

    const MARITIME_IMAGE_FALLBACK =
        'https://images.unsplash.com/photo-1494412574643-7cec40c5a2bf?auto=format&fit=crop&w=800&q=80';
    const MEDIA_IMAGES = {
        lead: MARITIME_IMAGE_FALLBACK,
        secondaryA: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=400&q=80',
        secondaryB: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=400&q=80',
        secondaryC: 'https://images.unsplash.com/photo-1569263979104-8659937a0c8c?auto=format&fit=crop&w=400&q=80',
    };

    const FALLBACK = {
        meta: { source: 'TVC Market Desk', updatedLabelEn: 'Updated daily benchmark (UTC)' },
        bunker: {
            hubs: ['Singapore', 'Rotterdam', 'Busan', 'Houston'],
            grades: [
                { key: 'VLSFO', label: 'VLSFO', fuel: 'VLSFO', defaultDensity: 991 },
                { key: 'LSMGO', label: 'LSMGO', fuel: 'LSMGO', defaultDensity: 850 },
                { key: 'HSFO380', label: 'HSFO 380', fuel: 'HSFO', defaultDensity: 991 },
            ],
            basePricesUsdMt: {
                Singapore: { VLSFO: 612, LSMGO: 748, HSFO380: 458 },
                Rotterdam: { VLSFO: 598, LSMGO: 722, HSFO380: 441 },
                Busan: { VLSFO: 625, LSMGO: 761, HSFO380: 472 },
                Houston: { VLSFO: 589, LSMGO: 715, HSFO380: 435 },
            },
        },
        indices: {
            bdi: { base: 1842, salt: 99 },
            capesizeTc: { base: 24850, jitter: 800, unit: '$/day', salt: 101 },
            panamaxTc: { base: 14220, jitter: 400, unit: '$/day', salt: 103 },
            bdti: { base: 1185, jitter: 60, salt: 107 },
            bcti: { base: 892, jitter: 40, salt: 109 },
            scfi: { base: 2140, jitter: 100, salt: 113 },
        },
        news: [],
    };

    function daySeed() {
        const d = new Date();
        const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
        let h = 0;
        for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
        return h;
    }

    function pseudoDelta(seed, salt) {
        const x = ((seed ^ salt) % 1000) / 1000;
        return (x - 0.5) * 2.4;
    }

    function formatPrice(n) {
        return Number(n).toFixed(2);
    }

    function formatDeltaPct(pct) {
        const sign = pct > 0 ? '+' : '';
        return `${sign}${pct.toFixed(2)}%`;
    }

    function escapeHtml(raw) {
        return String(raw ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function t(key, lang) {
        const i18n = global.TVC_MarketingI18n;
        if (i18n?.t) return i18n.t(key, lang) || key;
        return key;
    }

    function data() {
        return marketData || FALLBACK;
    }

    function loadMarketData() {
        if (loadPromise) return loadPromise;
        if (typeof fetch !== 'function') {
            marketData = FALLBACK;
            loadPromise = Promise.resolve(marketData);
            return loadPromise;
        }
        loadPromise = fetch(DATA_URL, { credentials: 'same-origin' })
            .then((res) => (res.ok ? res.json() : null))
            .catch(() => null)
            .then((json) => {
                if (json && typeof json === 'object') {
                    marketData = json;
                    return marketData;
                }
                return fetch(LEGACY_URL, { credentials: 'same-origin' })
                    .then((res) => (res.ok ? res.json() : FALLBACK))
                    .catch(() => FALLBACK)
                    .then((legacy) => {
                        marketData = legacy && typeof legacy === 'object' ? legacy : FALLBACK;
                        return marketData;
                    });
            });
        return loadPromise;
    }

    function getBunkerQuotes() {
        const d = data();
        if (Array.isArray(d.bunker?.quotes) && d.bunker.quotes.length) {
            return d.bunker.quotes;
        }
        const seed = daySeed();
        const quotes = [];
        const hubs = d.bunker?.hubs || FALLBACK.bunker.hubs;
        const grades = d.bunker?.grades || FALLBACK.bunker.grades;
        const base = d.bunker?.basePricesUsdMt || FALLBACK.bunker.basePricesUsdMt;
        hubs.forEach((port, pi) => {
            grades.forEach((grade, gi) => {
                const anchor = base[port]?.[grade.key] ?? 500;
                const deltaPct = pseudoDelta(seed, pi * 17 + gi * 31 + grade.key.length);
                const priceUsdMt = anchor * (1 + deltaPct / 100);
                quotes.push({
                    port,
                    gradeKey: grade.key,
                    gradeLabel: grade.label,
                    fuel: grade.fuel,
                    defaultDensity: grade.defaultDensity,
                    priceUsdMt,
                    deltaPct,
                });
            });
        });
        return quotes;
    }

    function buildToolkitBunkerUrl(quote) {
        const params = new URLSearchParams({
            tool: 'bunker',
            fuel: quote.fuel,
            density: String(quote.defaultDensity),
            port: quote.port,
            benchmark: formatPrice(quote.priceUsdMt),
        });
        return `/toolkit?${params.toString()}#tab-bunker`;
    }

    function resolveIndex(entry, seed, fallback) {
        const fb = fallback || {};
        if (entry && entry.value != null && Number.isFinite(Number(entry.value))) {
            return {
                value: Math.round(Number(entry.value)),
                deltaPct: Number(entry.deltaPct) || 0,
                unit: entry.unit || fb.unit,
            };
        }
        const jitter = fb.jitter || 0;
        return {
            value: (fb.base || 0) + (jitter ? seed % jitter : 0),
            deltaPct: pseudoDelta(seed, fb.salt || 0),
            unit: fb.unit,
        };
    }

    function getShippingBenchmarks() {
        const d = data();
        const seed = daySeed();
        const idx = d.indices || {};
        const legacy = FALLBACK.indices;
        const asOf = d.meta?.benchmarkAsOf || new Date().toISOString().slice(0, 10);
        return {
            asOf,
            source: d.meta?.source || FALLBACK.meta.source,
            updatedLabelKey: 'intel.market.stamp',
            dryBulk: {
                bdi: resolveIndex(idx.bdi, seed, legacy.bdi),
                capesize: resolveIndex(idx.capesizeTc, seed, legacy.capesizeTc),
                panamax: resolveIndex(idx.panamaxTc, seed, legacy.panamaxTc),
            },
            tanker: {
                bdti: resolveIndex(idx.bdti, seed, legacy.bdti),
                bcti: resolveIndex(idx.bcti, seed, legacy.bcti),
            },
            container: {
                scfiComposite: resolveIndex(idx.scfi, seed, legacy.scfi),
            },
        };
    }

    function renderTickerHtml(lang) {
        const d = data();
        const label = t('intel.ticker.label', lang);
        const updated =
            lang === 'ko'
                ? d.meta?.updatedLabelKo || t('intel.ticker.updated', lang)
                : d.meta?.updatedLabelEn || t('intel.ticker.updated', lang);
        const quotes = getBunkerQuotes();
        const chips = quotes
            .map((q) => {
                const href = buildToolkitBunkerUrl(q);
                const deltaClass = q.deltaPct > 0.05 ? 'is-up' : q.deltaPct < -0.05 ? 'is-down' : 'is-flat';
                return `<a class="mkt-ticker-chip" href="${href}" title="${escapeHtml(t('intel.ticker.openCalc', lang))}">
                    <span class="mkt-ticker-port">${escapeHtml(q.port)}</span>
                    <span class="mkt-ticker-grade">${escapeHtml(q.gradeLabel)}</span>
                    <span class="mkt-ticker-price">$${formatPrice(q.priceUsdMt)}/MT</span>
                    <span class="mkt-ticker-delta ${deltaClass}">${formatDeltaPct(q.deltaPct)}</span>
                </a>`;
            })
            .join('');
        return `
        <div class="mkt-bunker-ticker" role="region" aria-label="${escapeHtml(label)}">
            <div class="mkt-bunker-ticker-inner">
                <span class="mkt-ticker-label">${escapeHtml(label)}</span>
                <div class="mkt-ticker-track-wrap">
                    <div class="mkt-ticker-track">${chips}</div>
                </div>
                <span class="mkt-ticker-updated">${escapeHtml(updated)}</span>
            </div>
        </div>`;
    }

    function renderMarketTable(bench, lang) {
        const row = (name, val, delta, unit) => {
            const deltaClass = delta > 0.05 ? 'is-up' : delta < -0.05 ? 'is-down' : 'is-flat';
            return `<tr>
                <td class="mkt-intel-muted">${escapeHtml(name)}</td>
                <td>${escapeHtml(String(val))}${unit ? ` <span class="mkt-intel-muted">${escapeHtml(unit)}</span>` : ''}</td>
                <td><span class="mkt-ticker-delta ${deltaClass}">${formatDeltaPct(delta)}</span></td>
            </tr>`;
        };
        const stamp = `${escapeHtml(bench.source)} · ${escapeHtml(updatedLabelForFeed(lang, bench.asOf))}`;
        return `
        <p class="mkt-intel-stamp">${stamp}</p>
        <div class="mkt-intel-table-wrap">
            <table class="mkt-intel-table">
                <thead><tr>
                    <th>${escapeHtml(t('intel.table.benchmark', lang))}</th>
                    <th>${escapeHtml(t('intel.table.value', lang))}</th>
                    <th>${escapeHtml(t('intel.table.delta', lang))}</th>
                </tr></thead>
                <tbody>
                    ${row(t('intel.market.bdi', lang), bench.dryBulk.bdi.value, bench.dryBulk.bdi.deltaPct, '')}
                    ${row(t('intel.market.capesize', lang), bench.dryBulk.capesize.value, bench.dryBulk.capesize.deltaPct, bench.dryBulk.capesize.unit)}
                    ${row(t('intel.market.panamax', lang), bench.dryBulk.panamax.value, bench.dryBulk.panamax.deltaPct, bench.dryBulk.panamax.unit)}
                    ${row(t('intel.market.bdti', lang), bench.tanker.bdti.value, bench.tanker.bdti.deltaPct, '')}
                    ${row(t('intel.market.bcti', lang), bench.tanker.bcti.value, bench.tanker.bcti.deltaPct, '')}
                </tbody>
            </table>
        </div>
        <p class="mkt-intel-disclaimer">${escapeHtml(t('intel.market.disclaimer', lang))}</p>`;
    }

    function newsItems() {
        const list = data().news;
        return Array.isArray(list) && list.length ? list : [];
    }

    function updatedLabelForFeed(lang, asOf) {
        const d = data();
        if (lang === 'ko' && d.meta?.updatedLabelKo) return d.meta.updatedLabelKo;
        if (d.meta?.updatedLabelEn) return d.meta.updatedLabelEn;
        return `${t('intel.market.benchmarkAsOf', lang)} ${asOf}`;
    }

    function formatHoursAgo(hours, lang) {
        if (lang === 'ko') return `${hours}시간 전`;
        return `${hours}h ago`;
    }

    function formatPubRelative(pubDate, lang) {
        const t = Date.parse(pubDate);
        if (!Number.isFinite(t)) return '';
        const diffMs = Math.max(0, Date.now() - t);
        const mins = Math.floor(diffMs / 60_000);
        if (mins < 1) return lang === 'ko' ? '방금' : 'Just now';
        if (mins < 60) return lang === 'ko' ? `${mins}분 전` : `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return formatHoursAgo(hours, lang);
        if (hours < 48) return lang === 'ko' ? '어제' : 'Yesterday';
        const d = new Date(t);
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
    }

    function resolveNewsFields(item, lang) {
        const loc = lang === 'ko' && item.ko ? item.ko : item.en || item.ko || {};
        const tag = item.tag || item.category || 'Trade';
        return {
            headline: loc.headline || item.title || '',
            summary: loc.summary || item.summary || '',
            source: loc.source || item.source || '',
            link: item.link || '',
            tag,
            tagClass: item.tagClass || '',
            timeLabel: item.pubDate
                ? formatPubRelative(item.pubDate, lang)
                : item.hoursAgo != null
                  ? formatHoursAgo(item.hoursAgo, lang)
                  : '',
        };
    }

    function newsImageUrl(item, slotKey) {
        const fromFeed = String(item?.imageUrl || '').trim();
        if (fromFeed) return fromFeed;
        return MEDIA_IMAGES[slotKey] || MARITIME_IMAGE_FALLBACK;
    }

    function imgWithFallback(src, className, width, height, loading) {
        const fb = escapeHtml(MARITIME_IMAGE_FALLBACK);
        const attrs = [
            `class="${className}"`,
            `src="${escapeHtml(src)}"`,
            'alt=""',
            `loading="${loading || 'lazy'}"`,
            'decoding="async"',
        ];
        if (width) attrs.push(`width="${width}"`);
        if (height) attrs.push(`height="${height}"`);
        attrs.push(`onerror="this.onerror=null;this.src='${fb}'"`);
        return `<img ${attrs.join(' ')}>`;
    }

    function streamCategoryLabel(tag) {
        const key = String(tag || '').toLowerCase();
        if (key.includes('carbon') || key.includes('decarb')) return 'DECARB';
        if (key.includes('bunker')) return 'BUNKER';
        if (key.includes('s&p') || key === 's&p') return 'S&P';
        if (key.includes('trade') || key.includes('dry')) return 'DRY BULK';
        if (key.includes('reg') || key.includes('imo')) return 'IMO';
        return String(tag || 'TRADE').toUpperCase().slice(0, 12);
    }

    function leadBadgeLabel(_tag, lang) {
        return t('intel.news.leadBadge', lang);
    }

    function headlineLink(fields, className) {
        const text = escapeHtml(fields.headline);
        const cls = className ? ` class="${className}"` : '';
        if (fields.link) {
            return `<a href="${escapeHtml(fields.link)}" rel="noopener noreferrer" target="_blank"${cls}>${text}</a>`;
        }
        return `<span${cls}>${text}</span>`;
    }

    function renderNewsDashboard(lang) {
        const items = newsItems();
        if (!items.length) {
            return `<p class="mkt-intel-muted">${escapeHtml(t('intel.news.empty', lang))}</p>`;
        }

        const leadItem = items[0];
        const lead = resolveNewsFields(leadItem, lang);
        const secA = items[1] ? resolveNewsFields(items[1], lang) : lead;
        const secB = items[2] ? resolveNewsFields(items[2], lang) : secA;
        const secC = items[3] ? resolveNewsFields(items[3], lang) : secB;
        const streamItems = items.slice(4);

        const secondaryCard = (fields, item, slotKey, extraClass) => `
        <article class="mkt-media-card mkt-media-secondary ${extraClass}">
            <a class="mkt-media-thumb-wrap" href="${fields.link ? escapeHtml(fields.link) : '#'}" ${fields.link ? 'rel="noopener noreferrer" target="_blank"' : 'aria-hidden="true" tabindex="-1"'}>
                ${imgWithFallback(newsImageUrl(item, slotKey), 'mkt-media-thumb', 120, 120, 'lazy')}
            </a>
            <div class="mkt-media-secondary-body">
                <span class="mkt-news-tag ${escapeHtml(fields.tagClass)}">${escapeHtml(fields.tag)}</span>
                <h4 class="mkt-media-secondary-title">${headlineLink(fields, 'mkt-media-secondary-link')}</h4>
                <span class="mkt-media-time-badge">${escapeHtml(fields.timeLabel || t('intel.news.live', lang))}</span>
            </div>
        </article>`;

        const streamHtml = streamItems.length
            ? `<div class="mkt-stream-scroll" role="region" aria-label="${escapeHtml(t('intel.news.streamLabel', lang))}">
                <ul class="mkt-stream-list">${streamItems
                  .map((item) => {
                      const f = resolveNewsFields(item, lang);
                      const time = f.timeLabel || t('intel.news.live', lang);
                      return `<li class="mkt-stream-item">
                    <span class="mkt-stream-cat">[${escapeHtml(streamCategoryLabel(f.tag))}] · ${escapeHtml(time)}</span>
                    ${headlineLink(f, 'mkt-stream-headline')}
                    <span class="mkt-stream-source">${escapeHtml(f.source)}</span>
                </li>`;
                  })
                  .join('')}</ul></div>`
            : `<p class="mkt-intel-muted mkt-stream-empty">${escapeHtml(t('intel.news.streamMore', lang))}</p>`;

        return `
        <div class="mkt-news-dashboard">
            <article class="mkt-media-card mkt-media-lead">
                <a class="mkt-media-img-wrap" href="${lead.link ? escapeHtml(lead.link) : '#'}" ${lead.link ? 'rel="noopener noreferrer" target="_blank"' : ''}>
                    ${imgWithFallback(newsImageUrl(leadItem, 'lead'), 'mkt-media-hero-img', 800, 450, 'eager')}
                </a>
                <span class="mkt-media-lead-badge">${escapeHtml(leadBadgeLabel(lead.tag, lang))}</span>
                <h3 class="mkt-media-lead-title">${headlineLink(lead, 'mkt-media-lead-link')}</h3>
                <p class="mkt-media-lead-summary">${escapeHtml(lead.summary)}</p>
                <p class="mkt-media-lead-meta">${escapeHtml(lead.source)} · ${escapeHtml(lead.timeLabel)}</p>
            </article>
            <div class="mkt-news-dashboard-secondary">
                ${secondaryCard(secA, items[1] || leadItem, 'secondaryA', '')}
                ${secondaryCard(secB, items[2] || items[1] || leadItem, 'secondaryB', 'mkt-media-secondary-b')}
                ${secondaryCard(secC, items[3] || items[2] || leadItem, 'secondaryC', 'mkt-media-secondary-c')}
            </div>
            <aside class="mkt-news-dashboard-stream" aria-label="${escapeHtml(t('intel.news.streamLabel', lang))}">
                <p class="mkt-stream-kicker">${escapeHtml(t('intel.news.streamKicker', lang))}</p>
                ${streamHtml}
            </aside>
        </div>`;
    }

    function renderNewsList(lang) {
        return renderNewsDashboard(lang);
    }

    function renderPlgColumn(lang) {
        return `
        <div class="mkt-intel-card mkt-intel-plg">
            <h3 data-i18n="intel.plg.title">${escapeHtml(t('intel.plg.title', lang))}</h3>
            <p class="mkt-intel-plg-body" data-i18n="intel.plg.body">${escapeHtml(t('intel.plg.body', lang))}</p>
            <a class="mkt-intel-plg-cta" href="/sm" data-i18n="intel.plg.cta">${escapeHtml(t('intel.plg.cta', lang))}</a>
            <a class="mkt-intel-plg-secondary" href="/toolkit?tool=bunker#tab-bunker" data-i18n="intel.hook.bunker.cta">${escapeHtml(t('intel.hook.bunker.cta', lang))}</a>
        </div>`;
    }

    function renderHomeHub(root) {
        if (!root) return;
        const lang = global.TVC_MarketingI18n?.getLang?.() || 'en';
        const bench = getShippingBenchmarks();
        root.innerHTML = `
        <section class="mkt-intel-band" aria-labelledby="mktIntelTitle">
            <h2 id="mktIntelTitle" data-i18n="intel.hub.title">${escapeHtml(t('intel.hub.title', lang))}</h2>
            <p class="mkt-intel-lead" data-i18n="intel.hub.lead">${escapeHtml(t('intel.hub.lead', lang))}</p>
            <div class="mkt-intel-grid mkt-intel-grid-2">
                <div class="mkt-intel-card">
                    <h3 data-i18n="intel.market.title">${escapeHtml(t('intel.market.title', lang))}</h3>
                    ${renderMarketTable(bench, lang)}
                </div>
                ${renderPlgColumn(lang)}
            </div>
            <div class="mkt-intel-card mkt-intel-news-panel">
                <h3 data-i18n="intel.news.title">${escapeHtml(t('intel.news.title', lang))}</h3>
                ${renderNewsDashboard(lang)}
            </div>
        </section>`;
        global.TVC_MarketingI18n?.applyLang?.(lang);
    }

    function renderBunkerIntelStrip(port) {
        const quotes = getBunkerQuotes().filter((q) => q.port === port);
        if (!quotes.length) return '';
        const cells = quotes
            .map(
                (q) =>
                    `<div><strong>${escapeHtml(q.gradeLabel)}</strong> <a href="${buildToolkitBunkerUrl(q)}">$${formatPrice(q.priceUsdMt)}/MT</a></div>`,
            )
            .join('');
        return `
        <div class="maritime-bunker-intel">
            <h3>${escapeHtml(port)} — ${escapeHtml(data().meta?.updatedLabelEn || 'Indicative stem')}</h3>
            <div class="maritime-bunker-intel-grid">${cells}</div>
        </div>`;
    }

    function mountTicker(container) {
        if (!container) return;
        const lang = global.TVC_MarketingI18n?.getLang?.() || 'en';
        container.innerHTML = renderTickerHtml(lang);
    }

    function refreshUi() {
        const tickerHost = document.getElementById('mktBunkerTickerHost');
        if (tickerHost) mountTicker(tickerHost);
        const hub = document.getElementById('mktIntelHub');
        if (hub) renderHomeHub(hub);
    }

    function initHome() {
        if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;
        loadMarketData().then(refreshUi);
    }

    global.TVC_MarketFeed = {
        loadMarketData,
        getBunkerQuotes,
        getShippingBenchmarks,
        buildToolkitBunkerUrl,
        renderTickerHtml,
        renderNewsList,
        mountTicker,
        renderHomeHub,
        renderBunkerIntelStrip,
        initHome,
        refreshUi,
    };

    if (typeof global.addEventListener === 'function') {
        global.addEventListener('tvc-mkt-lang', () => {
            loadMarketData().then(refreshUi);
        });
    }

    if (document.readyState === 'loading' && typeof document.addEventListener === 'function') {
        document.addEventListener('DOMContentLoaded', initHome);
    } else {
        initHome();
    }
})(typeof window !== 'undefined' ? window : globalThis);
