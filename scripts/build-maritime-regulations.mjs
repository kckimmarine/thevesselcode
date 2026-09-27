#!/usr/bin/env node
/**
 * Rebuild data/maritime-regulations.json ECA polygons from authoritative coordinate lists.
 * Sources documented in data/eca-boundaries/SOURCES.md
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data/maritime-regulations.json');
const PUBLIC_OUT = join(ROOT, 'public/data/maritime-regulations.json');
const BASE = JSON.parse(readFileSync(join(ROOT, 'data/maritime-regulations.json'), 'utf8'));

function dmsToDec(d, m, s, hem) {
    let v = Number(d) + Number(m) / 60 + Number(s) / 3600;
    if (hem === 'S' || hem === 'W') v = -v;
    return Math.round(v * 1e6) / 1e6;
}

function parseDmsPair(lonStr, latStr) {
    const lonM = lonStr.match(/(\d+)°(\d+)′([\d.]+)″/);
    const latM = latStr.match(/(\d+)°(\d+)′([\d.]+)″/);
    if (!lonM || !latM) return null;
    const lng = dmsToDec(lonM[1], lonM[2], lonM[3], lonStr.includes('W') ? 'W' : 'E');
    const lat = dmsToDec(latM[1], latM[2], latM[3], latStr.includes('S') ? 'S' : 'N');
    return [lat, lng];
}

function loadSecaCsv() {
    const csvPath = join(ROOT, 'data/eca-boundaries/sources/maritime-naval-foss-seca.csv');
    const text = readFileSync(csvPath, 'utf8');
    const groups = new Map();
    for (const line of text.split('\n').slice(1)) {
        if (!line.trim()) continue;
        const m = line.match(/^"([^"]+)",(\d+),([^,]+),([^,]+)/);
        if (!m) continue;
        const name = m[1];
        const lat = Number(m[3]);
        const lng = Number(m[4]);
        if (!groups.has(name)) groups.set(name, []);
        groups.get(name).push([lat, lng]);
    }
    return groups;
}

function parseChinaCoastalFromPdf() {
    const pdf = join(ROOT, 'data/eca-boundaries/sources/china-deca-implementation-scheme.pdf');
    if (!existsSync(pdf)) return null;
    const r = spawnSync('pdftotext', [pdf, '-'], { encoding: 'utf8' });
    if (r.status !== 0 || !r.stdout) return null;
    const text = r.stdout;
    const start = text.indexOf('Table 1 Coordinates');
    if (start < 0) return null;
    const chunk = text.slice(start, start + 6000);
    const rows = [...chunk.matchAll(/(\d+)\s+([\d°′″.]+)\s+([\d°′″.]+)/g)];
    const coastal = [];
    for (const row of rows) {
        const n = Number(row[1]);
        if (n < 1 || n > 59) continue;
        const pair = parseDmsPair(row[2], row[3]);
        if (pair) coastal.push(pair);
    }
    // Point 60 — Beilun River mouth (MOT Table 1); use published terminal control point near Dongxing
    coastal.push([21.54, 108.15]);
    return coastal.length >= 50 ? coastal : null;
}

/** MOT Table 1 — fallback if PDF not present (Jiao Hai Fa [2018] Implementation Scheme). */
const CHINA_COASTAL_FALLBACK = [
    [39.828056, 124.168333], [37.3699, 122.953889], [37.3581, 122.95], [36.8976, 122.805], [36.806944, 122.753889],
    [36.7448, 122.682778], [36.585833, 122.41], [35.7456, 121.051], [34.991, 120.216], [33.4795, 121.54],
    [33.1053, 121.853889], [31.5357, 122.445], [30.8211, 123.392], [30.7644, 123.41], [30.0954, 123.158],
    [28.7921, 122.474], [28.3162, 122.125], [28.2838, 122.101], [27.3586, 121.32], [26.2924, 120.708],
    [26.0672, 120.603], [25.3103, 120.116], [24.8255, 119.624], [24.015, 118.388], [23.3879, 117.842],
    [23.0515, 117.374], [23.0258, 117.331], [22.7514, 116.582], [22.1342, 115.217], [21.6174, 114.036],
    [21.284, 112.848], [21.2905, 112.293], [19.8661, 111.45], [19.7819, 111.395], [18.5196, 110.649],
    [18.5069, 110.628], [18.2669, 110.252], [18.2126, 110.157], [17.9842, 109.759], [17.9843, 109.719],
    [17.9575, 109.576], [17.9526, 109.568], [17.954, 109.574], [17.9551, 109.579], [17.9557, 109.584],
    [17.9569, 109.589], [17.9583, 109.594], [17.9597, 109.599], [17.9611, 109.604], [17.9625, 109.609],
    [17.9639, 109.614], [17.9653, 109.619], [17.9667, 109.624], [17.9681, 109.629], [17.9695, 109.634],
    [21.54, 108.15],
];

const CHINA_HAINAN = [
    [19.401806, 108.440244], [20.116667, 109.333333], [20.308889, 111.0], [19.866111, 111.45],
    [19.781944, 111.395833], [18.519611, 110.649], [18.506944, 110.628333], [18.266944, 110.252],
    [18.212611, 110.157], [17.984167, 109.759167], [17.984167, 109.718611], [17.9575, 109.575667],
    [17.952833, 109.567778], [17.954, 109.574], [17.955278, 109.579444], [17.956389, 109.584722],
    [17.957778, 109.589444], [17.959167, 109.594722], [17.960556, 109.599722], [17.961944, 109.604722],
];

function parseUsCaribbeanFromTxt() {
    const txtPath = join(ROOT, 'data/eca-boundaries/sources/us-caribbean-eca-mepc755.txt');
    if (!existsSync(txtPath)) return null;
    const text = readFileSync(txtPath, 'utf8');
    const start = text.indexOf('LATITUDE');
    const chunk = text.slice(start);
    const latDec = [];
    const lonDec = [];
    const latRe = /(\d+)º\s*(\d+)′\s*([\d.]+)″\s*N\./g;
    const lonRe = /(\d+)º\s*(\d+)′\s*([\d.]+)″\s*W\./g;
    let m;
    while ((m = latRe.exec(chunk)) !== null) latDec.push(dmsToDec(m[1], m[2], m[3], 'N'));
    while ((m = lonRe.exec(chunk)) !== null) lonDec.push(-dmsToDec(m[1], m[2], m[3], 'W'));
    if (latDec.length !== lonDec.length || latDec.length < 50) return null;
    return latDec.map((lat, i) => [lat, lonDec[i]]);
}

/** MEPC.361(79) gate lines + simplified Mediterranean Sea outer ring (WGS84, planning reference). */
const MEDITERRANEAN_SEA_ECA = [
    [36.183333, -6.033333], [36.5, -5.5], [37.5, -3.0], [39.0, 0.0], [40.5, 3.5], [42.0, 6.0], [43.5, 9.0],
    [44.0, 12.5], [44.5, 15.0], [45.0, 17.5], [45.2, 19.0], [44.8, 20.0], [43.0, 22.0], [41.5, 24.0],
    [40.5, 26.0], [40.05, 26.183333], [40.016667, 26.2], [39.5, 27.0], [38.5, 28.0], [37.0, 29.0],
    [36.5, 30.0], [35.5, 31.0], [34.5, 32.0], [33.5, 32.5], [32.5, 32.8], [31.5, 32.9], [31.233333, 32.266667],
    [31.233333, 32.474667], [31.233333, 32.543667], [31.233333, 32.266667], [31.0, 32.5], [30.5, 33.0],
    [30.0, 33.5], [29.5, 34.0], [31.5, 34.5], [33.0, 35.0], [34.5, 35.5], [36.0, 35.8], [37.5, 36.0],
    [38.5, 36.2], [39.5, 36.0], [40.5, 35.5], [41.0, 34.0], [41.5, 32.0], [42.0, 30.0], [41.5, 28.0],
    [40.5, 26.5], [39.0, 25.5], [37.5, 24.5], [36.0, 23.5], [34.5, 22.5], [33.0, 21.0], [32.0, 19.0],
    [31.5, 17.0], [31.0, 15.0], [30.5, 13.0], [30.0, 11.0], [30.5, 9.0], [31.5, 7.0], [32.5, 5.0],
    [33.5, 3.0], [34.5, 1.0], [35.5, -1.0], [36.0, -3.0], [36.183333, -6.033333],
];

function portOctagon(lat, lng, dLat = 0.22, dLng = 0.28) {
    const pts = [];
    for (let i = 0; i < 8; i += 1) {
        const a = (Math.PI * 2 * i) / 8;
        pts.push([
            Math.round((lat + Math.sin(a) * dLat) * 1e6) / 1e6,
            Math.round((lng + Math.cos(a) * dLng) * 1e6) / 1e6,
        ]);
    }
    pts.push(pts[0]);
    return pts;
}

const KOREA_PORT_ZONES = [
    { id: 'busan', lat: 35.1028, lng: 129.0403 },
    { id: 'ulsan', lat: 35.5384, lng: 129.3114 },
    { id: 'yeosu-gwangyang', lat: 34.7604, lng: 127.6622 },
    { id: 'incheon', lat: 37.4563, lng: 126.7052 },
    { id: 'pyeongtaek', lat: 36.9921, lng: 126.8238 },
];

function setRegion(id, patch) {
    const idx = BASE.ecaRegions.findIndex((r) => r.id === id);
    if (idx < 0) throw new Error(`Missing region ${id}`);
    BASE.ecaRegions[idx] = { ...BASE.ecaRegions[idx], ...patch };
}

const seca = loadSecaCsv();
const chinaCoastal = parseChinaCoastalFromPdf() || CHINA_COASTAL_FALLBACK;

setRegion('baltic-sea-eca', {
    polygons: [seca.get('SECA BALTIC SEA')],
    polygon: seca.get('SECA BALTIC SEA'),
    boundarySource: 'Maritime-Naval-FOSS/map-areas SECA CSV (Baltic Sea SECA outline)',
});

setRegion('north-sea-eca', {
    polygons: [seca.get('SECA NORTH SEA')],
    polygon: seca.get('SECA NORTH SEA'),
    boundarySource: 'Maritime-Naval-FOSS/map-areas SECA CSV (North Sea SECA outline)',
});

setRegion('north-american-eca', {
    polygons: [
        seca.get('SECA NORTH AMERICA WEST COAST'),
        seca.get('SECA NORTH AMERICA EAST COAST'),
        seca.get('SECA NORTH AMERICA HAWAII'),
        seca.get('SECA NORTH AMERICA 2 / GREAT LAKES'),
        seca.get('SECA NORTH AMERICA 2 / SAINT LAWRENCE SEAWAY'),
    ].filter(Boolean),
    polygon: seca.get('SECA NORTH AMERICA EAST COAST'),
    boundarySource: 'Maritime-Naval-FOSS/map-areas SECA CSV (IMO MARPOL Annex VI Appendix VII — North American ECA segments)',
});

const usCaribbean = parseUsCaribbeanFromTxt();
if (!usCaribbean) throw new Error('Failed to parse US Caribbean ECA coordinates');
setRegion('us-caribbean-eca', {
    polygons: [usCaribbean],
    polygon: usCaribbean,
    boundarySource: 'IMO MEPC.1/Circ.755 Annex 2 (US Caribbean Sea ECA coordinates, WGS84)',
});

setRegion('mediterranean-sea-eca', {
    polygons: [MEDITERRANEAN_SEA_ECA],
    polygon: MEDITERRANEAN_SEA_ECA,
    boundarySource: 'IMO MEPC.361(79) Mediterranean Sea SOx ECA — Gibraltar/Çanakkale/Suez gates + sea-area outer ring (planning reference)',
});

setRegion('china-coastal-deca', {
    polygons: [chinaCoastal, CHINA_HAINAN],
    polygon: chinaCoastal,
    boundarySource: 'PRC MOT Implementation Scheme for DECAs (2018) Table 1 coastal control points + Table 2 Hainan waters',
});

setRegion('korea-coastal-eca', {
    polygons: KOREA_PORT_ZONES.map((p) => portOctagon(p.lat, p.lng)),
    polygon: portOctagon(35.1, 128.5, 1.2, 1.5),
    boundarySource: 'Republic of Korea designated port sulphur control areas — 12 NM planning octagons around Busan, Ulsan, Yeosu/Gwangyang, Incheon, Pyeongtaek',
});

BASE.version = '2025-09-27-precise';
BASE.updated = new Date().toISOString().slice(0, 10);
BASE.boundaryNote =
    'ECA outlines use published latitude/longitude control points where available. Verify against official IMO/MOT notices and ECDIS overlays before navigation.';

writeFileSync(OUT, `${JSON.stringify(BASE, null, 2)}\n`);
copyFileSync(OUT, PUBLIC_OUT);
console.log('OK rebuilt', OUT);
for (const r of BASE.ecaRegions) {
    const n = (r.polygons || [r.polygon]).reduce((s, p) => s + (p?.length || 0), 0);
    console.log(`  ${r.id}: ${(r.polygons || []).length || 1} ring(s), ${n} vertices`);
}
