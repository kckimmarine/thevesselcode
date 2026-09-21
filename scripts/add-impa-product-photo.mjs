#!/usr/bin/env node
/**
 * Download a land/industrial reference photo and register it for an IMPA code.
 *
 * Example (Wikimedia Commons):
 *   node scripts/add-impa-product-photo.mjs \
 *     --code=591150 \
 *     --url='https://upload.wikimedia.org/wikipedia/commons/d/de/4-8_indent_crimping_tool_.jpg' \
 *     --credit='Wikimedia Commons contributor' \
 *     --license='CC BY-SA 4.0' \
 *     --source-page='https://commons.wikimedia.org/wiki/File:4-8_indent_crimping_tool_.jpg'
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const OUT_DIR = join(ROOT, 'public', 'data', 'product-photos');
const INDEX_PATH = join(ROOT, 'public', 'data', 'impa-product-photos.json');
const MAX_WIDTH = 1200;
const WEBP_QUALITY = 82;

function parseArgs(argv) {
    const out = {};
    argv.forEach((arg) => {
        const m = /^--([^=]+)=(.*)$/.exec(arg);
        if (m) out[m[1]] = m[2];
    });
    return out;
}

function normalizeCode(value) {
    return String(value || '').replace(/\D/g, '').padStart(6, '0').slice(-6);
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const code = normalizeCode(args.code);
    if (!code || code === '000000') {
        console.error('Missing or invalid --code=######');
        process.exit(1);
    }
    const url = String(args.url || '').trim();
    if (!url) {
        console.error('Missing --url=...');
        process.exit(1);
    }

    mkdirSync(OUT_DIR, { recursive: true });
    const outFile = `${code}.webp`;
    const outPath = join(OUT_DIR, outFile);

    const res = await fetch(url, { headers: { 'User-Agent': 'TVC-IMPA-Photo/1.0' } });
    if (!res.ok) throw new Error(`Download failed HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());

    await sharp(buf)
        .rotate()
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toFile(outPath);

    let index = { version: 1, photos: {} };
    if (existsSync(INDEX_PATH)) {
        index = JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
        if (!index.photos || typeof index.photos !== 'object') index.photos = {};
    }

    index.photos[code] = {
        file: outFile,
        credit: String(args.credit || '').trim(),
        license: String(args.license || '').trim(),
        source_page: String(args['source-page'] || args.source_page || url).trim(),
        fetched_at: new Date().toISOString(),
    };

    writeFileSync(INDEX_PATH, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
    console.log('OK', code, '→', outPath);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
