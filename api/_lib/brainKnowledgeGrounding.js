'use strict';

const fs = require('fs');
const path = require('path');

const KB_MAX_MATCHES = 6;

/** @type {{ mtimeMs: number, data: object | null, path: string | null } | null} */
let knowledgeBaseCache = null;

function knowledgeBaseCandidatePaths() {
    const root = process.cwd();
    return [
        path.join(root, 'data', 'tvc-knowledge-base.json'),
        path.join(root, 'public', 'data', 'tvc-knowledge-base.json'),
        path.join(__dirname, '..', '..', 'data', 'tvc-knowledge-base.json'),
        path.join(__dirname, '..', 'data', 'tvc-knowledge-base.json'),
    ];
}

function loadKnowledgeBase() {
    for (const kbPath of knowledgeBaseCandidatePaths()) {
        try {
            const stat = fs.statSync(kbPath);
            if (knowledgeBaseCache && knowledgeBaseCache.path === kbPath && knowledgeBaseCache.mtimeMs === stat.mtimeMs) {
                return knowledgeBaseCache.data;
            }
            const raw = fs.readFileSync(kbPath, 'utf8');
            const data = JSON.parse(raw);
            knowledgeBaseCache = { mtimeMs: stat.mtimeMs, data, path: kbPath };
            return data;
        } catch {
            /* try next path */
        }
    }
    knowledgeBaseCache = { mtimeMs: 0, data: null, path: null };
    return null;
}

/** Korean / mixed-field synonyms → extra English tokens for archive search */
const TOKEN_ALIASES = {
    메인엔진: ['main', 'engine', 'm/e'],
    mainengine: ['main', 'engine'],
    rpm헌팅: ['rpm', 'hunting', 'surging'],
    rpm헌팅현상: ['rpm', 'hunting', 'surging'],
    헌팅: ['hunting', 'surging'],
    조타: ['steering', 'rudder'],
    제조기: ['fwg', 'generator', 'fresh', 'water'],
    aux: ['generator', 'engine'],
    부품: ['part', 'spare'],
};

function queryTokens(query) {
    const q = String(query || '').toLowerCase();
    const raw = q.match(/[\p{L}\p{N}]{2,}/gu) || [];
    const uniq = new Set(raw.filter((t) => t.length >= 2));
    for (const t of [...uniq]) {
        const aliases = TOKEN_ALIASES[t];
        if (aliases) aliases.forEach((a) => uniq.add(a));
        if (t.includes('rpm') && t.includes('헌팅')) {
            uniq.add('rpm');
            uniq.add('hunting');
        }
    }
    if (uniq.has('rpm') || q.includes('rpm')) uniq.add('rpm');
    return [...uniq];
}

function scoreHaystack(hay, tokens) {
    const text = String(hay || '').toLowerCase();
    if (!text) return 0;
    let score = 0;
    for (const t of tokens) {
        if (text.includes(t)) score += t.length >= 4 ? 3 : 1;
    }
    return score;
}

function normalizeRetrievalPart(p) {
    return {
        part_number: p.partNumber || p.part_number || p.impa || '',
        name: p.description || p.name || '',
        standard_price: p.unitPrice != null ? p.unitPrice : p.standard_price,
        last_vendor: p.vendor || p.last_vendor || '',
        compatible_equipment: p.equipment || p.compatible_equipment || '',
    };
}

function normalizeRetrievalTrouble(t) {
    return {
        equipment: t.equipment || '',
        symptoms: t.symptoms || '',
        presumed_cause: t.rootCause || t.presumed_cause || t.trouble_cause || '',
        action_taken: t.actionTaken || t.action_taken || t.corrective_action || '',
        inspection_tips: t.classRecommendation || t.inspection_tips || t.class_remarks || '',
    };
}

function rankArchiveRows(rows, tokens, blobFn, exactFn) {
    return rows
        .map((row) => {
            const blob = blobFn(row);
            const score = scoreHaystack(blob, tokens) + (exactFn ? exactFn(row, tokens) : 0);
            return { item: row, score };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, KB_MAX_MATCHES)
        .map((x) => x.item);
}

function matchKnowledgeBaseFromData(kb, query) {
    if (!kb) return { parts: [], trouble: [] };

    const tokens = queryTokens(query);
    if (!tokens.length) return { parts: [], trouble: [] };

    const structuredParts = kb.structured_parts || [];
    const retrievalParts = (kb.retrieval && kb.retrieval.parts) || [];
    const allParts = [
        ...structuredParts,
        ...retrievalParts.map(normalizeRetrievalPart),
    ];

    const structuredTrouble = kb.trouble_history || [];
    const retrievalTrouble = (kb.retrieval && kb.retrieval.troubles) || [];
    const allTrouble = [
        ...structuredTrouble,
        ...retrievalTrouble.map(normalizeRetrievalTrouble),
    ];

    const parts = rankArchiveRows(
        allParts,
        tokens,
        (p) => [p.part_number, p.name, p.last_vendor, p.compatible_equipment].join(' '),
        (p, toks) => {
            const pn = String(p.part_number || '').toLowerCase();
            return toks.some((t) => pn && (pn === t || pn.includes(t))) ? 8 : 0;
        },
    );

    const trouble = rankArchiveRows(
        allTrouble,
        tokens,
        (t) => [t.equipment, t.symptoms, t.presumed_cause, t.action_taken, t.inspection_tips].join(' '),
        () => 0,
    );

    return { parts, trouble };
}

function matchKnowledgeBase(query) {
    return matchKnowledgeBaseFromData(loadKnowledgeBase(), query);
}

function formatHistoricalContext(matches, lang) {
    const { parts, trouble } = matches;
    if (!parts.length && !trouble.length) return '';

    const header =
        lang === 'EN'
            ? '[Verified historical context — dock/field repair records & unit pricing from TVC archives]'
            : '[검증된 역사적 맥락 — 선석/현장 과거 수리 실적 및 단가 데이터 (TVC 아카이브)]';

    const lines = [header, ''];

    if (parts.length) {
        lines.push(lang === 'EN' ? '— Spare / pricing records:' : '— 부품·단가 실적:');
        for (const p of parts) {
            const price =
                p.standard_price != null && p.standard_price !== ''
                    ? `USD ${p.standard_price}`
                    : lang === 'EN'
                      ? 'price n/a'
                      : '단가 미기록';
            lines.push(
                `• ${p.part_number || '—'} | ${p.name || '—'} | ${price} | vendor: ${p.last_vendor || '—'} | equipment: ${p.compatible_equipment || '—'}`,
            );
        }
        lines.push('');
    }

    if (trouble.length) {
        lines.push(lang === 'EN' ? '— Defect / repair history:' : '— 결함·수리 이력:');
        for (const t of trouble) {
            lines.push(`• ${t.equipment || '—'}`);
            lines.push(`  cause/symptoms: ${t.presumed_cause || t.symptoms || '—'}`);
            lines.push(`  action: ${t.action_taken || '—'}`);
            if (t.inspection_tips) lines.push(`  class/survey: ${t.inspection_tips}`);
        }
    }

    lines.push(
        lang === 'EN'
            ? 'Use the above as factual grounding when relevant; state if the user question is outside this data.'
            : '위 데이터가 질문과 관련 있으면 사실 근거로 활용하고, 범위 밖이면 명시하라.',
    );

    return lines.join('\n');
}

function formatGroundingAnswer(matches, lang) {
    const { parts, trouble } = matches;
    if (!parts.length && !trouble.length) return '';

    const lines = [];
    if (lang === 'EN') {
        lines.push('**Core conclusion:** Matching records were found in TVC historical repair & pricing archives.');
    } else {
        lines.push('**핵심 결론:** TVC 역사 수리·단가 아카이브에서 질의와 일치하는 현장 실적을 찾았습니다.');
    }
    lines.push('');

    if (parts.length) {
        lines.push(lang === 'EN' ? '**Spare / unit pricing (archived):**' : '**부품·단가 실적 (아카이브):**');
        for (const p of parts) {
            const price = p.standard_price != null ? `USD ${p.standard_price}` : '—';
            lines.push(
                `- **${p.part_number || '—'}** — ${p.name || '—'} · ${price} · ${p.last_vendor || '—'} · ${p.compatible_equipment || '—'}`,
            );
        }
        lines.push('');
    }

    if (trouble.length) {
        lines.push(lang === 'EN' ? '**Defect / repair history:**' : '**결함·수리 이력:**');
        for (const t of trouble) {
            lines.push(`- **${t.equipment || '—'}**`);
            lines.push(`  - ${lang === 'EN' ? 'Cause' : '원인'}: ${t.presumed_cause || t.symptoms || '—'}`);
            lines.push(`  - ${lang === 'EN' ? 'Action' : '조치'}: ${t.action_taken || '—'}`);
            if (t.inspection_tips) {
                lines.push(`  - ${lang === 'EN' ? 'Class / survey' : '선급·검사'}: ${t.inspection_tips}`);
            }
        }
        lines.push('');
    }

    lines.push(
        lang === 'EN'
            ? '**Safety & compliance:** Cross-check unit prices and procedures against current maker manuals and class requirements before procurement or execution.'
            : '**안전·법적 주의:** 조달·작업 전 메이커 매뉴얼·선급 기준과 반드시 교차 확인하십시오.',
    );

    return lines.join('\n');
}

function historicalSources(matches, lang) {
    const { parts, trouble } = matches;
    if (!parts.length && !trouble.length) return [];
    return [
        {
            label:
                lang === 'EN'
                    ? 'TVC historical archives (parts & repair log)'
                    : 'TVC 역사 아카이브 (부품·수리 실적)',
            provider: 'tvc-knowledge-base',
            path: 'data/tvc-knowledge-base.json',
        },
    ];
}

module.exports = {
    KB_MAX_MATCHES,
    loadKnowledgeBase,
    matchKnowledgeBase,
    matchKnowledgeBaseFromData,
    formatHistoricalContext,
    formatGroundingAnswer,
    historicalSources,
    queryTokens,
};
