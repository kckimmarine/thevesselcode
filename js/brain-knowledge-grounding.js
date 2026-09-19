/* Client-side TVC Brain archive keyword grounding (mirrors api/_lib/brainKnowledgeGrounding.js) */
(function () {
    const KB_MAX_MATCHES = 6;

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

    function matchKnowledgeBaseFromData(kb, query) {
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

    let kbPromise = null;

    function loadKnowledgeBaseJson() {
        if (!kbPromise) {
            kbPromise = fetch('/data/tvc-knowledge-base.json', { cache: 'no-cache' })
                .then((r) => (r.ok ? r.json() : null))
                .catch(() => null);
        }
        return kbPromise;
    }

    async function matchFromStaticArchive(query, lang) {
        const kb = await loadKnowledgeBaseJson();
        if (!kb) return { matches: { parts: [], trouble: [] }, answer: '' };
        const matches = matchKnowledgeBaseFromData(kb, query);
        const answer = formatGroundingAnswer(matches, lang === 'EN' ? 'EN' : 'KO');
        return { matches, answer };
    }

    window.TVC_BrainKnowledge = {
        matchKnowledgeBaseFromData,
        formatGroundingAnswer,
        loadKnowledgeBaseJson,
        matchFromStaticArchive,
    };
})();
