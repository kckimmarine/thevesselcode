#!/usr/bin/env node
/**
 * Aggregate public RSS + baseline bunker/indices → public/data/market-feed.json
 * Usage:
 *   node scripts/fetch-market-feed.mjs          # live fetch (may use network)
 *   node scripts/fetch-market-feed.mjs --offline # baseline + overrides only
 *   node scripts/fetch-market-feed.mjs --build   # build-safe: never exit 1
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = join(ROOT, 'data/market-indices.json');
const OVERRIDES_PATH = join(ROOT, 'data/market-overrides.json');
const OUT_PATH = join(ROOT, 'public/data/market-feed.json');

const args = new Set(process.argv.slice(2));
const BUILD_MODE = args.has('--build');
const OFFLINE = args.has('--offline') || process.env.SKIP_MARKET_FETCH === '1';

const RSS_FEEDS = [
    { url: 'https://gcaptain.com/feed/', source: 'gCaptain' },
    { url: 'https://maritime-executive.com/rss/article', source: 'Maritime Executive' },
    { url: 'https://splash247.com/feed/', source: 'Splash247' },
];

const FETCH_TIMEOUT_MS = 12_000;
const MAX_NEWS = 16;
const MAX_OG_IMAGE_FETCH = 10;

/** Verified maritime photography — never generic office / tech stock. */
const MARITIME_FALLBACK_IMAGES = [
    'https://images.unsplash.com/photo-1494412574643-7cec40c5a2bf?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1569263979104-8659937a0c8c?auto=format&fit=crop&w=800&q=80',
];

function readJson(path, fallback = null) {
    try {
        if (!existsSync(path)) return fallback;
        return JSON.parse(readFileSync(path, 'utf8'));
    } catch {
        return fallback;
    }
}

function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function deepMergePrices(base, patch) {
    if (!patch) return base;
    const out = clone(base);
    for (const [hub, grades] of Object.entries(patch)) {
        out[hub] = { ...(out[hub] || {}), ...grades };
    }
    return out;
}

function daySeed(date = new Date()) {
    const key = `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`;
    let h = 0;
    for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    return h;
}

function pseudoDelta(seed, salt) {
    const x = ((seed ^ salt) % 1000) / 1000;
    return Math.round(((x - 0.5) * 2.4) * 100) / 100;
}

function stripTags(s) {
    return String(s || '')
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
}

function pickTagRaw(block, tag) {
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
    const m = block.match(re);
    if (!m) return '';
    return String(m[1]).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1').trim();
}

function pickTag(block, tag) {
    const raw = pickTagRaw(block, tag);
    return raw ? stripTags(raw) : '';
}

function pickAttr(block, tag, attr) {
    const re = new RegExp(`<${tag}[^>]*\\b${attr}\\s*=\\s*['"]([^'"]+)['"]`, 'i');
    const m = block.match(re);
    return m ? m[1].trim() : '';
}

function resolveAbsoluteUrl(url, base) {
    const raw = String(url || '').trim();
    if (!raw) return '';
    try {
        return new URL(raw, base || undefined).href;
    } catch {
        return '';
    }
}

function isWeakNewsImage(url) {
    const u = String(url || '').toLowerCase();
    if (!u || !/^https?:\/\//i.test(u)) return true;
    if (/favicon|emoji|1x1|pixel\.gif|data:image/i.test(u)) return true;
    if (/\b(32x32|48x48|64x64|96x96)\b/.test(u)) return true;
    if (/cropped-.*favicon|site-icon|placeholder/i.test(u)) return true;
    if (/unsplash\.com\/photo-1559136555/i.test(u)) return true;
    return false;
}

function pickBestImageUrlFromBlock(block, link, descriptionHtml) {
    const candidates = [];
    const mediaContent = pickAttr(block, 'media:content', 'url')
        || pickAttr(block, 'media:thumbnail', 'url');
    if (mediaContent) candidates.push(mediaContent);
    const enclosure = pickAttr(block, 'enclosure', 'url');
    const encType = pickAttr(block, 'enclosure', 'type');
    if (enclosure && (!encType || encType.startsWith('image/'))) candidates.push(enclosure);
    const desc = descriptionHtml || pickTag(block, 'description') || pickTag(block, 'content:encoded');
    const imgInDesc = desc.match(/<img[^>]+src\s*=\s*['"]([^'"]+)['"]/i);
    if (imgInDesc) candidates.push(imgInDesc[1]);
    for (const c of candidates) {
        const abs = resolveAbsoluteUrl(c, link);
        if (!isWeakNewsImage(abs)) return abs;
    }
    return '';
}

function maritimeFallbackImage(seed = 0) {
    const idx = Math.abs(Number(seed) || 0) % MARITIME_FALLBACK_IMAGES.length;
    return MARITIME_FALLBACK_IMAGES[idx];
}

function parseRss(xml, sourceName) {
    const items = [];
    const blocks = String(xml).match(/<item[\s\S]*?<\/item>/gi) || [];
    for (const block of blocks.slice(0, MAX_NEWS)) {
        const title = pickTag(block, 'title');
        if (!title) continue;
        const link = pickTag(block, 'link') || pickTag(block, 'guid');
        const pubDate = pickTag(block, 'pubDate') || pickTag(block, 'published');
        const descriptionRaw = pickTagRaw(block, 'description') || pickTagRaw(block, 'content:encoded');
        const summary = stripTags(descriptionRaw);
        const category = categorizeNews(title, summary);
        const imageUrl = pickBestImageUrlFromBlock(block, link, descriptionRaw);
        items.push({
            title,
            link,
            pubDate,
            source: sourceName,
            category,
            summary: summary.slice(0, 280),
            imageUrl,
        });
    }
    return items;
}

async function fetchArticleOgImage(link) {
    const pageUrl = String(link || '').trim();
    if (!pageUrl) return '';
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
        const res = await fetch(pageUrl, {
            signal: ctrl.signal,
            headers: {
                'User-Agent': 'TVC-MarketFeed/1.0 (+https://thevesselcode.com)',
                Accept: 'text/html,application/xhtml+xml',
            },
        });
        if (!res.ok) return '';
        const html = await res.text();
        const m = html.match(
            /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
        ) || html.match(
            /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
        ) || html.match(
            /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
        );
        const abs = m ? resolveAbsoluteUrl(m[1], pageUrl) : '';
        return isWeakNewsImage(abs) ? '' : abs;
    } catch {
        return '';
    } finally {
        clearTimeout(timer);
    }
}

async function enrichNewsImages(items) {
    let fetches = 0;
    const out = [];
    for (let i = 0; i < items.length; i += 1) {
        const item = { ...items[i] };
        if (!item.imageUrl && item.link && fetches < MAX_OG_IMAGE_FETCH) {
            fetches += 1;
            item.imageUrl = await fetchArticleOgImage(item.link);
        }
        if (!item.imageUrl) {
            item.imageUrl = maritimeFallbackImage(i + item.title.length);
        }
        out.push(item);
    }
    return out;
}

function categorizeNews(title, summary) {
    const hay = `${title} ${summary}`.toLowerCase();
    if (/bunker|vlsfo|lsmgo|hsfo|fuel oil|stem/.test(hay)) return 'Bunker';
    if (/ets|carbon|cii|co2|emission|decarbon/.test(hay)) return 'Carbon';
    if (/sale|purchase|second.?hand|s\s*&\s*p|demolition|newbuild/.test(hay)) return 'S&P';
    if (/dry bulk|bulk carrier|capesize|panamax|bdi|tonne-?mile/.test(hay)) return 'Dry Bulk';
    if (/trade|sanction|tariff|grain|container|port/.test(hay)) return 'Trade';
    return 'Trade';
}

function tagClass(category) {
    if (category === 'Carbon') return 'tag-carbon';
    if (category === 'S&P') return 'tag-sp';
    if (category === 'Dry Bulk') return 'tag-trade';
    if (category === 'Trade') return 'tag-trade';
    return '';
}

function hoursAgoFromPubDate(pubDate) {
    const t = Date.parse(pubDate);
    if (!Number.isFinite(t)) return 24;
    const h = Math.floor((Date.now() - t) / 3_600_000);
    return Math.max(1, Math.min(h, 168));
}

function normalizeNewsItem(raw) {
    const category = raw.category || 'Trade';
    return {
        title: raw.title,
        link: raw.link || '',
        pubDate: raw.pubDate || '',
        source: raw.source || 'RSS',
        category,
        summary: raw.summary || '',
        tag: category,
        tagClass: tagClass(category),
        hoursAgo: hoursAgoFromPubDate(raw.pubDate),
        imageUrl: raw.imageUrl || '',
        en: {
            headline: raw.title,
            summary: raw.summary || '',
            source: raw.source || 'RSS',
        },
    };
}

async function fetchText(url) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
        const res = await fetch(url, {
            signal: ctrl.signal,
            headers: {
                'User-Agent': 'TVC-MarketFeed/1.0 (+https://thevesselcode.com)',
                Accept: 'application/rss+xml, application/xml, text/xml, */*',
            },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.text();
    } finally {
        clearTimeout(timer);
    }
}

async function fetchAllRss() {
    const merged = [];
    const errors = [];
    for (const feed of RSS_FEEDS) {
        try {
            const xml = await fetchText(feed.url);
            merged.push(...parseRss(xml, feed.source));
        } catch (e) {
            errors.push(`${feed.source}: ${e.message}`);
        }
    }
    merged.sort((a, b) => (Date.parse(b.pubDate) || 0) - (Date.parse(a.pubDate) || 0));
    const sliced = merged.slice(0, MAX_NEWS);
    const withImages = await enrichNewsImages(sliced);
    return { items: withImages.map(normalizeNewsItem), errors };
}

function buildIndices(baseline, overrides, seed) {
    const idx = baseline.indices || {};
    const over = overrides?.indices || {};
    const keys = ['bdi', 'capesizeTc', 'panamaxTc', 'bdti', 'bcti', 'scfi'];
    const out = {};
    for (const key of keys) {
        const b = idx[key] || {};
        const o = over[key] || {};
        if (o.value != null) {
            out[key] = {
                value: o.value,
                deltaPct: o.deltaPct ?? 0,
                unit: o.unit || b.unit,
            };
        } else {
            const jitter = b.jitter || 0;
            out[key] = {
                value: b.base + (jitter ? seed % jitter : 0),
                deltaPct: pseudoDelta(seed, b.salt || key.length),
                unit: b.unit,
            };
        }
    }
    return out;
}

function buildBunkerQuotes(bunker, seed) {
    const hubs = bunker.hubs || [];
    const grades = bunker.grades || [];
    const base = bunker.basePricesUsdMt || {};
    const quotes = [];
    hubs.forEach((port, pi) => {
        grades.forEach((grade, gi) => {
            const anchor = base[port]?.[grade.key] ?? 500;
            const deltaPct = pseudoDelta(seed, pi * 17 + gi * 31 + grade.key.length);
            quotes.push({
                port,
                gradeKey: grade.key,
                gradeLabel: grade.label,
                fuel: grade.fuel,
                defaultDensity: grade.defaultDensity,
                priceUsdMt: Math.round(anchor * (1 + deltaPct / 100) * 100) / 100,
                deltaPct,
            });
        });
    });
    return quotes;
}

function buildFeed({ rssItems, rssErrors, previous }) {
    const baseline = readJson(BASELINE_PATH);
    if (!baseline) throw new Error('Missing data/market-indices.json');

    const overrides = readJson(OVERRIDES_PATH, {});
    const asOf = overrides.benchmarkAsOf || new Date().toISOString().slice(0, 10);
    const seed = daySeed(new Date(`${asOf}T12:00:00Z`));

    const bunker = clone(baseline.bunker);
    bunker.basePricesUsdMt = deepMergePrices(
        bunker.basePricesUsdMt,
        overrides.bunker?.basePricesUsdMt,
    );
    bunker.quotes = buildBunkerQuotes(bunker, seed);

    const indices = buildIndices(baseline, overrides, seed);

    let news = rssItems;
    let fetchStatus = 'ok';
    if (!news.length && rssErrors.length) {
        fetchStatus = 'rss-failed';
        news = previous?.news?.length ? previous.news : baseline.news || [];
    } else if (rssErrors.length) {
        fetchStatus = 'partial';
    }

    return {
        meta: {
            generatedAt: new Date().toISOString(),
            benchmarkAsOf: asOf,
            fetchStatus,
            rssErrors: rssErrors.length ? rssErrors : undefined,
            source: 'TVC Market Desk · RSS aggregation',
            updatedLabelEn: `Market benchmark as of ${asOf}`,
            updatedLabelKo: `${asOf} 기준 시장 벤치마크`,
        },
        bunker,
        indices,
        news,
    };
}

function writeFeed(feed) {
    const payload = `${JSON.stringify(feed, null, 2)}\n`;
    mkdirSync(dirname(OUT_PATH), { recursive: true });
    writeFileSync(OUT_PATH, payload, 'utf8');
    const devMirror = join(ROOT, 'data/market-feed.json');
    mkdirSync(dirname(devMirror), { recursive: true });
    writeFileSync(devMirror, payload, 'utf8');
}

async function main() {
    const previous = readJson(OUT_PATH);
    let rssItems = [];
    let rssErrors = [];

    if (!OFFLINE) {
        try {
            const rss = await fetchAllRss();
            rssItems = rss.items;
            rssErrors = rss.errors;
        } catch (e) {
            rssErrors = [String(e.message || e)];
        }
    } else {
        rssErrors = ['offline mode'];
    }

    try {
        const feed = buildFeed({ rssItems, rssErrors, previous });
        writeFeed(feed);
        console.log('OK market-feed.json', feed.meta.fetchStatus, `news=${feed.news.length}`, OUT_PATH);
        return 0;
    } catch (e) {
        console.warn('WARN fetch-market-feed failed', e.message || e);
        if (previous) {
            previous.meta = {
                ...previous.meta,
                fetchStatus: 'cached',
                generatedAt: new Date().toISOString(),
                cacheNote: 'Served from last good market-feed.json',
            };
            writeFeed(previous);
            console.log('OK kept cached market-feed.json');
            return 0;
        }
        const feed = buildFeed({ rssItems: [], rssErrors: ['baseline'], previous: null });
        writeFeed(feed);
        console.log('OK wrote baseline market-feed.json');
        return 0;
    }
}

main()
    .then((code) => {
        if (BUILD_MODE && code !== 0) process.exit(0);
        process.exit(code);
    })
    .catch((e) => {
        console.error(e);
        process.exit(BUILD_MODE ? 0 : 1);
    });
