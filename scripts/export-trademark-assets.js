/**
 * THE VESSEL CODE — RIPC / 특허청 상표 견본 에셋 일괄 생성
 * Usage: node scripts/export-trademark-assets.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const JSZip = require('jszip');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'dist', 'trademark-assets');
const SIZE = 2048;
const PADDING_RATIO = 0.09;
const DPI = 300;

/** Brand palette — Deep Navy & Ocean Accent */
const COLORS = {
  deepNavy: '#0c1929',
  oceanAccent: '#38bdf8',
  oceanAccentBright: '#9feaf9',
  wordmark: '#0f172a',
};

/** Atom mark geometry (from icons/atom-logo.svg) */
const ATOM_PATHS = {
  orbit1:
    'M48.578,28.615 C56.851,45.587 58.558,61.581 52.288,64.778 C45.822,68.076 33.326,56.521 24.375,38.969 C15.424,21.418 13.409,4.518 19.874,1.221 C22.689,-0.216 26.648,1.166 30.959,4.629',
  orbit2:
    'M7.64,39.45 C2.806,36.94 -0.009,33.915 0.154,30.79 C0.531,23.542 16.787,18.497 36.462,19.52 C56.137,20.544 71.781,27.249 71.404,34.497 C71.241,37.622 68.127,40.338 63.06,42.333',
  orbit3:
    'M28.828,59.354 C23.545,63.168 18.843,64.561 15.902,62.653 C9.814,58.702 13.572,42.102 24.296,25.575 C35.02,9.048 48.649,-1.149 54.736,2.803 C57.566,4.639 58.269,9.208 57.133,15.232',
  nucleus:
    'M40.363,32.075 C40.874,34.44 39.371,36.77 37.006,37.282 C34.641,37.793 32.311,36.29 31.799,33.925 C31.289,31.56 32.791,29.23 35.156,28.718 C37.521,28.207 39.851,29.71 40.363,32.075',
};

function hexPoints(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = ((60 * i - 90) * Math.PI) / 180;
    pts.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  return pts.map((p) => p.join(',')).join(' ');
}

function pickColor(mode, role) {
  if (mode === 'black') return '#000000';
  switch (role) {
    case 'shieldFill':
      return COLORS.deepNavy;
    case 'shieldStroke':
      return COLORS.oceanAccent;
    case 'atomStroke':
      return COLORS.oceanAccentBright;
    case 'atomFill':
      return COLORS.oceanAccentBright;
    case 'wordmark':
      return COLORS.wordmark;
    case 'tvcMono':
      return COLORS.oceanAccent;
    default:
      return COLORS.deepNavy;
  }
}

function symbolMarkInner(cx, cy, boxSize, mode) {
  const hexR = boxSize * 0.38;
  const hexPoly = hexPoints(cx, cy, hexR);
  const shieldFill = pickColor(mode, 'shieldFill');
  const shieldStroke = pickColor(mode, 'shieldStroke');
  const atomStroke = pickColor(mode, 'atomStroke');
  const atomFill = pickColor(mode, 'atomFill');
  const tvcFill = pickColor(mode, 'tvcMono');
  const atomScale = boxSize * 0.00455;
  const atomTy = cy - boxSize * 0.04;

  return `
  <polygon points="${hexPoly}" fill="${shieldFill}" stroke="${shieldStroke}" stroke-width="${boxSize * 0.012}" stroke-linejoin="round"/>
  <g transform="translate(${cx} ${atomTy}) scale(${atomScale}) translate(-36 -33)" fill="none" stroke="${atomStroke}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="${ATOM_PATHS.orbit1}"/>
    <path d="${ATOM_PATHS.orbit2}"/>
    <path d="${ATOM_PATHS.orbit3}"/>
  </g>
  <g transform="translate(${cx} ${atomTy}) scale(${atomScale}) translate(-36 -33)" fill="${atomFill}" stroke="none">
    <path d="${ATOM_PATHS.nucleus}"/>
  </g>
  <text x="${cx}" y="${cy + hexR * 0.52}" text-anchor="middle" font-family="Inter, 'Helvetica Neue', Arial, sans-serif" font-weight="700" font-size="${boxSize * 0.11}" letter-spacing="${boxSize * 0.008}" fill="${tvcFill}">TVC</text>`;
}

function wordmarkInner(cx, cy, width, height, mode) {
  const fill = pickColor(mode, 'wordmark');
  const fontSize = height * 0.38;
  const tracking = 1.75 * (fontSize / 48);
  return `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-family="Inter, 'Helvetica Neue', Arial, sans-serif" font-weight="600" font-size="${fontSize}" letter-spacing="${tracking}" fill="${fill}">THE VESSEL CODE</text>`;
}

function compositeSvg(layout, mode) {
  const pad = SIZE * PADDING_RATIO;
  const inner = SIZE - pad * 2;

  if (layout === 'symbol') {
    const cx = SIZE / 2;
    const cy = SIZE / 2;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
${symbolMarkInner(cx, cy, inner, mode)}
</svg>`;
  }

  if (layout === 'vertical') {
    const symBox = inner * 0.58;
    const gap = inner * 0.06;
    const textBox = inner - symBox - gap;
    const symCx = SIZE / 2;
    const symCy = pad + symBox / 2;
    const textCy = pad + symBox + gap + textBox / 2;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
${symbolMarkInner(symCx, symCy, symBox, mode)}
${wordmarkInner(SIZE / 2, textCy, inner, textBox, mode)}
</svg>`;
  }

  const symBox = inner * 0.44;
  const textW = inner - symBox;
  const rowCy = SIZE / 2;
  const symCx = pad + symBox / 2;
  const textCx = pad + symBox + textW / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
${symbolMarkInner(symCx, rowCy, symBox, mode)}
${wordmarkInner(textCx, rowCy, textW, inner * 0.22, mode)}
</svg>`;
}

function symbolOnlySvg(boxSize, mode) {
  const cx = boxSize / 2;
  const cy = boxSize / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${boxSize} ${boxSize}" width="${boxSize}" height="${boxSize}">
${symbolMarkInner(cx, cy, boxSize, mode)}
</svg>`;
}

async function renderPng(svgString) {
  return sharp(Buffer.from(svgString), { density: DPI })
    .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

async function renderJpg(svgString) {
  return sharp(Buffer.from(svgString), { density: DPI })
    .resize(SIZE, SIZE, { fit: 'contain', background: '#ffffff' })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 95, chromaSubsampling: '4:4:4' })
    .toBuffer();
}

async function writeAsset(baseName, layout, mode, zip) {
  const svg = compositeSvg(layout, mode);
  const pngTransparent = await renderPng(svg);
  const pngPath = path.join(OUT_DIR, `${baseName}.png`);
  fs.writeFileSync(pngPath, pngTransparent);
  zip.file(`${baseName}.png`, pngTransparent);

  if (mode === 'black') {
    const jpgName = `${baseName}-on-white.jpg`;
    const jpgBuf = await renderJpg(svg);
    fs.writeFileSync(path.join(OUT_DIR, jpgName), jpgBuf);
    zip.file(jpgName, jpgBuf);
  }
  return pngPath;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const symbolSrc = path.join(ROOT, 'icons', 'extracted', 'desktop-256.png');
  const fallbackSrc = path.join(ROOT, 'icons', 'company-logo.png');
  if (!fs.existsSync(symbolSrc) && !fs.existsSync(fallbackSrc)) {
    throw new Error('Missing icons/extracted/desktop-256.png or icons/company-logo.png');
  }

  const zip = new JSZip();
  const manifest = [];

  const jobs = [
    { base: 'tvc-logo-combo-vertical-color', layout: 'vertical', mode: 'color' },
    { base: 'tvc-logo-combo-vertical-black', layout: 'vertical', mode: 'black' },
    { base: 'tvc-logo-combo-horizontal-color', layout: 'horizontal', mode: 'color' },
    { base: 'tvc-logo-combo-horizontal-black', layout: 'horizontal', mode: 'black' },
    { base: 'tvc-logo-symbol-color', layout: 'symbol', mode: 'color' },
    { base: 'tvc-logo-symbol-black', layout: 'symbol', mode: 'black' },
  ];

  for (const job of jobs) {
    const written = await writeAsset(job.base, job.layout, job.mode, zip);
    manifest.push(written);
    console.log('Wrote', path.relative(ROOT, written));
  }

  const masterSvg = compositeSvg('vertical', 'color');
  const svgPath = path.join(OUT_DIR, 'tvc-trademark-vector.svg');
  fs.writeFileSync(svgPath, masterSvg, 'utf8');
  zip.file('tvc-trademark-vector.svg', masterSvg);
  console.log('Wrote', path.relative(ROOT, svgPath));

  const symbolOnly = symbolOnlySvg(1024, 'color');
  fs.writeFileSync(path.join(OUT_DIR, 'tvc-symbol-mark-vector.svg'), symbolOnly, 'utf8');
  zip.file('tvc-symbol-mark-vector.svg', symbolOnly);

  const readme = `# THE VESSEL CODE — Trademark specimen pack (RIPC / KIPO)

Generated: ${new Date().toISOString()}
Canvas: ${SIZE}×${SIZE} px @ ${DPI} DPI reference density
Safe padding: ~${Math.round(PADDING_RATIO * 100)}%

## Types
- Type A: tvc-logo-combo-vertical-*
- Type B: tvc-logo-combo-horizontal-*
- Type C: tvc-logo-symbol-*

## Variations
- *-color.png — Deep Navy & Ocean Accent (transparent PNG)
- *-black.png — Pure black monochrome (transparent PNG)
- *-black-on-white.jpg — Black on white (KIPO attachment JPG)

## Vector
- tvc-trademark-vector.svg — Type A color composite
- tvc-symbol-mark-vector.svg — Type C symbol only
`;
  fs.writeFileSync(path.join(OUT_DIR, 'README.txt'), readme, 'utf8');
  zip.file('README.txt', readme);

  const zipBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
  const zipPath = path.join(OUT_DIR, 'THE_VESSEL_CODE_Trademark_Pack.zip');
  fs.writeFileSync(zipPath, zipBuf);
  console.log('Wrote', path.relative(ROOT, zipPath));

  for (const p of manifest) {
    const meta = await sharp(p).metadata();
    if (meta.width < 2048 || meta.height < 2048) {
      throw new Error(`${p} below 2048px: ${meta.width}x${meta.height}`);
    }
  }
  console.log('Validation OK — all primary PNGs are ≥2048×2048.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
