/**
 * THE VESSEL CODE — shared marketing topbar + footer (Home, Services, Toolkit, Contact Us).
 * Requires marketing-i18n.js for KO/EN toggle.
 * Commercial ticker: js/intelligence/marketFeed.js (lazy-loaded).
 */
(function () {
    'use strict';

    const NAV = [
        { id: 'home', href: '/', i18n: 'nav.home' },
        { id: 'services', href: '/services', i18n: 'nav.services' },
        { id: 'toolkit', href: '/toolkit', i18n: 'nav.toolkit' },
        { id: 'forum', href: '/forum', i18n: 'nav.forum' },
        { id: 'sm', href: '/sm', i18n: 'nav.sm' },
        { id: 'contact', href: '/contact-us', i18n: 'nav.contact' },
    ];

    const FOOTER_LINKS = [
        { href: '/', i18n: 'nav.home' },
        { href: '/services', i18n: 'nav.services' },
        { href: '/toolkit', i18n: 'nav.toolkit' },
        { href: '/forum', i18n: 'nav.forum' },
        { href: '/sm', i18n: 'nav.sm' },
        { href: '/contact-us', i18n: 'nav.contact' },
    ];

    const LOGO = '/icons/company-logo.png?v=20260804-logo-no-ring';
    const INTEL_CSS = '/css/marketing-readability.css?v=20260914-news-media-dashboard';
    const INTEL_JS = '/js/intelligence/marketFeed.js?v=20260914-news-media-dashboard';

    function navLabel(item) {
        const i18n = globalThis.TVC_MarketingI18n;
        if (i18n?.t) {
            const lang = i18n.getLang();
            const label = i18n.t(item.i18n, lang);
            if (label) return label;
        }
        return item.i18n;
    }

    function ensureReadabilityCss() {
        if (document.querySelector('link[data-mkt-readability]')) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = INTEL_CSS;
        link.setAttribute('data-mkt-readability', '1');
        document.head.appendChild(link);
    }

    function ensureMarketFeed(done) {
        if (globalThis.TVC_MarketFeed) {
            done();
            return;
        }
        const existing = document.querySelector('script[data-mkt-market-feed]');
        if (existing) {
            existing.addEventListener('load', () => done(), { once: true });
            return;
        }
        const script = document.createElement('script');
        script.src = INTEL_JS;
        script.async = true;
        script.setAttribute('data-mkt-market-feed', '1');
        script.onload = () => done();
        document.head.appendChild(script);
    }

    function renderTopbar(active) {
        const nav = NAV.map((item) => {
            const current = item.id === active ? ' aria-current="page"' : '';
            const ext = item.external ? ' target="_blank" rel="noopener noreferrer"' : '';
            return `<a href="${item.href}" data-nav="${item.id}" data-i18n="${item.i18n}"${current}${ext}>${navLabel(item)}</a>`;
        }).join('\n                ');

        return `
        <div class="mkt-commercial-stack">
            <div id="mktBunkerTickerHost" aria-live="polite"></div>
            <header class="home-topbar mkt-topbar mkt-marketing-header" role="banner">
            <a class="home-brand" href="/"${active === 'home' ? ' aria-current="page"' : ''}>
                <img src="${LOGO}" alt="" width="44" height="44" draggable="false">
                <span class="home-brand-text">
                    <span class="home-brand-name">THE VESSEL CODE</span>
                    <span class="home-brand-tag" data-i18n="nav.brand.tag">Engineering · Operations · Open maritime hub</span>
                </span>
            </a>
            <div class="mkt-topbar-actions">
                <div class="mkt-lang-switch" role="group" aria-label="Language">
                    <button type="button" class="mkt-lang-btn" data-lang="ko" aria-pressed="false">KO</button>
                    <button type="button" class="mkt-lang-btn" data-lang="en" aria-pressed="false">EN</button>
                </div>
                <a class="mkt-topbar-cta" href="https://app.thevesselcode.com" target="_blank" rel="noopener noreferrer" data-i18n="nav.launchApp">Launch App</a>
                <button type="button" class="mkt-nav-toggle" id="mktNavToggle" aria-expanded="false" aria-controls="mktPrimaryNav">
                    <span data-i18n="nav.menu">Menu</span>
                </button>
            </div>
            <nav class="home-topnav" id="mktPrimaryNav" aria-label="Primary">
                ${nav}
            </nav>
        </header>
        </div>`;
    }

    function renderFooter() {
        const links = FOOTER_LINKS.map((item) => {
            const ext = item.external ? ' target="_blank" rel="noopener noreferrer"' : '';
            return `<a href="${item.href}" data-i18n="${item.i18n}"${ext}>${navLabel(item)}</a>`;
        }).join(' ·\n                ');

        return `
        <footer class="home-footer">
            <span data-i18n="footer.copy">© 2026 THE VESSEL CODE (K-TECH) · Busan, Republic of Korea</span>
            <span class="home-footer-links">
                ${links}
            </span>
        </footer>`;
    }

    function bindTopbar() {
        const toggle = document.getElementById('mktNavToggle');
        const nav = document.getElementById('mktPrimaryNav');
        if (toggle && nav) {
            toggle.addEventListener('click', () => {
                const open = nav.classList.toggle('is-open');
                toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            });
            nav.querySelectorAll('a').forEach((a) => {
                a.addEventListener('click', () => {
                    nav.classList.remove('is-open');
                    toggle.setAttribute('aria-expanded', 'false');
                });
            });
        }

        document.querySelectorAll('.mkt-lang-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const lang = btn.getAttribute('data-lang');
                if (globalThis.TVC_MarketingI18n?.setLang) {
                    globalThis.TVC_MarketingI18n.setLang(lang);
                }
                mount();
            });
        });
    }

    function mountTicker() {
        const host = document.getElementById('mktBunkerTickerHost');
        if (host && globalThis.TVC_MarketFeed?.mountTicker) {
            globalThis.TVC_MarketFeed.mountTicker(host);
        }
    }

    function mount() {
        ensureReadabilityCss();
        const active = document.body.getAttribute('data-mkt-active') || '';
        const topbarEl = document.getElementById('marketing-topbar');
        if (topbarEl) topbarEl.innerHTML = renderTopbar(active);
        const footerEl = document.getElementById('marketing-footer');
        if (footerEl) footerEl.innerHTML = renderFooter();
        bindTopbar();
        ensureMarketFeed(() => {
            mountTicker();
            globalThis.TVC_MarketFeed?.initHome?.();
        });
        if (globalThis.TVC_MarketingI18n?.applyLang) {
            globalThis.TVC_MarketingI18n.applyLang(globalThis.TVC_MarketingI18n.getLang());
        }
    }

    globalThis.addEventListener('tvc-mkt-lang', () => mount());

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mount);
    } else {
        mount();
    }
})();
