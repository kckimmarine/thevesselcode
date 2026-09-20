/**
 * Total Marine Care — 4-pillar suite bar (Store, Repair, Home, Toolkit).
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }
    if (root && typeof root === 'object') {
        root.TVC_TotalServiceBar = api;
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function totalServiceBarFactory() {
    'use strict';

    function esc(text) {
        return String(text ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    const PILLARS = [
        {
            id: 'impa',
            emoji: '📦',
            title: 'IMPA Stores Sourcing',
            subtitle: 'Direct Berth &amp; Anchorage Supply',
            href: '/toolkit',
        },
        {
            id: 'repair',
            emoji: '🛠️',
            title: 'Certified Ship Repair',
            subtitle: 'Engine, Valve, Piping &amp; Class Approval',
            href: '/ship-repair-korea',
        },
        {
            id: 'husbandry',
            emoji: '⚓',
            title: 'Technical Husbandry',
            subtitle: 'Port Clearance, Launch Boats &amp; Customs',
            href: '/ship-repair-korea#srkEmergencyTitle',
        },
        {
            id: 'sm',
            emoji: '💻',
            title: 'TVC-SM Fleet Platform',
            subtitle: 'Real-time Inventory &amp; Requisition OS',
            href: '/sm#pricing',
        },
    ];

    function buildTotalServiceBarHtml(options = {}) {
        const active = String(options.activePillar || '').trim();
        const impaCode = esc(options.impaCode || '');
        const itemName = esc(options.itemName || '');
        const dataAttrs = impaCode
            ? ` data-impa-code="${impaCode}" data-impa-name="${itemName}"`
            : '';
        const cards = PILLARS.map((p) => {
            let href = p.href;
            if (p.id === 'impa' && impaCode) {
                href = `/toolkit?impa=${encodeURIComponent(options.impaCode)}`;
            }
            if (p.id === 'repair' && (options.impaCode || options.itemName)) {
                const q = new URLSearchParams();
                if (options.impaCode) q.set('impa', options.impaCode);
                if (options.itemName) q.set('item', options.itemName);
                href = `/ship-repair-korea?${q.toString()}`;
            }
            const activeClass = active === p.id ? ' total-service-card--active' : '';
            return `
    <a class="total-service-card${activeClass}" href="${esc(href)}" data-total-service-pillar="${esc(p.id)}">
      <span class="total-service-card-emoji" aria-hidden="true">${p.emoji}</span>
      <span class="total-service-card-title">${esc(p.title.replace(/&amp;/g, '&'))}</span>
      <span class="total-service-card-sub">${p.subtitle}</span>
    </a>`;
        }).join('\n');
        return `
<section class="total-service-bar" aria-label="Complete port call and technical care suite"${dataAttrs}>
  <header class="total-service-bar-head">
    <h2 class="total-service-bar-title">Complete Port Call &amp; Technical Care in Korea · China · Singapore</h2>
    <p class="total-service-bar-lead">Parts supply, afloat repair, husbandry, and fleet OS — one turnkey superintendent desk.</p>
  </header>
  <div class="total-service-grid" role="list">
${cards}
  </div>
</section>`;
    }

    function buildStoreRepairBridgeCtaHtml(ctx = {}) {
        const code = String(ctx.impaCode || '').trim();
        const name = String(ctx.itemName || '').trim();
        if (!code && !name) return '';
        const q = new URLSearchParams();
        if (code) q.set('impa', code);
        if (name) q.set('item', name);
        const href = esc(`/ship-repair-korea?${q.toString()}`);
        const label = code ? `IMPA ${esc(code)}` : esc(name);
        return `
<p class="cross-bridge-cta cross-bridge-cta--store">
  Need this item delivered alongside emergency afloat repair in Korea?
  <a class="cross-bridge-cta-link" href="${href}">🛠️ Book Turnkey Port Call</a>
  <span class="visually-hidden"> for ${label}</span>
</p>`;
    }

    function buildRepairCatalogBridgeCtaHtml() {
        return `
<p class="cross-bridge-cta cross-bridge-cta--repair">
  Need marine stores or IMPA spares delivered with this repair?
  <a class="cross-bridge-cta-link" href="/store">📦 Browse 53k IMPA Catalog</a>
</p>`;
    }

    const FEATURED_PILLARS = [
        {
            id: 'impa',
            title: 'IMPA stores sourcing',
            subtitle: 'Direct berth & anchorage supply',
            href: '/toolkit',
            image: '/assets/images/home-ocean-hero-horizon.webp',
        },
        {
            id: 'repair',
            title: 'Certified ship repair',
            subtitle: 'Engine, valve, piping & class approval',
            href: '/ship-repair-korea',
            image: '/assets/images/shipyard-dock-hero.webp',
        },
        {
            id: 'husbandry',
            title: 'Technical husbandry',
            subtitle: 'Port clearance, launch boats & customs',
            href: '/ship-repair-korea#srkEmergencyTitle',
            image: '/assets/images/samples/set-b/ocean-voyage-setb-sunset-fjord.webp',
        },
        {
            id: 'sm',
            title: 'TVC-SM fleet platform',
            subtitle: 'Real-time inventory & requisition OS',
            href: '/sm#pricing',
            image: '/assets/images/digital-port-bg.jpg',
        },
    ];

    function buildHomeFeaturedSuiteHtml() {
        const cards = FEATURED_PILLARS.map((p) => `
    <a class="home-featured-card" href="${esc(p.href)}" data-total-service-pillar="${esc(p.id)}">
      <span class="home-featured-card-media" style="background-image:url('${esc(p.image)}')" aria-hidden="true"></span>
      <span class="home-featured-card-body">
        <span class="home-featured-card-title">${esc(p.title)}</span>
        <span class="home-featured-card-sub">${esc(p.subtitle)}</span>
      </span>
    </a>`).join('\n');
        return `<div class="home-featured-card-grid" role="list">${cards}</div>`;
    }

    return {
        PILLARS,
        FEATURED_PILLARS,
        buildTotalServiceBarHtml,
        buildHomeFeaturedSuiteHtml,
        buildStoreRepairBridgeCtaHtml,
        buildRepairCatalogBridgeCtaHtml,
    };
}));
