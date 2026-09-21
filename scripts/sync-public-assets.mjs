#!/usr/bin/env node
/**
 * Mirror public/assets → assets for local `npm start` (serve repo root).
 * Production build copies the same tree into dist/assets.
 */
import { cpSync, copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(ROOT, 'public', 'assets');
const dest = join(ROOT, 'assets');

if (!existsSync(src)) {
    console.warn('sync-public-assets: public/assets missing, skipping');
    process.exit(0);
}

rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
console.log('OK public/assets → assets/');

const dataDir = join(ROOT, 'data');
mkdirSync(dataDir, { recursive: true });

const dataMirrors = [
    ['public/data/fleet-ais-positions.json', 'fleet-ais-positions.json'],
    ['public/data/impa-full.json', 'impa-full.json'],
    ['public/data/impa-product-photos.json', 'impa-product-photos.json'],
    ['public/data/berth-impa-index.json', 'berth-impa-index.json'],
];

for (const [relSrc, destName] of dataMirrors) {
    const srcPath = join(ROOT, relSrc);
    if (!existsSync(srcPath)) continue;
    copyFileSync(srcPath, join(dataDir, destName));
    console.log(`OK ${relSrc} → data/${destName}`);
}

const productPhotosSrc = join(ROOT, 'public', 'data', 'product-photos');
const productPhotosDest = join(dataDir, 'product-photos');
if (existsSync(productPhotosSrc)) {
    cpSync(productPhotosSrc, productPhotosDest, { recursive: true });
    console.log('OK public/data/product-photos → data/product-photos/');
}
