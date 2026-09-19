'use strict';

const fs = require('fs');
const path = require('path');

const MAX_BODY_BYTES = 16 * 1024;
const MAX_QUERY_CHARS = 4000;
const KB_PATH = path.join(__dirname, '..', 'data', 'tvc-knowledge-base.json');

let cachedKnowledgeBase = null;
let cachedKnowledgeMtimeMs = 0;

const SYSTEM_PERSONA = `너는 1급 기관사이자 10년 차 수석 공무감독 'THE VESSEL CODE BRAIN'이다.
1. JIS 플랜지, ASTM 54B, 선급(Class) 규정, IMPA 자재를 물어보면 정밀한 공식과 수치를 최우선 제시하라.
2. 선박 엔진 결함, 전기 계통 이상, 해사 법규(SOLAS/MARPOL), 용선 계약 분쟁 등 내부 DB 외의 전문 영역도 현장 공무감독의 시각에서 명쾌하게 해결 절차를 설명하라.
3. 일반 공학, 화학, 번역, 비즈니스 상식을 물어보더라도 논리정연하고 친절하게 즉답하라.
4. 문체는 차분하고 묵직한 베테랑 선배의 어조를 유지하며, 군더더기를 배제하고 [핵심 결론/기준 수치 -> 현장 조치 절차 -> 안전 및 법적 주의사항] 순서로 출력하라.
5. 메시지에 [SUPERINTENDENT ARCHIVE] 블록이 포함되면 해당 실제 공무팀 이력(부품·견적·결함 조치)을 우선 근거로 삼고, 출처 파일명을 답변에 명시하라.`;

function loadKnowledgeBase() {
    try {
        if (!fs.existsSync(KB_PATH)) return null;
        const st = fs.statSync(KB_PATH);
        if (cachedKnowledgeBase && st.mtimeMs === cachedKnowledgeMtimeMs) {
            return cachedKnowledgeBase;
        }
        cachedKnowledgeBase = JSON.parse(fs.readFileSync(KB_PATH, 'utf8'));
        cachedKnowledgeMtimeMs = st.mtimeMs;
        return cachedKnowledgeBase;
    } catch (e) {
        console.warn('[ask-brain] knowledge base load failed', e.message || e);
        return null;
    }
}

function tokenizeQuery(query) {
    return String(query || '')
        .toLowerCase()
        .split(/[\s,./\\|()[\]:;]+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2);
}

function scoreText(tokens, text) {
    const hay = String(text || '').toLowerCase();
    let score = 0;
    for (const t of tokens) {
        if (hay.includes(t)) score += 1;
    }
    return score;
}

function buildSuperintendentArchiveContext(query, lang) {
    const kb = loadKnowledgeBase();
    const retrieval = kb && kb.retrieval;
    if (!retrieval) return { contextBlock: '', extraSources: [] };

    const tokens = tokenizeQuery(query);
    if (!tokens.length) return { contextBlock: '', extraSources: [] };

    const parts = (retrieval.parts || [])
        .map((p) => ({
            score: scoreText(tokens, [p.partNumber, p.impa, p.description, p.equipment, p.vendor].join(' ')),
            p,
        }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 6);

    const troubles = (retrieval.troubles || [])
        .map((t) => ({
            score: scoreText(tokens, [t.equipment, t.symptoms, t.rootCause, t.actionTaken, t.classRecommendation].join(' ')),
            t,
        }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 6);

    if (!parts.length && !troubles.length) {
        return { contextBlock: '', extraSources: [] };
    }

    const lines = [];
    if (lang === 'EN') {
        lines.push('[SUPERINTENDENT ARCHIVE — historical records from company Google Drive ingest]');
    } else {
        lines.push('[SUPERINTENDENT ARCHIVE — 공무팀 Google Drive 이력 DB]');
    }

    for (const { p } of parts) {
        const price = p.unitPrice != null ? `${p.unitPrice}${p.currency ? ` ${p.currency}` : ''}` : '—';
        lines.push(
            `- PART | ${p.partNumber || p.impa || '—'} | ${p.description || '—'} | equip: ${p.equipment || '—'} | vendor: ${p.vendor || '—'} | price: ${price} | src: ${p.sourceFile || '—'}`
        );
    }
    for (const { t } of troubles) {
        lines.push(
            `- TROUBLE | equip: ${t.equipment || '—'} | symptom: ${t.symptoms || '—'} | cause: ${t.rootCause || '—'} | action: ${t.actionTaken || '—'} | class: ${t.classRecommendation || '—'} | src: ${t.sourceFile || '—'}`
        );
    }

    const extraSources = [];
    const seen = new Set();
    for (const { p } of parts) {
        if (p.sourceFile && !seen.has(p.sourceFile)) {
            seen.add(p.sourceFile);
            extraSources.push({ label: `Superintendent archive: ${p.sourceFile}`, kind: 'superintendent_archive' });
        }
    }
    for (const { t } of troubles) {
        if (t.sourceFile && !seen.has(t.sourceFile)) {
            seen.add(t.sourceFile);
            extraSources.push({ label: `Superintendent archive: ${t.sourceFile}`, kind: 'superintendent_archive' });
        }
    }

    return { contextBlock: lines.join('\n'), extraSources };
}

function augmentQueryWithArchive(query, lang) {
    const { contextBlock, extraSources } = buildSuperintendentArchiveContext(query, lang);
    if (!contextBlock) {
        return { queryForModel: query, extraSources: [] };
    }
    return {
        queryForModel: `${contextBlock}\n\n---\nUser question:\n${query}`,
        extraSources,
    };
}

function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let total = 0;
        req.on('data', (chunk) => {
            total += chunk.length;
            if (total > MAX_BODY_BYTES) {
                reject(Object.assign(new Error('Payload too large'), { code: 'PAYLOAD_TOO_LARGE' }));
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => {
            try {
                const raw = Buffer.concat(chunks).toString('utf8');
                resolve(raw ? JSON.parse(raw) : {});
            } catch (e) {
                reject(e);
            }
        });
        req.on('error', reject);
    });
}

function normalizeLang(raw) {
    const v = String(raw || 'KO').trim().toUpperCase();
    return v === 'EN' ? 'EN' : 'KO';
}

function langHint(lang) {
    return lang === 'EN'
        ? 'Respond in clear English unless the user wrote in Korean.'
        : '사용자가 영어로 질문하지 않는 한 한국어로 답하라.';
}

function offlineFallbackAnswer(lang) {
    if (lang === 'EN') {
        return {
            answer: [
                '**Core conclusion:** The maritime AI backend is not configured on this deployment (no GEMINI_API_KEY or OPENAI_API_KEY).',
                '',
                '**Field steps:** Use the free Toolkit for IMPA lookup, ASTM 54B bunker math, and JIS flange tables while keys are provisioned.',
                '',
                '**Safety & compliance:** Always verify class, flag, and company SMS requirements before acting on any engineering guidance.',
            ].join('\n'),
            sources: [{ label: 'TVC Toolkit (offline)', url: '/toolkit' }],
        };
    }
    return {
        answer: [
            '**핵심 결론:** 이 배포 환경에는 AI API 키(GEMINI_API_KEY / OPENAI_API_KEY)가 설정되어 있지 않습니다.',
            '',
            '**현장 조치:** IMPA·ASTM 54B·JIS 플랜지는 무료 Toolkit에서 즉시 조회하십시오. 키 연동 후 동일 질문을 다시 보내시면 브레인이 분석합니다.',
            '',
            '**안전·법적 주의:** 선급·국적·사 SMS 기준과 교차 확인 없이는 작업 지시로 사용하지 마십시오.',
        ].join('\n'),
        sources: [{ label: 'TVC Toolkit (오프라인)', url: '/toolkit' }],
    };
}

async function callGemini(query, lang, extraSources) {
    const key = String(process.env.GEMINI_API_KEY || '').trim();
    if (!key) return null;

    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            systemInstruction: {
                parts: [{ text: `${SYSTEM_PERSONA}\n\n${langHint(lang)}` }],
            },
            contents: [
                {
                    role: 'user',
                    parts: [{ text: query }],
                },
            ],
            generationConfig: {
                temperature: 0.35,
                maxOutputTokens: 2048,
            },
        }),
    });

    if (!res.ok) {
        const text = await res.text();
        const err = new Error(`Gemini ${res.status}: ${text.slice(0, 400)}`);
        err.code = 'GEMINI_ERROR';
        throw err;
    }

    const data = await res.json();
    const answer = data?.candidates?.[0]?.content?.parts
        ?.map((p) => p.text || '')
        .join('')
        .trim();

    if (!answer) {
        const err = new Error('Gemini returned empty content');
        err.code = 'GEMINI_EMPTY';
        throw err;
    }

    const sources = [{ label: 'THE VESSEL CODE Brain (Gemini)', provider: 'gemini', model }];
    if (extraSources && extraSources.length) sources.push(...extraSources);

    return {
        answer,
        sources,
    };
}

async function callOpenAI(query, lang, extraSources) {
    const key = String(process.env.OPENAI_API_KEY || '').trim();
    if (!key) return null;

    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model,
            temperature: 0.35,
            max_tokens: 2048,
            messages: [
                { role: 'system', content: `${SYSTEM_PERSONA}\n\n${langHint(lang)}` },
                { role: 'user', content: query },
            ],
        }),
    });

    if (!res.ok) {
        const text = await res.text();
        const err = new Error(`OpenAI ${res.status}: ${text.slice(0, 400)}`);
        err.code = 'OPENAI_ERROR';
        throw err;
    }

    const data = await res.json();
    const answer = String(data?.choices?.[0]?.message?.content || '').trim();
    if (!answer) {
        const err = new Error('OpenAI returned empty content');
        err.code = 'OPENAI_EMPTY';
        throw err;
    }

    const sources = [{ label: 'THE VESSEL CODE Brain (OpenAI)', provider: 'openai', model }];
    if (extraSources && extraSources.length) sources.push(...extraSources);

    return {
        answer,
        sources,
    };
}

async function routeBrainQuery(query, lang) {
    const augmented = augmentQueryWithArchive(query, lang);
    const queryForModel = augmented.queryForModel;
    const archiveSources = augmented.extraSources;
    const geminiKey = String(process.env.GEMINI_API_KEY || '').trim();
    const openaiKey = String(process.env.OPENAI_API_KEY || '').trim();

    if (!geminiKey && !openaiKey) {
        return offlineFallbackAnswer(lang);
    }

    if (geminiKey) {
        try {
            const out = await callGemini(queryForModel, lang, archiveSources);
            if (out) return out;
        } catch (geminiErr) {
            console.error('[ask-brain] Gemini failed', geminiErr.message || geminiErr);
            if (!openaiKey) throw geminiErr;
        }
    }

    if (openaiKey) {
        const out = await callOpenAI(queryForModel, lang, archiveSources);
        if (out) return out;
    }

    return offlineFallbackAnswer(lang);
}

async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST, OPTIONS');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const body = await readJsonBody(req);
        const query = String(body.query || '').trim();
        const lang = normalizeLang(body.lang);

        if (!query) {
            return res.status(400).json({ error: 'query is required', answer: '', sources: [] });
        }
        if (query.length > MAX_QUERY_CHARS) {
            return res.status(400).json({
                error: 'query too long',
                answer: '',
                sources: [],
            });
        }

        const result = await routeBrainQuery(query, lang);
        const sources = Array.isArray(result.sources) ? result.sources : [];
        return res.status(200).json({
            answer: result.answer || '',
            sources,
        });
    } catch (e) {
        console.error('[ask-brain] unhandled', e);
        if (e.code === 'PAYLOAD_TOO_LARGE') {
            return res.status(413).json({ error: 'Payload too large', answer: '', sources: [] });
        }
        const lang = normalizeLang();
        const fallback = offlineFallbackAnswer(lang);
        return res.status(200).json({
            answer: `${fallback.answer}\n\n_(Temporary routing error: ${String(e.message || e).slice(0, 200)})_`,
            sources: fallback.sources,
        });
    }
}

module.exports = handler;
