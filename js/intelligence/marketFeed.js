/**
 * THE VESSEL CODE — Commercial maritime intelligence (bunker ticker, indices, news).
 * Curated reference benchmarks with deterministic daily deltas (no live API dependency).
 */
(function (global) {
    'use strict';

    const PORTS = ['Singapore', 'Rotterdam', 'Busan', 'Houston'];

    const GRADES = [
        { key: 'VLSFO', label: 'VLSFO', fuel: 'VLSFO', defaultDensity: 991 },
        { key: 'LSMGO', label: 'LSMGO', fuel: 'LSMGO', defaultDensity: 850 },
        { key: 'HSFO380', label: 'HSFO 380', fuel: 'HSFO', defaultDensity: 991 },
    ];

    /** Base $/MT anchors (indicative, updated periodically in repo). */
    const BASE_PRICES = {
        Singapore: { VLSFO: 612, LSMGO: 748, HSFO380: 458 },
        Rotterdam: { VLSFO: 598, LSMGO: 722, HSFO380: 441 },
        Busan: { VLSFO: 625, LSMGO: 761, HSFO380: 472 },
        Houston: { VLSFO: 589, LSMGO: 715, HSFO380: 435 },
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

    function getBunkerQuotes() {
        const seed = daySeed();
        const quotes = [];
        PORTS.forEach((port, pi) => {
            GRADES.forEach((grade, gi) => {
                const base = BASE_PRICES[port][grade.key];
                const deltaPct = pseudoDelta(seed, pi * 17 + gi * 31 + grade.key.length);
                const price = base * (1 + deltaPct / 100);
                quotes.push({
                    port,
                    gradeKey: grade.key,
                    gradeLabel: grade.label,
                    fuel: grade.fuel,
                    defaultDensity: grade.defaultDensity,
                    priceUsdMt: price,
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
        return `/toolkit?${params.toString()}`;
    }

    function renderTickerHtml(lang) {
        const i18n = global.TVC_MarketingI18n;
        const label = i18n?.t?.('intel.ticker.label', lang) || 'Bunker benchmarks';
        const updated = i18n?.t?.('intel.ticker.updated', lang) || 'Indicative · UTC daily refresh';
        const quotes = getBunkerQuotes();
        const chips = quotes
            .map((q) => {
                const href = buildToolkitBunkerUrl(q);
                const deltaClass = q.deltaPct > 0.05 ? 'is-up' : q.deltaPct < -0.05 ? 'is-down' : 'is-flat';
                return `<a class="mkt-ticker-chip" href="${href}" title="Open ASTM 54B calculator">
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

    function getShippingBenchmarks() {
        const seed = daySeed();
        const bdi = 1842 + (seed % 120) - 40;
        const bdiDelta = pseudoDelta(seed, 99);
        return {
            asOf: new Date().toISOString(),
            dryBulk: {
                bdi: { value: bdi, deltaPct: bdiDelta },
                capesize: { value: 24850 + (seed % 800), unit: '$/day', deltaPct: pseudoDelta(seed, 101) },
                panamax: { value: 14220 + (seed % 400), unit: '$/day', deltaPct: pseudoDelta(seed, 103) },
            },
            tanker: {
                bdti: { value: 1185 + (seed % 60), deltaPct: pseudoDelta(seed, 107) },
                bcti: { value: 892 + (seed % 40), deltaPct: pseudoDelta(seed, 109) },
            },
            container: {
                scfiComposite: { value: 2140 + (seed % 100), deltaPct: pseudoDelta(seed, 113) },
                noteKey: 'intel.market.container.note',
            },
        };
    }

    const NEWS_ITEMS = [
        {
            category: 'Bunker',
            tagClass: '',
            headlineKey: 'intel.news.1.headline',
            sourceKey: 'intel.news.1.source',
            summaryKey: 'intel.news.1.summary',
            hoursAgo: 3,
        },
        {
            category: 'Regulations',
            tagClass: 'tag-regulations',
            headlineKey: 'intel.news.2.headline',
            sourceKey: 'intel.news.2.source',
            summaryKey: 'intel.news.2.summary',
            hoursAgo: 8,
        },
        {
            category: 'S&P',
            tagClass: 'tag-sp',
            headlineKey: 'intel.news.3.headline',
            sourceKey: 'intel.news.3.source',
            summaryKey: 'intel.news.3.summary',
            hoursAgo: 14,
        },
        {
            category: 'Trade',
            tagClass: 'tag-trade',
            headlineKey: 'intel.news.4.headline',
            sourceKey: 'intel.news.4.source',
            summaryKey: 'intel.news.4.summary',
            hoursAgo: 22,
        },
        {
            category: 'Bunker',
            tagClass: '',
            headlineKey: 'intel.news.5.headline',
            sourceKey: 'intel.news.5.source',
            summaryKey: 'intel.news.5.summary',
            hoursAgo: 28,
        },
    ];

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

    function formatHoursAgo(hours, lang) {
        if (lang === 'ko') return `${hours}시간 전`;
        return `${hours}h ago`;
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
        return `
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
                    ${row(t('intel.market.scfi', lang), bench.container.scfiComposite.value, bench.container.scfiComposite.deltaPct, '')}
                </tbody>
            </table>
        </div>
        <p class="mkt-intel-lead" style="margin:12px 0 0;font-size:0.78rem;">${escapeHtml(t(bench.container.noteKey, lang))}</p>`;
    }

    function renderNewsList(lang) {
        return `<ul class="mkt-news-list">${NEWS_ITEMS.map((item) => {
            const tag = item.category;
            return `<li class="mkt-news-item">
                <span class="mkt-news-tag ${item.tagClass}">${escapeHtml(tag)}</span>
                <h4 class="mkt-news-headline">${escapeHtml(t(item.headlineKey, lang))}</h4>
                <p class="mkt-news-meta">${escapeHtml(t(item.sourceKey, lang))} · ${escapeHtml(formatHoursAgo(item.hoursAgo, lang))}</p>
                <p class="mkt-news-summary">${escapeHtml(t(item.summaryKey, lang))}</p>
            </li>`;
        }).join('')}</ul>`;
    }

    function renderHomeHub(root) {
        if (!root) return;
        const lang = global.TVC_MarketingI18n?.getLang?.() || 'en';
        const bench = getShippingBenchmarks();
        root.innerHTML = `
        <section class="mkt-intel-band" aria-labelledby="mktIntelTitle">
            <h2 id="mktIntelTitle" data-i18n="intel.hub.title">${escapeHtml(t('intel.hub.title', lang))}</h2>
            <p class="mkt-intel-lead" data-i18n="intel.hub.lead">${escapeHtml(t('intel.hub.lead', lang))}</p>
            <div class="mkt-intel-grid">
                <div class="mkt-intel-card">
                    <h3 data-i18n="intel.market.title">${escapeHtml(t('intel.market.title', lang))}</h3>
                    ${renderMarketTable(bench, lang)}
                    <div class="mkt-intel-hooks">
                        <div class="mkt-intel-hook">
                            <span data-i18n="intel.hook.fleet">${escapeHtml(t('intel.hook.fleet', lang))}</span>
                            <a class="mkt-intel-cta-sm" href="/sm" data-i18n="intel.hook.fleet.cta">${escapeHtml(t('intel.hook.fleet.cta', lang))}</a>
                        </div>
                        <div class="mkt-intel-hook">
                            <span data-i18n="intel.hook.bunker">${escapeHtml(t('intel.hook.bunker', lang))}</span>
                            <a class="mkt-intel-cta-tool" href="/toolkit?tool=bunker" data-i18n="intel.hook.bunker.cta">${escapeHtml(t('intel.hook.bunker.cta', lang))}</a>
                        </div>
                    </div>
                </div>
                <div class="mkt-intel-card">
                    <h3 data-i18n="intel.news.title">${escapeHtml(t('intel.news.title', lang))}</h3>
                    ${renderNewsList(lang)}
                </div>
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
            <h3>${escapeHtml(port)} — indicative stem (${escapeHtml(new Date().toISOString().slice(0, 10))})</h3>
            <div class="maritime-bunker-intel-grid">${cells}</div>
        </div>`;
    }

    function mountTicker(container) {
        if (!container) return;
        const lang = global.TVC_MarketingI18n?.getLang?.() || 'en';
        container.innerHTML = renderTickerHtml(lang);
    }

    function initHome() {
        if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;
        const hub = document.getElementById('mktIntelHub');
        if (hub) renderHomeHub(hub);
    }

    global.TVC_MarketFeed = {
        PORTS,
        GRADES,
        getBunkerQuotes,
        getShippingBenchmarks,
        buildToolkitBunkerUrl,
        renderTickerHtml,
        mountTicker,
        renderHomeHub,
        renderBunkerIntelStrip,
        initHome,
    };

    if (typeof global.addEventListener === 'function') {
        global.addEventListener('tvc-mkt-lang', () => {
            const tickerHost = document.getElementById('mktBunkerTickerHost');
            if (tickerHost) mountTicker(tickerHost);
            initHome();
        });
    }

    if (document.readyState === 'loading' && typeof document.addEventListener === 'function') {
        document.addEventListener('DOMContentLoaded', initHome);
    } else {
        initHome();
    }
})(typeof window !== 'undefined' ? window : globalThis);
