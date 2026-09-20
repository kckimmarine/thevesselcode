#!/usr/bin/env node
/**
 * Smoke test: revenue action rules (no Google API calls required).
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildRevenueActions } = require('../api/_lib/revenuePipeline.js');

const results = [];
function check(name, ok, detail = '') {
    results.push({ name, ok, detail });
    console.log(ok ? 'OK' : 'FAIL', name, detail ? `— ${detail}` : '');
}

const mock = buildRevenueActions({
    ga4: {
        configured: true,
        sessions: 120,
        events: [
            { name: 'poc_cta_click', count: 12 },
            { name: 'lead_form_submit', count: 2 },
        ],
        topPages: [
            { path: '/sm', views: 40 },
            { path: '/store/812101', views: 8 },
        ],
    },
    gsc: {
        configured: true,
        topQueries: [
            { query: 'impa 812101 valve', clicks: 5, impressions: 200, avgPosition: 8.2 },
            { query: 'ship pms software', clicks: 3, impressions: 90, avgPosition: 12.1 },
        ],
    },
    leads: {
        configured: true,
        items: [{ number: 99, title: '[Contact] TVC-SM Fleet Demo — ACME', url: 'https://example.com/99' }],
    },
});

check('buildRevenueActions returns array', Array.isArray(mock) && mock.length > 0, String(mock.length));
check('detects poc conversion gap', mock.some((a) => a.type === 'conversion_gap'));
check('detects gsc rfq query', mock.some((a) => a.type === 'gsc_rfq'));
check('detects gsc saas query', mock.some((a) => a.type === 'gsc_saas'));
check('detects open lead', mock.some((a) => a.type === 'open_lead'));

const failed = results.filter((r) => !r.ok);
if (failed.length) {
    console.error('\nRevenue pipeline tests FAILED');
    process.exit(1);
}
console.log('\nRevenue pipeline tests passed.');
