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
            en: 'THE VESSEL CODE — Open Maritime Intelligence & Utility Hub. Free Toolkit for everyone at sea and shore; affordable TVC-SM fleet software.',
            ko: 'THE VESSEL CODE — 열린 해양 인텔리전스·유틸리티 허브. 무료 Toolkit과 합리적인 TVC-SM 선박관리 소프트웨어.',
        },
        'home.eyebrow': { en: 'THE VESSEL CODE · Open Maritime Hub', ko: 'THE VESSEL CODE · 열린 해양 허브' },
        'home.headline': {
            en: 'The Open Digital Commons for Global Maritime',
            ko: '글로벌 해운을 위한 열린 디지털 공동체',
        },
        'home.tagline': {
            en: 'Connecting seafarers, superintendents, owners, suppliers, surveyors, and students worldwide with open technical tools and intelligent fleet software.',
            ko: '선원·공무·선주·부품사·검사원·학생을 전 세계에서 연결합니다 — 열린 기술 도구와 지능형 선대 소프트웨어.',
        },
        'home.cta.sm': { en: '🛳️ Discover TVC-SM Platform', ko: '🛳️ TVC-SM 플랫폼 알아보기' },
        'home.cta.toolkit': { en: '📦 Open Free Maritime Toolkit', ko: '📦 무료 Maritime Toolkit' },
        'home.ethos.p': {
            en: 'Built by a 1st Class Engineer & Superintendent with a mission to give back to the maritime community: Free tools to empower daily work, and affordable TVC-SM software to make modern ship management accessible to every fleet.',
            ko: '1급 기관사·슈퍼인텐던트가 해양 커뮤니티에 환원하는 마음으로 만들었습니다: 일상 업무를 돕는 무료 도구, 모든 선대가 쓸 수 있는 합리적인 TVC-SM.',
        },
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
            en: '<strong>Commercial launch September 2026.</strong> Join the community with free Maritime Toolkit — adopt TVC-SM when your fleet is ready.',
            ko: '<strong>2026년 9월 상용 출시.</strong> 무료 Maritime Toolkit로 커뮤니티에 참여하고, 준비되면 TVC-SM을 도입하세요.',
        },
        'home.launch.cta': { en: 'Community · Fleet demo', ko: '커뮤니티 · 파일럿 문의' },
        'home.stake.title': { en: 'Empowering Everyone at Sea and Shore', ko: '바다와 육상, 모두를 위한 플랫폼' },
        'home.stake.cadet.t': { en: 'Students & Seafarers', ko: '학생 · 선원' },
        'home.stake.cadet.d': {
            en: 'Free IMPA plate search, engineering calculators, and operational learning.',
            ko: '무료 IMPA 도판 검색, 엔지니어링 계산기, 운항 학습 자료.',
        },
        'home.stake.survey.t': { en: 'Superintendents & Surveyors', ko: '공무 · 검사원' },
        'home.stake.survey.d': {
            en: 'Standardized maintenance, ClassNK Annex 9.1.3 compliance, tolerance checks.',
            ko: '표준화된 유지보수, ClassNK Annex 9.1.3 준수, 허용 공차 점검.',
        },
        'home.stake.supplier.t': { en: 'Stores & Spares Suppliers', ko: '선용품 · 부품 공급사' },
        'home.stake.supplier.d': {
            en: 'Direct spec lookup, transparent RFQ communication, zero friction.',
            ko: '직접 사양 조회, 투명한 RFQ 소통, 낮은 진입 장벽.',
        },
        'home.stake.owner.t': { en: 'Owners & Commercial Operators', ko: '선주 · 운항사' },
        'home.stake.owner.d': {
            en: 'Affordable SaaS adoption, high-transparency fleet visibility.',
            ko: '합리적인 SaaS 도입, 높은 투명도의 선대 가시성.',
        },
        'home.edge.title': { en: 'Why an Open Maritime Hub', ko: '열린 해양 허브인 이유' },
        'home.edge.1.t': { en: 'Tools for Every Role', ko: '모든 역할을 위한 도구' },
        'home.edge.1.d': {
            en: 'Cadets to class surveyors — the same IMPA catalog and calculators, no paywall for daily technical work.',
            ko: '사관생도부터 검사원까지 — 같은 IMPA·계산기, 일상 기술 업무에 무료.',
        },
        'home.edge.2.t': { en: 'Professional Fleet Software', ko: '전문 선대 소프트웨어' },
        'home.edge.2.d': {
            en: 'TVC-SM brings offline-first PMS, SPARE, and shore ZIP sync at a price point small fleets can adopt.',
            ko: 'TVC-SM — 오프라인 PMS·SPARE·육상 ZIP, 소규모 선대도 도입 가능한 가격.',
        },
        'home.edge.3.t': { en: 'Community-Driven Growth', ko: '커뮤니티가 이끄는 성장' },
        'home.edge.3.d': {
            en: 'Engineers and superintendents building in the open — feedback from the waterfront shapes every release.',
            ko: '엔지니어·슈퍼인텐던트가 열어 만듭니다 — 현장 피드백이 릴리스를 만듭니다.',
        },
        'home.digital.title': { en: 'Digital Products', ko: '디지털 제품' },
        'home.digital.lead': {
            en: 'Free public utilities and optional fleet software — one ecosystem for global shipping.',
            ko: '무료 공개 유틸리티와 선택적 선대 소프트웨어 — 글로벌 해운 하나의 생태계.',
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
        'home.cta.title': { en: 'Explore free tools. Scale with TVC-SM.', ko: '무료 도구부터, TVC-SM으로 확장.' },
        'home.cta.p': {
            en: 'Questions, partnerships, or a fleet pilot — we welcome every corner of the maritime community.',
            ko: '문의·파트너십·파일럿 — 해양 커뮤니티 모두를 환영합니다.',
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
