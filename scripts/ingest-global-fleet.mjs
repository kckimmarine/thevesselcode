#!/usr/bin/env node
/**
 * Global merchant fleet ingestion — open registers → chunked JSON + search index.
 *
 * Usage:
 *   node scripts/ingest-global-fleet.mjs
 *   FLEET_SKIP_DOWNLOAD=1 node scripts/ingest-global-fleet.mjs  # rebuild from cache only
 *
 * Output: public/data/fleet/
 */
import {
    mkdirSync,
    writeFileSync,
    readFileSync,
    existsSync,
    rmSync,
    cpSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { digitsOnlyImo, isValidImoNumber, imoPartitionKey } from './lib/imo-checksum.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'data', 'fleet');
const CACHE_DIR = join(ROOT, 'data', 'fleet-cache');

const DEFAULT_SOURCES = [
    {
        id: 'warrantgroup-imo-codes',
        url: 'https://raw.githubusercontent.com/warrantgroup/IMO-Vessel-Codes/master/data/imo-vessel-codes.csv',
        kind: 'warrant-csv',
    },
    {
        id: 'seafarer-ships',
        url: 'https://seafarerindex.com/api/data/ships',
        kind: 'seafarer-ships',
    },
    {
        id: 'seafarer-companies',
        url: 'https://seafarerindex.com/api/data/companies',
        kind: 'seafarer-companies',
    },
];

const EXCLUDED_TYPE_RE =
    /navigation aid|fishing|pleasure|yacht|sailing|tug\b|pilot\b|dredger|research|military|warfare|barge\b|floating storage|unknown/i;

const MERCHANT_TYPE_HINT =
    /tanker|cargo|container|bulk|carrier|passenger|ro-?ro|lng|lpg|chemical|oil|products|gas|offshore supply|heavy load/i;

/** @typedef {{ i: string, n: string, t: string, d: number, y: number, f: string, m: string, e: string }} CompactVessel */

function normalizeName(name) {
    return String(name || '')
        .trim()
        .replace(/\s+/g, ' ')
        .toUpperCase();
}

function normalizeSearchName(name) {
    return normalizeName(name)
        .normalize('NFKC')
        .replace(/[^A-Z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function normalizeType(type) {
    const t = String(type || '').trim();
    if (!t) return 'Merchant Vessel';
    return t.replace(/\s+/g, ' ');
}

function normalizeFlag(flag) {
    return String(flag || '').trim() || '—';
}

function richnessScore(v) {
    let s = 0;
    if (v.n) s += 2;
    if (v.t && v.t !== 'Merchant Vessel') s += 1;
    if (v.d > 0) s += 2;
    if (v.y > 0) s += 2;
    if (v.f && v.f !== '—') s += 1;
    if (v.m) s += 2;
    if (v.e) s += 1;
    return s;
}

function toCompact(row) {
    return {
        i: row.i,
        n: row.n,
        t: row.t,
        d: Number(row.d) || 0,
        y: Number(row.y) || 0,
        f: row.f,
        m: row.m || '',
        e: row.e || '',
    };
}

function isMerchantCandidate(v) {
    const type = v.t || '';
    if (EXCLUDED_TYPE_RE.test(type)) return false;
    if (MERCHANT_TYPE_HINT.test(type)) return true;
    if (v.d >= 1000) return true;
    if (v.y > 0 && type) return true;
    return Boolean(v.n);
}

async function fetchText(url, cachePath) {
    if (process.env.FLEET_SKIP_DOWNLOAD === '1' && existsSync(cachePath)) {
        return readFileSync(cachePath, 'utf8');
    }
    mkdirSync(dirname(cachePath), { recursive: true });
    const res = await fetch(url, {
        headers: { 'User-Agent': 'TVC-Fleet-Ingest/1.0 (+https://thevesselcode.com)' },
    });
    if (!res.ok) throw new Error(`fetch failed ${url}: ${res.status}`);
    const text = await res.text();
    writeFileSync(cachePath, text, 'utf8');
    return text;
}

async function fetchJson(url, cachePath) {
    const text = await fetchText(url, cachePath);
    return JSON.parse(text);
}

function parseWarrantCsv(csvText) {
    const lines = csvText.split(/\r?\n/);
    const out = [];
    for (let li = 1; li < lines.length; li++) {
        const line = lines[li];
        if (!line?.trim()) continue;
        const cols = parseCsvLine(line);
        if (cols.length < 5) continue;
        const imo = digitsOnlyImo(cols[0]);
        if (!isValidImoNumber(imo)) continue;
        const name = normalizeName(cols[2]?.replace(/^"|"$/g, '') || cols[2]);
        if (!name || name.length < 2) continue;
        if (/[!@#$%^*=]/.test(name)) continue;
        const flag = normalizeFlag(cols[3]);
        const type = normalizeType(cols[4]);
        out.push({
            i: imo,
            n: name,
            t: type,
            d: 0,
            y: 0,
            f: flag,
            m: '',
            e: '',
        });
    }
    return out;
}

function parseCsvLine(line) {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            inQuotes = !inQuotes;
            continue;
        }
        if (ch === ',' && !inQuotes) {
            result.push(cur);
            cur = '';
            continue;
        }
        cur += ch;
    }
    result.push(cur);
    return result;
}

function mergeVessel(into, incoming) {
    const base = { ...into };
    const inc = { ...incoming };
    const pick = (a, b) => (b && String(b).trim() ? b : a);
    base.n = pick(base.n, inc.n);
    base.t = pick(base.t, inc.t);
    base.f = pick(base.f, inc.f);
    base.m = pick(base.m, inc.m);
    base.e = pick(base.e, inc.e);
    if (!base.d && inc.d) base.d = inc.d;
    if (!base.y && inc.y) base.y = inc.y;
    return base;
}

function applySeafarerShips(ships, companiesBySlug) {
    const out = [];
    for (const s of ships) {
        const imo = digitsOnlyImo(s.imo);
        if (!isValidImoNumber(imo)) continue;
        const manager = companiesBySlug.get(s.manager_slug)?.name || companiesBySlug.get(s.owner_slug)?.name || '';
        const engineBits = [s.builder, s.classification_society].filter(Boolean).join(' · ');
        out.push({
            i: imo,
            n: normalizeName(s.name),
            t: normalizeType(s.type),
            d: Number(s.dwt) || 0,
            y: Number(s.year_built) || 0,
            f: normalizeFlag(s.flag_iso3 || s.flag || ''),
            m: manager,
            e: engineBits,
        });
    }
    return out;
}

function loadLocalEnrichment() {
    const path = join(ROOT, 'data', 'fleet-enrichment.json');
    if (!existsSync(path)) return [];
    const data = JSON.parse(readFileSync(path, 'utf8'));
    const list = Array.isArray(data) ? data : data.vessels || [];
    return list.map((v) => ({
        i: digitsOnlyImo(v.imo || v.i),
        n: normalizeName(v.name || v.n),
        t: normalizeType(v.type || v.t),
        d: Number(v.dwt ?? v.d) || 0,
        y: Number(v.built_year ?? v.y) || 0,
        f: normalizeFlag(v.flag || v.f),
        m: String(v.technical_manager || v.m || '').trim(),
        e: String(v.engine_model || v.e || '').trim(),
    })).filter((v) => isValidImoNumber(v.i));
}

function loadSampleRegistry() {
    const path = join(ROOT, 'data', 'vessel-registry-sample.json');
    if (!existsSync(path)) return [];
    const data = JSON.parse(readFileSync(path, 'utf8'));
    const list = data.vessels || [];
    return list.map((v) => ({
        i: digitsOnlyImo(v.imo),
        n: normalizeName(v.name),
        t: normalizeType(v.type),
        d: Number(String(v.dwt).replace(/[^\d]/g, '')) || 0,
        y: Number(v.built_year) || 0,
        f: normalizeFlag(v.flag),
        m: String(v.technical_manager || '').trim(),
        e: String(v.engine_model || '').trim(),
    })).filter((v) => isValidImoNumber(v.i));
}

function dedupeBest(records) {
    const byImo = new Map();
    for (const rec of records) {
        if (!isValidImoNumber(rec.i)) continue;
        if (!isMerchantCandidate(rec)) continue;
        const prev = byImo.get(rec.i);
        if (!prev) {
            byImo.set(rec.i, rec);
        } else {
            const winner = richnessScore(rec) >= richnessScore(prev) ? rec : prev;
            const loser = winner === rec ? prev : rec;
            byImo.set(rec.i, mergeVessel(winner, loser));
        }
    }
    return [...byImo.values()];
}

function buildLetterIndex(vessels) {
    /** @type {Record<string, Array<{ i: string, n: string, s: string }>>} */
    const buckets = {};
    for (const v of vessels) {
        const search = normalizeSearchName(v.n);
        const bucketKey = (search[0] && /[a-z0-9]/.test(search[0]) ? search[0] : '_');
        if (!buckets[bucketKey]) buckets[bucketKey] = [];
        buckets[bucketKey].push({ i: v.i, n: v.n, s: search });
    }
    for (const key of Object.keys(buckets)) {
        buckets[key].sort((a, b) => a.s.localeCompare(b.s) || a.i.localeCompare(b.i));
    }
    return buckets;
}

function buildTokenIndex(vessels) {
    /** @type {Map<string, Set<string>>} */
    const tokens = new Map();
    for (const v of vessels) {
        const search = normalizeSearchName(v.n);
        const parts = search.split(/\s+/).filter((p) => p.length >= 3);
        for (const part of parts) {
            if (!tokens.has(part)) tokens.set(part, new Set());
            tokens.get(part).add(v.i);
        }
        const words = search.split(/\s+/).filter(Boolean);
        for (let wi = 0; wi < words.length - 1; wi++) {
            const pair = `${words[wi]} ${words[wi + 1]}`;
            if (pair.length >= 3) {
                if (!tokens.has(pair)) tokens.set(pair, new Set());
                tokens.get(pair).add(v.i);
            }
        }
        if (search.length >= 3) {
            const prefix = search.slice(0, Math.min(8, search.length));
            if (!tokens.has(prefix)) tokens.set(prefix, new Set());
            tokens.get(prefix).add(v.i);
        }
    }
    const out = {};
    for (const [tok, imoSet] of tokens.entries()) {
        if (imoSet.size > 800) continue;
        out[tok] = [...imoSet];
    }
    return out;
}

function partitionChunks(vessels) {
    /** @type {Record<string, CompactVessel[]>} */
    const chunks = {};
    for (const v of vessels) {
        const key = imoPartitionKey(v.i);
        if (!chunks[key]) chunks[key] = [];
        chunks[key].push(toCompact(v));
    }
    for (const key of Object.keys(chunks)) {
        chunks[key].sort((a, b) => a.i.localeCompare(b.i));
    }
    return chunks;
}

async function main() {
    mkdirSync(OUT_DIR, { recursive: true });
    mkdirSync(CACHE_DIR, { recursive: true });

    const sources = DEFAULT_SOURCES;
    let merged = [];

    for (const src of sources) {
        const cachePath = join(CACHE_DIR, `${src.id}.dat`);
        console.log('SOURCE', src.id, src.url);
        if (src.kind === 'warrant-csv') {
            const csv = await fetchText(src.url, cachePath);
            const rows = parseWarrantCsv(csv);
            console.log('  parsed', rows.length, 'rows');
            merged = merged.concat(rows);
        } else if (src.kind === 'seafarer-ships') {
            const ships = await fetchJson(src.url, cachePath);
            const companiesPath = join(CACHE_DIR, 'seafarer-companies.dat');
            const companies = existsSync(companiesPath)
                ? JSON.parse(readFileSync(companiesPath, 'utf8'))
                : [];
            const companiesBySlug = new Map((companies || []).map((c) => [c.slug, c]));
            const rows = applySeafarerShips(ships, companiesBySlug);
            console.log('  enriched', rows.length, 'ships');
            merged = merged.concat(rows);
        } else if (src.kind === 'seafarer-companies') {
            await fetchJson(src.url, cachePath);
            console.log('  cached companies');
        }
    }

    merged = merged.concat(loadLocalEnrichment(), loadSampleRegistry());
    let vessels = dedupeBest(merged);
    const overlay = [...loadLocalEnrichment(), ...loadSampleRegistry()];
    const byImo = new Map(vessels.map((v) => [v.i, v]));
    for (const row of overlay) {
        if (!isValidImoNumber(row.i)) continue;
        const prev = byImo.get(row.i);
        if (!prev) byImo.set(row.i, row);
        else {
            const merged = mergeVessel(prev, row);
            if (row.n) merged.n = row.n;
            if (row.m) merged.m = row.m;
            if (row.e) merged.e = row.e;
            if (row.d) merged.d = row.d;
            if (row.y) merged.y = row.y;
            if (row.t) merged.t = row.t;
            if (row.f) merged.f = row.f;
            byImo.set(row.i, merged);
        }
    }
    vessels = [...byImo.values()];
    console.log('MERCHANT vessels after dedupe:', vessels.length);

    if (vessels.length < 1000) {
        console.error('FAIL: fleet count too low — check network sources');
        process.exit(1);
    }

    rmSync(OUT_DIR, { recursive: true, force: true });
    mkdirSync(OUT_DIR, { recursive: true });

    const chunks = partitionChunks(vessels);
    const imoMap = {};
    const chunkMeta = {};

    for (const [key, list] of Object.entries(chunks)) {
        const fileName = `fleet-${key}.json`;
        const rel = `/data/fleet/${fileName}`;
        writeFileSync(join(OUT_DIR, fileName), JSON.stringify({ v: 1, p: key, n: list.length, ships: list }));
        chunkMeta[key] = { file: rel, count: list.length };
        for (const ship of list) {
            imoMap[ship.i] = key;
        }
    }

    const letterBuckets = buildLetterIndex(vessels);
    const letterMeta = {};
    for (const [letter, items] of Object.entries(letterBuckets)) {
        const fileName = `fleet-idx-${letter}.json`;
        const rel = `/data/fleet/${fileName}`;
        writeFileSync(join(OUT_DIR, fileName), JSON.stringify({ v: 1, letter, n: items.length, items }));
        letterMeta[letter] = { file: rel, count: items.length };
    }

    const tokenIndex = buildTokenIndex(vessels);
    writeFileSync(join(OUT_DIR, 'fleet-tokens.json'), JSON.stringify({ v: 1, n: Object.keys(tokenIndex).length, tokens: tokenIndex }));

    const fleetIndex = {
        v: 1,
        generated: new Date().toISOString(),
        count: vessels.length,
        partition: 'imo2',
        fields: { i: 'imo', n: 'name', t: 'type', d: 'dwt', y: 'yearBuilt', f: 'flag', m: 'manager', e: 'engine' },
        chunks: chunkMeta,
        imo: imoMap,
        nameIndex: letterMeta,
        tokensFile: '/data/fleet/fleet-tokens.json',
    };

    writeFileSync(join(OUT_DIR, 'fleet-index.json'), JSON.stringify(fleetIndex));

    console.log('OK chunks', Object.keys(chunks).length);
    console.log('OK name index buckets', Object.keys(letterBuckets).length);
    const devMirror = join(ROOT, 'data', 'fleet');
    cpSync(OUT_DIR, devMirror, { recursive: true });
    console.log('OK fleet-index.json', vessels.length, 'vessels →', OUT_DIR);
    console.log('OK mirrored →', devMirror, '(local npm start /data/fleet)');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
