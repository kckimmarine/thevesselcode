#!/usr/bin/env node
/** Smoke tests for Stripe billing API modules (no live Stripe calls). */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const stripeClient = require(path.join(root, 'api/_lib/stripeClient.js'));
assert.equal(stripeClient.isStripeConfigured(), false);
assert.equal(stripeClient.priceIdForPlan('toolkit-pro'), '');
assert.equal(stripeClient.priceIdForPlan('fleet-starter'), '');

const billingStore = require(path.join(root, 'api/_lib/billingStore.js'));
const row = billingStore.upsertSubscription({
    planType: 'toolkit-pro',
    stripeCustomerId: 'cus_test_1',
    stripeSubscriptionId: 'sub_test_1',
    email: 'officer@example.com',
    status: 'trialing',
    premiumAccess: true,
});
assert.equal(row.planType, 'toolkit-pro');
assert.equal(billingStore.getCustomerIdByEmail('officer@example.com'), 'cus_test_1');

const checkoutHandler = require(path.join(root, 'api/_lib/handlers/billingCreateCheckoutSession.js'));
assert.equal(typeof checkoutHandler, 'function');

const webhookHandler = require(path.join(root, 'api/_lib/handlers/billingWebhook.js'));
assert.equal(typeof webhookHandler, 'function');

const billingRouter = require(path.join(root, 'api/billing/[...path].js'));
assert.equal(typeof billingRouter, 'function');
assert.ok(billingRouter.config?.api?.bodyParser === false);

console.log('OK billing-checkout smoke');
