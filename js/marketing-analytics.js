/**
 * THE VESSEL CODE — GA4 (gtag) for marketing pages.
 * Default measurement ID: G-XB1B5NY3NB (override via window.TVC_GA4_MEASUREMENT_ID).
 */
(function (global) {
    'use strict';

    const DEFAULT_ID = 'G-XB1B5NY3NB';

    function measurementId() {
        return String(global.TVC_GA4_MEASUREMENT_ID || DEFAULT_ID).trim();
    }

    function isConfigured(id) {
        return /^G-[A-Z0-9]+$/i.test(String(id || '').trim());
    }

    function ensureGtagReady(onReady) {
        if (typeof global.gtag === 'function') {
            onReady();
            return;
        }
        const id = measurementId();
        if (!isConfigured(id)) return;
        global.dataLayer = global.dataLayer || [];
        global.gtag = function gtag() {
            global.dataLayer.push(arguments);
        };
        global.gtag('js', new Date());
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
        script.onload = onReady;
        script.onerror = onReady;
        document.head.appendChild(script);
        global.gtag('config', id, { send_page_view: true });
    }

    function trackEvent(eventName, params) {
        const id = measurementId();
        if (!isConfigured(id)) return;
        if (typeof global.gtag !== 'function') return;
        global.gtag('event', eventName, params || {});
    }

    function bindPocCtaClicks() {
        document.addEventListener('click', (e) => {
            const anchor = e.target.closest('a[href*="inquiry=poc"]');
            if (!anchor) return;
            trackEvent('poc_cta_click', {
                link_url: anchor.getAttribute('href') || '',
                page_path: global.location?.pathname || '',
            });
        });
    }

    function init() {
        if (!isConfigured(measurementId())) return;
        ensureGtagReady(() => {
            bindPocCtaClicks();
        });
    }

    global.TVC_MarketingAnalytics = {
        measurementId,
        isConfigured,
        trackEvent,
        trackLeadFormSubmit(extra) {
            trackEvent('lead_form_submit', extra || {});
        },
        trackPocCtaClick(extra) {
            trackEvent('poc_cta_click', extra || {});
        },
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(typeof window !== 'undefined' ? window : globalThis);
