'use strict';

const fs = require('fs');
const path = require('path');

const MAX_BODY_BYTES = 16 * 1024;
const MAX_QUERY_CHARS = 4000;
const KB_PATH = path.join(__dirname, '..', 'data', 'tvc-knowledge-base.json');

let cachedKnowledgeBase = null;
let cachedKnowledgeMtimeMs = 0;

const SYSTEM_PERSONA = `너는 THE VESSEL CODE BRAIN — 글로벌 선박 표준·규격·운영 데이터에 기반한 중립적 Maritime Search & Intelligence Hub이다.
1. JIS 플랜지, ASTM 54B, 선급(Class) 규정, IMPA 자재를 물어보면 정밀한 공식과 수치를 최우선 제시하라.
2. 선박 기계·전기·해사 법규(SOLAS/MARPOL) 질의는 maker manual·class rule·현장 안전 기준 관점에서 객관적으로 설명하라.
3. 일반 공학·화학·번역·비즈니스 질의도 논리정연하고 친절하게 답하라.
4. 문체는 차분하고 전문적이며, [핵심 결론/기준 수치 → 현장 조치 절차 → 안전·법적 주의] 순서로 출력하라.
5. 특정 선사명·개인 이름·과거 직함·연차(예: ○○년 차)를 답변에 끌어오지 말고, TVC 지식베이스의 객관적 기록만 인용하라.
6. 메시지에 [TVC MARITIME INTEL] 블록(PART/TROUBLE/MAIL)이 있으면 해당 기록을 우선 근거로 삼고, 출처(source)를 명시하라.`;

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

    const mailRows = (retrieval.mailIntel || [])
        .map((m) => ({
            score: scoreText(tokens, [m.subject, m.from, m.bodySnippet, (m.attachmentFiles || []).join(' ')].join(' ')),
            m,
        }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);

    if (!parts.length && !troubles.length && !mailRows.length) {
        return { contextBlock: '', extraSources: [] };
    }

    const lines = [];
    if (lang === 'EN') {
        lines.push('[TVC MARITIME INTEL — verified parts, pricing, defect/repair records from TVC knowledge base]');
    } else {
        lines.push('[TVC MARITIME INTEL — TVC 지식베이스(부품·단가·결함/정비 기록)]');
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
    for (const { m } of mailRows) {
        lines.push(
            `- MAIL | ${m.date || '—'} | from: ${m.from || '—'} | subject: ${m.subject || '—'} | snippet: ${(m.bodySnippet || '—').slice(0, 280)} | attachments: ${(m.attachmentFiles || []).length}`
        );
    }

    const extraSources = [];
    const seen = new Set();
    for (const { p } of parts) {
        if (p.sourceFile && !seen.has(p.sourceFile)) {
            seen.add(p.sourceFile);
            extraSources.push({ label: `TVC archive (PART): ${p.sourceFile}`, kind: 'tvc_archive_part' });
        }
    }
    for (const { t } of troubles) {
        if (t.sourceFile && !seen.has(t.sourceFile)) {
            seen.add(t.sourceFile);
            extraSources.push({ label: `TVC archive (TROUBLE): ${t.sourceFile}`, kind: 'tvc_archive_trouble' });
        }
    }
    for (const { m } of mailRows) {
        const label = `Gmail: ${m.subject || m.source || 'maritime mail'}`;
        if (!seen.has(label)) {
            seen.add(label);
            extraSources.push({ label, kind: 'gmail_intel' });
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

    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
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
