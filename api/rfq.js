'use strict';

const impaSeo = require('./_lib/impaSeo');
const { buildRfqDraftHtml } = require('./_lib/rfqDraftHtml');

async function handleDraft(req, res) {
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
        console.error('[rfq draft]', e);
        return res.status(500).send('Draft generation failed');
    }
}

async function handleSubmit(req, res) {
    try {
        let body = req.body;
        if (!body || typeof body !== 'object') {
            const chunks = [];
            await new Promise((resolve, reject) => {
                req.on('data', (c) => chunks.push(c));
                req.on('end', resolve);
                req.on('error', reject);
            });
            const raw = Buffer.concat(chunks).toString('utf8');
            body = raw ? JSON.parse(raw) : {};
        }

        const code = String(body.code || body.impa || '').trim().replace(/\D/g, '').padStart(6, '0').slice(-6);
        const name = String(body.name || body.item || '').trim();
        const qty = Math.max(1, parseInt(String(body.qty || '1'), 10) || 1);
        const port = String(body.port || '').trim();
        const contact = String(body.contact || '').trim();
        const ref = String(body.ref || '').trim();
        const landCompat = String(body.land_compat_name || '').trim();

        if (!code || code === '000000') {
            return res.status(400).json({ ok: false, error: 'invalid_code' });
        }
        if (!contact) {
            return res.status(400).json({ ok: false, error: 'contact_required' });
        }

        const payload = {
            received_at: new Date().toISOString(),
            code,
            name,
            qty,
            port,
            contact,
            ref,
            land_compat_name: landCompat,
            source: String(body.source || 'impa_detail').trim(),
        };

        console.info('[rfq submit]', JSON.stringify(payload));

        const notifyTo = String(process.env.RFQ_NOTIFY_EMAIL || process.env.CONTACT_TO_EMAIL || '').trim();
        if (notifyTo && process.env.SMTP_HOST) {
            // Optional SMTP hook — production can wire nodemailer; log-only when unset.
        }

        return res.status(200).json({
            ok: true,
            message: 'RFQ received. Our supply desk will respond within 12 business hours.',
            code,
        });
    } catch (err) {
        console.error('[rfq submit]', err);
        return res.status(500).json({ ok: false, error: 'server_error' });
    }
}

module.exports = async function handler(req, res) {
    if (req.method === 'GET') {
        return handleDraft(req, res);
    }
    if (req.method === 'POST') {
        return handleSubmit(req, res);
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
};
