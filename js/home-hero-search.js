/* THE VESSEL CODE — Home hero unified search (single direct answer) */
(function () {
    function normalizeQuery(raw) {
        return globalThis.TVC_SearchResolver?.normalizeQuery?.(raw)
            ?? String(raw || '').trim();
    }

    function handleSubmit(input) {
        const q = normalizeQuery(input.value);
        if (!q) {
            globalThis.location.href = '/toolkit';
            return;
        }
        if (globalThis.TVC_SearchPortal?.executePortalSearch) {
            globalThis.TVC_SearchPortal.executePortalSearch(q);
            return;
        }
        const R = globalThis.TVC_SearchResolver;
        const route = R?.routeHeroQuery?.(q) || { type: 'brain', query: q };
        if (route.type === 'brain') {
            if (globalThis.TVC_BrainChat?.openModal) {
                globalThis.TVC_BrainChat.openModal(route.query, { briefing: true });
            } else {
                globalThis.location.href = `/toolkit?q=${encodeURIComponent(q)}`;
            }
            return;
        }
        globalThis.location.href = route.href;
    }

    function openBrain(query) {
        if (globalThis.TVC_SearchPortal?.openBrainModal) {
            return globalThis.TVC_SearchPortal.openBrainModal(query, { briefing: true });
        }
        if (globalThis.TVC_BrainChat?.openModal) {
            globalThis.TVC_BrainChat.openModal(query, { briefing: true });
            return true;
        }
        return false;
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

        const params = new URLSearchParams(globalThis.location?.search || '');
        const brainQ = params.get('brain');
        if (brainQ && String(brainQ).trim()) {
            openBrain(String(brainQ).trim());
        }

        bindQuickChips();
    }

    const R = () => globalThis.TVC_SearchResolver || {};
    const api = {
        routeHeroQuery: (q) => R().routeHeroQuery?.(q),
        classifyQuery: (q) => R().classifyQuery?.(q),
        isToolkitSpecQuery: (q) => R().isToolkitSpecQuery?.(q),
        isBrainNaturalQuery: (q) => R().isBrainNaturalQuery?.(q),
        destinationForQuery: (q) => R().destinationForQuery?.(q),
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
