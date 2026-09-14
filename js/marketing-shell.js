/**
 * THE VESSEL CODE — shared marketing topbar + footer (Home, Services, Toolkit, Contact Us).
 * Requires marketing-i18n.js for KO/EN toggle.
 */
(function () {
    'use strict';

    const NAV = [
        { id: 'home', href: '/', i18n: 'nav.home' },
        { id: 'services', href: '/services', i18n: 'nav.services' },
        { id: 'toolkit', href: '/toolkit', i18n: 'nav.toolkit' },
        { id: 'sm', href: '/sm', i18n: 'nav.sm' },
        { id: 'contact', href: '/contact-us', i18n: 'nav.contact' },
    ];

    const FOOTER_LINKS = [
        { href: '/', i18n: 'nav.home' },
        { href: '/services', i18n: 'nav.services' },
        { href: '/toolkit', i18n: 'nav.toolkit' },
        { href: '/sm', i18n: 'nav.sm' },
        { href: '/contact-us', i18n: 'nav.contact' },
    ];

    const LOGO = '/icons/company-logo.png?v=20260804-logo-no-ring';

    function navLabel(item) {
        const i18n = globalThis.TVC_MarketingI18n;
        if (i18n?.t) {
            const lang = i18n.getLang();
            const label = i18n.t(item.i18n, lang);
            if (label) return label;
        }
        return item.i18n;
    }

    function renderTopbar(active) {
        const nav = NAV.map((item) => {
            const current = item.id === active ? ' aria-current="page"' : '';
            const ext = item.external ? ' target="_blank" rel="noopener noreferrer"' : '';
            return `<a href="${item.href}" data-nav="${item.id}" data-i18n="${item.i18n}"${current}${ext}>${navLabel(item)}</a>`;
        }).join('\n                ');

        return `
        <header class="home-topbar mkt-topbar" role="banner">
            <a class="home-brand" href="/"${active === 'home' ? ' aria-current="page"' : ''}>
                <img src="${LOGO}" alt="" width="44" height="44" draggable="false">
                <span class="home-brand-text">
                    <span class="home-brand-name">THE VESSEL CODE</span>
                    <span class="home-brand-tag">Engineering · Operations · Economics</span>
                </span>
            </a>
            <div class="mkt-topbar-actions">
                <div class="mkt-lang-switch" role="group" aria-label="Language">
                    <button type="button" class="mkt-lang-btn" data-lang="ko" aria-pressed="false">KO</button>
                    <button type="button" class="mkt-lang-btn" data-lang="en" aria-pressed="false">EN</button>
                </div>
                <button type="button" class="mkt-nav-toggle" id="mktNavToggle" aria-expanded="false" aria-controls="mktPrimaryNav">
                    <span data-i18n="nav.menu">Menu</span>
                </button>
            </div>
            <nav class="home-topnav" id="mktPrimaryNav" aria-label="Primary">
                ${nav}
            </nav>
        </header>`;
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

    function mount() {
        const active = document.body.getAttribute('data-mkt-active') || '';
        const topbarEl = document.getElementById('marketing-topbar');
        if (topbarEl) topbarEl.innerHTML = renderTopbar(active);
        const footerEl = document.getElementById('marketing-footer');
        if (footerEl) footerEl.innerHTML = renderFooter();
        bindTopbar();
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
