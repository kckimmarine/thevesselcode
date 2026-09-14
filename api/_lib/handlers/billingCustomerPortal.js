'use strict';

const { getStripe, isStripeConfigured, requestOrigin } = require('../stripeClient');
const billingStore = require('../billingStore');

const MAX_BODY_BYTES = 8 * 1024;

function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let total = 0;
        req.on('data', (chunk) => {
            total += chunk.length;
            if (total > MAX_BODY_BYTES) {
                reject(Object.assign(new Error('Payload too large'), { code: 'PAYLOAD_TOO_LARGE' }));
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => {
            try {
                const raw = Buffer.concat(chunks).toString('utf8');
                resolve(raw ? JSON.parse(raw) : {});
            } catch (e) {
                reject(e);
            }
        });
        req.on('error', reject);
    });
}

async function resolveCustomerId(stripe, body) {
    const direct = String(body.customerId || body.stripeCustomerId || '').trim();
    if (direct) return direct;

    const email = String(body.email || '').trim();
    if (email) {
        const fromStore = billingStore.getCustomerIdByEmail(email);
        if (fromStore) return fromStore;
    }

    const sessionId = String(body.sessionId || '').trim();
    if (sessionId) {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session?.customer) {
            return typeof session.customer === 'string' ? session.customer : session.customer.id;
        }
    }

    return null;
}

async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!isStripeConfigured()) {
        return res.status(503).json({
            error: 'STRIPE_NOT_CONFIGURED',
            message: 'Billing portal is not configured on this deployment.',
        });
    }

    try {
        const body = await readJsonBody(req);
        const stripe = getStripe();
        const customerId = await resolveCustomerId(stripe, body);
        if (!customerId) {
            return res.status(404).json({
                error: 'CUSTOMER_NOT_FOUND',
                message: 'Provide customerId, email, or a completed checkout sessionId.',
            });
        }

        const origin = requestOrigin(req);
        const returnUrl = String(body.returnUrl || '').trim() || `${origin}/sm?billing=portal`;

        const portal = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: returnUrl,
        });

        return res.status(200).json({ ok: true, url: portal.url });
    } catch (e) {
        console.error('[billing/customer-portal]', e);
        if (e.code === 'PAYLOAD_TOO_LARGE') {
            return res.status(413).json({ error: 'Payload too large' });
        }
        return res.status(500).json({
            error: 'PORTAL_SESSION_FAILED',
            message: e.message || String(e),
        });
    }
}

module.exports = handler;
