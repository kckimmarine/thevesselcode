'use strict';

const {
    loadKnowledgeBase,
    matchKnowledgeBaseFromData,
    formatGroundingAnswer,
    historicalSources,
} = require('./_lib/brainKnowledgeGrounding');

const MAX_BODY_BYTES = 16 * 1024;
const MAX_QUERY_CHARS = 4000;

const SYSTEM_PERSONA = `너는 THE VESSEL CODE BRAIN — 글로벌 선박 표준·규격·운영 데이터에 기반한 중립적 Maritime Search & Intelligence Hub이다.
1. JIS 플랜지, ASTM 54B, 선급(Class) 규정, IMPA 자재를 물어보면 정밀한 공식과 수치를 최우선 제시하라.
2. 선박 기계·전기·해사 법규(SOLAS/MARPOL) 질의는 maker manual·class rule·현장 안전 기준 관점에서 객관적으로 설명하라.
3. 일반 공학·화학·번역·비즈니스 질의도 논리정연하고 친절하게 답하라.
4. 문체는 차분하고 전문적이며, [핵심 결론/기준 수치 → 현장 조치 절차 → 안전·법적 주의] 순서로 출력하라.
5. 특정 선사명·개인 이름·과거 직함·연차(예: ○○년 차)를 답변에 끌어오지 말고, TVC 지식베이스의 객관적 기록만 인용하라.
6. 메시지에 [TVC MARITIME INTEL] 블록(PART/TROUBLE/MAIL)이 있으면 해당 기록을 우선 근거로 삼고, 출처(source)를 명시하라.`;

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

function appendDomainArchiveLines(lines, extraSources, kb, query, seenSources) {
    const { parts, trouble } = matchKnowledgeBaseFromData(kb, query);
    for (const p of parts) {
        const price = p.standard_price != null ? `${p.standard_price} USD` : '—';
        lines.push(
            `- PART | ${p.part_number || '—'} | ${p.name || '—'} | equip: ${p.compatible_equipment || '—'} | vendor: ${p.last_vendor || '—'} | price: ${price} | src: data/raw_archives`,
        );
    }
    for (const t of trouble) {
        lines.push(
            `- TROUBLE | equip: ${t.equipment || '—'} | symptom: ${t.symptoms || '—'} | cause: ${t.presumed_cause || '—'} | action: ${t.action_taken || '—'} | class: ${t.inspection_tips || '—'} | src: data/raw_archives`,
        );
    }
    if ((parts.length || trouble.length) && !seenSources.has('domain-archives')) {
        seenSources.add('domain-archives');
        extraSources.push({ label: 'TVC domain archives (raw_archives ingest)', kind: 'tvc_archive_domain' });
    }
    return parts.length + trouble.length;
}

function buildSuperintendentArchiveContext(query, lang) {
    const kb = loadKnowledgeBase();
    if (!kb) return { contextBlock: '', extraSources: [] };

    const tokens = tokenizeQuery(query);
    if (!tokens.length) return { contextBlock: '', extraSources: [] };

    const retrieval = kb.retrieval || {};
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

    const domainMatches = matchKnowledgeBaseFromData(kb, query);

    if (
        !parts.length &&
        !troubles.length &&
        !mailRows.length &&
        !domainMatches.parts.length &&
        !domainMatches.trouble.length
    ) {
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
    appendDomainArchiveLines(lines, extraSources, kb, query, seen);
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

/** @type {string[]} */
const GEMINI_MODEL_FALLBACKS = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-flash-8b',
];

function normalizeGeminiModel(raw) {
    let model = String(raw || '').trim();
    if (model.startsWith('models/')) model = model.slice('models/'.length);
    return model;
}

function buildGeminiModelList() {
    const preferred = normalizeGeminiModel(process.env.GEMINI_MODEL || 'gemini-2.5-flash');
    const list = [preferred];
    for (const m of GEMINI_MODEL_FALLBACKS) {
        if (m && !list.includes(m)) list.push(m);
    }
    return list;
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

function providerFailureAnswer(lang, detail) {
    const detailLine = detail ? `\n\n**Technical:** ${detail}` : '';
    if (lang === 'EN') {
        return {
            answer: [
                '**Core conclusion:** TVC Brain could not reach the configured AI model (Gemini/OpenAI). Keys may be set, but the model name or API access failed.',
                '',
                '**Field steps:** In Vercel → Project → Settings → Environment Variables, verify `GEMINI_API_KEY` and set `GEMINI_MODEL` to `gemini-2.0-flash` if needed, or add `OPENAI_API_KEY` as fallback. IMPA·ASTM·JIS lookups remain available in the free Toolkit.',
                '',
                '**Safety & compliance:** Do not treat this message as engineering guidance; cross-check class, flag, and company SMS before any shipboard action.',
                detailLine,
            ].join('\n'),
            sources: [{ label: 'TVC Toolkit', url: '/toolkit' }],
        };
    }
    return {
        answer: [
            '**핵심 결론:** TVC Brain이 설정된 AI 모델(Gemini/OpenAI)에 연결하지 못했습니다. API 키는 있을 수 있으나 모델 이름·권한 오류일 수 있습니다.',
            '',
            '**현장 조치:** Vercel 프로젝트 → Settings → Environment Variables에서 `GEMINI_API_KEY`를 확인하고, `GEMINI_MODEL`을 `gemini-2.0-flash`로 지정하거나 `OPENAI_API_KEY`를 백업으로 추가하십시오. IMPA·ASTM·JIS는 무료 Toolkit에서 즉시 조회 가능합니다.',
            '',
            '**안전·법적 주의:** 본 메시지는 공학 지침이 아닙니다. 선급·국적·사 SMS와 반드시 교차 확인하십시오.',
            detailLine,
        ].join('\n'),
        sources: [{ label: 'TVC Toolkit', url: '/toolkit' }],
    };
}

async function callGeminiOnce(model, key, query, lang) {
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
        err.httpStatus = res.status;
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

    return answer;
}

async function callGemini(query, lang, extraSources) {
    const key = String(process.env.GEMINI_API_KEY || '').trim();
    if (!key) return null;

    const models = buildGeminiModelList();
    let lastErr = null;

    for (const model of models) {
        try {
            const answer = await callGeminiOnce(model, key, query, lang);
            const sources = [{ label: 'THE VESSEL CODE Brain (Gemini)', provider: 'gemini', model }];
            if (extraSources && extraSources.length) sources.push(...extraSources);
            return { answer, sources };
        } catch (err) {
            lastErr = err;
            const retryable = err.code === 'GEMINI_ERROR' && (err.httpStatus === 404 || err.httpStatus === 400);
            if (retryable && models.indexOf(model) < models.length - 1) {
                console.warn('[ask-brain] Gemini model failed, trying next', model, err.message || err);
                continue;
            }
            throw err;
        }
    }

    throw lastErr || new Error('Gemini routing failed');
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

function offlineWithArchives(query, lang) {
    const kb = loadKnowledgeBase();
    const matches = matchKnowledgeBaseFromData(kb, query);
    const grounding = formatGroundingAnswer(matches, lang);
    if (!grounding) return null;

    const aiNote =
        lang === 'EN'
            ? '\n\n_(Generative Brain analysis requires GEMINI_API_KEY or OPENAI_API_KEY on the server; archive records above are from your ingested files.)_'
            : '\n\n_(생성형 Brain 분석은 서버 API 키 연동 후 가능합니다. 위 실적은 ingest된 아카이브 데이터입니다.)_';

    return {
        answer: grounding + aiNote,
        grounding,
        sources: historicalSources(matches, lang),
    };
}

async function routeBrainQuery(query, lang) {
    const augmented = augmentQueryWithArchive(query, lang);
    const queryForModel = augmented.queryForModel;
    const archiveSources = augmented.extraSources;
    const kbMatches = matchKnowledgeBaseFromData(loadKnowledgeBase(), query);
    const grounding = formatGroundingAnswer(kbMatches, lang);
    const geminiKey = String(process.env.GEMINI_API_KEY || '').trim();
    const openaiKey = String(process.env.OPENAI_API_KEY || '').trim();

    if (!geminiKey && !openaiKey) {
        const archiveFirst = offlineWithArchives(query, lang);
        if (archiveFirst) return archiveFirst;
        return offlineFallbackAnswer(lang);
    }

    if (geminiKey) {
        try {
            const out = await callGemini(queryForModel, lang, archiveSources);
            if (out) {
                return grounding ? { ...out, grounding } : out;
            }
        } catch (geminiErr) {
            console.error('[ask-brain] Gemini failed', geminiErr.message || geminiErr);
            if (!openaiKey) {
                const archiveFirst = offlineWithArchives(query, lang);
                if (archiveFirst) return archiveFirst;
                throw geminiErr;
            }
        }
    }

    if (openaiKey) {
        try {
            const out = await callOpenAI(queryForModel, lang, archiveSources);
            if (out) {
                return grounding ? { ...out, grounding } : out;
            }
        } catch (openaiErr) {
            console.error('[ask-brain] OpenAI failed', openaiErr.message || openaiErr);
            const archiveFirst = offlineWithArchives(query, lang);
            if (archiveFirst) return archiveFirst;
            throw openaiErr;
        }
    }

    const archiveFirst = offlineWithArchives(query, lang);
    if (archiveFirst) return archiveFirst;

    return providerFailureAnswer(lang, 'All configured providers returned empty.');
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

    let lang = 'KO';
    let query = '';
    try {
        const body = await readJsonBody(req);
        query = String(body.query || '').trim();
        lang = normalizeLang(body.lang);

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
        const payload = {
            answer: result.answer || '',
            sources,
        };
        if (result.grounding) payload.grounding = result.grounding;
        return res.status(200).json(payload);
    } catch (e) {
        console.error('[ask-brain] unhandled', e);
        if (e.code === 'PAYLOAD_TOO_LARGE') {
            return res.status(413).json({ error: 'Payload too large', answer: '', sources: [] });
        }
        const archiveFirst = query ? offlineWithArchives(query, lang) : null;
        if (archiveFirst) {
            return res.status(200).json({
                answer: archiveFirst.answer,
                sources: archiveFirst.sources,
                grounding: archiveFirst.grounding,
            });
        }
        const geminiKey = String(process.env.GEMINI_API_KEY || '').trim();
        const openaiKey = String(process.env.OPENAI_API_KEY || '').trim();
        const detail = String(e.message || e).slice(0, 280);
        const fallback = (geminiKey || openaiKey)
            ? providerFailureAnswer(lang, detail)
            : offlineFallbackAnswer(lang);
        return res.status(200).json({
            answer: fallback.answer,
            sources: fallback.sources,
        });
    }
}

module.exports = handler;
module.exports._testing = {
    normalizeGeminiModel,
    buildGeminiModelList,
    offlineFallbackAnswer,
    providerFailureAnswer,
};
