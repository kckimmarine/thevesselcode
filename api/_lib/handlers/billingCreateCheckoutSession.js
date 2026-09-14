'use strict';

const { getStripe, isStripeConfigured, priceIdForPlan, requestOrigin } = require('../stripeClient');

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

function parsePlanType(raw) {
    const plan = String(raw || '').trim();
    if (plan === 'toolkit-pro' || plan === 'fleet-starter') return plan;
    return null;
}

function billingUrls(origin, planType) {
    if (planType === 'toolkit-pro') {
        return {
            success: `${origin}/toolkit?billing=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel: `${origin}/toolkit?billing=cancelled`,
        };
    }
    return {
        success: `${origin}/sm?billing=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel: `${origin}/sm?billing=cancelled`,
    };
}

async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!isStripeConfigured()) {
        return res.status(503).json({
            error: 'STRIPE_NOT_CONFIGURED',
            message: 'Payment gateway is not configured on this deployment.',
        });
    }

    try {
        const body = await readJsonBody(req);
        const planType = parsePlanType(body.planType);
        if (!planType) {
            return res.status(400).json({ error: 'Invalid planType. Use toolkit-pro or fleet-starter.' });
        }

        const priceId = priceIdForPlan(planType);
        if (!priceId) {
            return res.status(503).json({
                error: 'STRIPE_PRICE_MISSING',
                message: 'Stripe price ID is not configured for this plan.',
            });
        }

        const email = String(body.email || '').trim();
        let vesselCount = parseInt(String(body.vesselCount ?? '1'), 10);
        if (!Number.isFinite(vesselCount) || vesselCount < 1) vesselCount = 1;
        if (vesselCount > 500) vesselCount = 500;

        const origin = requestOrigin(req);
        const urls = billingUrls(origin, planType);
        const stripe = getStripe();

        const quantity = planType === 'fleet-starter' ? vesselCount : 1;
        const sessionParams = {
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [{ price: priceId, quantity }],
            success_url: urls.success,
            cancel_url: urls.cancel,
            metadata: {
                planType,
                vesselCount: String(quantity),
            },
            subscription_data: {
                metadata: {
                    planType,
                    vesselCount: String(quantity),
                },
            },
        };

        if (planType === 'fleet-starter') {
            sessionParams.subscription_data.trial_period_days = 30;
        }

        if (email) {
            sessionParams.customer_email = email;
        }

        const session = await stripe.checkout.sessions.create(sessionParams);

        return res.status(200).json({
            ok: true,
            sessionId: session.id,
            url: session.url,
        });
    } catch (e) {
        console.error('[billing/create-checkout-session]', e);
        if (e.code === 'PAYLOAD_TOO_LARGE') {
            return res.status(413).json({ error: 'Payload too large' });
        }
        if (e.code === 'STRIPE_NOT_CONFIGURED') {
            return res.status(503).json({ error: 'STRIPE_NOT_CONFIGURED' });
        }
        return res.status(500).json({
            error: 'CHECKOUT_SESSION_FAILED',
            message: e.message || String(e),
        });
    }
}

module.exports = handler;
