'use strict';

const { getStripe, isStripeConfigured } = require('../stripeClient');
const billingStore = require('../billingStore');

const MAX_BODY_BYTES = 512 * 1024;

function readRawBody(req) {
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
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
}

function subscriptionStatus(subscription) {
    const status = String(subscription?.status || 'unknown');
    const premium = status === 'active' || status === 'trialing';
    return { status, premiumAccess: premium };
}

async function handleCheckoutCompleted(session) {
    const stripe = getStripe();
    const full = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ['subscription'],
    });

    const planType = full.metadata?.planType || 'unknown';
    const vesselCount = full.metadata?.vesselCount || null;
    const customerId = typeof full.customer === 'string' ? full.customer : full.customer?.id;
    const subscriptionId =
        typeof full.subscription === 'string' ? full.subscription : full.subscription?.id;

    let status = 'active';
    if (full.subscription && typeof full.subscription === 'object') {
        status = full.subscription.status;
    } else if (subscriptionId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        status = sub.status;
    }

    billingStore.upsertSubscription({
        planType,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        email: full.customer_details?.email || full.customer_email || '',
        vesselCount,
        status,
        premiumAccess: status === 'active' || status === 'trialing',
    });
}

async function handleSubscriptionUpdated(subscription) {
    const { status, premiumAccess } = subscriptionStatus(subscription);
    billingStore.upsertSubscription({
        planType: subscription.metadata?.planType || billingStore.getBySubscriptionId(subscription.id)?.planType,
        stripeCustomerId:
            typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id,
        stripeSubscriptionId: subscription.id,
        vesselCount: subscription.metadata?.vesselCount,
        status,
        premiumAccess,
    });
}

async function handleSubscriptionDeleted(subscription) {
    billingStore.upsertSubscription({
        planType: subscription.metadata?.planType || billingStore.getBySubscriptionId(subscription.id)?.planType,
        stripeCustomerId:
            typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id,
        stripeSubscriptionId: subscription.id,
        vesselCount: subscription.metadata?.vesselCount,
        status: 'canceled',
        premiumAccess: false,
    });
}

async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).send('Method not allowed');
    }

    const webhookSecret = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();
    if (!isStripeConfigured() || !webhookSecret) {
        return res.status(503).send('Stripe webhook not configured');
    }

    try {
        const rawBody = await readRawBody(req);
        const signature = req.headers['stripe-signature'];
        if (!signature) {
            return res.status(400).send('Missing stripe-signature header');
        }

        const stripe = getStripe();
        let event;
        try {
            event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
        } catch (err) {
            console.error('[billing/webhook] signature verification failed', err.message);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        switch (event.type) {
            case 'checkout.session.completed':
                await handleCheckoutCompleted(event.data.object);
                break;
            case 'customer.subscription.updated':
                await handleSubscriptionUpdated(event.data.object);
                break;
            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(event.data.object);
                break;
            default:
                break;
        }

        return res.status(200).json({ received: true });
    } catch (e) {
        console.error('[billing/webhook]', e);
        if (e.code === 'PAYLOAD_TOO_LARGE') {
            return res.status(413).send('Payload too large');
        }
        return res.status(500).send('Webhook handler failed');
    }
}

module.exports = handler;
