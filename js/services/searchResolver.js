/**
 * TVC Portal — unified search classification (single direct answer).
 * Priority: IMPA / Toolkit spec → Vessel particulars → TVC Brain briefing.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    if (typeof root !== 'undefined') {
        root.TVC_SearchResolver = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function searchResolverFactory() {
    const TOOLKIT_HINT_RE = /\b(IMPA|JIS|ANSI|ASTM|54B|PCD|DN\b|NPS|Kg\/cm|bar\b|flange|벙커|플랜지|IMPA\s*\d|VCF|bunker|fuel\s*calc)/i;
    const BRAIN_HINT_RE = /(원인|수리|헌팅|고장|조치|증상|결함|누설|불량|점화|trouble|defect|symptom|repair|cause|hunting|failure|malfunction|why|how\s+to|진단|overhaul|maintenance|leak|\bspec\b)/i;
    const VESSEL_IMO_RE = /^\d{7}$/;

    function normalizeQuery(raw) {
        return String(raw || '').trim();
    }

    function digitsOnly(str) {
        return String(str || '').replace(/\D/g, '');
    }

    function isImpaCode(query) {
        const digits = digitsOnly(query);
        return /^\d{6}$/.test(digits);
    }

    function impaFromQuery(query) {
        const m = String(query || '').match(/\b(\d{6})\b/);
        return m ? m[1] : null;
    }

    function isBrainNaturalQuery(query) {
        const q = normalizeQuery(query);
        if (!q) return false;
        if (/[?？]/.test(q)) return true;
        if (BRAIN_HINT_RE.test(q)) return true;
        if (/\b(RPM|rpm)\b/.test(q) && /[\uac00-\ud7a3]/.test(q)) return true;
        if (q.length > 12 && /[\uac00-\ud7a3]/.test(q)) return true;
        if (q.length > 18 && /\s/.test(q)) return true;
        return false;
    }

    function isToolkitSpecQuery(query) {
        const q = normalizeQuery(query);
        if (!q) return false;
        if (isImpaCode(q)) return true;
        const impa = impaFromQuery(q);
        if (impa && q.length <= 16) return true;
        if (TOOLKIT_HINT_RE.test(q) && !isBrainNaturalQuery(q)) return true;
        if (/^[\d\s./+\-*%,]+$/i.test(q) && q.length <= 28) return true;
        if (/\d+\s*[Kk]\s*\d+\s*[Aa]/i.test(q)) return true;
        return false;
    }

    function resolveToolkitTool(query) {
        const q = normalizeQuery(query).toLowerCase();
        if (/\b(54b|vcf|bunker|벙커|fuel|co2|co₂)\b/i.test(q)) return 'bunker';
        if (/\b(flange|jis|ansi|pcd|dn\b|nps|플랜지)\b/i.test(q)) return 'engineering';
        if (/\b(lube|lubricat|cylinder oil|system oil)\b/i.test(q)) return 'lube';
        if (/\b(paint|coating|antifouling|epoxy)\b/i.test(q)) return 'paint';
        if (/\b(pt100|rtd|motor|flc|eocr|electrical)\b/i.test(q)) return 'electrical';
        if (/\b(psc|mou|cic|survey|statutory)\b/i.test(q)) return 'compliance';
        if (/\b(torque|deflection|mechanical)\b/i.test(q)) return 'mechanical';
        if (/\b(pmax|combustion|cylinder)\b/i.test(q)) return 'combustion';
        if (/\b(refriger|superheat|boiler blowdown|auxiliary)\b/i.test(q)) return 'auxiliary';
        if (isImpaCode(query) || impaFromQuery(query)) return 'catalog';
        return 'catalog';
    }

    function isVesselImoQuery(query) {
        const imo = digitsOnly(query);
        return VESSEL_IMO_RE.test(imo);
    }

    function isLikelyVesselNameQuery(query) {
        const q = normalizeQuery(query);
        if (q.length < 3) return false;
        if (isImpaCode(q) || isVesselImoQuery(q)) return false;
        if (isBrainNaturalQuery(q)) return false;
        if (isToolkitSpecQuery(q)) return false;
        if (/^\d+$/.test(digitsOnly(q)) && digitsOnly(q).length >= 6) return false;
        return /[a-zA-Z\uac00-\ud7a3]/.test(q);
    }

    /**
     * @returns {{
     *   type: 'empty'|'impa'|'toolkit'|'vessel'|'brain'|'catalog',
     *   confidence: 'high'|'medium'|'low',
     *   direct: boolean,
     *   query?: string,
     *   impa?: string,
     *   imo?: string,
     *   tool?: string,
     *   briefing?: boolean,
     * }}
     */
    function classifyQuery(rawQuery) {
        const q = normalizeQuery(rawQuery);
        if (!q) {
            return { type: 'empty', confidence: 'low', direct: false };
        }

        const impaDigits = digitsOnly(q);
        if (/^\d{6}$/.test(impaDigits)) {
            return {
                type: 'impa',
                impa: impaDigits,
                confidence: 'high',
                direct: true,
                tool: 'catalog',
            };
        }

        if (isToolkitSpecQuery(q) && !isBrainNaturalQuery(q)) {
            const impa = impaFromQuery(q);
            if (impa) {
                return {
                    type: 'impa',
                    impa,
                    confidence: 'high',
                    direct: true,
                    tool: 'catalog',
                    query: q,
                };
            }
            return {
                type: 'toolkit',
                query: q,
                tool: resolveToolkitTool(q),
                confidence: 'high',
                direct: true,
            };
        }

        if (isVesselImoQuery(q)) {
            const imo = digitsOnly(q).slice(0, 7);
            return {
                type: 'vessel',
                imo,
                confidence: 'high',
                direct: true,
                query: q,
            };
        }

        if (isLikelyVesselNameQuery(q)) {
            return {
                type: 'vessel',
                query: q,
                confidence: 'medium',
                direct: true,
            };
        }

        if (isBrainNaturalQuery(q)) {
            return {
                type: 'brain',
                query: q,
                confidence: 'high',
                direct: true,
                briefing: true,
            };
        }

        if (isToolkitSpecQuery(q)) {
            return {
                type: 'toolkit',
                query: q,
                tool: resolveToolkitTool(q),
                confidence: 'medium',
                direct: true,
            };
        }

        return {
            type: 'brain',
            query: q,
            confidence: 'medium',
            direct: true,
            briefing: true,
        };
    }

    /** @deprecated use classifyQuery — kept for home-hero tests */
    function routeHeroQuery(query) {
        const c = classifyQuery(query);
        const q = normalizeQuery(query);
        if (c.type === 'empty') return { type: 'toolkit', href: '/toolkit' };
        if (c.type === 'brain') return { type: 'brain', query: c.query };
        if (c.type === 'impa') return { type: 'toolkit', href: `/store/${c.impa}` };
        if (c.type === 'vessel') {
            const param = c.imo ? `imo=${encodeURIComponent(c.imo)}` : `vessel=${encodeURIComponent(c.query || q)}`;
            return { type: 'toolkit', href: `/toolkit?${param}` };
        }
        if (c.type === 'toolkit') {
            const tool = c.tool && c.tool !== 'catalog' ? c.tool : null;
            const qs = tool ? `tool=${encodeURIComponent(tool)}&q=${encodeURIComponent(c.query || q)}` : `q=${encodeURIComponent(c.query || q)}`;
            return { type: 'toolkit', href: `/toolkit?${qs}` };
        }
        return { type: 'brain', query: q };
    }

    function destinationForQuery(query) {
        const r = routeHeroQuery(query);
        return r.type === 'toolkit' ? r.href : `/toolkit?q=${encodeURIComponent(r.query)}`;
    }

    function shouldSuppressResultList(classification) {
        return Boolean(classification?.direct && classification.confidence !== 'low');
    }

    return {
        classifyQuery,
        routeHeroQuery,
        destinationForQuery,
        isToolkitSpecQuery,
        isBrainNaturalQuery,
        isImpaCode,
        impaFromQuery,
        resolveToolkitTool,
        shouldSuppressResultList,
        normalizeQuery,
    };
});
