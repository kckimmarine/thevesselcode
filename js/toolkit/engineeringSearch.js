/**
 * Unified marine engineering knowledge index — search & ranking.
 * Dataset: data/engineering-knowledge-index.json
 */
(function (global) {
    'use strict';

    /** @type {Array<object> | null} */
    let _entries = null;

    function normalize(str) {
        return String(str || '')
            .trim()
            .toLowerCase()
            .normalize('NFKC');
    }

    function tokenize(query) {
        const q = normalize(query);
        if (!q) return [];
        return q.split(/[\s,/|]+/).filter(Boolean);
    }

    function setKnowledgeIndex(data) {
        const list = Array.isArray(data) ? data : data?.entries;
        if (!Array.isArray(list)) {
            throw new Error('Invalid engineering-knowledge-index payload');
        }
        _entries = list.map((e) => ({ ...e }));
    }

    function getKnowledgeEntries() {
        return _entries ? [..._entries] : [];
    }

    /**
     * @param {string} query
     * @returns {Array<{ entry: object, score: number, matchKind: string }>}
     */
    function searchEngineeringKnowledge(query) {
        const entries = _entries || [];
        const qNorm = normalize(query);
        if (!qNorm) return [];

        const tokens = tokenize(query);
        const results = [];

        for (const entry of entries) {
            const title = normalize(entry.title);
            const discipline = normalize(entry.discipline);
            const keywords = (entry.keywords || []).map(normalize);
            const keywordBlob = keywords.join(' ');

            let score = 0;
            let matchKind = '';

            if (title === qNorm) {
                score = 1000;
                matchKind = 'title-exact';
            } else if (title.includes(qNorm) || qNorm.includes(title)) {
                score = 800;
                matchKind = 'title-partial';
            } else {
                for (const kw of keywords) {
                    if (kw === qNorm) {
                        score = Math.max(score, 600);
                        matchKind = 'keyword-exact';
                    } else if (kw.includes(qNorm) || qNorm.includes(kw)) {
                        score = Math.max(score, 500);
                        matchKind = matchKind || 'keyword-partial';
                    }
                }
                if (keywordBlob.includes(qNorm)) {
                    score = Math.max(score, 450);
                    matchKind = matchKind || 'keyword-blob';
                }
                for (const tok of tokens) {
                    if (title.includes(tok)) score = Math.max(score, 400);
                    if (keywords.some((k) => k.includes(tok) || tok.includes(k))) {
                        score = Math.max(score, 350);
                        matchKind = matchKind || 'token-keyword';
                    }
                    if (discipline.includes(tok)) {
                        score = Math.max(score, 200);
                        matchKind = matchKind || 'discipline';
                    }
                }
            }

            if (score > 0) {
                results.push({ entry, score, matchKind });
            }
        }

        results.sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title));
        return results;
    }

    async function loadKnowledgeIndexFromJson(url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`engineering index fetch failed: ${res.status}`);
        const data = await res.json();
        setKnowledgeIndex(data);
        return getKnowledgeEntries();
    }

    const api = {
        setKnowledgeIndex,
        getKnowledgeEntries,
        searchEngineeringKnowledge,
        loadKnowledgeIndexFromJson,
        normalize,
    };

    global.TVC_EngineeringSearch = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
