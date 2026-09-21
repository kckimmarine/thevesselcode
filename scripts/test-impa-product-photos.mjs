#!/usr/bin/env node
/**
 * Product photo registry + plate URL resolver smoke tests.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const root = process.cwd();
const require = createRequire(import.meta.url);

const HIGH_INTENT = [
    '231016', '790669', '790228', '812101', '617425', '331197', '190123', '614273',
];
const ALL_REGISTERED = [...HIGH_INTENT, '591150'];

const { resolvePlateAssetUrl, deriveCatalogPlateUrlFromItem } = require('../api/_lib/plateAssetUrl.js');
const impaSeo = require('../api/_lib/impaSeo.js');
const { getProductPhotoForCode, DEFAULT_DISCLAIMER } = require('../api/_lib/impaProductPhotos.js');

const index = JSON.parse(readFileSync(join(root, 'public/data/impa-product-photos.json'), 'utf8'));

const results = [];
function check(name, ok, detail = '') {
    results.push({ name, ok, detail });
    console.log(ok ? 'OK' : 'FAIL', name, detail ? `— ${detail}` : '');
}

check(
    'legacy plate id strips .jpg',
    resolvePlateAssetUrl('61-471-01.jpg') === '/data/plates/61-471-01.webp',
    resolvePlateAssetUrl('61-471-01.jpg'),
);

check('index version 2', index.version === 2, String(index.version));

for (const code of ALL_REGISTERED) {
    const product = getProductPhotoForCode(code);
    check(`${code} product photo registered`, !!product?.url, product?.url || '');
    check(
        `${code} webp on disk`,
        existsSync(join(root, 'public', 'data', 'product-photos', `${code}.webp`)),
    );
    const meta = index.photos?.[code];
    check(`${code} has source_url`, !!meta?.source_url);
    check(`${code} has license`, !!meta?.license);
    check(`${code} has disclaimer`, String(meta?.disclaimer || '').includes('Reference photo'));
    check(`${code} photo_url path`, meta?.photo_url === `/data/product-photos/${code}.webp`);

    const item = impaSeo.getItemByCode(code);
    if (!item) {
        check(`${code} catalog lookup`, false, 'missing item');
        continue;
    }
    const html = impaSeo.buildStoreItemHtml(item, { origin: 'https://www.thevesselcode.com' });
    check(`${code} html product photo path`, html.includes(`/data/product-photos/${code}.webp`));
    check(`${code} html product aria`, html.includes('aria-label="Product reference photo"'));
    check(`${code} html license badge`, html.includes('impa-photo-license-badge'));
    check(`${code} html disclaimer`, html.includes('impa-product-photo-disclaimer'));

    const hero = impaSeo.resolveStoreHeroImage(item);
    check(`${code} hero kind product`, hero.kind === 'product');
}

check('default disclaimer constant', DEFAULT_DISCLAIMER.includes('maritime supply'));

const failed = results.filter(r => !r.ok);
if (failed.length) {
    console.error('\nFailed:', failed.length);
    process.exit(1);
}
console.log('\nAll', results.length, 'checks passed.');
