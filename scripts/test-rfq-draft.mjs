#!/usr/bin/env node
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const impaSeo = require('../api/_lib/impaSeo.js');
const { buildRfqDraftHtml, quoteRef } = require('../api/_lib/rfqDraftHtml.js');
const { detailText } = require('../api/_lib/contactNotify.js');

const code = Object.keys(impaSeo.loadIndex().items).sort()[0];
const html = buildRfqDraftHtml({
    impaCode: code,
    itemName: 'Test item',
    companyName: 'Test Co',
    yourName: 'Officer',
    email: 'test@example.com',
    message: 'Qty 2, deliver Busan',
    port: 'Busan',
});

const checks = [
    ['quote ref', quoteRef(code).startsWith('RFQ-')],
    ['draft html', html.includes('DRAFT') && html.includes(code)],
    ['notify text', detailText({ inquiryType: 'RFQ', companyName: 'A', yourName: 'B', email: 'c@d.com', message: 'hi' }).includes('A')],
    ['store utm', impaSeo.buildStoreItemHtml(impaSeo.getItemByCode(code)).includes('utm_campaign=impa_rfq')],
];

checks.forEach(([name, ok]) => console.log(ok ? 'OK' : 'FAIL', name));
if (checks.some(([, ok]) => !ok)) process.exit(1);
console.log('\nRFQ draft tests passed.');
