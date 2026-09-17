/* TVC-SM — App shell EN/KR (PMS header, tabs, common labels) */
const TVC_I18n = (function () {
    const LS_KEY = 'tvc_lang';
    const LEGACY_KEY = 'tvc-mkt-lang';

    const MESSAGES = {
        en: {
            'nav.menu': '📑 Menu',
            'nav.certificate': '📋 Certificate',
            'nav.pms': '🛠 PMS',
            'nav.spare': '🔩 SPARE',
            'nav.history': '📜 Report History',
            'nav.settings': '⚙ Settings',
            'nav.aiHelp': '🤖 AI Help',
            'nav.langToggle': '🌐 EN/KR',
            'header.shipName': "Ship's Name",
            'header.imo': 'IMO No',
            'header.delivery': 'Delivery',
            'header.user': 'User',
            'header.department': 'Department',
            'dept.all': 'All',
            'dept.deck': 'Deck',
            'dept.engine': 'Engine',
            'header.end': 'End',
            'header.mobileMode': 'SM Mode',
            'header.vesselPrefix': 'Vessel: ',
            'header.imoPrefix': ' | IMO: ',
        },
        ko: {
            'nav.menu': '📑 메뉴',
            'nav.certificate': '📋 증서',
            'nav.pms': '🛠 PMS',
            'nav.spare': '🔩 선용·부속',
            'nav.history': '📜 작업이력',
            'nav.settings': '⚙ 설정',
            'nav.aiHelp': '🤖 AI 도움말',
            'nav.langToggle': '🌐 EN/KR',
            'header.shipName': '선명',
            'header.imo': 'IMO 번호',
            'header.delivery': '인도일',
            'header.user': '사용자',
            'header.department': '부서',
            'dept.all': '전체',
            'dept.deck': '갑판',
            'dept.engine': '기관',
            'header.end': '종료',
            'header.mobileMode': 'SM Mode',
            'header.vesselPrefix': '선박: ',
            'header.imoPrefix': ' | IMO: ',
        },
    };

    function normalizeLang(raw) {
        return String(raw || '').toLowerCase() === 'en' ? 'en' : 'ko';
    }

    function getLang() {
        try {
            const primary = localStorage.getItem(LS_KEY);
            if (primary) return normalizeLang(primary);
            const legacy = localStorage.getItem(LEGACY_KEY);
            if (legacy) return normalizeLang(legacy);
        } catch (_) { /* ignore */ }
        return 'ko';
    }

    function setLang(lang) {
        const next = normalizeLang(lang);
        try {
            localStorage.setItem(LS_KEY, next);
            localStorage.setItem(LEGACY_KEY, next);
        } catch (_) { /* ignore */ }
        if (typeof document !== 'undefined') {
            document.documentElement.lang = next === 'en' ? 'en' : 'ko';
        }
        return next;
    }

    function t(key, lang) {
        const L = normalizeLang(lang || getLang());
        return MESSAGES[L]?.[key] ?? MESSAGES.en?.[key] ?? key;
    }

    function apply(root) {
        const scope = root && root.querySelectorAll ? root : document;
        scope.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (!key) return;
            el.textContent = t(key);
        });
        scope.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            if (key) el.setAttribute('title', t(key));
        });
        if (typeof document !== 'undefined') {
            const rootEl = document.documentElement;
            rootEl.style.setProperty('--tvc-mobile-vessel-prefix', `"${t('header.vesselPrefix')}"`);
            rootEl.style.setProperty('--tvc-mobile-imo-prefix', `"${t('header.imoPrefix')}"`);
        }
        syncLangToggleButton();
    }

    function syncLangToggleButton() {
        const btn = document.getElementById('appLangToggleBtn');
        if (!btn) return;
        const lang = getLang();
        btn.textContent = lang === 'ko' ? '🌐 EN/KR' : '🌐 KR/EN';
        btn.setAttribute('aria-label', lang === 'ko' ? 'Switch to English' : '한국어로 전환');
    }

    function toggle() {
        const next = getLang() === 'ko' ? 'en' : 'ko';
        setLang(next);
        apply(document);
        try {
            window.dispatchEvent(new CustomEvent('tvc-lang-change', { detail: { lang: next } }));
            window.dispatchEvent(new CustomEvent('tvc-mkt-lang', { detail: { lang: next } }));
        } catch (_) { /* ignore */ }
        return next;
    }

    function init() {
        setLang(getLang());
        apply(document);
    }

    return { getLang, setLang, toggle, apply, t, init, syncLangToggleButton, MESSAGES };
})();
