/**
 * THE VESSEL CODE — 원형 심볼 상표 견본 (RIPC / KIPO)
 * Usage: node scripts/export-trademark-circle-assets.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const JSZip = require('jszip');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'dist', 'trademark-assets');
const SQUARE = 2048;
const HORIZ_W = 4096;
const HORIZ_H = 2048;
const PADDING_RATIO = 0.1;
const DPI = 300;

const PALETTE = {
  circleBg: '#1e2433',
  circleBgAlt: '#0f172a',
  orbit: '#8be9fd',
  orbitAlt: '#38bdf8',
  wordmark: '#0f172a',
};

/** Official orbital mark paths (icons/atom-logo.svg) */
const ATOM = {
  orbit1:
    'M48.578,28.615 C56.851,45.587 58.558,61.581 52.288,64.778 C45.822,68.076 33.326,56.521 24.375,38.969 C15.424,21.418 13.409,4.518 19.874,1.221 C22.689,-0.216 26.648,1.166 30.959,4.629',
  orbit2:
    'M7.64,39.45 C2.806,36.94 -0.009,33.915 0.154,30.79 C0.531,23.542 16.787,18.497 36.462,19.52 C56.137,20.544 71.781,27.249 71.404,34.497 C71.241,37.622 68.127,40.338 63.06,42.333',
  orbit3:
    'M28.828,59.354 C23.545,63.168 18.843,64.561 15.902,62.653 C9.814,58.702 13.572,42.102 24.296,25.575 C35.02,9.048 48.649,-1.149 54.736,2.803 C57.566,4.639 58.269,9.208 57.133,15.232',
  nucleus:
    'M40.363,32.075 C40.874,34.44 39.371,36.77 37.006,37.282 C34.641,37.793 32.311,36.29 31.799,33.925 C31.289,31.56 32.791,29.23 35.156,28.718 C37.521,28.207 39.851,29.71 40.363,32.075',
};

function color(mode, role) {
  if (mode === 'black') return '#000000';
  if (role === 'circle') return PALETTE.circleBg;
  if (role === 'orbit') return PALETTE.orbit;
  if (role === 'wordmark') return PALETTE.wordmark;
  return '#000000';
}

function circularSymbolFragment(cx, cy, diameter, mode) {
  const r = diameter / 2;
  const fill = color(mode, 'circle');
  const stroke = color(mode, 'orbit');
  const atomFill = color(mode, 'orbit');
  const inner = diameter * 0.72;
  const atomScale = inner * 0.0112;
  return `
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>
  <g transform="translate(${cx} ${cy}) scale(${atomScale}) translate(-36 -33)" fill="none" stroke="${stroke}" stroke-width="3.35" stroke-linecap="round" stroke-linejoin="round">
    <path d="${ATOM.orbit1}"/>
    <path d="${ATOM.orbit2}"/>
    <path d="${ATOM.orbit3}"/>
  </g>
  <g transform="translate(${cx} ${cy}) scale(${atomScale}) translate(-36 -33)" fill="${atomFill}" stroke="none">
    <path d="${ATOM.nucleus}"/>
  </g>`;
}

function wordmarkFragment(cx, cy, fontSize, mode) {
  const fill = color(mode, 'wordmark');
  const trackingEm = 0.175;
  const tracking = fontSize * trackingEm;
  return `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-family="Inter, Montserrat, 'Helvetica Neue', Arial, sans-serif" font-weight="700" font-size="${fontSize}" letter-spacing="${tracking}" fill="${fill}">THE VESSEL CODE</text>`;
}

function svgVertical(mode) {
  const pad = SQUARE * PADDING_RATIO;
  const inner = SQUARE - pad * 2;
  const symD = inner * 0.52;
  const gap = inner * 0.08;
  const textBand = inner - symD - gap;
  const symCy = pad + symD / 2;
  const textCy = pad + symD + gap + textBand / 2;
  const fontSize = textBand * 0.38;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SQUARE} ${SQUARE}" width="${SQUARE}" height="${SQUARE}">
${circularSymbolFragment(SQUARE / 2, symCy, symD, mode)}
${wordmarkFragment(SQUARE / 2, textCy, fontSize, mode)}
</svg>`;
}

function svgHorizontal(mode) {
  const pad = HORIZ_H * PADDING_RATIO;
  const innerH = HORIZ_H - pad * 2;
  const innerW = HORIZ_W - pad * 2;
  const gap = innerW * 0.05;
  const symD = innerH * 0.92;
  const textAreaW = innerW - symD - gap;
  const symCx = pad + symD / 2;
  const symCy = HORIZ_H / 2;
  const textCx = pad + symD + gap + textAreaW / 2;
  let fontSize = innerH * 0.17;
  const maxByWidth = textAreaW / (17 * 0.64);
  fontSize = Math.min(fontSize, maxByWidth);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${HORIZ_W} ${HORIZ_H}" width="${HORIZ_W}" height="${HORIZ_H}">
${circularSymbolFragment(symCx, symCy, symD, mode)}
${wordmarkFragment(textCx, symCy, fontSize, mode)}
</svg>`;
}

function svgSymbolOnly(mode) {
  const pad = SQUARE * PADDING_RATIO;
  const symD = SQUARE - pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SQUARE} ${SQUARE}" width="${SQUARE}" height="${SQUARE}">
${circularSymbolFragment(SQUARE / 2, SQUARE / 2, symD, mode)}
</svg>`;
}

function layoutSvg(layout, mode) {
  if (layout === 'vertical') return svgVertical(mode);
  if (layout === 'horizontal') return svgHorizontal(mode);
  return svgSymbolOnly(mode);
}

async function renderPng(svg, w, h) {
  return sharp(Buffer.from(svg), { density: DPI })
    .resize(w, h, { fit: 'fill', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

async function renderJpg(svg, w, h) {
  return sharp(Buffer.from(svg), { density: DPI })
    .resize(w, h, { fit: 'fill', background: '#ffffff' })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 96, chromaSubsampling: '4:4:4' })
    .toBuffer();
}

async function exportLayout(baseName, layout, zip) {
  const isHoriz = layout === 'horizontal';
  const w = isHoriz ? HORIZ_W : SQUARE;
  const h = isHoriz ? HORIZ_H : SQUARE;

  const colorSvg = layoutSvg(layout, 'color');
  const blackSvg = layoutSvg(layout, 'black');

  const colorPng = await renderPng(colorSvg, w, h);
  const blackPng = await renderPng(blackSvg, w, h);
  const blackJpg = await renderJpg(blackSvg, w, h);

  const files = [
    [`${baseName}-color.png`, colorPng],
    [`${baseName}-black.png`, blackPng],
    [`${baseName}-black.jpg`, blackJpg],
  ];

  for (const [name, buf] of files) {
    const fp = path.join(OUT_DIR, name);
    fs.writeFileSync(fp, buf);
    zip.file(name, buf);
    console.log('Wrote', path.relative(ROOT, fp));
  }
  return files.map(([name]) => path.join(OUT_DIR, name));
}

async function validateSharpness(pngPath) {
  const meta = await sharp(pngPath).metadata();
  const upscale = await sharp(pngPath).resize(meta.width * 4, meta.height * 4, { kernel: sharp.kernel.nearest }).png().toBuffer();
  const upMeta = await sharp(upscale).metadata();
  if (upMeta.width < meta.width * 4) throw new Error(`Upscale failed for ${pngPath}`);
  return meta;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const refCircle = path.join(ROOT, 'icons', 'extracted', 'desktop-256.png');
  if (!fs.existsSync(refCircle)) {
    console.warn('Note: reference raster', refCircle, 'not found; using vector atom paths only.');
  }

  const zip = new JSZip();
  const written = [];

  written.push(...(await exportLayout('tvc-circle-vertical', 'vertical', zip)));
  written.push(...(await exportLayout('tvc-circle-horizontal', 'horizontal', zip)));
  written.push(...(await exportLayout('tvc-circle-symbol', 'symbol', zip)));

  const masterSvg = `<?xml version="1.0" encoding="UTF-8"?>
<!-- THE VESSEL CODE — Circle trademark master (Type 1 vertical, color) -->
${svgVertical('color')}`;
  const masterPath = path.join(OUT_DIR, 'THE_VESSEL_CODE_Circle_Master.svg');
  fs.writeFileSync(masterPath, masterSvg, 'utf8');
  zip.file('THE_VESSEL_CODE_Circle_Master.svg', masterSvg);
  console.log('Wrote', path.relative(ROOT, masterPath));

  const symbolSvg = svgSymbolOnly('color');
  fs.writeFileSync(path.join(OUT_DIR, 'tvc-circle-symbol-master.svg'), symbolSvg, 'utf8');
  zip.file('tvc-circle-symbol-master.svg', symbolSvg);

  const readme = `# THE VESSEL CODE — Circle trademark pack (RIPC / KIPO)

Generated: ${new Date().toISOString()}

## Layouts
- Type 1 Vertical: tvc-circle-vertical-* (${SQUARE}×${SQUARE})
- Type 2 Horizontal: tvc-circle-horizontal-* (${HORIZ_W}×${HORIZ_H}, 2:1)
- Type 3 Symbol: tvc-circle-symbol-* (${SQUARE}×${SQUARE})

## Variations (×3 each)
- *-color.png — Navy circle + cyan orbits + wordmark / transparent
- *-black.png — Pure black mono / transparent
- *-black.jpg — Black on white (KIPO form)

Padding: ${Math.round(PADDING_RATIO * 100)}% · Raster density: ${DPI} DPI
Vector: THE_VESSEL_CODE_Circle_Master.svg
`;
  fs.writeFileSync(path.join(OUT_DIR, 'README-circle-pack.txt'), readme, 'utf8');
  zip.file('README-circle-pack.txt', readme);

  const zipBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
  const zipPath = path.join(OUT_DIR, 'TVC_Trademark_Circle_Pack.zip');
  fs.writeFileSync(zipPath, zipBuf);
  console.log('Wrote', path.relative(ROOT, zipPath));

  for (const p of written.filter((f) => f.endsWith('.png'))) {
    const meta = await validateSharpness(p);
    const min = Math.min(meta.width, meta.height);
    if (min < 2048) throw new Error(`${p} below 2048px minimum (${meta.width}×${meta.height})`);
  }
  console.log('Validation OK — dimensions ≥2048 and vector PNG upscales cleanly.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
