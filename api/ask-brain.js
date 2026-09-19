'use strict';

const fs = require('fs');
const path = require('path');

const MAX_BODY_BYTES = 16 * 1024;
const MAX_QUERY_CHARS = 4000;
const KB_MAX_MATCHES = 6;

/** @type {{ mtimeMs: number, data: object | null } | null} */
let knowledgeBaseCache = null;

function knowledgeBasePath() {
    return path.join(__dirname, '..', 'data', 'tvc-knowledge-base.json');
}

function loadKnowledgeBase() {
    const kbPath = knowledgeBasePath();
    try {
        const stat = fs.statSync(kbPath);
        if (knowledgeBaseCache && knowledgeBaseCache.mtimeMs === stat.mtimeMs) {
            return knowledgeBaseCache.data;
        }
        const raw = fs.readFileSync(kbPath, 'utf8');
        const data = JSON.parse(raw);
        knowledgeBaseCache = { mtimeMs: stat.mtimeMs, data };
        return data;
    } catch {
        knowledgeBaseCache = { mtimeMs: 0, data: null };
        return null;
    }
}

function queryTokens(query) {
    const q = String(query || '').toLowerCase();
    const tokens = q.match(/[\p{L}\p{N}]{2,}/gu) || [];
    const uniq = new Set(tokens.filter((t) => t.length >= 2));
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

function matchKnowledgeBase(query) {
    const kb = loadKnowledgeBase();
    if (!kb) return { parts: [], trouble: [] };

    const tokens = queryTokens(query);
    if (!tokens.length) return { parts: [], trouble: [] };

    const parts = (kb.structured_parts || [])
        .map((p) => {
            const blob = [p.part_number, p.name, p.last_vendor, p.compatible_equipment].join(' ');
            const score = scoreHaystack(blob, tokens);
            const pn = String(p.part_number || '').toLowerCase();
            const exact = tokens.some((t) => pn && (pn === t || pn.includes(t)));
            return { item: p, score: score + (exact ? 8 : 0) };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, KB_MAX_MATCHES)
        .map((x) => x.item);

    const trouble = (kb.trouble_history || [])
        .map((t) => {
            const blob = [t.equipment, t.symptoms, t.presumed_cause, t.action_taken, t.inspection_tips].join(' ');
            return { item: t, score: scoreHaystack(blob, tokens) };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, KB_MAX_MATCHES)
        .map((x) => x.item);

    return { parts, trouble };
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

const SYSTEM_PERSONA = `너는 1급 기관사이자 10년 차 수석 공무감독 'THE VESSEL CODE BRAIN'이다.
1. JIS 플랜지, ASTM 54B, 선급(Class) 규정, IMPA 자재를 물어보면 정밀한 공식과 수치를 최우선 제시하라.
2. 선박 엔진 결함, 전기 계통 이상, 해사 법규(SOLAS/MARPOL), 용선 계약 분쟁 등 내부 DB 외의 전문 영역도 현장 공무감독의 시각에서 명쾌하게 해결 절차를 설명하라.
3. 일반 공학, 화학, 번역, 비즈니스 상식을 물어보더라도 논리정연하고 친절하게 즉답하라.
4. 문체는 차분하고 묵직한 베테랑 선배의 어조를 유지하며, 군더더기를 배제하고 [핵심 결론/기준 수치 -> 현장 조치 절차 -> 안전 및 법적 주의사항] 순서로 출력하라.`;

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

async function callGemini(query, lang, historicalContext) {
    const key = String(process.env.GEMINI_API_KEY || '').trim();
    if (!key) return null;

    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;

    const systemParts = `${SYSTEM_PERSONA}\n\n${langHint(lang)}`;
    const systemInstruction = historicalContext
        ? `${systemParts}\n\n${historicalContext}`
        : systemParts;

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            systemInstruction: {
                parts: [{ text: systemInstruction }],
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

    return {
        answer,
        sources: [{ label: 'THE VESSEL CODE Brain (Gemini)', provider: 'gemini', model }],
    };
}

async function callOpenAI(query, lang, historicalContext) {
    const key = String(process.env.OPENAI_API_KEY || '').trim();
    if (!key) return null;

    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const systemContent = historicalContext
        ? `${SYSTEM_PERSONA}\n\n${langHint(lang)}\n\n${historicalContext}`
        : `${SYSTEM_PERSONA}\n\n${langHint(lang)}`;

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
                { role: 'system', content: systemContent },
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

    return {
        answer,
        sources: [{ label: 'THE VESSEL CODE Brain (OpenAI)', provider: 'openai', model }],
    };
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

async function routeBrainQuery(query, lang) {
    const geminiKey = String(process.env.GEMINI_API_KEY || '').trim();
    const openaiKey = String(process.env.OPENAI_API_KEY || '').trim();

    const kbMatches = matchKnowledgeBase(query);
    const historicalContext = formatHistoricalContext(kbMatches, lang);
    const kbSources = historicalSources(kbMatches, lang);

    if (!geminiKey && !openaiKey) {
        const fallback = offlineFallbackAnswer(lang);
        return {
            ...fallback,
            sources: [...kbSources, ...fallback.sources],
        };
    }

    if (geminiKey) {
        try {
            const out = await callGemini(query, lang, historicalContext);
            if (out) {
                return {
                    ...out,
                    sources: [...kbSources, ...out.sources],
                };
            }
        } catch (geminiErr) {
            console.error('[ask-brain] Gemini failed', geminiErr.message || geminiErr);
            if (!openaiKey) throw geminiErr;
        }
    }

    if (openaiKey) {
        const out = await callOpenAI(query, lang, historicalContext);
        if (out) {
            return {
                ...out,
                sources: [...kbSources, ...out.sources],
            };
        }
    }

    const fallback = offlineFallbackAnswer(lang);
    return {
        ...fallback,
        sources: [...kbSources, ...fallback.sources],
    };
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
