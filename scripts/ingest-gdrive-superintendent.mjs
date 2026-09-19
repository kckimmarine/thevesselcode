#!/usr/bin/env node
/**
 * Recursive ingest: Google Drive Desktop superintendent archive → TVC knowledge JSON.
 *
 * Default source (Windows): G:\내 드라이브\참조 (공무팀)
 * Override: TVC_SUPERINTENDENT_ARCHIVE_ROOT
 * Fallback (CI / no G:): TVC_INGEST_ALLOW_DATA_FALLBACK=1 or --fallback-data
 *
 * Usage: node scripts/ingest-gdrive-superintendent.mjs [--fallback-data] [--dry-run]
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import XLSX from 'xlsx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const DEFAULT_WIN_ROOT = 'G:\\내 드라이브\\참조 (공무팀)';
const SCAN_EXT = new Set(['.xlsx', '.xls', '.csv', '.txt', '.json']);
const OUT_KB = path.join(ROOT, 'data', 'tvc-knowledge-base.json');
const OUT_PARTS = path.join(ROOT, 'data', 'historical-parts-master.json');
const OUT_TROUBLE = path.join(ROOT, 'data', 'superintendent-trouble-history.json');

const EQUIPMENT_TERMS = [
    'M/E', 'A/E', 'G/E', 'MAIN ENGINE', 'AUX ENGINE', 'GENERATOR',
    'BOILER', 'PURIFIER', 'SEPARATOR', 'COMPRESSOR', 'PUMP', 'VALVE',
    'COOLER', 'HEATER', 'TURBOCHARGER', 'GOVERNOR', 'FWG', 'STEERING',
    'WINDLASS', 'CRANE', 'BWTS', 'ODME', 'INCINERATOR', 'OWS',
    '메인엔진', '보일러', '펌프', '밸브', '정화기', '발전기',
];

const HEADER_ALIASES = {
    partNumber: ['part number', 'part no', 'partno', 'p/n', 'pn', 'maker p/n', 'code number', '품번', '부품번호', 'part code', 'item code', 'drawing no', 'dwg'],
    impa: ['impa', 'impa code', 'impa no'],
    description: ['description', 'item', 'items', 'name', 'part name', '품명', '명칭', 'specification', 'spec'],
    equipment: ['equipment', 'machinery', 'machine', 'unit', 'group', '설비', '기기', '장비'],
    vendor: ['vendor', 'supplier', 'maker', 'company', '공급', '업체', '매입처', '견적처'],
    unitPrice: ['unit price', 'price', 'amount', 'cost', 'unit cost', '단가', '견적가', '금액', 'usd', 'krw'],
    currency: ['currency', 'curr', '통화'],
    quoteDate: ['date', 'quote date', 'quotation date', '견적일', '일자'],
    symptom: ['symptom', 'symptoms', 'phenomenon', 'complaint', 'issue', '증상', '현상', '고장증상'],
    rootCause: ['root cause', 'cause', 'reason', '원인', '근본원인'],
    actionTaken: ['action', 'action taken', 'corrective action', 'repair', 'work done', '조치', '수리내용', '대응'],
    classRec: ['class', 'class recommendation', 'survey', '선급', '검사', '권고'],
};

function parseArgs(argv) {
    return {
        fallbackData: argv.includes('--fallback-data') || process.env.TVC_INGEST_ALLOW_DATA_FALLBACK === '1',
        dryRun: argv.includes('--dry-run'),
    };
}

function normalizeCell(v) {
    if (v == null) return '';
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return String(v).replace(/\s+/g, ' ').trim();
}

function normalizeKey(s) {
    return normalizeCell(s).toLowerCase().replace(/[_\-./\\]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function matchHeader(header, aliasKey) {
    const h = normalizeKey(header);
    if (!h) return false;
    return HEADER_ALIASES[aliasKey].some((a) => h === a || h.includes(a));
}

function mapHeaders(row) {
    const map = {};
    row.forEach((cell, idx) => {
        const h = normalizeKey(cell);
        if (!h) return;
        for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
            if (map[field] != null) continue;
            if (aliases.some((a) => h === a || h.includes(a))) map[field] = idx;
        }
    });
    return map;
}

function hashId(parts) {
    return crypto.createHash('sha256').update(parts.filter(Boolean).join('|')).digest('hex').slice(0, 16);
}

function parseMoney(raw) {
    const s = normalizeCell(raw).replace(/,/g, '');
    const m = s.match(/(-?\d+(?:\.\d+)?)/);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
}

function detectCurrency(rowText, explicit) {
    const c = normalizeCell(explicit).toUpperCase();
    if (/^(USD|EUR|KRW|JPY|CNY|SGD)$/.test(c)) return c;
    const t = rowText.toUpperCase();
    if (t.includes('USD') || t.includes('$')) return 'USD';
    if (t.includes('KRW') || t.includes('₩') || t.includes('원')) return 'KRW';
    if (t.includes('EUR') || t.includes('€')) return 'EUR';
    return '';
}

function extractEquipmentFromText(text) {
    const upper = text.toUpperCase();
    const found = [];
    for (const term of EQUIPMENT_TERMS) {
        const t = term.toUpperCase();
        if (upper.includes(t)) found.push(term);
    }
    return [...new Set(found)];
}

const PART_PATTERNS = [
    /\bIMPA[\s-]*(\d{6})\b/i,
    /\bDWG[\s.-]*([A-Z0-9][A-Z0-9\-./]{2,})\b/i,
    /\b([0-9]{2}-[0-9]{3}-[0-9]{2})\b/,
    /\b([A-Z]{2,4}[\s-]?[0-9]{4,}[A-Z0-9\-./]*)\b/,
];

function extractPartNumbers(text) {
    const out = new Set();
    for (const re of PART_PATTERNS) {
        const m = text.match(re);
        if (m) out.add(m[1] || m[0]);
    }
    return [...out];
}

function resolveSourceRoot(fallbackData) {
    const envRoot = process.env.TVC_SUPERINTENDENT_ARCHIVE_ROOT;
    const candidates = [];
    if (envRoot) candidates.push(envRoot);
    candidates.push(DEFAULT_WIN_ROOT);

    if (process.platform === 'win32') {
        for (const c of candidates) {
            if (fs.existsSync(c)) return { root: c, mode: 'gdrive' };
        }
    } else {
        const linuxMounts = [
            '/mnt/g/내 드라이브/참조 (공무팀)',
            '/mnt/g/My Drive/참조 (공무팀)',
            path.join(process.env.HOME || '', 'Google Drive', '참조 (공무팀)'),
        ];
        for (const c of [...candidates, ...linuxMounts]) {
            if (c && fs.existsSync(c)) return { root: c, mode: 'gdrive' };
        }
    }

    if (fallbackData) {
        const dataDir = path.join(ROOT, 'data');
        if (fs.existsSync(dataDir)) return { root: dataDir, mode: 'fallback-data' };
    }

    return { root: candidates[0] || DEFAULT_WIN_ROOT, mode: 'missing' };
}

function walkTree(rootDir) {
    const files = [];
    let dirCount = 0;

    function walk(dir) {
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        dirCount += 1;
        for (const ent of entries) {
            const full = path.join(dir, ent.name);
            if (ent.isDirectory()) {
                if (/^\./.test(ent.name)) continue;
                walk(full);
            } else if (ent.isFile()) {
                const ext = path.extname(ent.name).toLowerCase();
                if (SCAN_EXT.has(ext)) files.push(full);
            }
        }
    }

    walk(rootDir);
    return { files, dirCount };
}

function sheetToRows(wb) {
    const rows = [];
    for (const name of wb.SheetNames) {
        const sheet = wb.Sheets[name];
        const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
        for (const row of aoa) {
            if (!Array.isArray(row)) continue;
            const cells = row.map(normalizeCell);
            if (cells.some(Boolean)) rows.push({ sheet: name, cells });
        }
    }
    return rows;
}

function parseCsvRows(text) {
    const lines = text.split(/\r?\n/);
    const rows = [];
    for (const line of lines) {
        if (!line.trim()) continue;
        const cells = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((c) =>
            normalizeCell(c.replace(/^"|"$/g, '').replace(/""/g, '"'))
        );
        if (cells.some(Boolean)) rows.push({ sheet: 'csv', cells });
    }
    return rows;
}

function ingestTabularRows(rows, sourceFile, parts, troubles, snippets) {
    let headerIdx = -1;
    let colMap = null;
    let currentEquipment = '';

    for (let i = 0; i < rows.length; i += 1) {
        const { cells } = rows[i];
        const rowText = cells.join(' | ');
        const eqHits = extractEquipmentFromText(rowText);
        if (eqHits.length) currentEquipment = eqHits[0];

        const maybeHeader = cells.filter(Boolean).length >= 3
            && (matchHeader(cells[0], 'partNumber') || matchHeader(cells[3], 'partNumber')
                || cells.some((c) => matchHeader(c, 'symptom') || matchHeader(c, 'unitPrice')));
        if (maybeHeader) {
            const trial = mapHeaders(cells);
            if (Object.keys(trial).length >= 2) {
                headerIdx = i;
                colMap = trial;
                continue;
            }
        }

        if (colMap && i > headerIdx) {
            const get = (field) => {
                const idx = colMap[field];
                return idx == null ? '' : normalizeCell(cells[idx]);
            };
            const partNumber = get('partNumber') || extractPartNumbers(rowText)[0] || '';
            const impa = get('impa') || (rowText.match(/\b(\d{6})\b/)?.[1] ?? '');
            const description = get('description');
            const equipment = get('equipment') || currentEquipment || eqHits[0] || '';
            const vendor = get('vendor');
            const unitPrice = parseMoney(get('unitPrice'));
            const currency = detectCurrency(rowText, get('currency'));
            const quoteDate = get('quoteDate');
            const symptom = get('symptom');
            const rootCause = get('rootCause');
            const actionTaken = get('actionTaken');
            const classRec = get('classRec');

            if (partNumber || impa || (description && unitPrice != null)) {
                parts.push({
                    id: hashId(['part', partNumber, impa, description, vendor, String(unitPrice), sourceFile]),
                    partNumber: partNumber || impa,
                    impa: impa || (partNumber.match(/^\d{6}$/) ? partNumber : ''),
                    description,
                    equipment,
                    vendor,
                    unitPrice,
                    currency,
                    quotedAt: quoteDate,
                    sourceFile,
                });
            }

            if (symptom || rootCause || actionTaken) {
                troubles.push({
                    id: hashId(['trouble', equipment, symptom, rootCause, actionTaken, sourceFile]),
                    equipment: equipment || currentEquipment,
                    symptoms: symptom,
                    rootCause,
                    actionTaken,
                    classRecommendation: classRec,
                    sourceFile,
                });
            }
        } else if (!colMap) {
            const pn = extractPartNumbers(rowText);
            const price = parseMoney(rowText);
            if (pn.length && price != null) {
                parts.push({
                    id: hashId(['part', pn[0], rowText, sourceFile]),
                    partNumber: pn[0],
                    impa: '',
                    description: cells.find((c) => c.length > 3 && !/^\d/.test(c)) || '',
                    equipment: currentEquipment || eqHits[0] || '',
                    vendor: '',
                    unitPrice: price,
                    currency: detectCurrency(rowText, ''),
                    quotedAt: '',
                    sourceFile,
                });
            }
            if (/증상|symptom|고장|defect|trouble|원인|cause|조치|action/i.test(rowText)) {
                troubles.push({
                    id: hashId(['trouble', rowText, sourceFile]),
                    equipment: currentEquipment || eqHits.join(', '),
                    symptoms: rowText.slice(0, 500),
                    rootCause: '',
                    actionTaken: '',
                    classRecommendation: '',
                    sourceFile,
                });
            }
        }

        const partHits = extractPartNumbers(rowText);
        if (rowText.length > 20 && (eqHits.length || partHits.length)) {
            snippets.push({
                id: hashId(['snippet', sourceFile, String(i), rowText.slice(0, 200)]),
                text: rowText.slice(0, 800),
                equipment: currentEquipment || eqHits[0] || '',
                sourceFile,
            });
        }
    }
}

function ingestPlainText(text, sourceFile, parts, troubles, snippets) {
    const blocks = text.split(/\n{2,}/);
    let currentEquipment = '';
    for (const block of blocks) {
        const line = normalizeCell(block);
        if (!line) continue;
        const eq = extractEquipmentFromText(line);
        if (eq.length) currentEquipment = eq[0];
        const row = { sheet: 'txt', cells: line.split(/\t|;/).map(normalizeCell) };
        ingestTabularRows([row], sourceFile, parts, troubles, snippets);
        if (/증상|symptom|defect|trouble|overhaul|repair/i.test(line)) {
            troubles.push({
                id: hashId(['trouble', line, sourceFile]),
                equipment: currentEquipment,
                symptoms: line.slice(0, 400),
                rootCause: '',
                actionTaken: '',
                classRecommendation: '',
                sourceFile,
            });
        }
    }
}

function ingestJsonFile(obj, sourceFile, parts, troubles, snippets) {
    const stack = [{ prefix: '', value: obj }];
    while (stack.length) {
        const { prefix, value } = stack.pop();
        if (value == null) continue;
        if (Array.isArray(value)) {
            value.forEach((v, i) => stack.push({ prefix: `${prefix}[${i}]`, value: v }));
        } else if (typeof value === 'object') {
            const rec = value;
            const partNumber = normalizeCell(rec.partNumber || rec.part_no || rec.pn || rec.code);
            const symptom = normalizeCell(rec.symptom || rec.symptoms || rec.issue);
            if (partNumber) {
                parts.push({
                    id: hashId(['part', partNumber, sourceFile, prefix]),
                    partNumber,
                    impa: normalizeCell(rec.impa || rec.impa_code),
                    description: normalizeCell(rec.description || rec.name || rec.item),
                    equipment: normalizeCell(rec.equipment || rec.machine),
                    vendor: normalizeCell(rec.vendor || rec.supplier),
                    unitPrice: parseMoney(rec.unitPrice ?? rec.price ?? rec.amount),
                    currency: detectCurrency(JSON.stringify(rec), rec.currency),
                    quotedAt: normalizeCell(rec.date || rec.quotedAt),
                    sourceFile,
                });
            }
            if (symptom) {
                troubles.push({
                    id: hashId(['trouble', symptom, sourceFile, prefix]),
                    equipment: normalizeCell(rec.equipment),
                    symptoms: symptom,
                    rootCause: normalizeCell(rec.rootCause || rec.cause),
                    actionTaken: normalizeCell(rec.actionTaken || rec.action),
                    classRecommendation: normalizeCell(rec.classRecommendation || rec.class),
                    sourceFile,
                });
            }
            for (const [k, v] of Object.entries(rec)) {
                if (v && typeof v === 'object') stack.push({ prefix: `${prefix}.${k}`, value: v });
            }
        }
    }
    snippets.push({
        id: hashId(['snippet', sourceFile, 'json']),
        text: JSON.stringify(obj).slice(0, 800),
        equipment: '',
        sourceFile,
    });
}

function processFile(filePath, parts, troubles, snippets) {
    const rel = path.relative(ROOT, filePath);
    const ext = path.extname(filePath).toLowerCase();
    try {
        if (ext === '.json') {
            const raw = fs.readFileSync(filePath, 'utf8');
            if (path.basename(filePath).startsWith('tvc-knowledge-base')
                || path.basename(filePath).startsWith('historical-parts-master')
                || path.basename(filePath).startsWith('superintendent-trouble-history')) {
                return;
            }
            ingestJsonFile(JSON.parse(raw), rel, parts, troubles, snippets);
            return;
        }
        if (ext === '.txt') {
            ingestPlainText(fs.readFileSync(filePath, 'utf8'), rel, parts, troubles, snippets);
            return;
        }
        if (ext === '.csv') {
            ingestTabularRows(parseCsvRows(fs.readFileSync(filePath, 'utf8')), rel, parts, troubles, snippets);
            return;
        }
        if (ext === '.xlsx' || ext === '.xls') {
            const wb = XLSX.readFile(filePath, { cellDates: true });
            ingestTabularRows(sheetToRows(wb), rel, parts, troubles, snippets);
        }
    } catch (err) {
        console.warn(`[skip] ${rel}: ${err.message || err}`);
    }
}

function dedupeParts(list) {
    const map = new Map();
    for (const p of list) {
        const key = [
            normalizeKey(p.partNumber),
            normalizeKey(p.impa),
            normalizeKey(p.description),
            normalizeKey(p.vendor),
            p.unitPrice ?? '',
            normalizeKey(p.quotedAt),
        ].join('|');
        if (!map.has(key)) map.set(key, p);
    }
    return [...map.values()];
}

function dedupeTroubles(list) {
    const map = new Map();
    for (const t of list) {
        const key = [
            normalizeKey(t.equipment),
            normalizeKey(t.symptoms),
            normalizeKey(t.rootCause),
            normalizeKey(t.actionTaken),
        ].join('|');
        if (!map.has(key)) map.set(key, t);
    }
    return [...map.values()];
}

function loadExistingParts() {
    if (!fs.existsSync(OUT_PARTS)) return [];
    try {
        const j = JSON.parse(fs.readFileSync(OUT_PARTS, 'utf8'));
        return Array.isArray(j.parts) ? j.parts : [];
    } catch {
        return [];
    }
}

function loadExistingTroubles() {
    if (!fs.existsSync(OUT_TROUBLE)) return [];
    try {
        const j = JSON.parse(fs.readFileSync(OUT_TROUBLE, 'utf8'));
        return Array.isArray(j.cases) ? j.cases : [];
    } catch {
        return [];
    }
}

export function loadExistingKnowledgeBase() {
    if (!fs.existsSync(OUT_KB)) return null;
    try {
        return JSON.parse(fs.readFileSync(OUT_KB, 'utf8'));
    } catch {
        return null;
    }
}

export function buildKnowledgeBase(meta, parts, troubles, snippets, historicalMailIntel = []) {
    const equipmentIndex = {};
    for (const p of parts) {
        const eq = p.equipment || 'UNKNOWN';
        equipmentIndex[eq] = (equipmentIndex[eq] || 0) + 1;
    }
    for (const t of troubles) {
        const eq = t.equipment || 'UNKNOWN';
        equipmentIndex[eq] = (equipmentIndex[eq] || 0) + 1;
    }

    return {
        version: 1,
        updatedAt: new Date().toISOString(),
        source: meta,
        stats: {
            filesScanned: meta.filesScanned,
            directoriesScanned: meta.directoriesScanned,
            partsRecords: parts.length,
            pricePoints: parts.filter((p) => p.unitPrice != null).length,
            troubleCases: troubles.length,
            snippets: snippets.length,
        },
        equipmentIndex: Object.entries(equipmentIndex)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 200)
            .map(([name, count]) => ({ name, count })),
        historical_mail_intel: historicalMailIntel.slice(-5000),
        retrieval: {
            parts: parts.slice(0, 5000),
            troubles: troubles.slice(0, 2000),
            snippets: snippets.slice(0, 3000),
            mailIntel: historicalMailIntel.slice(-1500),
        },
    };
}

export {
    OUT_KB,
    OUT_PARTS,
    OUT_TROUBLE,
    processFile,
    dedupeParts,
    dedupeTroubles,
    loadExistingParts,
    loadExistingTroubles,
    writeJson,
};

function writeJson(filePath, obj) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(obj, null, 2)}\n`, 'utf8');
}

function printKoreanReport(meta, parts, troubles, accessible) {
    const pricePoints = parts.filter((p) => p.unitPrice != null).length;
    console.log('\n========== 공무팀 Google Drive 수집 요약 ==========');
    console.log(`소스 경로: ${meta.sourceRoot}`);
    console.log(`접근 가능: ${accessible ? '예' : '아니오 (경로 마운트 또는 TVC_SUPERINTENDENT_ARCHIVE_ROOT 확인)'}`);
    console.log(`모드: ${meta.mode}`);
    console.log(`스캔한 하위 디렉터리 수: ${meta.directoriesScanned}`);
    console.log(`스캔한 대상 파일 수 (.xlsx/.xls/.csv/.txt/.json): ${meta.filesScanned}`);
    console.log(`추출·병합된 spare parts 레코드: ${parts.length}`);
    console.log(`추출된 단가·견적 price point: ${pricePoints}`);
    console.log(`수집된 troubleshooting / maintenance 사례: ${troubles.length}`);
    console.log(`출력:`);
    console.log(`  - ${path.relative(ROOT, OUT_KB)}`);
    console.log(`  - ${path.relative(ROOT, OUT_PARTS)}`);
    console.log(`  - ${path.relative(ROOT, OUT_TROUBLE)}`);
    console.log('================================================\n');
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const { root, mode } = resolveSourceRoot(args.fallbackData);
    const accessible = mode !== 'missing' && fs.existsSync(root);

    if (!accessible) {
        printKoreanReport({
            sourceRoot: root,
            mode: 'missing',
            directoriesScanned: 0,
            filesScanned: 0,
        }, [], [], false);
        console.error('아카이브 폴더에 접근할 수 없습니다. Google Drive Desktop 마운트 후 다시 실행하거나');
        console.error('  TVC_SUPERINTENDENT_ARCHIVE_ROOT=<경로> node scripts/ingest-gdrive-superintendent.mjs');
        console.error('로컬 data/ 샘플만 병합하려면: TVC_INGEST_ALLOW_DATA_FALLBACK=1 또는 --fallback-data');
        process.exit(2);
    }

    const { files, dirCount } = walkTree(root);
    const parts = [];
    const troubles = [];
    const snippets = [];

    for (const f of files) {
        processFile(f, parts, troubles, snippets);
    }

    const mergedParts = dedupeParts([...loadExistingParts(), ...parts]);
    const mergedTroubles = dedupeTroubles([...loadExistingTroubles(), ...troubles]);

    const meta = {
        sourceRoot: root,
        mode,
        directoriesScanned: dirCount,
        filesScanned: files.length,
        ingestedAt: new Date().toISOString(),
    };

    if (!args.dryRun) {
        writeJson(OUT_PARTS, {
            version: 1,
            updatedAt: meta.ingestedAt,
            sourceRoot: root,
            parts: mergedParts,
        });
        writeJson(OUT_TROUBLE, {
            version: 1,
            updatedAt: meta.ingestedAt,
            sourceRoot: root,
            cases: mergedTroubles,
        });
        const priorKb = loadExistingKnowledgeBase();
        const mailIntel = priorKb?.historical_mail_intel || [];
        writeJson(OUT_KB, buildKnowledgeBase(meta, mergedParts, mergedTroubles, snippets, mailIntel));
    }

    printKoreanReport(meta, mergedParts, mergedTroubles, true);
}

const isDirectRun = process.argv[1]
    && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirectRun) {
    main().catch((e) => {
        console.error(e);
        process.exit(1);
    });
}
