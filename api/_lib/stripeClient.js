'use strict';

function stripeSecretKey() {
    return String(process.env.STRIPE_SECRET_KEY || '').trim();
}

function isStripeConfigured() {
    return !!stripeSecretKey();
}

function getStripe() {
    const key = stripeSecretKey();
    if (!key) {
        const err = new Error('STRIPE_SECRET_KEY is not configured');
        err.code = 'STRIPE_NOT_CONFIGURED';
        throw err;
    }
    // eslint-disable-next-line global-require
    const Stripe = require('stripe');
    return new Stripe(key);
}

function priceIdForPlan(planType) {
    if (planType === 'toolkit-pro') {
        return String(process.env.STRIPE_PRICE_TOOLKIT_PRO || '').trim();
    }
    if (planType === 'fleet-starter') {
        return String(process.env.STRIPE_PRICE_FLEET_STARTER || '').trim();
    }
    return '';
}

function requestOrigin(req) {
    const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'thevesselcode.com')
        .split(',')[0]
        .trim();
    return `${proto}://${host}`;
}

module.exports = {
    getStripe,
    isStripeConfigured,
    priceIdForPlan,
    requestOrigin,
};
