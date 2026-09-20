'use strict';

const { buildRevenueSnapshot, formatDigestText } = require('../_lib/revenuePipeline');
const { notifyRevenueDigest } = require('../_lib/revenueNotify');

function authorizeCron(req) {
    const secret = String(process.env.CRON_SECRET || process.env.REVENUE_PIPELINE_SECRET || '').trim();
    if (!secret) return false;
    const auth = String(req.headers.authorization || '').trim();
    if (auth === `Bearer ${secret}`) return true;
    return String(req.headers['x-cron-secret'] || '') === secret;
}

module.exports = async function handler(req, res) {
    if (!authorizeCron(req)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    if (req.method !== 'GET' && req.method !== 'POST') {
        res.setHeader('Allow', 'GET, POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
        const snapshot = await buildRevenueSnapshot({ days: 7 });
        const notify = await notifyRevenueDigest(snapshot);
        return res.status(200).json({
            ok: true,
            generatedAt: snapshot.generatedAt,
            actionCount: snapshot.actions?.length || 0,
            notify,
            preview: formatDigestText(snapshot).slice(0, 2000),
        });
    } catch (e) {
        console.error('[cron/revenue-digest]', e);
        return res.status(500).json({ error: String(e.message || e) });
    }
};
