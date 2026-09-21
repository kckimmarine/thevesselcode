#!/usr/bin/env node
/**
 * Batch-ingest IMPA product photos from a JSON manifest.
 *
 *   node scripts/ingest-high-intent-product-photos.mjs
 *   node scripts/ingest-high-intent-product-photos.mjs --manifest=scripts/data/batch2-product-photos-manifest.json
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifestArg = process.argv.find((a) => a.startsWith('--manifest='));
const MANIFEST = manifestArg
    ? join(ROOT, manifestArg.slice('--manifest='.length))
    : join(ROOT, 'scripts', 'data', 'high-intent-product-photos-manifest.json');
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

async function downloadWebp(code, url, outFile) {
    const fileName = String(outFile || `${code}.webp`).trim();
    const outPath = join(OUT_DIR, fileName);
    let res;
    for (let attempt = 0; attempt < 5; attempt += 1) {
        res = await fetch(url, { headers: { 'User-Agent': 'TVC-IMPA-Photo/1.0' } });
        if (res.status !== 429) break;
        await sleep(4000 * (attempt + 1));
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${code} (${url})`);
    const buf = Buffer.from(await res.arrayBuffer());
    await sharp(buf)
        .rotate()
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toFile(outPath);
    return fileName;
}

async function main() {
    if (!existsSync(MANIFEST)) {
        console.error('Manifest not found:', MANIFEST);
        process.exit(1);
    }
    console.log('Manifest:', MANIFEST);
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
        const outFile = String(row.file || `${code}.webp`).trim();
        const outPath = join(OUT_DIR, outFile);
        let file = outFile;
        const reuseFrom = normalizeCode(row.reuse_from || row.reuseFrom || '');
        if (existsSync(outPath)) {
            console.log('SKIP on disk', code, '→', outFile);
        } else if (reuseFrom) {
            const srcFile = String(index.photos[reuseFrom]?.file || row.reuse_file || `photo_${reuseFrom}.webp`).trim();
            const srcPath = join(OUT_DIR, srcFile);
            if (existsSync(srcPath)) {
                copyFileSync(srcPath, outPath);
                console.log('COPY', reuseFrom, '→', code, outFile);
            } else {
                file = await downloadWebp(code, url, outFile);
                console.log('OK', code, '→', file);
                await sleep(3500);
            }
        } else {
            file = await downloadWebp(code, url, outFile);
            console.log('OK', code, '→', file);
            await sleep(3500);
        }
        index.photos[code] = buildEntry(code, file, row);
    }

    writeFileSync(INDEX_PATH, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
    console.log('Updated', INDEX_PATH);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
