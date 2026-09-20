'use strict';

const { formatDigestText } = require('./revenuePipeline');
const { webhookUrls } = require('./contactNotify');

async function postJson(url, payload) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Webhook ${res.status}: ${text.slice(0, 300)}`);
    }
}

async function sendDigestEmail(text) {
    const apiKey = String(process.env.RESEND_API_KEY || '').trim();
    if (!apiKey) return { channel: 'email', ok: false, skipped: true };

    const toRaw = String(process.env.REVENUE_DIGEST_TO || process.env.CONTACT_TO_EMAILS || 'ktechship@gmail.com').trim();
    const to = toRaw.split(',').map((s) => s.trim()).filter(Boolean);
    const from = String(process.env.CONTACT_FROM_EMAIL || 'THE VESSEL CODE <onboarding@resend.dev>').trim();
    const subject = `[TVC Revenue] Weekly GSC/GA4 actions — ${new Date().toISOString().slice(0, 10)}`;

    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from,
            to,
            subject,
            text,
        }),
    });
    if (!res.ok) {
        const detail = await res.text();
        throw new Error(`Resend ${res.status}: ${detail.slice(0, 400)}`);
    }
    const data = await res.json();
    return { channel: 'email', ok: true, id: data.id, to };
}

async function notifyRevenueDigest(snapshot) {
    const text = snapshot?.digestText || formatDigestText(snapshot);
    const results = [];
    const { slack, kakaoWork } = webhookUrls();

    if (slack) {
        try {
            await postJson(slack, {
                text: `[TVC Revenue pipeline] ${snapshot.actions?.length || 0} actions`,
                blocks: [
                    { type: 'header', text: { type: 'plain_text', text: 'TVC revenue pipeline (GSC + GA4)', emoji: true } },
                    { type: 'section', text: { type: 'mrkdwn', text: `\`\`\`\n${text.slice(0, 2800)}\n\`\`\`` } },
                ],
            });
            results.push({ channel: 'slack', ok: true });
        } catch (e) {
            results.push({ channel: 'slack', ok: false, error: e.message });
        }
    }

    if (kakaoWork) {
        try {
            await postJson(kakaoWork, { text: text.slice(0, 3500) });
            results.push({ channel: 'kakao_work', ok: true });
        } catch (e) {
            results.push({ channel: 'kakao_work', ok: false, error: e.message });
        }
    }

    try {
        const email = await sendDigestEmail(text);
        results.push(email);
    } catch (e) {
        results.push({ channel: 'email', ok: false, error: e.message });
    }

    return results;
}

module.exports = {
    notifyRevenueDigest,
    sendDigestEmail,
};
