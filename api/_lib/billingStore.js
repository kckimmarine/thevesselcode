'use strict';

const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, '..', '_data', 'billing-subscriptions.json');

function getSupabaseAdmin() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    try {
        const { createClient } = require('@supabase/supabase-js');
        return createClient(url, key, { auth: { persistSession: false } });
    } catch {
        return null;
    }
}

async function persistRemote(record) {
    const supabase = getSupabaseAdmin();
    if (!supabase) return;
    try {
        await supabase.from('billing_subscriptions').upsert(
            {
                stripe_customer_id: record.stripeCustomerId,
                stripe_subscription_id: record.stripeSubscriptionId,
                plan_type: record.planType,
                status: record.status,
                email: record.email || null,
                vessel_count: record.vesselCount,
                premium_access: record.premiumAccess !== false,
                updated_at: record.updatedAt,
            },
            { onConflict: 'stripe_subscription_id' },
        );
    } catch (e) {
        console.warn('[billingStore] supabase upsert skipped', e.message);
    }
}

/** @type {{ byCustomer: Record<string, object>, bySubscription: Record<string, object>, byEmail: Record<string, string> } | null} */
let memory = null;

function emptyStore() {
    return { byCustomer: {}, bySubscription: {}, byEmail: {} };
}

function loadStore() {
    if (memory) return memory;
    try {
        if (fs.existsSync(STORE_PATH)) {
            const parsed = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
            memory = {
                byCustomer: parsed.byCustomer && typeof parsed.byCustomer === 'object' ? parsed.byCustomer : {},
                bySubscription:
                    parsed.bySubscription && typeof parsed.bySubscription === 'object' ? parsed.bySubscription : {},
                byEmail: parsed.byEmail && typeof parsed.byEmail === 'object' ? parsed.byEmail : {},
            };
            return memory;
        }
    } catch (e) {
        console.warn('[billingStore] load failed', e.message);
    }
    memory = emptyStore();
    return memory;
}

function persistStore() {
    if (!memory) return;
    try {
        const dir = path.dirname(STORE_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(STORE_PATH, `${JSON.stringify(memory, null, 2)}\n`, 'utf8');
    } catch (e) {
        console.warn('[billingStore] persist failed', e.message);
    }
}

function normalizeEmail(email) {
    return String(email || '')
        .trim()
        .toLowerCase();
}

function upsertSubscription(record) {
    const store = loadStore();
    const customerId = String(record.stripeCustomerId || '').trim();
    const subscriptionId = String(record.stripeSubscriptionId || '').trim();
    if (!customerId && !subscriptionId) return null;

    const payload = {
        planType: record.planType || 'unknown',
        status: record.status || 'unknown',
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        email: record.email || '',
        vesselCount: record.vesselCount != null ? Number(record.vesselCount) : null,
        updatedAt: new Date().toISOString(),
        premiumAccess: record.premiumAccess !== false,
    };

    if (customerId) store.byCustomer[customerId] = payload;
    if (subscriptionId) store.bySubscription[subscriptionId] = payload;
    const em = normalizeEmail(record.email);
    if (em && customerId) store.byEmail[em] = customerId;
    persistStore();
    return payload;
}

function getByCustomerId(customerId) {
    const store = loadStore();
    return store.byCustomer[String(customerId || '').trim()] || null;
}

function getCustomerIdByEmail(email) {
    const store = loadStore();
    return store.byEmail[normalizeEmail(email)] || null;
}

function getBySubscriptionId(subscriptionId) {
    const store = loadStore();
    return store.bySubscription[String(subscriptionId || '').trim()] || null;
}

function setPremiumAccess(subscriptionId, premiumAccess) {
    const existing = getBySubscriptionId(subscriptionId);
    if (!existing) return null;
    return upsertSubscription({ ...existing, premiumAccess, status: premiumAccess ? existing.status : 'canceled' });
}

module.exports = {
    upsertSubscription,
    getByCustomerId,
    getCustomerIdByEmail,
    getBySubscriptionId,
    setPremiumAccess,
};
