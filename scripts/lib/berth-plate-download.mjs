/**
 * Shared Berth Marine plate download + WebP conversion.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

export const PLATE_MAX_WIDTH = 800;
export const PLATE_WEBP_QUALITY = 80;
export const BERTH_PLATE_UA = 'Mozilla/5.0 (compatible; TVC-Berth-Plate-Backfill/1.0)';

export function berthWebpPath(platesDir, item) {
  const key = String(item.plate_key || item.impa_code || '').replace(/[^a-zA-Z0-9._-]/g, '');
  const stem = key.startsWith('berth-') ? key : `berth-${key}`;
  return join(platesDir, `${stem}.webp`);
}

export function plateExists(platesDir, item) {
  const path = berthWebpPath(platesDir, item);
  return existsSync(path);
}

export async function downloadBerthPlateWebp(item, platesDir) {
  const outPath = berthWebpPath(platesDir, item);
  if (existsSync(outPath)) {
    return { ok: true, skipped: true, path: outPath };
  }
  const imageUrl = item.image_url
    || `https://www.berthmarine.com/wp-content/uploads/2022/05/${item.impa_code}.jpg`;

  const res = await fetch(imageUrl, {
    headers: { 'User-Agent': BERTH_PLATE_UA, Accept: 'image/*' },
  });

  if (res.status === 429) {
    const err = new Error('HTTP 429 rate limit');
    err.code = 'RATE_LIMIT';
    err.status = 429;
    throw err;
  }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} for ${imageUrl}`);
    err.status = res.status;
    throw err;
  }

  const buf = Buffer.from(await res.arrayBuffer());
  mkdirSync(platesDir, { recursive: true });
  await sharp(buf)
    .resize({ width: PLATE_MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: PLATE_WEBP_QUALITY })
    .toFile(outPath);

  return { ok: true, skipped: false, path: outPath };
}
