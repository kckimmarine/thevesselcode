/* THE VESSEL CODE — Home hero unified search (Toolkit specs + TVC Brain) */
(function () {
    const TOOLKIT_HINT_RE = /\b(IMPA|JIS|ANSI|ASTM|54B|PCD|DN\b|NPS|Kg\/cm|bar\b|flange|벙커|플랜지|IMPA\s*\d)/i;
    const BRAIN_HINT_RE = /(원인|수리|헌팅|고장|조치|증상|결함|누설|불량|점화|trouble|defect|symptom|repair|cause|hunting|failure|malfunction|why|how\s+to|진단|overhaul|maintenance)/i;

    function normalizeQuery(raw) {
        return String(raw || '').trim();
    }

    function isImpaCode(query) {
        const digits = query.replace(/\s/g, '');
        return /^\d{6}$/.test(digits);
    }

    function impaFromQuery(query) {
        const m = query.match(/\b(\d{6})\b/);
        return m ? m[1] : null;
    }

    function isToolkitSpecQuery(query) {
        const q = normalizeQuery(query);
        if (!q) return true;
        if (isImpaCode(q)) return true;
        if (impaFromQuery(q) && q.length <= 16) return true;
        if (TOOLKIT_HINT_RE.test(q) && !BRAIN_HINT_RE.test(q)) return true;
        if (/^[\d\s./+\-*%,]+$/i.test(q) && q.length <= 28) return true;
        if (/\d+\s*[Kk]\s*\d+\s*[Aa]/i.test(q)) return true;
        return false;
    }

    function isBrainNaturalQuery(query) {
        const q = normalizeQuery(query);
        if (!q) return false;
        if (/[?？]/.test(q)) return true;
        if (BRAIN_HINT_RE.test(q)) return true;
        if (q.length > 12 && /[\uac00-\ud7a3]/.test(q)) return true;
        if (q.length > 18 && /\s/.test(q)) return true;
        return false;
    }

    function routeHeroQuery(query) {
        const q = normalizeQuery(query);
        if (!q) return { type: 'toolkit', href: '/toolkit' };
        if (isBrainNaturalQuery(q) && !isImpaCode(q)) {
            return { type: 'brain', query: q };
        }
        if (isToolkitSpecQuery(q)) {
            if (isImpaCode(q)) {
                return { type: 'toolkit', href: `/store/${q.replace(/\s/g, '')}` };
            }
            const impa = impaFromQuery(q);
            if (impa && TOOLKIT_HINT_RE.test(q)) {
                return { type: 'toolkit', href: `/store/${impa}` };
            }
            return { type: 'toolkit', href: `/toolkit?q=${encodeURIComponent(q)}` };
        }
        return { type: 'brain', query: q };
    }

    function destinationForQuery(query) {
        const r = routeHeroQuery(query);
        return r.type === 'toolkit' ? r.href : `/toolkit?q=${encodeURIComponent(r.query)}`;
    }

    function openBrain(query) {
        if (globalThis.TVC_BrainChat && typeof globalThis.TVC_BrainChat.openModal === 'function') {
            globalThis.TVC_BrainChat.openModal(query);
            return true;
        }
        return false;
    }

    function handleSubmit(input) {
        const q = normalizeQuery(input.value);
        if (!q) {
            globalThis.location.href = '/toolkit';
            return;
        }
        const route = routeHeroQuery(q);
        if (route.type === 'brain') {
            if (!openBrain(route.query)) {
                globalThis.location.href = `/toolkit?q=${encodeURIComponent(q)}`;
            }
            return;
        }
        globalThis.location.href = route.href;
    }

    function bindQuickChips() {
        document.querySelectorAll('[data-home-route]').forEach((el) => {
            el.addEventListener('click', (e) => {
                const mode = el.getAttribute('data-home-route');
                const seed = el.getAttribute('data-home-seed') || '';
                if (mode === 'brain' && seed) {
                    e.preventDefault();
                    openBrain(seed);
                    return;
                }
                if (mode === 'brain') {
                    e.preventDefault();
                    const input = document.getElementById('homeHeroSearchInput');
                    if (input && input.value.trim()) {
                        handleSubmit(input);
                    } else {
                        input?.focus();
                    }
                }
            });
        });
    }

    function init() {
        const form = document.getElementById('homeHeroSearchForm');
        const input = document.getElementById('homeHeroSearchInput');
        if (!form || !input) return;

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            handleSubmit(input);
        });

        bindQuickChips();
    }

    const api = {
        routeHeroQuery,
        isToolkitSpecQuery,
        isBrainNaturalQuery,
        destinationForQuery,
    };
    globalThis.TVC_HomeHeroSearch = api;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }
    }
})();
