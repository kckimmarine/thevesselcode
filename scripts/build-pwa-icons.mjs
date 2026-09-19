#!/usr/bin/env node
/**
 * Generate PWA icons (192/512) from icons/company-logo.png (official atom mark).
 * Output: public/assets/icons/ (mirrored to assets/ via sync-public-assets)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'icons', 'company-logo.png');
const OUT_DIR = path.join(ROOT, 'public', 'assets', 'icons');
const BG = '#111111';

async function writeIcon(size) {
    const pad = Math.round(size * 0.08);
    const inner = size - pad * 2;
    const buf = await sharp(SRC)
        .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .extend({
            top: pad,
            bottom: pad,
            left: pad,
            right: pad,
            background: BG,
        })
        .png()
        .toBuffer();
    const outPath = path.join(OUT_DIR, `icon-${size}.png`);
    fs.writeFileSync(outPath, buf);
    console.log(`OK ${path.relative(ROOT, outPath)} (${buf.length} bytes)`);
}

async function main() {
    if (!fs.existsSync(SRC)) {
        console.error('Missing', SRC);
        process.exit(1);
    }
    fs.mkdirSync(OUT_DIR, { recursive: true });
    await writeIcon(192);
    await writeIcon(512);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
