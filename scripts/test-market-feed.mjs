#!/usr/bin/env node
/** Smoke test for TVC_MarketFeed (VM load). */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = fs.readFileSync(path.join(root, 'js/intelligence/marketFeed.js'), 'utf8');

const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    TVC_MarketingI18n: { getLang: () => 'en', t: (k) => k, applyLang: () => {} },
    document: { readyState: 'loading', addEventListener: () => {}, getElementById: () => null },
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
sandbox.global = sandbox;
sandbox.URLSearchParams = globalThis.URLSearchParams;

vm.runInNewContext(src, sandbox);

const feed = sandbox.TVC_MarketFeed;
assert.ok(feed, 'TVC_MarketFeed');
const quotes = feed.getBunkerQuotes();
assert.equal(quotes.length, 12);
const url = feed.buildToolkitBunkerUrl(quotes[0]);
assert.match(url, /^\/toolkit\?tool=bunker&fuel=/);
assert.match(url, /#tab-bunker$/);

const mockFeed = {
    meta: { updatedLabelEn: 'test' },
    news: [
        {
            title: 'Lead story',
            link: 'https://example.com/lead',
            pubDate: new Date(Date.now() - 3_600_000).toUTCString(),
            source: 'Test',
            category: 'Dry Bulk',
            summary: 'Lead summary',
            imageUrl: 'https://images.unsplash.com/photo-1494412574643-7cec40c5a2bf?auto=format&fit=crop&w=800&q=80',
            tag: 'Dry Bulk',
            tagClass: 'tag-trade',
            en: { headline: 'Lead story', summary: 'Lead summary', source: 'Test' },
        },
        { title: 'Sec 1', link: '#', pubDate: new Date().toUTCString(), source: 'A', category: 'Trade', summary: '', en: { headline: 'Sec 1', source: 'A' } },
        { title: 'Sec 2', link: '#', pubDate: new Date().toUTCString(), source: 'B', category: 'Carbon', summary: '', en: { headline: 'Sec 2', source: 'B' } },
        { title: 'Sec 3', link: '#', pubDate: new Date().toUTCString(), source: 'C', category: 'Trade', summary: '', en: { headline: 'Sec 3', source: 'C' } },
        { title: 'Stream 1', link: '#', pubDate: new Date(Date.now() - 120_000).toUTCString(), source: 'D', category: 'Trade', summary: '', en: { headline: 'Stream 1', source: 'D' } },
        { title: 'Stream 2', link: '#', pubDate: new Date().toUTCString(), source: 'E', category: 'Carbon', summary: '', en: { headline: 'Stream 2', source: 'E' } },
    ],
};
sandbox.fetch = async (url) => {
    if (String(url).includes('market-feed')) {
        return { ok: true, json: async () => mockFeed };
    }
    return { ok: false };
};
await feed.loadMarketData();
const html = feed.renderNewsList('en');
assert.match(html, /mkt-media-secondary-c/, 'third secondary card');
assert.match(html, /mkt-stream-scroll/, 'scrollable stream');
assert.match(html, /· .* ago|Just now|Yesterday/m, 'relative timestamp in stream');
assert.match(html, /photo-1494412574643/, 'lead uses feed image');
console.log('OK marketFeed smoke');
