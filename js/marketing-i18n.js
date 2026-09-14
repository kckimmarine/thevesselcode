/**
 * THE VESSEL CODE — marketing site KO/EN toggle (home, /sm, toolkit hero).
 * Storage: localStorage tvc-mkt-lang = ko | en
 */
(function (global) {
    'use strict';

    const STORAGE_KEY = 'tvc-mkt-lang';

    const T = {
        'nav.home': { en: 'Home', ko: '홈' },
        'nav.services': { en: 'Services', ko: '서비스' },
        'nav.toolkit': { en: 'Maritime Toolkit', ko: 'Maritime Toolkit' },
        'nav.sm': { en: 'TVC-SM', ko: 'TVC-SM' },
        'nav.contact': { en: 'Contact Us', ko: '문의하기' },
        'nav.menu': { en: 'Menu', ko: '메뉴' },
        'lang.ko': { en: '한국어', ko: '한국어' },
        'lang.en': { en: 'English', ko: 'English' },
        'footer.copy': {
            en: '© 2026 THE VESSEL CODE (K-TECH) · Busan, Republic of Korea',
            ko: '© 2026 THE VESSEL CODE (K-TECH) · 부산',
        },

        'home.meta.description': {
            en: 'THE VESSEL CODE — Fleet SaaS for owners, superintendents, yards & suppliers. Offline Vessel Core, online SM & Supplier Mode, free Maritime Toolkit (15,000+ IMPA).',
            ko: 'THE VESSEL CODE — 선주·공무감독·조선·부품사를 잇는 해운 SaaS. 오프라인 Vessel Core, 온라인 SM·Supplier, 무료 Toolkit(15,000+ IMPA).',
        },
        'home.eyebrow': { en: '2026 · Fleet software launch', ko: '2026 · 선박관리 소프트웨어 출시' },
        'home.tagline': {
            en: 'Decoding the Engineering, Operations, and Economics of Global Shipping.',
            ko: '글로벌 해운의 공학·운항·경제를 코드로 풀어냅니다.',
        },
        'home.lead': {
            en: 'Owners, superintendents, yards and suppliers on one platform. Offline at sea, online ashore and in procurement — less Excel, less Off-hire.',
            ko: '선주·공무감독·조선·부품사가 같은 코드로 맞춥니다. 바다에서는 오프라인, 육상과 조달에서는 온라인 — 엑셀과 Off-hire 비효율을 줄입니다.',
        },
        'home.cta.sm': { en: 'Explore TVC-SM', ko: 'TVC-SM 알아보기' },
        'home.cta.toolkit': { en: 'Free Maritime Toolkit / IMPA', ko: '무료 Maritime Toolkit / IMPA' },
        'home.platform.title': { en: 'TVC-SM Platform', ko: 'TVC-SM 플랫폼' },
        'home.platform.sm.t': { en: 'SM Mode', ko: 'SM Mode' },
        'home.platform.sm.d': {
            en: 'Online + offline — fleet oversight, ZIP import, RFQ to suppliers.',
            ko: '온라인·오프라인 혼용 — 다선박 관제, ZIP Import, Supplier RFQ.',
        },
        'home.platform.vessel.t': { en: 'Vessel Mode', ko: 'Vessel Mode' },
        'home.platform.vessel.d': {
            en: 'Captain Hub & shore HQ: online + offline · Deck/Engine: offline-first + ZIP.',
            ko: 'Captain Hub·육상 HQ: 온라인·오프라인 혼용 · Deck/Engine: 오프라인 완결 + ZIP.',
        },
        'home.platform.supplier.t': { en: 'Supplier Mode', ko: 'Supplier Mode' },
        'home.platform.supplier.d': {
            en: 'Online — RFQ inbox, quotes, delivery & invoices.',
            ko: '온라인 — RFQ 수신, 견적, 납품·인보이스.',
        },
        'home.launch.p': {
            en: '<strong>Commercial launch September 2026.</strong> Start free with Maritime Toolkit, scale to vessel PMS and shore SM — one brand.',
            ko: '<strong>2026년 9월 상용 출시.</strong> Maritime Toolkit 무료로 시작하고, 선박 PMS·육상 SM까지 한 브랜드로 확장합니다.',
        },
        'home.launch.cta': { en: 'Fleet demo · Pilot', ko: '파일럿 · 데모 문의' },
        'home.stake.title': { en: 'Where owners, superintendents & yards meet', ko: '선주 · 공무 · 조선소가 만나는 곳' },
        'home.stake.owner.t': { en: 'Owner', ko: '선주' },
        'home.stake.owner.d': {
            en: 'Cut Off-hire and duplicate orders; maintenance traceability for audits and insurance.',
            ko: 'Off-hire·중복 발주를 줄이고, 유지보수 추적성으로 감사·보험 대응력을 높입니다.',
        },
        'home.stake.sup.t': { en: 'Superintendent', ko: '공무감독' },
        'home.stake.sup.d': {
            en: 'SM Mode fleet view, vessel ZIP and supplier quotes in one workflow.',
            ko: 'SM Mode에서 다선박을 보고, 선박 ZIP·Supplier 견적을 한 흐름으로 처리합니다.',
        },
        'home.stake.yard.t': { en: 'Yard & Supplier', ko: '조선 · 부품 · 수리' },
        'home.stake.yard.d': {
            en: 'IMPA Toolkit for specs; Supplier Mode for RFQ responses.',
            ko: 'IMPA Toolkit으로 사양을 맞추고, Supplier Mode로 RFQ에 응답합니다.',
        },
        'home.edge.title': { en: 'The Vessel Code Edge', ko: 'The Vessel Code Edge' },
        'home.edge.1.t': { en: 'Bridge & Engine Room Synergy', ko: 'Bridge & Engine Room Synergy' },
        'home.edge.1.d': {
            en: 'Former Captains, Chief Engineers, and Superintendents — one team, no silos.',
            ko: '전 선장·기관장·슈퍼인텐던트 한 팀 — 운항·기술 판단의 단절 없음.',
        },
        'home.edge.2.t': { en: 'Asia Troika Advantage', ko: 'Asia Troika Advantage' },
        'home.edge.2.d': {
            en: 'Korea strategy · Hong Kong finance · China execution across major repair hubs.',
            ko: '한국 전략 · 홍콩 금융 · 중국 실행 — 아시아 조선·수리 거점 대응.',
        },
        'home.edge.3.t': { en: 'Data-Driven Ship Management', ko: 'Data-Driven Ship Management' },
        'home.edge.3.d': {
            en: 'Offline-first TVC-SM: PMS, SPARE, reports and shore ZIP workflows.',
            ko: '오프라인 우선 TVC-SM — PMS·SPARE·보고·육상 ZIP 워크플로.',
        },
        'home.digital.title': { en: 'Digital Products', ko: '디지털 제품' },
        'home.digital.lead': {
            en: 'Professional services and shipboard software — from inspection to inventory.',
            ko: '검사부터 재고까지 — 서비스와 선박 소프트웨어가 연결됩니다.',
        },
        'home.digital.sm.t': { en: 'TVC-SM — Vessel Core', ko: 'TVC-SM — Vessel Core' },
        'home.digital.sm.d': {
            en: 'PMS, SPARE, defect & permit workflows, atomic stock for deck and engine.',
            ko: 'PMS·SPARE·결함·작업허가, 갑판·기관 원자적 재고 관리.',
        },
        'home.digital.sm.link': { en: 'Learn about TVC-SM →', ko: 'TVC-SM 자세히 →' },
        'home.digital.tk.t': { en: 'Maritime Toolkit', ko: 'Maritime Toolkit' },
        'home.digital.tk.d': {
            en: 'Free IMPA catalog (15,000+ codes), bunker, lube, paint & flange tools.',
            ko: '무료 IMPA 15,000+ 코드, 벙커·플랜지 등 실무 도구.',
        },
        'home.digital.tk.link': { en: 'Open IMPA Catalog →', ko: 'IMPA 카탈로그 →' },
        'home.cta.title': { en: 'Protect your fleet. Modernize your operations.', ko: '선대를 지키고, 운영을 현대화하세요.' },
        'home.cta.p': {
            en: 'Superintendent services, retrofit, or a TVC-SM pilot — Busan engineering team.',
            ko: '감독·개조·TVC-SM 파일럿 — 부산 엔지니어링팀과 상담하세요.',
        },
        'home.cta.btn': { en: 'Contact Us', ko: '문의하기' },
        'home.impa.title': { en: 'Popular Marine Stores & Critical Parts', ko: '인기 선용품 · 핵심 부품' },
        'home.impa.lead': {
            en: 'Indexed IMPA spec sheets — dimensions, units, and catalog plates.',
            ko: 'IMPA 규격 시트 — 치수·단위·도판.',
        },

        'sm.eyebrow': { en: 'THE VESSEL CODE · Ship management SaaS', ko: '더베슬코드 · 선박관리 SaaS' },
        'sm.hero.title': {
            en: 'Integrated Ship Management for SME fleets',
            ko: '중소 선단을 위한 통합 선박관리',
        },
        'sm.hero.sub': {
            en: 'TVC-SM: Integrated Ship Management Platform',
            ko: 'TVC-SM: Integrated Ship Management Platform',
        },
        'sm.hero.lead': {
            en: 'PMS and SPARE in one flow — <strong>offline-complete</strong> at sea, <strong>ZIP</strong> sync with shore HQ (online or offline).',
            ko: 'PMS·SPARE 한 흐름 — 원양 <strong>오프라인 완결</strong>, 육상 HQ와 <strong>ZIP</strong>(온라인·오프라인 혼용).',
        },
        'sm.cta.launch': { en: '🚀 Launch TVC-SM App', ko: '🚀 TVC-SM 앱 실행' },
        'sm.cta.demo': { en: 'Request Fleet Demo', ko: '파일럿 데모 문의' },
        'sm.cta.toolkit': { en: 'Free Maritime Toolkit', ko: '무료 Toolkit' },
        'sm.diagram.title': { en: 'Ship ↔ Shore sync', ko: '선박 ↔ 육상 동기화' },
        'sm.diagram.deck': { en: 'Deck', ko: '갑판' },
        'sm.diagram.engine': { en: 'Engine', ko: '기관' },
        'sm.diagram.hub': { en: 'Captain Hub', ko: 'Captain Hub' },
        'sm.diagram.hub.sub': { en: 'Relay', ko: '선장 취합' },
        'sm.diagram.offline': { en: 'Offline · IndexedDB', ko: '오프라인 · IndexedDB' },
        'sm.diagram.zip': { en: 'Email · USB · Messenger', ko: '이메일 · USB · 메신저' },
        'sm.diagram.hq': { en: 'Shore HQ', ko: '육상 HQ' },
        'sm.diagram.hq.sub': { en: 'Online + offline · TVC-SM', ko: '온라인·오프라인 · TVC-SM' },
        'sm.stat.1.s': { en: 'At sea when link drops', ko: '통신 두절 시 선내 가동' },
        'sm.stat.2.s': { en: 'Ship–shore packets', ko: '선박–육상 표준 패킷' },
        'sm.stat.3.s': { en: 'PMS · SPARE · stores', ko: '정비 · SPARE · 소모' },
        'sm.stat.4.s': { en: 'IMPA Toolkit PLG', ko: 'IMPA Toolkit PLG' },
        'sm.modes.title': { en: 'Three TVC-SM modes', ko: 'TVC-SM 3가지 모드' },
        'sm.modes.lead': {
            en: 'Owners & SM, vessel stations, and suppliers — one data model.',
            ko: '선주·SM, 선박 스테이션, Supplier — 하나의 데이터 규격.',
        },
        'sm.mode.sm.badge': { en: 'Online + Offline', ko: '온라인 + 오프라인' },
        'sm.mode.sm.for': { en: 'Owner · SM · Superintendent', ko: '선주 · 선박관리사 · 공무감독' },
        'sm.mode.sm.p': {
            en: 'Fleet PMS, approvals, vessel ZIP import/export, RFQ to suppliers. Cloud HQ or offline ZIP handoff.',
            ko: '다선박 PMS·승인, 선박 ZIP Import/Export, Supplier RFQ. 클라우드 HQ 또는 오프라인 ZIP 병행.',
        },
        'sm.mode.vessel.badge': { en: 'Online + Offline', ko: '온라인 + 오프라인' },
        'sm.mode.vessel.for': { en: 'Captain Hub · Deck · Engine', ko: 'Captain Hub · Deck · Engine' },
        'sm.mode.vessel.l1': {
            en: '<strong>Captain & shore HQ</strong> — hub relay, SM sync online or via ZIP.',
            ko: '<strong>선장·육상 HQ</strong> — Hub 취합, SM과 온라인 또는 ZIP 동기화.',
        },
        'sm.mode.vessel.l2': {
            en: '<strong>Deck / Engine</strong> — offline-complete, ZIP export/import.',
            ko: '<strong>Deck / Engine</strong> — 오프라인 완결, ZIP Export/Import.',
        },
        'sm.mode.sup.badge': { en: 'Online', ko: '온라인' },
        'sm.mode.sup.for': { en: 'Parts & repair vendors', ko: '부품 · 수리 협력사' },
        'sm.mode.sup.p': {
            en: 'RFQ inbox, quotes, delivery/repair, invoices — respond to SM online.',
            ko: 'RFQ·견적·납품·인보이스 — SM 요청에 온라인 응답.',
        },
        'sm.ops.title': { en: 'Why leave Excel behind?', ko: '왜 엑셀에서 벗어나야 하나요?' },
        'sm.ops.lead': {
            en: 'Disconnected maintenance, inventory and oversight fail across satellite gaps and multi-vessel fleets.',
            ko: '정비·재고·관제가 끊기면 위성 공백과 다선박 운영이 무너집니다.',
        },
        'sm.vessel.title': { en: 'Vessel Core (PMS + SPARE)', ko: 'Vessel Core (PMS + SPARE)' },
        'sm.shore.title': { en: 'Shore Superintendent oversight', ko: 'Shore Superintendent oversight' },
        'sm.rfq.title': { en: 'Automated RFQ workflows', ko: 'Automated RFQ workflows' },
        'sm.cta.end.title': { en: 'Launch TVC-SM across your fleet', ko: '선단에 TVC-SM을 도입하세요' },

        'tk.eyebrow': { en: 'Free · For global seafarers', ko: '무료 · 글로벌 실무자용' },
        'tk.lead': {
            en: '<strong>15,000+</strong> IMPA codes and calculators in the browser. Vessel ROB & PMS via <a href="/sm">TVC-SM</a> subscription.',
            ko: '브라우저에서 <strong>15,000+</strong> IMPA·계산기. 본선 ROB·PMS는 <a href="/sm">TVC-SM</a> 구독으로 연결.',
        },
        'tk.plg.p': {
            en: '<strong>Product-led growth:</strong> practitioners find tools first → TVC-SM pilot for owners & SM.',
            ko: '<strong>PLG:</strong> 실무자 무료 도구 → 선주·SM TVC-SM 파일럿 전환.',
        },
        'tk.plg.sm': { en: 'About TVC-SM', ko: 'TVC-SM 소개' },
        'tk.plg.app': { en: 'Launch App', ko: '앱 실행' },
    };

    function detectDefaultLang() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved === 'ko' || saved === 'en') return saved;
        } catch (_) { /* ignore */ }
        const nav = (navigator.language || '').toLowerCase();
        return nav.startsWith('ko') ? 'ko' : 'en';
    }

    function getLang() {
        return detectDefaultLang();
    }

    function setLang(lang) {
        const next = lang === 'ko' ? 'ko' : 'en';
        try {
            localStorage.setItem(STORAGE_KEY, next);
        } catch (_) { /* ignore */ }
        applyLang(next);
        try {
            global.dispatchEvent(new CustomEvent('tvc-mkt-lang', { detail: { lang: next } }));
        } catch (_) { /* ignore */ }
    }

    function t(key, lang) {
        const row = T[key];
        if (!row) return null;
        return row[lang] ?? row.en ?? null;
    }

    function applyLang(lang) {
        document.documentElement.lang = lang === 'ko' ? 'ko' : 'en';
        document.body.classList.toggle('mkt-lang-ko', lang === 'ko');
        document.body.classList.toggle('mkt-lang-en', lang === 'en');

        document.querySelectorAll('[data-i18n]').forEach((el) => {
            const key = el.getAttribute('data-i18n');
            const val = t(key, lang);
            if (val == null) return;
            if (el.hasAttribute('data-i18n-html')) {
                el.innerHTML = val;
            } else {
                el.textContent = val;
            }
        });

        const desc = document.querySelector('meta[name="description"]');
        const page = document.body.getAttribute('data-mkt-active');
        if (desc && page === 'home') {
            const d = t('home.meta.description', lang);
            if (d) desc.setAttribute('content', d);
        }

        document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
            const key = el.getAttribute('data-i18n-placeholder');
            const val = t(key, lang);
            if (val != null) el.setAttribute('placeholder', val);
        });

        document.querySelectorAll('.mkt-lang-btn').forEach((btn) => {
            const isKo = btn.getAttribute('data-lang') === 'ko';
            btn.setAttribute('aria-pressed', isKo === (lang === 'ko') ? 'true' : 'false');
            btn.classList.toggle('is-active', isKo === (lang === 'ko'));
        });
    }

    function init() {
        applyLang(getLang());
    }

    global.TVC_MarketingI18n = {
        getLang,
        setLang,
        t,
        applyLang,
        init,
        keys: Object.keys(T),
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(typeof window !== 'undefined' ? window : globalThis);
