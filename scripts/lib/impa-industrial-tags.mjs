/**
 * Parse IMPA description text into land–marine cross-reference tags.
 * Used by scripts/enrich-impa-industrial-tags.mjs and search regression tests.
 */

export const ITEM_TYPES = [
  'Globe Valve',
  'Gate Valve',
  'Check Valve',
  'Angle Valve',
  'Butterfly Valve',
  'Ball Valve',
  'Flange',
  'Gasket',
  'Coupling',
];

const STANDARD_RE = /\b(JIS|DIN|ANSI|ASME|ISO)\b/gi;

const PRESSURE_PATTERNS = [
  { re: /\b(\d+)\s*KGF\s*\/\s*CM2\b/i, fmt: (m) => `${m[1]}K` },
  { re: /\b(\d+)\s*KG\b(?!\s*\/)/i, fmt: (m) => `${m[1]}K` },
  { re: /\b(5|10|16|20)\s*K\b/i, fmt: (m) => `${m[1]}K` },
  { re: /\b(150|300)\s*LB\b/i, fmt: (m) => `${m[1]}LB` },
  { re: /\bPN\s*(10|16|25|40)\b/i, fmt: (m) => `PN${m[1]}` },
];

const SIZE_A_RE = /\b(\d+(?:\.\d+)?)\s*A\b/i;
const SIZE_B_RE = /\b(\d+(?:\.\d+)?)\s*B\b/i;
const SIZE_INCH_RE = /\b(\d+(?:\.\d+)?)\s*(?:INCH|IN\.?|"|\")\b/i;
const SIZE_MM_TRAIL_RE = /,\s*(\d+(?:\.\d+)?)\s*MM\b/i;
const SIZE_MM_GENERIC_RE = /\b(\d+(?:\.\d+)?)\s*MM\b/i;

function uniqPush(arr, value) {
  const v = String(value || '').trim();
  if (!v) return;
  const key = v.toLowerCase();
  if (arr.some((x) => x.toLowerCase() === key)) return;
  arr.push(v);
}

function extractStandards(text, tags) {
  for (const m of text.matchAll(STANDARD_RE)) {
    uniqPush(tags, m[1].toUpperCase());
  }
}

function extractPressure(text, tags) {
  for (const { re, fmt } of PRESSURE_PATTERNS) {
    const m = re.exec(text);
    if (m) uniqPush(tags, fmt(m));
  }
}

function extractItemType(text, tags) {
  const lower = text.toLowerCase();
  for (const t of ITEM_TYPES) {
    if (lower.includes(t.toLowerCase())) uniqPush(tags, t);
  }
}

function mmToNominalA(mm) {
  const n = Number(mm);
  if (!Number.isFinite(n) || n <= 0) return '';
  const table = [
    [15, '15A'],
    [20, '20A'],
    [25, '25A'],
    [32, '32A'],
    [40, '40A'],
    [50, '50A'],
    [65, '65A'],
    [80, '80A'],
    [100, '100A'],
    [125, '125A'],
    [150, '150A'],
    [200, '200A'],
    [250, '250A'],
    [300, '300A'],
    [350, '350A'],
    [400, '400A'],
    [450, '450A'],
    [500, '500A'],
  ];
  let best = '';
  let bestDiff = Infinity;
  for (const [val, label] of table) {
    const diff = Math.abs(val - n);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = label;
    }
  }
  return bestDiff <= 3 ? best : `${Math.round(n)}MM`;
}

function extractSizes(text, tags, { jisContext }) {
  let m = SIZE_A_RE.exec(text);
  if (m) uniqPush(tags, `${m[1]}A`);

  m = SIZE_B_RE.exec(text);
  if (m) uniqPush(tags, `${m[1]}B`);

  m = SIZE_INCH_RE.exec(text);
  if (m) uniqPush(tags, `${m[1]} inch`);

  m = SIZE_MM_TRAIL_RE.exec(text);
  if (!m) m = SIZE_MM_GENERIC_RE.exec(text);
  if (m) {
    const mm = m[1];
    uniqPush(tags, `${mm} mm`);
    if (jisContext) {
      const nominal = mmToNominalA(mm);
      if (nominal.endsWith('A')) uniqPush(tags, nominal);
    }
  }
}

/**
 * @param {string} description IMPA `n` or catalog name
 * @returns {{ industrial_tags: string[], land_compat_name: string }}
 */
export function extractIndustrialTags(description) {
  const text = String(description || '').trim();
  const tags = [];
  if (!text) {
    return { industrial_tags: [], land_compat_name: '' };
  }

  extractStandards(text, tags);
  extractPressure(text, tags);
  extractItemType(text, tags);

  const jisContext = tags.some((t) => t.toUpperCase() === 'JIS')
    || /\bJIS\s+[A-Z]\d+/i.test(text);
  extractSizes(text, tags, { jisContext });

  const type = tags.find((t) => ITEM_TYPES.includes(t)) || '';
  const standard = tags.find((t) => /^(JIS|DIN|ANSI|ASME|ISO)$/.test(t)) || '';
  const pressure = tags.find((t) => /^(5|10|16|20)K$|^PN\d+|^\d+LB$/i.test(t)) || '';
  const sizeA = tags.find((t) => /^\d+A$/i.test(t)) || '';

  const parts = [type, standard, pressure, sizeA].filter(Boolean);
  const land_compat_name = parts.join(' ').replace(/\s+/g, ' ').trim();

  return { industrial_tags: tags, land_compat_name };
}

/** Lowercase haystack for multi-token catalog search */
export function industrialSearchHaystack(item) {
  const name = String(item?.n || item?.name || '');
  const land = String(item?.land_compat_name || '');
  const tags = Array.isArray(item?.industrial_tags) ? item.industrial_tags.join(' ') : '';
  return `${name} ${land} ${tags}`.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * All query tokens must appear in haystack (order-independent).
 * @param {object[]} items
 * @param {string} query
 * @param {number} limit
 */
export function matchIndustrialSearch(items, query, { limit = 20 } = {}) {
  const tokens = String(query || '')
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9]/g, ''))
    .filter(Boolean);
  if (!tokens.length) return [];

  const hits = [];
  for (const item of items) {
    const hay = industrialSearchHaystack(item)
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ');
    if (tokens.every((tok) => hay.includes(tok))) hits.push(item);
    if (hits.length >= limit) break;
  }
  return hits;
}
