'use strict';

const { getAccessToken } = require('./googleServiceAccount');

const GA4_SCOPES = ['https://www.googleapis.com/auth/analytics.readonly'];
const GSC_SCOPES = ['https://www.googleapis.com/auth/webmasters.readonly'];

const MONEY_PAGES = [
    { path: '/', product: 'Home / Brain search', action: 'PoC or RFQ follow-up' },
    { path: '/sm', product: 'TVC-SM SaaS', action: 'Fleet demo / 14-day PoC' },
    { path: '/services', product: 'Superintendent & Korea repair hub', action: 'Port repair RFQ or engineering scope call' },
    { path: '/toolkit', product: 'Maritime Toolkit PLG', action: 'IMPA → RFQ upsell' },
    { path: '/contact-us', product: 'Direct inquiry', action: 'Reply within 12h SLA' },
];

const RFQ_QUERY_RE = /\b(impa|valve|spare|store|supply|quote|rfq|marine store|pilot lamp|wire rope)\b/i;
const PMS_QUERY_RE = /\b(pms|planned maintenance|ship management|fleet|vessel management|sm mode)\b/i;

function ga4PropertyId() {
    const raw = String(process.env.GA4_PROPERTY_ID || process.env.GOOGLE_ANALYTICS_PROPERTY_ID || '').trim();
    if (!raw) return '';
    if (raw.startsWith('properties/')) return raw;
    const digits = raw.replace(/\D/g, '');
    return digits ? `properties/${digits}` : '';
}

function gscSiteUrl() {
    return String(process.env.GSC_SITE_URL || 'https://www.thevesselcode.com/').trim();
}

function githubConfig() {
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
    const [owner, repo] = String(process.env.GITHUB_REPO || 'kckimmarine/thevesselcode').split('/');
    return {
        token: String(token || '').trim(),
        owner: owner || 'kckimmarine',
        repo: repo || 'thevesselcode',
    };
}

function daysAgo(n) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10);
}

async function ga4RunReport(property, requestBody, token) {
    const url = `https://analyticsdata.googleapis.com/v1beta/${property}:runReport`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(`GA4 ${res.status}: ${JSON.stringify(payload).slice(0, 400)}`);
    }
    return payload;
}

async function fetchGa4Summary(days = 7) {
    const property = ga4PropertyId();
    if (!property) {
        return { configured: false, reason: 'GA4_PROPERTY_ID not set' };
    }
    const token = await getAccessToken(GA4_SCOPES);
    const startDate = daysAgo(days);
    const endDate = daysAgo(0);

    const [overviewRes, eventsRes, pagesRes] = await Promise.all([
        ga4RunReport(property, {
            dateRanges: [{ startDate, endDate }],
            metrics: [
                { name: 'sessions' },
                { name: 'activeUsers' },
                { name: 'screenPageViews' },
            ],
        }, token),
        ga4RunReport(property, {
            dateRanges: [{ startDate, endDate }],
            dimensions: [{ name: 'eventName' }],
            metrics: [{ name: 'eventCount' }],
            orderBys: [{ desc: true, metric: { metricName: 'eventCount' } }],
            limit: 30,
        }, token),
        ga4RunReport(property, {
            dateRanges: [{ startDate, endDate }],
            dimensions: [{ name: 'pagePath' }],
            metrics: [{ name: 'screenPageViews' }],
            orderBys: [{ desc: true, metric: { metricName: 'screenPageViews' } }],
            limit: 15,
        }, token),
    ]);

    const metricValues = overviewRes?.rows?.[0]?.metricValues || [];
    const eventRows = (eventsRes?.rows || []).map((row) => ({
        name: row.dimensionValues?.[0]?.value || '',
        count: Number(row.metricValues?.[0]?.value || 0),
    }));
    const focus = new Set(['lead_form_submit', 'poc_cta_click', 'page_view', 'session_start', 'first_visit']);
    const events = eventRows.filter((e) => focus.has(e.name) || e.name.startsWith('poc_') || e.name.startsWith('lead_'));
    const topPages = (pagesRes?.rows || []).map((row) => ({
        path: row.dimensionValues?.[0]?.value || '',
        views: Number(row.metricValues?.[0]?.value || 0),
    }));

    return {
        configured: true,
        period: { startDate, endDate, days },
        sessions: Number(metricValues[0]?.value || 0),
        activeUsers: Number(metricValues[1]?.value || 0),
        pageViews: Number(metricValues[2]?.value || 0),
        events,
        topPages,
    };
}

async function fetchGscSummary(days = 7) {
    const siteUrl = gscSiteUrl();
    const token = await getAccessToken(GSC_SCOPES);
    const end = new Date();
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - days);

    const encodedSite = encodeURIComponent(siteUrl);
    const url = `https://www.googleapis.com/webmasters/v3/sites/${encodedSite}/searchAnalytics/query`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            startDate: start.toISOString().slice(0, 10),
            endDate: end.toISOString().slice(0, 10),
            dimensions: ['query', 'page'],
            rowLimit: 50,
        }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(`GSC ${res.status}: ${JSON.stringify(payload).slice(0, 400)}`);
    }

    const rows = payload?.rows || [];
    const byQuery = new Map();
    const byPage = new Map();
    for (const row of rows) {
        const query = row.keys?.[0] || '';
        const page = row.keys?.[1] || '';
        const clicks = row.clicks || 0;
        const impressions = row.impressions || 0;
        const ctr = row.ctr || 0;
        const position = row.position || 0;
        if (query) {
            const prev = byQuery.get(query) || { query, clicks: 0, impressions: 0, position: 0, n: 0 };
            prev.clicks += clicks;
            prev.impressions += impressions;
            prev.position += position;
            prev.n += 1;
            byQuery.set(query, prev);
        }
        if (page) {
            const prev = byPage.get(page) || { page, clicks: 0, impressions: 0 };
            prev.clicks += clicks;
            prev.impressions += impressions;
            byPage.set(page, prev);
        }
    }

    const topQueries = [...byQuery.values()]
        .map((q) => ({
            query: q.query,
            clicks: q.clicks,
            impressions: q.impressions,
            ctr: q.impressions ? q.clicks / q.impressions : 0,
            avgPosition: q.n ? q.position / q.n : 0,
        }))
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 20);

    const topLandingPages = [...byPage.values()]
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 15);

    return {
        configured: true,
        siteUrl,
        period: { days },
        topQueries,
        topLandingPages,
    };
}

async function fetchOpenLeads(limit = 20) {
    const c = githubConfig();
    if (!c.token) {
        return { configured: false, reason: 'GITHUB_TOKEN not set' };
    }
    const q = encodeURIComponent(`repo:${c.owner}/${c.repo} is:issue is:open "[Contact]" in:title`);
    const res = await fetch(`https://api.github.com/search/issues?q=${q}&sort=created&order=desc&per_page=${limit}`, {
        headers: {
            Authorization: `Bearer ${c.token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'TVC-Revenue-Pipeline',
        },
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`GitHub search ${res.status}: ${text.slice(0, 300)}`);
    }
    const data = await res.json();
    const items = (data.items || []).map((issue) => ({
        number: issue.number,
        title: issue.title,
        url: issue.html_url,
        createdAt: issue.created_at,
    }));
    return { configured: true, openCount: data.total_count ?? items.length, items };
}

function scoreInquiryType(title) {
    const t = String(title || '').toLowerCase();
    if (t.includes('rfq') || t.includes('part')) return { tier: 'A', label: 'RFQ / parts revenue' };
    if (t.includes('demo') || t.includes('poc') || t.includes('fleet')) return { tier: 'A', label: 'PoC / SaaS' };
    if (t.includes('engineering') || t.includes('superintendent')) return { tier: 'A', label: 'Services revenue' };
    if (t.includes('partnership')) return { tier: 'B', label: 'Partnership' };
    return { tier: 'B', label: 'General lead' };
}

function buildRevenueActions({ ga4, gsc, leads }) {
    const actions = [];
    const pocClicks = ga4?.events?.find((e) => e.name === 'poc_cta_click')?.count || 0;
    const leadSubmits = ga4?.events?.find((e) => e.name === 'lead_form_submit')?.count || 0;

    if (pocClicks > leadSubmits && pocClicks >= 3) {
        actions.push({
            priority: 'high',
            type: 'conversion_gap',
            message: `PoC CTA clicks (${pocClicks}) exceed form submits (${leadSubmits}). Shorten path: PoC link → pre-filled contact or callback CTA on /sm.`,
            revenue: 'TVC-SM PoC → monthly SaaS',
        });
    }

    for (const row of (gsc?.topQueries || []).slice(0, 10)) {
        if (row.clicks < 2) continue;
        if (RFQ_QUERY_RE.test(row.query)) {
            actions.push({
                priority: 'high',
                type: 'gsc_rfq',
                message: `Search demand: "${row.query}" (${row.clicks} clicks, pos ~${row.avgPosition.toFixed(1)}). Ensure IMPA/store page + RFQ CTA ranks; reply to any matching inbound RFQ same day.`,
                revenue: 'Parts / stores margin',
                query: row.query,
            });
        } else if (PMS_QUERY_RE.test(row.query)) {
            actions.push({
                priority: 'high',
                type: 'gsc_saas',
                message: `Search demand: "${row.query}" (${row.clicks} clicks). Push /sm + 14-day PoC in meta title or run limited Google Ads to /contact-us?inquiry=poc.`,
                revenue: 'TVC-SM subscription',
                query: row.query,
            });
        }
    }

    for (const page of (ga4?.topPages || [])) {
        const path = page.path.split('?')[0];
        const meta = MONEY_PAGES.find((p) => p.path === path);
        if (meta && page.views >= 10) {
            actions.push({
                priority: 'medium',
                type: 'traffic_money_page',
                message: `${path}: ${page.views} views (7d). Product: ${meta.product}. Next: ${meta.action}.`,
                revenue: meta.product,
            });
        }
        if (path.startsWith('/store/') && page.views >= 5) {
            actions.push({
                priority: 'medium',
                type: 'impa_plg',
                message: `${path}: ${page.views} views. Add Fast RFQ follow-up email template for this IMPA code if inquiries mention it.`,
                revenue: 'RFQ / supply',
            });
        }
    }

    for (const lead of (leads?.items || []).slice(0, 8)) {
        const score = scoreInquiryType(lead.title);
        if (score.tier === 'A') {
            actions.push({
                priority: 'urgent',
                type: 'open_lead',
                message: `Open lead #${lead.number}: ${lead.title}. Class: ${score.label}. Close within 12h SLA.`,
                revenue: score.label,
                issueUrl: lead.url,
            });
        }
    }

    const seen = new Set();
    return actions.filter((a) => {
        const key = `${a.type}:${a.message.slice(0, 80)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    }).slice(0, 25);
}

function formatDigestText(snapshot) {
    const lines = [
        `THE VESSEL CODE — Revenue pipeline (${snapshot.generatedAt})`,
        '',
        '## Traffic (GA4)',
    ];
    if (snapshot.ga4?.configured) {
        lines.push(
            `Sessions: ${snapshot.ga4.sessions} | Users: ${snapshot.ga4.activeUsers} | Page views: ${snapshot.ga4.pageViews}`,
            `Events: ${(snapshot.ga4.events || []).map((e) => `${e.name}=${e.count}`).join(', ') || '—'}`,
        );
    } else {
        lines.push(`(not configured: ${snapshot.ga4?.reason || 'unknown'})`);
    }
    lines.push('', '## Search (GSC)');
    if (snapshot.gsc?.configured) {
        for (const q of (snapshot.gsc.topQueries || []).slice(0, 8)) {
            lines.push(`• "${q.query}" — ${q.clicks} clicks, ${q.impressions} impr, ~pos ${q.avgPosition.toFixed(1)}`);
        }
    } else {
        lines.push(`(not configured: ${snapshot.gsc?.reason || 'unknown'})`);
    }
    lines.push('', '## Open leads (GitHub)');
    if (snapshot.leads?.configured) {
        lines.push(`Open [Contact] issues: ${snapshot.leads.openCount}`);
        for (const l of (snapshot.leads.items || []).slice(0, 5)) {
            lines.push(`• #${l.number} ${l.title}`);
        }
    } else {
        lines.push(`(${snapshot.leads?.reason || 'not configured'})`);
    }
    lines.push('', '## Money actions (this week)');
    for (const a of snapshot.actions || []) {
        lines.push(`[${a.priority}] ${a.message}`);
    }
    return lines.join('\n');
}

async function buildRevenueSnapshot(options = {}) {
    const days = Math.min(28, Math.max(1, Number(options.days) || 7));
    const errors = [];
    let ga4 = { configured: false };
    let gsc = { configured: false };
    let leads = { configured: false };

    try {
        ga4 = await fetchGa4Summary(days);
    } catch (e) {
        errors.push({ source: 'ga4', message: String(e.message || e) });
        ga4 = { configured: false, error: String(e.message || e) };
    }

    try {
        gsc = await fetchGscSummary(days);
    } catch (e) {
        errors.push({ source: 'gsc', message: String(e.message || e) });
        gsc = { configured: false, error: String(e.message || e) };
    }

    try {
        leads = await fetchOpenLeads();
    } catch (e) {
        errors.push({ source: 'leads', message: String(e.message || e) });
        leads = { configured: false, error: String(e.message || e) };
    }

    const actions = buildRevenueActions({ ga4, gsc, leads });
    const snapshot = {
        v: 1,
        generatedAt: new Date().toISOString(),
        periodDays: days,
        ga4,
        gsc,
        leads,
        actions,
        errors,
    };
    snapshot.digestText = formatDigestText(snapshot);
    return snapshot;
}

module.exports = {
    buildRevenueSnapshot,
    formatDigestText,
    fetchGa4Summary,
    fetchGscSummary,
    fetchOpenLeads,
    buildRevenueActions,
    ga4PropertyId,
    gscSiteUrl,
};
