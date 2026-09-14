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
    document: { readyState: 'complete', addEventListener: () => {}, getElementById: () => null },
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
console.log('OK marketFeed smoke');
