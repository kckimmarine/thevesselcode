/**
 * Marketing home — IR/SaaS section helpers (static site; mirrors CoreCapabilities / Pricing / DomainAuthority modules).
 * Loaded after marketing-i18n.js on home/index.html only.
 */
(function () {
    'use strict';
    document.querySelectorAll('a[href^="#core-capabilities"]').forEach((link) => {
        link.addEventListener('click', (ev) => {
            const target = document.getElementById('core-capabilities');
            if (!target) return;
            ev.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
})();
