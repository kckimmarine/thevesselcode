#!/usr/bin/env node
/**
 * Product photo registry + plate URL resolver smoke tests.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const root = process.cwd();
const require = createRequire(import.meta.url);

const { resolvePlateAssetUrl, deriveCatalogPlateUrlFromItem } = require('../api/_lib/plateAssetUrl.js');
const impaSeo = require('../api/_lib/impaSeo.js');
const { getProductPhotoForCode } = require('../api/_lib/impaProductPhotos.js');

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

check(
    'derive item plate url',
    deriveCatalogPlateUrlFromItem({ impa_code: '591150', plate_id: '61-471-01.jpg' })
        === '/data/plates/61-471-01.webp',
);

const product591 = getProductPhotoForCode('591150');
check('591150 product photo registered', !!product591?.url, product591?.url || '');
check(
    '591150 webp on disk',
    existsSync(join(root, 'public', 'data', 'product-photos', '591150.webp')),
);

const item591 = impaSeo.getItemByCode('591150');
const html591 = impaSeo.buildStoreItemHtml(item591, { origin: 'https://www.thevesselcode.com' });
check('591150 html uses product photo path', html591.includes('/data/product-photos/591150.webp'));
check('591150 html product aria', html591.includes('aria-label="Product reference photo"'));
check('591150 html photo credit', html591.includes('impa-product-photo-credit'));

const hero = impaSeo.resolveStoreHeroImage(item591);
check('591150 hero kind product', hero.kind === 'product');

const failed = results.filter(r => !r.ok);
if (failed.length) {
    console.error('\nFailed:', failed.length);
    process.exit(1);
}
console.log('\nAll', results.length, 'checks passed.');
