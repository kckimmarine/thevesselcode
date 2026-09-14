/**
 * THE VESSEL CODE — Stripe Checkout triggers for marketing pricing cards.
 * Card data stays on Stripe-hosted Checkout (PCI scope minimized).
 */
(function (global) {
    'use strict';

    const FALLBACK = {
        'toolkit-pro': '/contact-us?inquiry=toolkit-pro',
        'fleet-starter': '/contact-us?inquiry=fleet-trial',
    };

    function t(key, fallback) {
        const i18n = global.TVC_MarketingI18n;
        if (i18n?.t) {
            const v = i18n.t(key, i18n.getLang?.());
            if (v && v !== key) return v;
        }
        return fallback;
    }

    function setLoading(el, on) {
        if (!el) return;
        el.classList.toggle('is-billing-loading', on);
        el.setAttribute('aria-busy', on ? 'true' : 'false');
        if (on) el.dataset.billingLabel = el.textContent;
        if (on) el.textContent = t('billing.checkout.loading', 'Redirecting to secure checkout…');
        else if (el.dataset.billingLabel) el.textContent = el.dataset.billingLabel;
    }

    function resolveVesselCount(trigger) {
        const selector = trigger.getAttribute('data-billing-vessel-input');
        if (selector) {
            const input = document.querySelector(selector);
            if (input) {
                const n = parseInt(String(input.value || '1'), 10);
                if (Number.isFinite(n) && n >= 1) return Math.min(n, 500);
            }
        }
        const inline = trigger.getAttribute('data-billing-vessel-count');
        if (inline) {
            const n = parseInt(inline, 10);
            if (Number.isFinite(n) && n >= 1) return Math.min(n, 500);
        }
        return 1;
    }

    function resolveEmail(trigger) {
        const selector = trigger.getAttribute('data-billing-email-input');
        if (!selector) return undefined;
        const input = document.querySelector(selector);
        const email = input ? String(input.value || '').trim() : '';
        return email || undefined;
    }

    function openFallback(planType) {
        const msg = t(
            'billing.checkout.fallback',
            'Payment gateway initializing. Connecting you to onboarding support…',
        );
        global.alert(msg);
        const url = FALLBACK[planType] || '/contact-us';
        global.location.href = url;
    }

    async function startCheckout(planType, trigger) {
        const payload = {
            planType,
            vesselCount: planType === 'fleet-starter' ? resolveVesselCount(trigger) : 1,
        };
        const email = resolveEmail(trigger);
        if (email) payload.email = email;

        const res = await fetch('/api/billing/create-checkout-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.url) {
            const code = data.error || 'CHECKOUT_FAILED';
            if (code === 'STRIPE_NOT_CONFIGURED' || code === 'STRIPE_PRICE_MISSING') {
                openFallback(planType);
                return;
            }
            throw new Error(data.message || code);
        }

        global.location.href = data.url;
    }

    async function onBillingClick(event) {
        const trigger = event.currentTarget;
        const planType = trigger.getAttribute('data-billing-plan');
        if (!planType) return;

        event.preventDefault();
        setLoading(trigger, true);
        try {
            await startCheckout(planType, trigger);
        } catch (e) {
            console.warn('[TVC_Billing]', e);
            openFallback(planType);
        } finally {
            setLoading(trigger, false);
        }
    }

    function bindCheckoutTriggers() {
        document.querySelectorAll('[data-billing-plan]').forEach((el) => {
            if (el.dataset.billingBound === '1') return;
            el.dataset.billingBound = '1';
            el.addEventListener('click', onBillingClick);
        });
    }

    async function openCustomerPortal(options = {}) {
        const res = await fetch('/api/billing/customer-portal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(options),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.url) {
            throw new Error(data.message || data.error || 'PORTAL_FAILED');
        }
        global.location.href = data.url;
    }

    function handleBillingReturnBanner() {
        try {
            const params = new URLSearchParams(global.location.search);
            const billing = params.get('billing');
            if (!billing) return;
            const host =
                document.querySelector('[data-billing-return-host]') ||
                document.querySelector('.mkt-pricing-band') ||
                document.querySelector('.home-shell');
            if (!host || host.querySelector('.mkt-billing-return')) return;

            const box = document.createElement('p');
            box.className = 'mkt-billing-return mkt-intel-muted';
            if (billing === 'success') {
                box.textContent = t(
                    'billing.return.success',
                    'Subscription received. Manage billing anytime from the customer portal.',
                );
                const sessionId = params.get('session_id');
                if (sessionId) {
                    const link = document.createElement('button');
                    link.type = 'button';
                    link.className = 'home-btn home-btn-secondary mkt-billing-portal-btn';
                    link.textContent = t('billing.portal.cta', 'Manage subscription & invoices');
                    link.style.marginTop = '12px';
                    link.addEventListener('click', () => {
                        openCustomerPortal({ sessionId }).catch(() => openFallback('fleet-starter'));
                    });
                    const wrap = document.createElement('div');
                    wrap.appendChild(box);
                    wrap.appendChild(link);
                    host.prepend(wrap);
                    return;
                }
            } else if (billing === 'cancelled') {
                box.textContent = t('billing.return.cancelled', 'Checkout cancelled — no charge was made.');
            } else if (billing === 'portal') {
                return;
            } else {
                return;
            }
            host.prepend(box);
        } catch (e) {
            console.warn('[TVC_Billing] return banner', e);
        }
    }

    function init() {
        bindCheckoutTriggers();
        handleBillingReturnBanner();
    }

    global.TVC_Billing = {
        startCheckout,
        openCustomerPortal,
        bindCheckoutTriggers,
        init,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    global.addEventListener('tvc-mkt-lang', init);
})(typeof window !== 'undefined' ? window : globalThis);
