/**
 * /store programmatic pages — persist landing path for contact attribution.
 */
(function () {
    'use strict';

    function storePath() {
        try {
            return `${window.location.pathname}${window.location.search}`;
        } catch {
            return '/store';
        }
    }

    function persistAttribution() {
        try {
            const payload = {
                landing: storePath(),
                referrer: document.referrer || '',
                ts: Date.now(),
            };
            sessionStorage.setItem('tvc_inbound', JSON.stringify(payload));
        } catch { /* ignore */ }
    }

    function initStickyLead() {
        const sticky = document.querySelector('.store-sticky-lead');
        const lead = document.querySelector('.store-rfq-lead');
        if (!sticky || !lead || !window.IntersectionObserver) return;
        const obs = new IntersectionObserver(
            (entries) => {
                const visible = entries.some((e) => e.isIntersecting);
                sticky.classList.toggle('is-visible', !visible);
            },
            { root: null, threshold: 0.05 }
        );
        obs.observe(lead);
    }

    function onReady() {
        persistAttribution();
        initStickyLead();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onReady);
    } else {
        onReady();
    }
})();
