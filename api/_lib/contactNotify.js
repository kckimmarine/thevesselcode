'use strict';

/**
 * Optional instant alerts when /api/contact receives a submission.
 *
 * Env (Vercel):
 *   CONTACT_SLACK_WEBHOOK_URL — Slack incoming webhook
 *   CONTACT_KAKAO_WORK_WEBHOOK_URL — Kakao Work / generic JSON webhook (text field)
 */

function webhookUrls() {
    const slack = String(process.env.CONTACT_SLACK_WEBHOOK_URL || '').trim();
    const kakaoWork = String(process.env.CONTACT_KAKAO_WORK_WEBHOOK_URL || '').trim();
    return { slack, kakaoWork };
}

function summaryLine(body) {
    const parts = [
        body.inquiryType,
        body.companyName,
        body.yourName,
        body.email,
    ].filter(Boolean);
    return parts.join(' · ');
}

function detailText(body, extras = {}) {
    const lines = [
        `*${body.inquiryType || 'Inquiry'}*`,
        `Company: ${body.companyName}`,
        `Name: ${body.yourName}`,
        `Email: ${body.email}`,
    ];
    if (body.impaCode) lines.push(`IMPA: ${body.impaCode}`);
    if (body.landingPage) lines.push(`Landing: ${body.landingPage}`);
    if (body.referrer) lines.push(`Referrer: ${body.referrer}`);
    if (body.campaign) lines.push(`Campaign: ${body.campaign}`);
    if (body.utmSource) lines.push(`UTM: ${body.utmSource}/${body.utmMedium || ''}/${body.utmCampaign || ''}`.replace(/\/+$/, ''));
    lines.push('', body.message || '(no message)');
    if (extras.rfqDraftUrl) lines.push('', `Draft quote: ${extras.rfqDraftUrl}`);
    return lines.join('\n');
}

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

async function notifySlack(url, body, extras) {
    const text = `[TVC Contact] ${summaryLine(body)}`;
    await postJson(url, {
        text,
        blocks: [
            { type: 'header', text: { type: 'plain_text', text: 'New TVC inquiry', emoji: true } },
            { type: 'section', text: { type: 'mrkdwn', text: detailText(body, extras) } },
        ],
    });
}

async function notifyKakaoWork(url, body, extras) {
    const text = `[TVC 문의]\n${detailText(body, extras).replace(/\*/g, '')}`;
    await postJson(url, { text });
}

async function notifyContactChannels(body, extras = {}) {
    const { slack, kakaoWork } = webhookUrls();
    const results = [];
    if (slack) {
        try {
            await notifySlack(slack, body, extras);
            results.push({ channel: 'slack', ok: true });
        } catch (e) {
            console.error('[contactNotify] slack', e.message);
            results.push({ channel: 'slack', ok: false, error: e.message });
        }
    }
    if (kakaoWork) {
        try {
            await notifyKakaoWork(kakaoWork, body, extras);
            results.push({ channel: 'kakao_work', ok: true });
        } catch (e) {
            console.error('[contactNotify] kakao_work', e.message);
            results.push({ channel: 'kakao_work', ok: false, error: e.message });
        }
    }
    return results;
}

module.exports = {
    webhookUrls,
    notifyContactChannels,
    detailText,
};
