#!/usr/bin/env node
/**
 * Gmail IMAP → maritime intel ingest (견적·수리·발주·결함).
 *
 * Requires project root `.env`:
 *   GMAIL_USER=...
 *   GMAIL_APP_PASSWORD=16-char app password (no spaces)
 *
 * Usage:
 *   node scripts/fetch-gmail-direct.mjs [--scan=500] [--match-limit=80] [--dry-run]
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import {
    OUT_KB,
    OUT_PARTS,
    OUT_TROUBLE,
    processFile,
    dedupeParts,
    dedupeTroubles,
    loadExistingParts,
    loadExistingTroubles,
    loadExistingKnowledgeBase,
    buildKnowledgeBase,
    writeJson,
} from './ingest-gdrive-superintendent.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(ROOT, '.env') });

const ATTACH_ROOT = path.join(ROOT, 'data', 'raw_archives', 'gmail_attachments');
const STATE_PATH = path.join(ROOT, 'data', 'raw_archives', 'gmail_ingest_state.json');

const MARITIME_KEYWORDS = [
    '견적', '수리', '발주', 'Defect', 'defect', 'quotation', 'Quotation', 'invoice', 'Invoice',
    'spares', 'Spares', 'ClassNK', 'KR', '선급', '검사', 'bunker', 'flange', 'IMPA', '대명상선',
    'repair', 'purchase', 'PO', 'P/O', 'work order', 'overhaul', 'M/E', 'A/E', 'spare part',
];

const NOISE_RE = [
    /\bunsubscribe\b/i,
    /\bnewsletter\b/i,
    /\bpromotion\b/i,
    /\bmarketing\b/i,
    /쿠폰|할인 이벤트|광고 수신/,
    /\bfacebook\b/i,
    /\binstagram\b/i,
    /\bcrypto\b/i,
    /\bcasino\b/i,
];

const ATTACH_EXT = new Set(['.xlsx', '.xls', '.csv']);

function parseArgs(argv) {
    let scan = 400;
    let matchLimit = 80;
    for (const a of argv) {
        const mScan = a.match(/^--scan=(\d+)$/);
        if (mScan) scan = Number(mScan[1]);
        const mMatch = a.match(/^--match-limit=(\d+)$/);
        if (mMatch) matchLimit = Number(mMatch[1]);
    }
    return {
        scan: Number.isFinite(scan) ? scan : 400,
        matchLimit: Number.isFinite(matchLimit) ? matchLimit : 80,
        dryRun: argv.includes('--dry-run'),
    };
}

function hashId(parts) {
    return crypto.createHash('sha256').update(parts.filter(Boolean).join('|')).digest('hex').slice(0, 16);
}

function normalizeAppPassword(raw) {
    return String(raw || '').replace(/\s+/g, '').trim();
}

function loadState() {
    if (!fs.existsSync(STATE_PATH)) return { processedUids: [] };
    try {
        return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    } catch {
        return { processedUids: [] };
    }
}

function saveState(state) {
    fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
    const trimmed = {
        ...state,
        processedUids: (state.processedUids || []).slice(-50000),
        updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(STATE_PATH, `${JSON.stringify(trimmed, null, 2)}\n`, 'utf8');
}

function isNoise(text) {
    return NOISE_RE.some((re) => re.test(text));
}

function matchesMaritime(text) {
    if (!text || isNoise(text)) return false;
    const hay = String(text);
    return MARITIME_KEYWORDS.some((kw) => hay.includes(kw));
}

function summarizeBody(text, max = 600) {
    const clean = String(text || '')
        .replace(/\r/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[^\S\n]+/g, ' ')
        .trim();
    return clean.slice(0, max);
}

function sanitizeFilename(name) {
    const base = path.basename(String(name || 'attachment')).replace(/[^\w.\-()가-힣\s]/g, '_');
    return base.slice(0, 180) || 'attachment.bin';
}

function dedupeMailIntel(list) {
    const map = new Map();
    for (const row of list) {
        const key = [row.messageId, row.date, row.subject, row.from].join('|');
        if (!map.has(key)) map.set(key, row);
    }
    return [...map.values()];
}

function extractTroubleFromMail(subject, body, sourceFile) {
    const text = `${subject}\n${body}`;
    if (!/defect|결함|고장|증상|symptom|trouble|수리|repair|overhaul/i.test(text)) return null;
    return {
        id: hashId(['mail-trouble', subject, body.slice(0, 200), sourceFile]),
        equipment: '',
        symptoms: summarizeBody(text, 400),
        rootCause: '',
        actionTaken: '',
        classRecommendation: /선급|class|KR|ClassNK/i.test(text) ? 'See mail / class mention' : '',
        sourceFile,
    };
}

async function connectClient(user, pass) {
    const client = new ImapFlow({
        host: 'imap.gmail.com',
        port: 993,
        secure: true,
        auth: { user, pass },
        logger: false,
    });
    await client.connect();
    return client;
}

async function fetchRecentMessages(client, scanCount) {
    const lock = await client.getMailboxLock('INBOX');
    const messages = [];
    try {
        const exists = client.mailbox.exists || 0;
        if (!exists) return messages;
        const fromSeq = Math.max(1, exists - scanCount + 1);
        const range = `${fromSeq}:${exists}`;
        for await (const msg of client.fetch(range, {
            uid: true,
            envelope: true,
            source: true,
            internalDate: true,
        })) {
            messages.push(msg);
        }
    } finally {
        lock.release();
    }
    return messages;
}

async function parseMessage(msg) {
    const parsed = await simpleParser(msg.source);
    return {
        uid: msg.uid,
        date: parsed.date?.toISOString?.() || msg.internalDate?.toISOString?.() || '',
        from: parsed.from?.text || msg.envelope?.from?.[0]?.address || '',
        subject: parsed.subject || msg.envelope?.subject || '',
        text: parsed.text || '',
        html: parsed.html || '',
        attachments: parsed.attachments || [],
    };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const user = String(process.env.GMAIL_USER || '').trim();
    const pass = normalizeAppPassword(process.env.GMAIL_APP_PASSWORD);

    if (!user || !pass) {
        console.error('GMAIL_USER / GMAIL_APP_PASSWORD 가 설정되지 않았습니다.');
        console.error('프로젝트 루트 `.env` 파일에 앱 비밀번호(공백 없이 16자)를 등록한 뒤 다시 실행하십시오.');
        process.exit(2);
    }

    const state = loadState();
    const processed = new Set(state.processedUids || []);

    let client;
    try {
        client = await connectClient(user, pass);
    } catch (e) {
        console.error('IMAP 로그인 실패:', e.message || e);
        console.error('Gmail 앱 비밀번호·2단계 인증·IMAP 사용 설정을 확인하십시오.');
        process.exit(1);
    }

    const scanned = await fetchRecentMessages(client, args.scan);
    await client.logout();

    const mailIntel = [];
    const newParts = [];
    const newTroubles = [];
    const newSnippets = [];
    let maritimeMatched = 0;
    let attachmentsSaved = 0;

    for (const msg of scanned) {
        if (processed.has(msg.uid)) continue;
        if (maritimeMatched >= args.matchLimit) break;

        let parsed;
        try {
            parsed = await parseMessage(msg);
        } catch (e) {
            console.warn(`[skip uid ${msg.uid}] parse failed: ${e.message || e}`);
            continue;
        }

        const composite = `${parsed.subject}\n${parsed.from}\n${parsed.text}\n${parsed.html}`;
        if (!matchesMaritime(composite)) continue;

        maritimeMatched += 1;
        const messageId = parsed.subject || `uid-${msg.uid}`;
        const relMailSource = `gmail/${msg.uid}/${sanitizeFilename(parsed.subject || 'mail')}.eml.meta`;
        const bodySnippet = summarizeBody(parsed.text || parsed.html?.replace(/<[^>]+>/g, ' ') || '');

        mailIntel.push({
            id: hashId(['mail', String(msg.uid), parsed.date, parsed.subject]),
            messageUid: msg.uid,
            date: parsed.date,
            from: parsed.from,
            subject: parsed.subject,
            bodySnippet,
            attachmentFiles: [],
            source: relMailSource,
        });

        const mailRecord = mailIntel[mailIntel.length - 1];
        const trouble = extractTroubleFromMail(parsed.subject, bodySnippet, relMailSource);
        if (trouble) newTroubles.push(trouble);

        if (bodySnippet.length > 40) {
            newSnippets.push({
                id: hashId(['mail-snippet', String(msg.uid), bodySnippet.slice(0, 120)]),
                text: bodySnippet,
                equipment: '',
                sourceFile: relMailSource,
            });
        }

        const attachDir = path.join(ATTACH_ROOT, String(msg.uid));
        for (const att of parsed.attachments) {
            const ext = path.extname(att.filename || '').toLowerCase();
            if (!ATTACH_EXT.has(ext)) continue;
            const fname = sanitizeFilename(att.filename);
            const diskPath = path.join(attachDir, fname);
            const relPath = path.relative(ROOT, diskPath);

            if (!args.dryRun) {
                fs.mkdirSync(attachDir, { recursive: true });
                fs.writeFileSync(diskPath, att.content);
            }
            attachmentsSaved += 1;
            mailRecord.attachmentFiles.push(relPath);
            if (!args.dryRun && fs.existsSync(diskPath)) {
                processFile(diskPath, newParts, newTroubles, newSnippets);
            }
        }

        processed.add(msg.uid);
    }

    const mergedParts = dedupeParts([...loadExistingParts(), ...newParts]);
    const mergedTroubles = dedupeTroubles([...(loadExistingTroubles()), ...newTroubles]);
    const priorKb = loadExistingKnowledgeBase() || {};
    const mergedMailIntel = dedupeMailIntel([
        ...(priorKb.historical_mail_intel || []),
        ...mailIntel,
    ]);

    const meta = {
        sourceRoot: `imap://${user}/INBOX`,
        mode: 'gmail-imap',
        directoriesScanned: 0,
        filesScanned: scanned.length,
        ingestedAt: new Date().toISOString(),
        gmail: {
            emailsScanned: scanned.length,
            maritimeMatched: mailIntel.length,
            attachmentsSaved,
            scanWindow: args.scan,
            matchLimit: args.matchLimit,
        },
    };

    if (!args.dryRun) {
        writeJson(OUT_PARTS, {
            version: 1,
            updatedAt: meta.ingestedAt,
            sourceRoot: meta.sourceRoot,
            parts: mergedParts,
        });
        writeJson(OUT_TROUBLE, {
            version: 1,
            updatedAt: meta.ingestedAt,
            sourceRoot: meta.sourceRoot,
            cases: mergedTroubles,
        });
        const kb = buildKnowledgeBase(meta, mergedParts, mergedTroubles, [
            ...(priorKb.retrieval?.snippets || []).slice(0, 2500),
            ...newSnippets,
        ], mergedMailIntel);
        kb.sources = { ...(priorKb.sources || {}), gmail: meta.gmail };
        writeJson(OUT_KB, kb);
        saveState({ ...state, processedUids: [...processed] });
    }

    const pricePoints = mergedParts.filter((p) => p.unitPrice != null).length;
    const newPricePoints = newParts.filter((p) => p.unitPrice != null).length;

    console.log('\n========== Gmail IMAP 해운 실무 수집 요약 ==========');
    console.log(`계정: ${user}`);
    console.log(`스캔한 메일(최근 ${args.scan}통 범위): ${scanned.length}`);
    console.log(`해운 키워드 매칭 메일: ${mailIntel.length} (이번 배치 한도 ${args.matchLimit})`);
    console.log(`다운로드한 Excel/CSV 첨부: ${attachmentsSaved}`);
    console.log(`지식베이스 historical_mail_intel 누적: ${mergedMailIntel.length}`);
    console.log(`부품·견적 레코드(전체): ${mergedParts.length} (이번 +${newParts.length})`);
    console.log(`단가 price point(전체): ${pricePoints} (이번 +${newPricePoints})`);
    console.log(`결함·수리 이력(전체): ${mergedTroubles.length} (이번 +${newTroubles.length})`);
    console.log(`첨부 저장 경로: ${path.relative(ROOT, ATTACH_ROOT)}/`);
    if (args.dryRun) console.log('(dry-run: 파일·JSON 미기록)');
    console.log('====================================================\n');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
