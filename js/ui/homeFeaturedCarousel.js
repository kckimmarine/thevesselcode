/**
 * Home featured service cards — horizontal carousel (mobile/tablet) + grid (desktop).
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }
    if (root && typeof root === 'object') {
        root.TVC_HomeFeaturedCarousel = api;
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function homeFeaturedCarouselFactory() {
    'use strict';

    function initFeaturedCarousel(container) {
        const root = container || document.querySelector('[data-featured-carousel]');
        if (!root || root.dataset.featuredBound === '1') return;
        const viewport = root.querySelector('[data-featured-viewport]');
        const track = root.querySelector('.home-featured-card-track');
        const prevBtn = root.querySelector('[data-featured-prev]');
        const nextBtn = root.querySelector('[data-featured-next]');
        const dotsHost = root.querySelector('[data-featured-dots]');
        if (!viewport || !track) return;

        root.dataset.featuredBound = '1';
        const cards = () => Array.from(track.querySelectorAll('.home-featured-card'));

        function buildDots() {
            if (!dotsHost) return;
            dotsHost.innerHTML = '';
            cards().forEach((card, i) => {
                const dot = document.createElement('button');
                dot.type = 'button';
                dot.className = 'home-featured-carousel-dot';
                dot.setAttribute('role', 'tab');
                dot.setAttribute('aria-label', `Slide ${i + 1}`);
                dot.dataset.index = String(i);
                dot.addEventListener('click', () => scrollToIndex(i));
                dotsHost.appendChild(dot);
            });
        }

        function activeIndex() {
            const list = cards();
            if (!list.length) return 0;
            const vp = viewport.getBoundingClientRect();
            const center = vp.left + vp.width / 2;
            let best = 0;
            let bestDist = Infinity;
            list.forEach((el, i) => {
                const r = el.getBoundingClientRect();
                const c = r.left + r.width / 2;
                const d = Math.abs(c - center);
                if (d < bestDist) {
                    bestDist = d;
                    best = i;
                }
            });
            return best;
        }

        function updateDots() {
            if (!dotsHost) return;
            const idx = activeIndex();
            dotsHost.querySelectorAll('.home-featured-carousel-dot').forEach((dot, i) => {
                const on = i === idx;
                dot.classList.toggle('is-active', on);
                dot.setAttribute('aria-selected', on ? 'true' : 'false');
            });
        }

        function scrollToIndex(index) {
            const list = cards();
            const el = list[index];
            if (!el) return;
            const offset = el.offsetLeft - (viewport.clientWidth - el.offsetWidth) / 2;
            viewport.scrollTo({ left: Math.max(0, offset), behavior: 'smooth' });
        }

        function scrollStep(dir) {
            const idx = activeIndex();
            const next = Math.max(0, Math.min(cards().length - 1, idx + dir));
            scrollToIndex(next);
        }

        prevBtn?.addEventListener('click', () => scrollStep(-1));
        nextBtn?.addEventListener('click', () => scrollStep(1));

        let scrollTimer;
        viewport.addEventListener('scroll', () => {
            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(updateDots, 80);
        }, { passive: true });

        buildDots();
        updateDots();
    }

    function initDocument(scope) {
        (scope || document).querySelectorAll('[data-featured-carousel]').forEach(initFeaturedCarousel);
    }

    return { initFeaturedCarousel, initDocument };
}));
