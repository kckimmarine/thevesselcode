'use strict';

const { buildRevenueSnapshot } = require('./_lib/revenuePipeline');

function authorize(req) {
    const secret = String(process.env.REVENUE_PIPELINE_SECRET || process.env.CRON_SECRET || '').trim();
    if (!secret) return false;
    const auth = String(req.headers.authorization || '').trim();
    if (auth === `Bearer ${secret}`) return true;
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
        const days = Number.parseInt(url.searchParams.get('days') || '7', 10);
        const snapshot = await buildRevenueSnapshot({ days });
        return res.status(200).json(snapshot);
    } catch (e) {
        console.error('[revenue-pipeline]', e);
        return res.status(500).json({ error: String(e.message || e) });
    }
};
