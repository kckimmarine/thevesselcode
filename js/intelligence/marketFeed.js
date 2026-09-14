/**
 * THE VESSEL CODE — Commercial maritime intelligence (loads data/market-indices.json).
 */
(function (global) {
    'use strict';

    const DATA_URL = '/data/market-indices.json';
    let marketData = null;
    let loadPromise = null;

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
            .then((res) => (res.ok ? res.json() : FALLBACK))
            .then((json) => {
                marketData = json && typeof json === 'object' ? json : FALLBACK;
                return marketData;
            })
            .catch(() => {
                marketData = FALLBACK;
                return marketData;
            });
        return loadPromise;
    }

    function getBunkerQuotes() {
        const d = data();
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

    function getShippingBenchmarks() {
        const d = data();
        const seed = daySeed();
        const idx = d.indices || FALLBACK.indices;
        const pick = (key) => idx[key] || FALLBACK.indices[key];
        const bdi = pick('bdi');
        const cap = pick('capesizeTc');
        const pan = pick('panamaxTc');
        const bdti = pick('bdti');
        const bcti = pick('bcti');
        const scfi = pick('scfi');
        return {
            asOf: new Date().toISOString().slice(0, 10),
            source: d.meta?.source || FALLBACK.meta.source,
            updatedLabelKey: 'intel.market.stamp',
            dryBulk: {
                bdi: { value: bdi.base + (seed % 120) - 40, deltaPct: pseudoDelta(seed, bdi.salt) },
                capesize: {
                    value: cap.base + (seed % (cap.jitter || 1)),
                    unit: cap.unit || '$/day',
                    deltaPct: pseudoDelta(seed, cap.salt),
                },
                panamax: {
                    value: pan.base + (seed % (pan.jitter || 1)),
                    unit: pan.unit || '$/day',
                    deltaPct: pseudoDelta(seed, pan.salt),
                },
            },
            tanker: {
                bdti: { value: bdti.base + (seed % (bdti.jitter || 1)), deltaPct: pseudoDelta(seed, bdti.salt) },
                bcti: { value: bcti.base + (seed % (bcti.jitter || 1)), deltaPct: pseudoDelta(seed, bcti.salt) },
            },
            container: {
                scfiComposite: { value: scfi.base + (seed % (scfi.jitter || 1)), deltaPct: pseudoDelta(seed, scfi.salt) },
            },
        };
    }

    function renderTickerHtml(lang) {
        const d = data();
        const label = t('intel.ticker.label', lang);
        const updated =
            lang === 'ko' ? d.meta?.updatedLabelKo || t('intel.ticker.updated', lang) : d.meta?.updatedLabelEn || t('intel.ticker.updated', lang);
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
        const stamp = `${escapeHtml(bench.source)} · ${escapeHtml(t('intel.market.stamp', lang))} · ${escapeHtml(bench.asOf)}`;
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

    function renderNewsList(lang) {
        const items = newsItems();
        if (!items.length) {
            return `<p class="mkt-intel-muted">${escapeHtml(t('intel.news.empty', lang))}</p>`;
        }
        return `<ul class="mkt-news-list">${items
            .map((item) => {
                const loc = lang === 'ko' && item.ko ? item.ko : item.en || item.ko || {};
                return `<li class="mkt-news-item">
                <span class="mkt-news-tag ${escapeHtml(item.tagClass || '')}">${escapeHtml(item.tag || '')}</span>
                <h4 class="mkt-news-headline">${escapeHtml(loc.headline || '')}</h4>
                <p class="mkt-news-meta">${escapeHtml(loc.source || '')} · ${escapeHtml(formatHoursAgo(item.hoursAgo, lang))}</p>
                <p class="mkt-news-summary">${escapeHtml(loc.summary || '')}</p>
            </li>`;
            })
            .join('')}</ul>`;
    }

    function formatHoursAgo(hours, lang) {
        if (lang === 'ko') return `${hours}시간 전`;
        return `${hours}h ago`;
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
            <div class="mkt-intel-grid mkt-intel-grid-3">
                <div class="mkt-intel-card">
                    <h3 data-i18n="intel.market.title">${escapeHtml(t('intel.market.title', lang))}</h3>
                    ${renderMarketTable(bench, lang)}
                </div>
                <div class="mkt-intel-card">
                    <h3 data-i18n="intel.news.title">${escapeHtml(t('intel.news.title', lang))}</h3>
                    ${renderNewsList(lang)}
                </div>
                ${renderPlgColumn(lang)}
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
