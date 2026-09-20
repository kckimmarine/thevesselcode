'use strict';

const { buildRevenueSnapshot, formatDigestText } = require('./_lib/revenuePipeline');
const { notifyRevenueDigest } = require('./_lib/revenueNotify');

function authorize(req) {
    const secret = String(process.env.REVENUE_PIPELINE_SECRET || process.env.CRON_SECRET || '').trim();
    if (!secret) return false;
    const auth = String(req.headers.authorization || '').trim();
    if (auth === `Bearer ${secret}`) return true;
    if (String(req.headers['x-cron-secret'] || '') === secret) return true;
    try {
        const url = new URL(req.url, 'http://localhost');
        return url.searchParams.get('token') === secret;
    } catch {
        return false;
    }
}

module.exports = async function handler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    if (!authorize(req)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
        const url = new URL(req.url, 'http://localhost');
        const digest = url.searchParams.get('digest') === '1' || url.searchParams.get('notify') === '1';
        const days = Number.parseInt(url.searchParams.get('days') || '7', 10);
        const snapshot = await buildRevenueSnapshot({ days: digest ? 7 : days });
        if (digest) {
            const notify = await notifyRevenueDigest(snapshot);
            return res.status(200).json({
                ok: true,
                generatedAt: snapshot.generatedAt,
                actionCount: snapshot.actions?.length || 0,
                notify,
                preview: formatDigestText(snapshot).slice(0, 2000),
            });
        }
        return res.status(200).json(snapshot);
    } catch (e) {
        console.error('[revenue-pipeline]', e);
        return res.status(500).json({ error: String(e.message || e) });
    }
};
