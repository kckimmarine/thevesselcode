/**
 * THE VESSEL CODE — 원형 심볼 상표 견본 (RIPC / KIPO)
 * Official symbol source: icons/extracted/desktop-256.png (company circular mark)
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
  wordmarkColor: '#0f172a',
};

function pickSymbolSource() {
  const candidates = [
    path.join(ROOT, 'icons', 'extracted', 'desktop-256.png'),
    path.join(ROOT, 'icons', 'company-logo.png'),
    path.join(ROOT, 'build', 'icon.png'),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) throw new Error('Missing official circle logo PNG (desktop-256.png)');
  return found;
}

/** Recolor every visible pixel to pure black; preserve alpha (mono filing plate). */
async function symbolToMonoBlack(inputPath, pixelSize) {
  const { data, info } = await sharp(inputPath)
    .resize(pixelSize, pixelSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: sharp.kernel.lanczos3 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const out = Buffer.from(data);
  for (let i = 0; i < info.width * info.height; i += 1) {
    const o = i * 4;
    if (out[o + 3] > 8) {
      out[o] = 0;
      out[o + 1] = 0;
      out[o + 2] = 0;
      out[o + 3] = 255;
    } else {
      out[o + 3] = 0;
    }
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

async function symbolRaster(mode, pixelSize) {
  const src = pickSymbolSource();
  if (mode === 'black') return symbolToMonoBlack(src, pixelSize);
  return sharp(src)
    .resize(pixelSize, pixelSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
}

function wordmarkSvgFragment(width, height, mode) {
  const fill = mode === 'black' ? '#000000' : PALETTE.wordmarkColor;
  const trackingEm = 0.15;
  const fontSize = Math.min(height * 0.48, width / 13.4);
  const tracking = fontSize * trackingEm;
  const padX = width * 0.04;
  const vbW = width + padX * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-padX} 0 ${vbW} ${height}" width="${width}" height="${height}">
  <text x="${width / 2}" y="${height / 2}" text-anchor="middle" dominant-baseline="middle" font-family="Inter, Montserrat, 'Helvetica Neue', Arial, sans-serif" font-weight="700" font-size="${fontSize}" letter-spacing="${tracking}" fill="${fill}">THE VESSEL CODE</text>
</svg>`;
}

async function wordmarkRaster(width, height, mode) {
  const svg = wordmarkSvgFragment(width, height, mode);
  return sharp(Buffer.from(svg), { density: DPI })
    .resize(width, height, { fit: 'fill', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

async function composeLayout(layout, mode) {
  const isHoriz = layout === 'horizontal';
  const canvasW = isHoriz ? HORIZ_W : SQUARE;
  const canvasH = isHoriz ? HORIZ_H : SQUARE;
  const pad = Math.round(Math.min(canvasW, canvasH) * PADDING_RATIO);

  let symSize;
  let symLeft;
  let symTop;
  let textW;
  let textH;
  let textLeft;
  let textTop;

  if (layout === 'symbol') {
    symSize = Math.min(canvasW, canvasH) - pad * 2;
    symLeft = Math.round((canvasW - symSize) / 2);
    symTop = Math.round((canvasH - symSize) / 2);
    const symBuf = await symbolRaster(mode, symSize);
    return sharp({
      create: { width: canvasW, height: canvasH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([{ input: symBuf, left: symLeft, top: symTop }])
      .png()
      .toBuffer();
  }

  if (layout === 'vertical') {
    const inner = canvasH - pad * 2;
    symSize = Math.round(inner * 0.54);
    const gap = Math.round(inner * 0.07);
    textH = inner - symSize - gap;
    textW = canvasW - pad * 2;
    symLeft = Math.round((canvasW - symSize) / 2);
    symTop = pad;
    textLeft = pad;
    textTop = pad + symSize + gap;
  } else {
    const innerH = canvasH - pad * 2;
    const innerW = canvasW - pad * 2;
    const gap = Math.round(innerW * 0.05);
    symSize = Math.round(innerH * 0.94);
    textW = innerW - symSize - gap;
    textH = Math.round(innerH * 0.28);
    symLeft = pad;
    symTop = Math.round((canvasH - symSize) / 2);
    textLeft = pad + symSize + gap;
    textTop = Math.round((canvasH - textH) / 2);
  }

  const [symBuf, textBuf] = await Promise.all([
    symbolRaster(mode, symSize),
    wordmarkRaster(textW, textH, mode),
  ]);

  return sharp({
    create: { width: canvasW, height: canvasH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: symBuf, left: symLeft, top: symTop },
      { input: textBuf, left: textLeft, top: textTop },
    ])
    .png()
    .toBuffer();
}

async function toJpgWhite(pngBuf, w, h) {
  return sharp(pngBuf)
    .resize(w, h, { fit: 'fill' })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 96, chromaSubsampling: '4:4:4' })
    .toBuffer();
}

async function buildMasterSvg() {
  const src = pickSymbolSource();
  const b64 = fs.readFileSync(src).toString('base64');
  const pad = SQUARE * PADDING_RATIO;
  const inner = SQUARE - pad * 2;
  const symSize = inner * 0.54;
  const gap = inner * 0.07;
  const textY = pad + symSize + gap + (inner - symSize - gap) / 2;
  const fontSize = (inner - symSize - gap) * 0.38;
  const tracking = fontSize * 0.175;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${SQUARE} ${SQUARE}" width="${SQUARE}" height="${SQUARE}">
  <image x="${(SQUARE - symSize) / 2}" y="${pad}" width="${symSize}" height="${symSize}" xlink:href="data:image/png;base64,${b64}" />
  <text x="${SQUARE / 2}" y="${textY}" text-anchor="middle" dominant-baseline="middle" font-family="Inter, Montserrat, 'Helvetica Neue', Arial, sans-serif" font-weight="700" font-size="${fontSize}" letter-spacing="${tracking}" fill="${PALETTE.wordmarkColor}">THE VESSEL CODE</text>
</svg>`;
}

async function exportLayout(baseName, layout, zip) {
  const isHoriz = layout === 'horizontal';
  const w = isHoriz ? HORIZ_W : SQUARE;
  const h = isHoriz ? HORIZ_H : SQUARE;

  const colorPng = await composeLayout(layout, 'color');
  const blackPng = await composeLayout(layout, 'black');
  const blackJpg = await toJpgWhite(blackPng, w, h);

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

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log('Symbol source:', path.relative(ROOT, pickSymbolSource()));

  const zip = new JSZip();
  const written = [];

  written.push(...(await exportLayout('tvc-circle-vertical', 'vertical', zip)));
  written.push(...(await exportLayout('tvc-circle-horizontal', 'horizontal', zip)));
  written.push(...(await exportLayout('tvc-circle-symbol', 'symbol', zip)));

  const masterSvg = await buildMasterSvg();
  const masterPath = path.join(OUT_DIR, 'THE_VESSEL_CODE_Circle_Master.svg');
  fs.writeFileSync(masterPath, masterSvg, 'utf8');
  zip.file('THE_VESSEL_CODE_Circle_Master.svg', masterSvg);
  console.log('Wrote', path.relative(ROOT, masterPath));

  const symOnlyB64 = fs.readFileSync(pickSymbolSource()).toString('base64');
  const symSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 256 256" width="256" height="256">
  <image width="256" height="256" xlink:href="data:image/png;base64,${symOnlyB64}" />
</svg>`;
  fs.writeFileSync(path.join(OUT_DIR, 'tvc-circle-symbol-master.svg'), symSvg, 'utf8');
  zip.file('tvc-circle-symbol-master.svg', symSvg);

  const readme = `# THE VESSEL CODE — Circle trademark pack (RIPC / KIPO)

Generated: ${new Date().toISOString()}
Symbol raster: ${path.relative(ROOT, pickSymbolSource())} (official app/marketing circle mark)

## Layouts
- Type 1 Vertical: tvc-circle-vertical-* (${SQUARE}×${SQUARE})
- Type 2 Horizontal: tvc-circle-horizontal-* (${HORIZ_W}×${HORIZ_H}, 2:1)
- Type 3 Symbol: tvc-circle-symbol-* (${SQUARE}×${SQUARE})

Variations: color PNG (transparent), black PNG (transparent), black JPG (white)
Padding: ${Math.round(PADDING_RATIO * 100)}% · Upscale: Lanczos3 from 256px master PNG
`;
  fs.writeFileSync(path.join(OUT_DIR, 'README-circle-pack.txt'), readme, 'utf8');
  zip.file('README-circle-pack.txt', readme);

  const zipBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
  const zipPath = path.join(OUT_DIR, 'TVC_Trademark_Circle_Pack.zip');
  fs.writeFileSync(zipPath, zipBuf);
  console.log('Wrote', path.relative(ROOT, zipPath));

  for (const p of written.filter((f) => f.endsWith('.png'))) {
    const meta = await sharp(p).metadata();
    if (Math.min(meta.width, meta.height) < 2048) {
      throw new Error(`${p} below 2048px (${meta.width}×${meta.height})`);
    }
  }
  console.log('Validation OK.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
