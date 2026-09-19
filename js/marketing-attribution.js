/**
 * Persist UTM / Google organic attribution for contact funnel (GSC → inquiry).
 */
(function () {
    'use strict';

    const STORAGE_KEY = 'tvc_attribution';

    function readParams() {
        try {
            return new URLSearchParams(window.location.search);
        } catch {
            return new URLSearchParams();
        }
    }

    function load() {
        try {
            const raw = sessionStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch {
            return {};
        }
    }

    function inferOrganicGoogle(referrer) {
        const ref = String(referrer || '').toLowerCase();
        if (!ref) return null;
        if (ref.includes('google.') || ref.includes('googleadservices')) {
            return { utmSource: 'google', utmMedium: 'organic' };
        }
        return null;
    }

    function capture() {
        const params = readParams();
        const existing = load();
        const normalized = {
            utmSource: String(params.get('utm_source') || existing.utmSource || '').trim(),
            utmMedium: String(params.get('utm_medium') || existing.utmMedium || '').trim(),
            utmCampaign: String(params.get('utm_campaign') || existing.utmCampaign || '').trim(),
            utmContent: String(params.get('utm_content') || existing.utmContent || '').trim(),
            utmTerm: String(params.get('utm_term') || existing.utmTerm || '').trim(),
            gclid: String(params.get('gclid') || existing.gclid || '').trim(),
            landing: existing.landing || `${window.location.pathname}${window.location.search}`,
            referrer: document.referrer || existing.referrer || '',
            ts: Date.now(),
        };
        if (!normalized.utmSource) {
            const inferred = inferOrganicGoogle(document.referrer);
            if (inferred) {
                normalized.utmSource = inferred.utmSource;
                normalized.utmMedium = normalized.utmMedium || inferred.utmMedium;
            }
        }
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
        } catch { /* ignore */ }
        return normalized;
    }

    function get() {
        const data = load();
        if (data.ts) return data;
        return capture();
    }

    function appendToUrl(url) {
        const attr = get();
        try {
            const u = new URL(url, window.location.origin);
            if (attr.utmSource && !u.searchParams.get('utm_source')) u.searchParams.set('utm_source', attr.utmSource);
            if (attr.utmMedium && !u.searchParams.get('utm_medium')) u.searchParams.set('utm_medium', attr.utmMedium);
            if (attr.utmCampaign && !u.searchParams.get('utm_campaign')) u.searchParams.set('utm_campaign', attr.utmCampaign);
            if (attr.utmContent && !u.searchParams.get('utm_content')) u.searchParams.set('utm_content', attr.utmContent);
            if (attr.utmTerm && !u.searchParams.get('utm_term')) u.searchParams.set('utm_term', attr.utmTerm);
            return u.pathname + u.search + u.hash;
        } catch {
            return url;
        }
    }

    globalThis.TVC_Attribution = { capture, get, appendToUrl, load };

    capture();
})();
