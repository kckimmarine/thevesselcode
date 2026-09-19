'use strict';

const impaSeo = require('./_lib/impaSeo');
const { buildRfqDraftHtml } = require('./_lib/rfqDraftHtml');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).send('Method not allowed');
    }

    try {
        const q = req.query || {};
        const code = String(q.code || q.impa || '').trim();
        const item = code ? impaSeo.getItemByCode(code) : null;
        const itemName = String(q.name || '').trim() || item?.name || '';

        const html = buildRfqDraftHtml({
            impaCode: code || item?.impa_code,
            itemName,
            companyName: String(q.company || '').trim(),
            yourName: String(q.contact || q.yourName || '').trim(),
            email: String(q.email || '').trim(),
            message: String(q.message || '').trim(),
            port: String(q.port || '').trim(),
        });

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'private, no-store');
        return res.status(200).send(html);
    } catch (e) {
        console.error('[rfq-draft]', e);
        return res.status(500).send('Draft generation failed');
    }
};
