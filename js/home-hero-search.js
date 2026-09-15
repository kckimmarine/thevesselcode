/* THE VESSEL CODE — Home hero search → Toolkit / IMPA store */
(function () {
    function normalizeQuery(raw) {
        return String(raw || '').trim();
    }

    function isImpaCode(query) {
        const digits = query.replace(/\s/g, '');
        return /^\d{6}$/.test(digits);
    }

    function destinationForQuery(query) {
        if (!query) return '/toolkit';
        if (isImpaCode(query)) {
            const code = query.replace(/\s/g, '');
            return `/store/${code}`;
        }
        return `/toolkit?q=${encodeURIComponent(query)}`;
    }

    function init() {
        const form = document.getElementById('homeHeroSearchForm');
        const input = document.getElementById('homeHeroSearchInput');
        if (!form || !input) return;

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const q = normalizeQuery(input.value);
            globalThis.location.href = destinationForQuery(q);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
