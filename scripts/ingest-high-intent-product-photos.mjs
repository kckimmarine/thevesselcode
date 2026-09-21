#!/usr/bin/env node
/**
 * Batch-ingest high-intent IMPA product photos from scripts/data/high-intent-product-photos-manifest.json
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = join(ROOT, 'scripts', 'data', 'high-intent-product-photos-manifest.json');
const OUT_DIR = join(ROOT, 'public', 'data', 'product-photos');
const INDEX_PATH = join(ROOT, 'public', 'data', 'impa-product-photos.json');
const MAX_WIDTH = 1200;
const WEBP_QUALITY = 82;
const PHOTO_BASE = '/data/product-photos';
const DEFAULT_DISCLAIMER =
    'Reference photo for industrial/commercial specification. Actual maritime supply brand/finish may vary.';

function normalizeCode(value) {
    return String(value || '').replace(/\D/g, '').padStart(6, '0').slice(-6);
}

function buildEntry(code, file, row) {
    const photoUrl = `${PHOTO_BASE}/${file}`;
    return {
        file,
        photo_url: photoUrl,
        source_name: String(row.source_name || '').trim(),
        source_url: String(row.source_url || '').trim(),
        license: String(row.license || '').trim(),
        disclaimer: String(row.disclaimer || DEFAULT_DISCLAIMER).trim(),
        credit: String(row.source_name || row.credit || '').trim(),
        source_page: String(row.source_url || row.source_page || '').trim(),
        fetched_at: new Date().toISOString(),
    };
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function downloadWebp(code, url) {
    const outFile = `${code}.webp`;
    const outPath = join(OUT_DIR, outFile);
    let res;
    for (let attempt = 0; attempt < 5; attempt += 1) {
        res = await fetch(url, { headers: { 'User-Agent': 'TVC-IMPA-Photo/1.0' } });
        if (res.status !== 429) break;
        await sleep(2000 * (attempt + 1));
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${code}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await sharp(buf)
        .rotate()
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toFile(outPath);
    return outFile;
}

async function main() {
    const rows = JSON.parse(readFileSync(MANIFEST, 'utf8'));
    mkdirSync(OUT_DIR, { recursive: true });

    let index = { version: 2, photos: {} };
    if (existsSync(INDEX_PATH)) {
        index = JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
        if (!index.photos || typeof index.photos !== 'object') index.photos = {};
    }
    index.version = 2;

    for (const row of rows) {
        const code = normalizeCode(row.code);
        const url = String(row.url || '').trim();
        if (!code || !url) continue;
        const file = await downloadWebp(code, url);
        index.photos[code] = buildEntry(code, file, row);
        console.log('OK', code, '→', file);
        await sleep(1200);
    }

    writeFileSync(INDEX_PATH, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
    console.log('Updated', INDEX_PATH);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
