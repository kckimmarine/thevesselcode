'use strict';

const ROUTES = {
    'create-checkout-session': require('../_lib/handlers/billingCreateCheckoutSession'),
    'customer-portal': require('../_lib/handlers/billingCustomerPortal'),
    webhook: require('../_lib/handlers/billingWebhook'),
};

function billingRouteKey(req) {
    const segments = req.query?.path;
    if (Array.isArray(segments) && segments.length) {
        return segments.map(s => String(s).trim()).filter(Boolean).join('/');
    }
    if (typeof segments === 'string' && segments.trim()) {
        return segments.trim();
    }
    const raw = String(req.url || '');
    const match = raw.match(/\/api\/billing\/([^?]+)/);
    if (match) {
        return decodeURIComponent(match[1]).replace(/\/+$/, '');
    }
    return '';
}

async function handler(req, res) {
    const key = billingRouteKey(req);
    const routeHandler = ROUTES[key];
    if (!routeHandler) {
        return res.status(404).json({
            error: 'NOT_FOUND',
            message: key ? `Unknown billing route: ${key}` : 'Billing path required.',
        });
    }
    return routeHandler(req, res);
}

module.exports = handler;
module.exports.config = {
    api: {
        bodyParser: false,
    },
};
