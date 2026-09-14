/**
 * Berth Marine scrape rows → TVC compact catalog schema.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeImpaCode } from './impa-quality-gate.mjs';

const UNIT_TAIL_RE = /\s[-–]\s*(PCS|PC|SET|SETS|ROL|ROLL|ROLLS|MTR|METER|METERS|KG|KGS|LTR|L|BOX|BOXES|SHT|SHEET|LOT|LOTS|EA|EACH|M)\s*$/i;

export function parseUnitFromBerthName(name) {
  const m = String(name || '').match(UNIT_TAIL_RE);
  if (!m) return 'PCS';
  const token = m[1].toUpperCase();
  const map = { PC: 'PCS', EA: 'PCS', EACH: 'PCS', SETS: 'SET', ROLL: 'ROL', ROLLS: 'ROL', METER: 'MTR', METERS: 'MTR', KGS: 'KG', L: 'LTR', BOXES: 'BOX', SHEET: 'SHT', LOTS: 'LOT' };
  return map[token] || token;
}

export function cleanBerthItemName(name) {
  return String(name || '')
    .replace(UNIT_TAIL_RE, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function berthPlateRef(item) {
  const code = normalizeImpaCode(item?.impa_code);
  const key = String(item?.plate_key || code || '').replace(/[^a-zA-Z0-9._-]/g, '');
  if (!key) return '';
  return key.startsWith('berth-') ? key : `berth-${key}`;
}

export function berthPlateFileExists(plateRef, platesDir) {
  if (!plateRef || !platesDir) return false;
  const safe = plateRef.replace(/[^a-zA-Z0-9._-]/g, '');
  return existsSync(join(platesDir, `${safe}.webp`)) || existsSync(join(platesDir, `${safe}.jpg`));
}

export function berthItemToCompact(item) {
  const code = normalizeImpaCode(item?.impa_code);
  if (!code) return null;
  const rawName = String(item?.item_name || '').trim();
  const name = cleanBerthItemName(rawName) || `IMPA ${code}`;
  const g = String(item?.chapter || code.slice(0, 2)).padStart(2, '0').slice(-2);
  const category = String(item?.category || `Chapter ${g}`).trim();
  const p = berthPlateRef(item);
  return {
    c: code,
    n: name,
    u: parseUnitFromBerthName(rawName),
    g,
    p,
    category,
    specs: {
      'Catalog Section': category,
      Description: name,
      Source: 'Berth Marine',
      ...(item?.product_url ? { 'Product URL': item.product_url } : {}),
    },
  };
}
