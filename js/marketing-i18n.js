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
        'nav.toolkit': { en: 'Maritime Toolkit', ko: '해운 실무 공구함' },
        'nav.insights': { en: 'Insights', ko: '인사이트' },
        'nav.forum': { en: 'Exchange', ko: '해양 Q&A' },
        'nav.sm': { en: 'TVC-SM', ko: 'TVC-SM 선박관리' },
        'nav.contact': { en: 'Contact Us', ko: '문의하기' },
        'nav.menu': { en: 'Menu', ko: '메뉴' },
        'nav.launchPill': { en: 'Launch App', ko: '앱 실행' },
        'nav.launchApp': { en: 'Launch TVC-SM', ko: 'TVC-SM 실행' },
        'nav.brand.tag': {
            en: 'Engineering · Operations · Open maritime hub',
            ko: '해운 기술 · 운항 · 열린 해양 플랫폼',
        },
        'nav.lang.group': { en: 'Language', ko: '언어' },
        'lang.ko': { en: 'KO', ko: 'KO' },
        'lang.en': { en: 'EN', ko: 'EN' },
        'footer.copy': {
            en: 'TVC-SM · © 2026 K-TECH. All rights reserved.',
            ko: 'TVC-SM · © 2026 K-TECH. All rights reserved.',
        },
        'footer.signature': {
            en: 'The Vessel Code is an engineering commons and fleet operating architecture designed by Mr. Kyoung-Chul, Kim (1st Class Marine Engineer License / Chief Engineer / Superintendent).',
            ko: 'The Vessel Code는 1급 기관사 면허·기관장·공무감독 김경철(Kyoung-Chul, Kim)이 설계한 엔지니어링 커먼즈 및 선대 운영 아키텍처입니다.',
        },

        'home.meta.description': {
            en: 'THE VESSEL CODE — Marine engineering knowledge base and fleet operating tools. Open IMPA reference, thermodynamics, piping, lubrication, coatings, and survey checklists.',
            ko: 'THE VESSEL CODE — 해양 엔지니어링 지식 기반 및 선대 운영 도구. IMPA·역학·배관·윤활·도장·검사 체크리스트.',
        },
        'home.eyebrow': { en: 'THE VESSEL CODE', ko: 'THE VESSEL CODE' },
        'home.headline': {
            en: 'Stop Searching Thick Manuals. Get Maritime Answers in 0.05s.',
            ko: '두꺼운 매뉴얼 대신 0.05초 해양 답변.',
        },
        'home.subtitle': {
            en: 'Instant search for 50,000+ IMPA standards, engineering calculators, and an offline-first fleet management OS.',
            ko: '50,000+ IMPA 규격, 엔지니어링 계산기, 오프라인 우선 선대 관리 OS를 즉시 검색.',
        },
        'home.tagline': {
            en: 'Built by a former Chief Engineer and Technical Superintendent. An open reference for seafarers, superintendents, and engineers who demand exact standards.',
            ko: '전직 기관장·기술공무감독이 만든 열린 참조 자료. 정확한 기준을 요구하는 선원·감독·엔지니어를 위해.',
        },
        'home.search.label': {
            en: 'Search IMPA and maritime utilities',
            ko: 'IMPA 및 해양 유틸리티 검색',
        },
        'home.search.placeholder': {
            en: 'Enter IMPA code, Valve size, Flange PCD, or Bunker formula...',
            ko: 'IMPA 코드, 밸브 규격, 플랜지 PCD, 벙커 공식 입력...',
        },
        'home.search.button': { en: 'Search', ko: '검색' },
        'home.metrics.specs': { en: '<strong>50,000+</strong> Specs', ko: '<strong>50,000+</strong> 스펙' },
        'home.metrics.offline': { en: '<strong>100%</strong> Offline PWA', ko: '<strong>100%</strong> 오프라인 PWA' },
        'home.metrics.sync': { en: '<strong>ZIP</strong> Ship↔Shore', ko: '<strong>ZIP</strong> 선박↔육상' },
        'home.utility.bunker': { en: '⛽ ASTM 54B Bunker Calc', ko: '⛽ ASTM 54B 벙커 계산' },
        'home.utility.flange': { en: '📐 JIS Flange Specs', ko: '📐 JIS 플랜지 규격' },
        'home.utility.lube': { en: 'Lube cross-ref', ko: '윤활 조견' },
        'home.utility.impa': { en: '📦 50,000+ IMPA Plates', ko: '📦 50,000+ IMPA 도판' },
        'home.utility.cic': { en: '📋 Tokyo MoU CIC Guard', ko: '📋 Tokyo MoU CIC 가드' },
        'home.benefits.title': { en: 'What You Can Do Today', ko: '오늘 바로 쓸 수 있는 것' },
        'home.benefits.crew.label': { en: 'For Shipboard Crew', ko: '선상 승무원' },
        'home.benefits.crew.desc': {
            en: 'Zero-network IMPA lookup & offline work reports. Never lose records even during deep-sea satellite blackout.',
            ko: '네트워크 없이 IMPA 조회·오프라인 작업보고. 심해 위성 두절 시에도 기록 유실 없음.',
        },
        'home.benefits.super.label': { en: 'For Superintendents', ko: '슈퍼인텐던트' },
        'home.benefits.super.desc': {
            en: 'Instant Table 54B fuel mass conversions, JIS/ANSI flange specs, and one-click PSC inspection checklists.',
            ko: 'Table 54B 연료 질량 변환, JIS/ANSI 플랜지, PSC 검사 체크리스트 원클릭.',
        },
        'home.benefits.owner.label': { en: 'For Ship Owners & SM', ko: '선주 · 선박관리사' },
        'home.benefits.owner.desc': {
            en: 'Replace legacy million-dollar ERPs. Full PMS + SPARE inventory sync for just $300–$400/vessel/mo.',
            ko: '고가 레거시 ERP 대체. PMS + SPARE 동기화, 선박당 월 $300–$400.',
        },
        'home.benefits.supplier.label': { en: 'For Marine Suppliers', ko: '해양 공급사' },
        'home.benefits.supplier.desc': {
            en: 'Quote part numbers instantly, set profit margins, and export official PDF quotations in 60 seconds.',
            ko: '부품 번호 즉시 견적, 마진 설정, 60초 내 PDF 견적서 출력.',
        },
        'home.showcase.title': {
            en: 'Work Report → Instant Spare Deduction → Class Export',
            ko: '작업보고 → 즉시 예비품 차감 → 선급 Export',
        },
        'home.showcase.tagline': {
            en: 'Save 10+ hours of excel paperwork every week.',
            ko: '매주 엑셀 서류 작업 10시간 이상 절약.',
        },
        'home.showcase.cta.toolkit': { en: '🛠️ Launch Free Toolkit', ko: '🛠️ 무료 Toolkit 실행' },
        'home.showcase.cta.sm': { en: '🛳️ Test TVC-SM Fleet OS', ko: '🛳️ TVC-SM Fleet OS 체험' },
        'home.showcase.mock.label': { en: 'TVC-SM · Vessel Core', ko: 'TVC-SM · Vessel Core' },
        'home.showcase.step1.t': { en: 'Work Report', ko: '작업 보고' },
        'home.showcase.step1.d': { en: 'Deck / Engine job saved offline', ko: '갑판·기관 작업 오프라인 저장' },
        'home.showcase.step2.t': { en: 'Spare deduction', ko: '예비품 차감' },
        'home.showcase.step2.d': { en: 'ROB updated — no double-count', ko: 'ROB 갱신 — 이중 차감 없음' },
        'home.showcase.step3.t': { en: 'Class export', ko: '선급 Export' },
        'home.showcase.step3.d': {
            en: 'ZIP pack for superintendent & survey',
            ko: '슈퍼인텐던트·검사용 ZIP 패킷',
        },
        'home.showcase.stat.time': { en: '<strong>~4 min</strong> vs 2+ hrs Excel', ko: '<strong>~4분</strong> vs 엑셀 2시간+' },
        'home.showcase.stat.offline': { en: '<strong>100%</strong> offline on board', ko: '선상 <strong>100%</strong> 오프라인' },
        'home.enterprise.title': {
            en: 'From Daily Field Work to Complete Fleet Management',
            ko: '일상 현장 업무에서 선대 관리까지',
        },
        'home.enterprise.subtitle': {
            en: 'Experience offline-first vessel maintenance and superintendent oversight with TVC-SM.',
            ko: 'TVC-SM으로 오프라인 우선 선박 유지보수와 슈퍼인텐던트 관제를 경험하세요.',
        },
        'home.enterprise.vessel.title': { en: 'TVC-SM Vessel Mode', ko: 'TVC-SM Vessel Mode' },
        'home.enterprise.vessel.desc': {
            en: 'TVC-SM (Vessel Core / Fleet OS) — 100% offline PWA maintenance and SPARE with one-click reports.',
            ko: 'TVC-SM (Vessel Core / Fleet OS) — 100% 오프라인 PWA 정비·SPARE와 원클릭 리포트.',
        },
        'home.enterprise.vessel.cta': { en: 'Explore Vessel Mode', ko: 'Vessel Mode 알아보기' },
        'home.enterprise.fleet.title': { en: 'TVC-SM Fleet HQ', ko: 'TVC-SM Fleet HQ' },
        'home.enterprise.fleet.desc': {
            en: 'Real-time superintendent fleet oversight & audit prep.',
            ko: '실시간 슈퍼인텐던트 선대 관제 및 감사 준비.',
        },
        'home.enterprise.fleet.cta': { en: 'Request Fleet Demo', ko: 'Fleet Demo 신청' },
        'home.ethos.label': { en: 'Mutual growth platform', ko: '상생 플랫폼' },
        'home.document.title': {
            en: 'THE VESSEL CODE | Maritime Answers in 0.05s',
            ko: 'THE VESSEL CODE | 0.05초 해양 답변',
        },
        'home.cta.sm': { en: 'TVC-SM Fleet Platform', ko: 'TVC-SM 선대 플랫폼' },
        'home.cta.toolkit': { en: 'Free Maritime Toolkit', ko: '무료 Maritime Toolkit' },
        'home.ethos.p': {
            en: 'Built by a 1st Class Engineer & Superintendent for the maritime community.',
            ko: '1급 기관사·슈퍼인텐던트가 해양 커뮤니티를 위해 만들었습니다.',
        },
        'home.ethos.p2': {
            en: 'Start with the free Toolkit. Adopt TVC-SM when you are ready for fleet-grade PMS and stores.',
            ko: '무료 Toolkit부터 시작하세요. 선대급 PMS·자재가 필요할 때 TVC-SM을 도입하세요.',
        },
        'home.platform.title': { en: 'TVC-SM Platform', ko: 'TVC-SM 플랫폼' },
        'home.platform.sm.t': { en: 'SM Mode', ko: 'SM Mode' },
        'home.platform.sm.badge': { en: 'Online + Offline', ko: '온라인 + 오프라인' },
        'home.platform.sm.d': {
            en: 'Online + offline — fleet oversight, ZIP import, RFQ to suppliers.',
            ko: '온라인·오프라인 혼용 — 다선박 관제, ZIP Import, Supplier RFQ.',
        },
        'home.platform.vessel.t': { en: 'Vessel Mode', ko: 'Vessel Mode' },
        'home.platform.vessel.badge': { en: 'Online + Offline', ko: '온라인 + 오프라인' },
        'home.platform.vessel.d': {
            en: 'Captain Hub & shore HQ: online + offline · Deck/Engine: offline-first + ZIP.',
            ko: 'Captain Hub·육상 HQ: 온라인·오프라인 혼용 · Deck/Engine: 오프라인 완결 + ZIP.',
        },
        'home.platform.supplier.t': { en: 'Supplier Mode', ko: 'Supplier Mode' },
        'home.platform.supplier.badge': { en: 'Online', ko: '온라인' },
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
            en: 'Standardized maintenance, IACS UR Z20 & IMO ISM Code Section 10 alignment, tolerance checks.',
            ko: '표준화된 유지보수, IACS UR Z20 및 IMO ISM Code Section 10 정렬, 허용 공차 점검.',
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
        'home.values.lead': {
            en: 'Search-first utilities for daily technical work. TVC-SM when the fleet needs an offline-ready operating system.',
            ko: '일상 기술 업무는 검색·계산기부터. 선대 OS가 필요할 때 TVC-SM.',
        },
        'home.edge.2.t': { en: 'TVC-SM Fleet OS', ko: 'TVC-SM Fleet OS' },
        'home.edge.2.d': {
            en: 'TVC-SM (Vessel Core / Fleet OS) — offline maintenance, SPARE, and ZIP sync built for small fleets.',
            ko: 'TVC-SM — 오프라인 정비·SPARE·ZIP, 소규모 선대용 Fleet OS.',
        },
        'home.edge.3.t': { en: 'Built by Practitioners', ko: '현장 전문가가 설계' },
        'home.edge.3.d': {
            en: 'Engineered by a 1st Class Engineer and superintendent — credible workflows, not generic office IT.',
            ko: '1급 기관사·슈퍼인텐던트가 만든 실무형 워크플로.',
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
            en: 'Launch the fleet app or request a superintendent-led demo.',
            ko: 'Fleet 앱 실행 또는 슈퍼인텐던트 데모를 요청하세요.',
        },
        'home.cta.btn': { en: 'Contact Us', ko: '문의하기' },
        'home.impa.title': { en: 'Popular Marine Stores & Critical Parts', ko: '인기 선용품 · 핵심 부품' },
        'home.impa.lead': {
            en: 'Tap a code — open the IMPA plate in the Toolkit viewer instantly.',
            ko: '코드를 누르면 Toolkit 도판 뷰어에서 즉시 열립니다.',
        },

        'sm.meta.description': {
            en: 'TVC-SM — The resilient, local-first ship management OS for PMS, SPARE, and shore ZIP sync. Built for fleets that sail offline.',
            ko: 'TVC-SM — 인터넷이 끊겨도 바로 쓰는 현장 중심 선박관리. 정비·예비품·육상 연동을 한곳에서.',
        },
        'sm.document.title': {
            en: 'TVC-SM | Ship Management Platform | THE VESSEL CODE',
            ko: 'TVC-SM | 선박관리 플랫폼 | THE VESSEL CODE',
        },
        'sm.eyebrow': { en: 'THE VESSEL CODE · Ship management SaaS', ko: 'THE VESSEL CODE · 선박관리 소프트웨어' },
        'sm.hero.title': {
            en: 'TVC-SM Ship Management',
            ko: 'TVC-SM 선박관리',
        },
        'sm.hero.tagline': {
            en: 'TVC-SM (Vessel Core / Fleet OS) — local-first ship management engineered by superintendents.',
            ko: 'TVC-SM (Vessel Core / Fleet OS) — 슈퍼인텐던트가 설계한 로컬 우선 선박관리',
        },
        'sm.hero.lead': {
            en: 'Offline-complete maintenance and SPARE on board. Superintendent oversight via ZIP or online Fleet HQ.',
            ko: '선상 오프라인 정비·SPARE 완결. ZIP 또는 온라인 Fleet HQ로 감독.',
        },
        'sm.metrics.offline': { en: '<strong>100%</strong> Offline PWA', ko: '<strong>100%</strong> 오프라인 PWA' },
        'sm.metrics.zip': { en: '<strong>ZIP</strong> sync', ko: '<strong>ZIP</strong> 동기화' },
        'sm.metrics.fleet': { en: '<strong>10–50</strong> vessel fleets', ko: '<strong>10–50</strong> 선박 선대' },
        'sm.hero.approval': {
            en: 'Structured workflow: Drafted (ship staff) → Verified (Chief Officer / Chief Engineer) → Final approval (Superintendent).',
            ko: '작성(사관) ➔ 확인(선·기장) ➔ 최종 승인(공무감독)의 체계적인 결재선',
        },
        'sm.philosophy': {
            en: 'A mutual-growth ship management system — without legacy PMS markup, priced so small owners can adopt with confidence.',
            ko: '비싼 외산 프로그램의 거품을 빼고, 영세 선사도 부담 없이 도입할 수 있는 상생형 선박관리 시스템',
        },
        'sm.cta.launch': { en: '🚀 Launch TVC-SM App', ko: '🚀 TVC-SM 앱 실행' },
        'sm.cta.demo': { en: 'Request Fleet Demo', ko: 'Fleet Demo 요청' },
        'sm.essentials.title': { en: 'How TVC-SM works', ko: 'TVC-SM 작동 방식' },
        'sm.essentials.lead': {
            en: 'One offline core on the ship. One approval line for superintendents. ZIP when the link is down.',
            ko: '선박 오프라인 코어, 감독 승인 라인, 링크 단절 시 ZIP.',
        },
        'sm.essentials.1.t': { en: 'Report · Confirm · Approve', ko: 'Report · Confirm · Approve' },
        'sm.essentials.1.d': {
            en: 'Structured statuses from deck and engine through chief officers to superintendent approval.',
            ko: '갑판·기관에서 기관장·갑판장, 슈퍼인텐던트 승인까지 구조화된 상태.',
        },
        'sm.essentials.2.t': { en: 'Linked maintenance & SPARE', ko: '정비·SPARE 연동' },
        'sm.essentials.2.d': {
            en: 'Work reports and IMPA consumption stay aligned — no duplicate stock deductions on confirm.',
            ko: '작업보고와 IMPA 소모가 연동 — 확인 시 이중 차감 없음.',
        },
        'sm.essentials.3.t': { en: 'ZIP ship ↔ shore', ko: 'ZIP 선박 ↔ 육상' },
        'sm.essentials.3.d': {
            en: 'Signed export/import packets over email, USB, or messenger — no always-on cloud at sea.',
            ko: '이메일·USB·메신저로 서명된 ZIP — 해상 상시 클라우드 불필요.',
        },
        'sm.pillars.title': { en: 'Three core TVC-SM pillars', ko: 'TVC-SM 핵심 3대 축' },
        'sm.pillars.lead': {
            en: 'Shipboard execution, shore oversight, and procurement — one offline-first platform.',
            ko: '선박 실행, 육상 감독, 조달 — 하나의 오프라인 우선 플랫폼.',
        },
        'sm.pillar.1.t': { en: 'TVC-SM Vessel Core', ko: 'TVC-SM Vessel Core' },
        'sm.pillar.1.d': {
            en: 'Deck and engine workflows, atomic stock, defect & permit — fully usable without satellite.',
            ko: 'Deck·Engine 워크플로, 원자적 재고, 결함·작업허가 — 위성 없이 완결.',
        },
        'sm.pillar.2.t': { en: 'Shore Superintendent Fleet Oversight', ko: '육상 슈퍼인텐던트 선대 관제' },
        'sm.pillar.2.d': {
            en: 'Confirm, approve, and audit fleet-wide maintenance and ROB via ZIP or online HQ.',
            ko: 'ZIP 또는 온라인 HQ로 선대 정비·ROB 확인·승인·감사.',
        },
        'sm.pillar.3.t': { en: 'RFQ Procurement', ko: 'RFQ 조달' },
        'sm.pillar.3.d': {
            en: '1-click requisitions to suppliers with spec history tied to IMPA and job cards.',
            ko: 'IMPA·작업카드와 연결된 1클릭 청구 및 공급사 RFQ.',
        },
        'sm.cta.toolkit': { en: 'Free Maritime Toolkit', ko: '무료 Toolkit' },
        'sm.diagram.title': { en: 'Ship ↔ Shore sync', ko: '선박 ↔ 육상 동기화' },
        'sm.diagram.deck': { en: 'Deck', ko: '갑판' },
        'sm.diagram.engine': { en: 'Engine', ko: '기관' },
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
        'sm.cta.end.p': {
            en: 'Open the web app for HQ, or request a pilot with our Busan team. Start free tools on the <a href="/toolkit">Maritime Toolkit</a>.',
            ko: '웹 앱으로 HQ를 열거나 부산 팀과 파일럿·데모를 요청하세요. <a href="/toolkit">해운 실무 공구함</a>에서 무료로 시작할 수 있습니다.',
        },
        'sm.ops.1.t': { en: 'Administrative drag at sea', ko: '선상 서류·입력 반복' },
        'sm.ops.1.d': {
            en: 'Deck and engine teams re-type the same data across PMS, stock, permits, and defect logs.',
            ko: '기관·갑판이 정비, 재고, 작업허가, 결함 장부에 같은 내용을 반복 입력합니다.',
        },
        'sm.ops.2.t': { en: 'Connectivity as a bottleneck', ko: '통신 두절이 병목' },
        'sm.ops.2.d': {
            en: 'Cloud-only tools stall when VSAT drops — confirmations, stock, and HQ visibility freeze.',
            ko: '클라우드만 의존하면 위성 단절 시 확인·재고·육상 가시성이 멈춥니다.',
        },
        'sm.ops.3.t': { en: 'Fragmented fleet picture', ko: '선대 현황이 흩어짐' },
        'sm.ops.3.d': {
            en: 'Superintendents need one line — Report → Confirm → Approve — not email Excel chains.',
            ko: '슈퍼인텐던트가 이메일·엑셀을 취합하는 대신, 작성→확인→승인 한 줄기가 필요합니다.',
        },
        'sm.ops.4.t': { en: 'Procurement friction', ko: '조달·청구 마찰' },
        'sm.ops.4.d': {
            en: 'When maintenance and ROB history are unlinked, every RFQ starts from scratch.',
            ko: '정비 이벤트와 재고·소모 이력이 연결되지 않으면 청구와 RFQ가 매번 처음부터입니다.',
        },
        'sm.vessel.title': { en: 'Vessel Core (PMS + SPARE)', ko: '선내 코어 (정비 + 예비품)' },
        'sm.vessel.lead': {
            en: 'Deck and engine share one offline core for planned maintenance and stores.',
            ko: '갑판·기관이 같은 오프라인 코어에서 계획 정비와 예비품을 함께 다룹니다.',
        },
        'sm.vessel.1.t': { en: 'Unified work reports', ko: '통합 작업보고' },
        'sm.vessel.1.p': {
            en: 'Run-hour and calendar jobs, department reports, defects and permits — schedules update at the right lifecycle step.',
            ko: '운전시간·일정 작업, 부서별 보고, 결함·작업허가 — 일정 갱신은 올바른 단계에서만 적용됩니다.',
        },
        'sm.vessel.2.t': { en: 'Integrated SPARE control', ko: '예비품(SPARE) 연동' },
        'sm.vessel.2.p': {
            en: 'IMPA consumption tied to work reports; <strong>no double stock deduction</strong> on confirm.',
            ko: '작업보고와 연동된 IMPA 소모, 확인 단계 <strong>이중 차감 방지</strong>로 재고 정합성을 유지합니다.',
        },
        'sm.vessel.3.t': { en: 'Offline-first marine core', ko: '오프라인 우선 선박 코어' },
        'sm.vessel.3.p': {
            en: 'Full function during satellite gaps. Ship ↔ HQ via signed, versioned <strong>ZIP export/import</strong> — no always-on cloud API at sea.',
            ko: '위성 두절 중에도 전 기능 가동. 선박 ↔ 육상은 서명·버전 관리된 <strong>ZIP Export/Import</strong> — 일반 운항에서 상시 클라우드 API에 의존하지 않습니다.',
        },
        'sm.lifecycle.title': { en: 'Report · Confirm · Approve', ko: '보고 · 확인 · 승인' },
        'sm.lifecycle.lead': {
            en: 'Clear statuses from ship to shore simplify audits and class preparation.',
            ko: '선내 작성부터 육상 승인까지 상태가 명확해 감사·검사 대응이 수월합니다.',
        },
        'sm.lc.1.s': { en: 'Author save', ko: '작성자 저장' },
        'sm.lc.2.s': { en: 'C/E · C/O verify', ko: '기관장·CO 확인' },
        'sm.lc.3.s': { en: 'ZIP export → HQ', ko: 'ZIP Export → 육상' },
        'sm.lc.4.s': { en: 'Superintendent approval', ko: '공무감독 승인' },
        'sm.shore.title': { en: 'Shore Superintendent oversight', ko: '육상 공무감독 관제' },
        'sm.rfq.title': { en: 'Automated RFQ workflows', ko: 'RFQ 자동화 워크플로' },
        'sm.shore.lead': {
            en: 'HQ and superintendent stations share one data model and RBAC across the fleet.',
            ko: 'HQ와 공무감독 스테이션은 동일 데이터·역할(RBAC)로 다선박을 봅니다.',
        },
        'sm.shore.1.t': { en: 'Dual-view control', ko: '선내·육상 화면' },
        'sm.shore.1.p': {
            en: 'Ship officer/chief UI and shore fleet UI — one record for docking and vetting.',
            ko: '선내 사관·기장 UI와 육상 선대 UI — 도킹·vetting 준비에 하나의 기록.',
        },
        'sm.shore.2.t': { en: 'Exportable fleet packages', ko: '선대 패키지 Export' },
        'sm.shore.2.p': {
            en: 'Structured ZIP handoff keeps sync state without exposing ship data to always-on cloud.',
            ko: '구조화된 ZIP 핸드오프로 동기화 상태를 유지하며, 선내 데이터를 상시 클라우드에 노출하지 않습니다.',
        },
        'sm.shore.3.t': { en: 'Lifecycle discipline', ko: '결재 단계 준수' },
        'sm.shore.3.p': {
            en: 'Stock, schedule, and approval locks apply only at Reported → Confirmed → Approved.',
            ko: 'Reported → Confirmed → Approved 에서만 재고·일정·승인 잠금이 적용됩니다.',
        },
        'sm.rfq.lead': {
            en: 'Roadmap linking maintenance, consumption, and procurement — offline safety preserved.',
            ko: '정비·소모와 조달을 연결하는 확장 로드맵 — 오프라인 안전성은 유지합니다.',
        },
        'sm.rfq.1.t': { en: 'Consumption-driven demand', ko: '소모 기반 수요' },
        'sm.rfq.1.p': {
            en: 'Confirmed spare usage flows to requisition context so HQ sees what was used and where.',
            ko: '확인된 작업보고의 spare 사용이 청구·RFQ 맥락으로 전달되어 육상이 무엇을, 어디서 썼는지 봅니다.',
        },
        'sm.rfq.2.t': { en: 'Structured RFQ workspace', ko: 'RFQ 작업 공간' },
        'sm.rfq.2.p': {
            en: 'Digital superintendent operations to compare quotes and fleet orders (phased release).',
            ko: '디지털 공무 운영으로 견적 비교·선단 발주를 단순화 (단계적 출시).',
        },
        'sm.compare.title': { en: 'Positioned for SME fleets', ko: '중소 선단에 맞춘 포지션' },
        'sm.compare.col.excel': { en: 'Excel / paper', ko: '엑셀·수기' },
        'sm.compare.col.legacy': { en: 'Legacy PMS', ko: '고가 외산 PMS' },
        'sm.compare.col.tvc': { en: 'TVC-SM', ko: 'TVC-SM' },
        'sm.compare.row.cost': { en: 'Upfront cost', ko: '도입 비용' },
        'sm.compare.v.excel.cost': { en: 'Low', ko: '낮음' },
        'sm.compare.v.legacy.cost': { en: 'High SI projects', ko: '수억 원대 SI' },
        'sm.compare.v.tvc.cost': { en: 'Monthly · low entry', ko: '월 구독 · 낮은 초기비' },
        'sm.compare.row.offline': { en: 'Deep-sea offline', ko: '원양 오프라인' },
        'sm.compare.v.excel.offline': { en: 'Possible', ko: '가능' },
        'sm.compare.v.legacy.offline': { en: 'Cloud dependent', ko: '클라우드 의존' },
        'sm.compare.v.tvc.offline': { en: '100% ship-complete', ko: '선내 100% 완결' },
        'sm.compare.row.link': { en: 'PMS–stock link', ko: '정비–재고 연동' },
        'sm.compare.v.excel.link': { en: 'Manual', ko: '수동' },
        'sm.compare.v.legacy.link': { en: 'Project-dependent', ko: '구축 의존' },
        'sm.compare.v.tvc.link': { en: 'Built-in 3-way', ko: '3-Way 내장' },
        'sm.compare.row.shore': { en: 'Shore handoff', ko: '육상 연동' },
        'sm.compare.v.excel.shore': { en: 'Email files', ko: '이메일 파일' },
        'sm.compare.v.legacy.shore': { en: 'Private networks', ko: '전용망' },
        'sm.compare.v.tvc.shore': { en: 'Standard ZIP', ko: '표준 ZIP' },
        'sm.mode.sm.h': { en: 'SM Mode', ko: 'SM Mode' },
        'sm.mode.vessel.h': { en: 'Vessel Mode', ko: 'Vessel Mode' },
        'sm.mode.sup.h': { en: 'Supplier Mode', ko: 'Supplier Mode' },
        'sm.diagram.hub': { en: 'Captain Hub', ko: '선장 Hub' },

        'pricing.title': {
            en: 'Two tracks — individual tools or fleet OS',
            ko: '두 가지 트랙 — 개인 실무 도구 또는 선대 OS',
        },
        'pricing.lead': {
            en: 'Start free on the Toolkit. Upgrade to Pro for personal workflows, or adopt TVC-SM when you need Class-ready PMS across the fleet.',
            ko: 'Toolkit 무료로 시작하세요. 개인 실무는 Pro, 선대 정비·재고는 TVC-SM으로 확장합니다.',
        },
        'pricing.trackA.label': { en: 'Track A · Individual', ko: 'Track A · 개인' },
        'pricing.trackB.label': { en: 'Track B · Enterprise Fleet', ko: 'Track B · 선대' },
        'pricing.toolkitPro.title': { en: 'Maritime Toolkit Pro', ko: 'Maritime Toolkit Pro' },
        'pricing.toolkitPro.audience': {
            en: 'Officers, engineers, and surveyors who need ASTM logs and offline PDFs daily.',
            ko: '일상적으로 ASTM 로그·오프라인 PDF가 필요한 항해사·기관사·검사원.',
        },
        'pricing.toolkitPro.price': { en: '$9.99 / month', ko: '월 $9.99' },
        'pricing.toolkitPro.f1': {
            en: 'Unlimited ASTM Table 54B calculation logs',
            ko: 'ASTM Table 54B 계산 로그 무제한',
        },
        'pricing.toolkitPro.f2': {
            en: 'Offline PDF downloads for plates & calculators',
            ko: '도판·계산기 오프라인 PDF 다운로드',
        },
        'pricing.toolkitPro.f3': {
            en: 'Full-plate bookmarking across IMPA catalog',
            ko: 'IMPA 도판 전체 북마크',
        },
        'pricing.toolkitPro.cta': {
            en: 'Upgrade to Toolkit Pro',
            ko: 'Toolkit Pro 업그레이드',
        },
        'pricing.fleet.title': { en: 'TVC-SM Fleet OS', ko: 'TVC-SM Fleet OS' },
        'pricing.fleet.audience': {
            en: 'Shipowners, managers, and superintendents running multi-vessel PMS & SPARE.',
            ko: '다선대 PMS·SPARE를 운영하는 선주·관리사·공무감독.',
        },
        'pricing.fleet.price': { en: '$99 / vessel / month (Starter)', ko: '선박당 월 $99 (Starter)' },
        'pricing.fleet.trial': {
            en: '30-Day Risk-Free Trial (Cancel Anytime)',
            ko: '30일 무위험 체험 (언제든 해지)',
        },
        'pricing.fleet.f1': {
            en: 'IACS UR Z20 & IMO ISM Code Section 10 aligned PMS & SPARE',
            ko: 'IACS UR Z20 및 IMO ISM Code Section 10 정렬 PMS & SPARE',
        },
        'pricing.fleet.f2': {
            en: 'Local-first offline sync with ZIP ship ↔ shore packets',
            ko: 'ZIP 선박↔육상 로컬 우선 동기화',
        },
        'pricing.fleet.f3': {
            en: 'Superintendent approval queue & multi-vessel oversight',
            ko: '공무 승인 큐 & 다선대 관제',
        },
        'pricing.fleet.cta': {
            en: '🚀 Start 30-Day Free Fleet Trial',
            ko: '🚀 30일 무료 선대 체험 시작',
        },
        'pricing.fleet.secondary': { en: 'See how TVC-SM works ↓', ko: 'TVC-SM 작동 방식 ↓' },
        'tk.pricing.hook': {
            en: 'Free catalog & calculators — upgrade to Toolkit Pro or fleet TVC-SM when you scale.',
            ko: '무료 카탈로그·계산기 — 확장 시 Toolkit Pro 또는 TVC-SM 선대로.',
        },
        'billing.fleet.vessels': { en: 'Vessels on Starter plan', ko: 'Starter 적용 선박 수' },
        'billing.checkout.loading': { en: 'Redirecting to secure checkout…', ko: '안전 결제 페이지로 이동 중…' },
        'billing.checkout.fallback': {
            en: 'Payment gateway initializing. Connecting you to onboarding support…',
            ko: '결제 게이트웨이 준비 중입니다. 온보딩 지원으로 연결합니다…',
        },
        'billing.return.success': {
            en: 'Subscription received. Manage billing anytime from the customer portal.',
            ko: '구독이 접수되었습니다. 고객 포털에서 결제·해지를 관리할 수 있습니다.',
        },
        'billing.return.cancelled': {
            en: 'Checkout cancelled — no charge was made.',
            ko: '결제가 취소되었습니다 — 청구되지 않았습니다.',
        },
        'billing.portal.cta': { en: 'Manage subscription & invoices', ko: '구독·청구서 관리' },

        'tk.meta.description': {
            en: 'Maritime Toolkit — IMPA catalog, bunker, flange, lube and paint cross-reference tools. Free for global seafarers.',
            ko: '해운 실무 공구함 — IMPA·벙커·플랜지·윤활·페인트 조견. 선원·공무 모두 무료.',
        },
        'tk.document.title': {
            en: 'Maritime Toolkit | THE VESSEL CODE',
            ko: '해운 실무 공구함 | THE VESSEL CODE',
        },
        'tk.eyebrow': { en: 'Maritime Toolkit', ko: 'Maritime Toolkit' },
        'tk.hero.title': { en: 'THE VESSEL CODE', ko: 'THE VESSEL CODE' },
        'tk.subtitle': {
            en: 'Marine Engineering Knowledge Base & Field Utilities.',
            ko: '해양 엔지니어링 지식 기반 & 현장 유틸리티.',
        },
        'tk.lead': {
            en: 'Tabulated engineering standards, thermodynamics, piping, lubrication, and statutory checkpoints for shipboard use.<br>Fleet maintenance records and ROB are operated in <a href="/sm" class="underline-link">TVC-SM (Vessel Core / Fleet OS)</a>.',
            ko: '선상용 표준·열역학·배관·윤활·법규 체크포인트를 표로 정리했습니다.<br>선대 정비 기록·ROB는 <a href="/sm" class="underline-link">TVC-SM (Vessel Core / Fleet OS)</a>에서 운영합니다.',
        },
        'tk.mod.1.title': { en: 'Fuels & Thermodynamics', ko: '연료·열역학' },
        'tk.mod.1.d': { en: 'ASTM Table 54B, VCF, metric tons in air, IMO CO₂ factors.', ko: 'ASTM 54B, VCF, 공기중 MT, IMO CO₂ 계수.' },
        'tk.mod.2.title': { en: 'Piping & Fluid Mechanics', ko: '배관·유체역학' },
        'tk.mod.2.d': { en: 'JIS 5K/10K/16K, ANSI 150#, DIN flange matrix (OD, PCD, bolts).', ko: 'JIS·ANSI·DIN 플랜지 치수 (OD, PCD, 볼트).' },
        'tk.mod.3.title': { en: 'Lubrication & Tribology', ko: '윤활·트라이볼로지' },
        'tk.mod.3.d': { en: 'Cylinder, system, trunk piston, and hydraulic oil cross-reference.', ko: '실린더·시스템·트렁크 피스톤·유압유 조견.' },
        'tk.mod.4.title': { en: 'Marine Coatings', ko: '선박 도장' },
        'tk.mod.4.d': { en: 'Antifouling (A/F), anticorrosive (A/C), and epoxy primer tables.', ko: '방오·방식·에폭시 프라이머 조견.' },
        'tk.mod.5.title': { en: 'Electrical & controls (EE)', ko: '전기·제어 (EE)' },
        'tk.mod.5.d': {
            en: 'PT100 RTD inversion (IEC 60751) and motor FLC / EOCR protection calculator.',
            ko: 'PT100 RTD 역산(IEC 60751) 및 전동기 FLC·EOCR 계산.',
        },
        'tk.mod.6.title': { en: 'Statutory & Survey', ko: '법규·검사' },
        'tk.mod.6.d': { en: 'Tokyo/Paris MoU CIC checkpoints: OWS 15 ppm, fire pump, quick-closing valves.', ko: '도쿄·파리 MoU CIC: OWS 15ppm, 소화펌프, 퀵클로징 밸브.' },
        'tk.mod.catalog.title': { en: 'IMPA stores index', ko: 'IMPA 선용품 인덱스' },
        'tk.mod.catalog.d': { en: '50,000+ spec pages with catalog plates.', ko: '5만+ 규격·도판 페이지.' },
        'tk.modules.title': { en: 'Engineering modules', ko: '엔지니어링 모듈' },
        'tk.fleet.lock.rob': { en: 'Vessel ROB tracking — TVC-SM Fleet', ko: '선박 ROB 추적 — TVC-SM Fleet' },
        'tk.fleet.lock.req': { en: 'Superintendent requisitions — TVC-SM Fleet', ko: '감독 청구 — TVC-SM Fleet' },
        'tk.fleet.lock.survey': { en: 'Class survey export — TVC-SM Fleet', ko: '선급 검사 출력 — TVC-SM Fleet' },
        'tk.lube.title': { en: 'Lubricant cross-reference', ko: '윤활유 조견' },
        'tk.lube.sub': {
            en: 'Cylinder, system, trunk piston, and hydraulic grades across major makers.',
            ko: '실린더·시스템·트렁크 피스톤·유압 등급 조견.',
        },
        'tk.paint.title': { en: 'Marine paint cross-reference', ko: '선박 페인트 조견' },
        'tk.paint.sub': {
            en: 'Antifouling (A/F), anticorrosive (A/C), and epoxy primer equivalents.',
            ko: '방오(A/F)·방식(A/C)·에폭시 프라이머 조견.',
        },
        'tk.electrical.title': { en: 'Electrical & controls (EE)', ko: '전기·제어 (EE)' },
        'tk.electrical.sub': {
            en: 'PT100 RTD inversion (IEC 60751) and 3-phase motor FLC with DOL inrush and EOCR relay guidance.',
            ko: 'PT100 RTD 역산(IEC 60751) 및 3상 FLC·DOL·EOCR 가이드.',
        },
        'tk.electrical.pt100card': { en: 'PT100 temperature lookup', ko: 'PT100 온도 조회' },
        'tk.electrical.pt100sub': { en: 'Measured resistance (Ω) → equivalent temperature (°C).', ko: '측정 저항(Ω) → 등가 온도(°C).' },
        'tk.electrical.pt100ohms': { en: 'Measured resistance (Ω)', ko: '측정 저항 (Ω)' },
        'tk.electrical.pt100temp': { en: 'Equivalent temperature', ko: '등가 온도' },
        'tk.electrical.pt100toggle': { en: 'Show IEC 60751 reference table', ko: 'IEC 60751 참조표 표시' },
        'tk.electrical.motorcard': { en: '3-phase motor current & protection', ko: '3상 전동기 전류·보호' },
        'tk.electrical.motorsub': { en: 'FLC, DOL starting current, and recommended EOCR setting.', ko: 'FLC, DOL 기동전류, EOCR 설정.' },
        'tk.electrical.kw': { en: 'Motor power (kW)', ko: '전동기 출력 (kW)' },
        'tk.electrical.voltage': { en: 'Line voltage (V)', ko: '선간 전압 (V)' },
        'tk.electrical.eff': { en: 'Efficiency η', ko: '효율 η' },
        'tk.electrical.pf': { en: 'Power factor cos φ', ko: '역률 cos φ' },
        'tk.electrical.flc': { en: 'FLC (A)', ko: 'FLC (A)' },
        'tk.electrical.dol': { en: 'DOL start (A)', ko: 'DOL 기동 (A)' },
        'tk.electrical.eocr': { en: 'EOCR set (A)', ko: 'EOCR 설정 (A)' },
        'tk.electrical.pt100': { en: 'PT100 resistance vs temperature', ko: 'PT100 저항–온도' },
        'tk.electrical.note': {
            en: 'Confirm against nameplate, sequence control interlocks, and HV safety procedures before energizing.',
            ko: '가압 전 명판·시퀀스 인터록·고압 안전 절차를 확인하세요.',
        },
        'tk.compliance.title': { en: 'Statutory & survey compliance', ko: '법규·검사 준수' },
        'tk.compliance.sub': {
            en: 'Tokyo / Paris MoU concentrated inspection campaign (CIC) style checkpoints — verify against current PSC circular.',
            ko: '도쿄·파리 MoU CIC 유형 체크포인트 — 최신 PSC 서큘러로 확인.',
        },
        'tk.compliance.note': {
            en: 'Reference only. Always use the official MoU CIC questionnaire and class/statutory requirements in force.',
            ko: '참고용. 공식 MoU CIC 질문서와 현행 선급·법규를 따르세요.',
        },
        'tk.feature.impa': {
            en: '50,000+ IMPA store specs &amp; catalog plates — fast search',
            ko: '5만 개 선용품 규격 &amp; 도판 초고속 검색',
        },
        'tk.feature.bunker': {
            en: 'Bunker volume &amp; weight converter (temperature and density)',
            ko: '기름 부피·무게 환산기 (온도/비중에 따른 벙커 계산)',
        },
        'tk.feature.flange': {
            en: 'Pipe valve, flange dimensions and bolt tables',
            ko: '파이프 밸브·플랜지 치수 및 볼트 규격표',
        },
        'tk.feature.lube': {
            en: 'Lubricant cross-reference by maker',
            ko: '윤활유 제조사별 호환 조견표',
        },
        'tk.feature.paint': {
            en: 'Marine paint cross-reference by maker',
            ko: '페인트 제조사별 호환 조견표',
        },
        'tk.popular.title': { en: 'Popular Marine Stores & Critical Parts', ko: '자주 찾는 선용품 · 핵심 부품' },
        'tk.popular.lead': {
            en: 'Indexed IMPA spec pages for frequently searched codes.',
            ko: '많이 검색하는 IMPA 코드의 규격·도판 페이지.',
        },
        'tk.tab.catalog': { en: 'IMPA index', ko: 'IMPA 인덱스' },
        'tk.tab.bunker': { en: 'Fuels & 54B', ko: '연료·54B' },
        'tk.tab.lube': { en: 'Lubrication', ko: '윤활' },
        'tk.tab.paint': { en: 'Coatings', ko: '도장' },
        'tk.tab.engineering': { en: 'Piping / flanges', ko: '배관·플랜지' },
        'tk.tab.electrical': { en: 'Electrical', ko: '전기' },
        'tk.tab.compliance': { en: 'Survey / PSC', ko: '검사·PSC' },
        'tk.tab.mechanical': { en: 'Mechanical', ko: '기계' },
        'tk.mod.mech.title': { en: 'Mechanical elements', ko: '기계 요소' },
        'tk.mod.mech.d': {
            en: 'Bolt tightening torque tables and crankshaft deflection diagnostics.',
            ko: '볼트 체결 토크 표와 크랭크샤프트 처형 진단.',
        },
        'tk.mech.title': { en: 'Mechanical elements', ko: '기계 요소' },
        'tk.mech.sub': {
            en: 'Bolt tightening torque (ISO property class) and crankshaft deflection vs stroke — machine design & alignment checks.',
            ko: '볼트 체결 토크(ISO 강도등급)와 크랭크샤프트 처형 — 정렬 점검.',
        },
        'tk.mech.bolt.title': { en: 'Bolt torque guide', ko: '볼트 토크 가이드' },
        'tk.mech.bolt.sub': {
            en: 'T = K × d × Fm — metric coarse threads, lightly oiled (K=0.14) or dry (K=0.18).',
            ko: 'T = K × d × Fm — 미터 나사, 오일(K=0.14) 또는 건식(K=0.18).',
        },
        'tk.mech.bolt.size': { en: 'Bolt size', ko: '볼트 규격' },
        'tk.mech.bolt.class': { en: 'Property class', ko: '강도 등급' },
        'tk.mech.bolt.lube': { en: 'Lubrication', ko: '윤활' },
        'tk.mech.bolt.oiled': { en: 'Lightly oiled (K=0.14)', ko: '가벼운 오일 (K=0.14)' },
        'tk.mech.bolt.dry': { en: 'Dry (K=0.18)', ko: '건식 (K=0.18)' },
        'tk.mech.bolt.nm': { en: 'Target torque (N·m)', ko: '목표 토크 (N·m)' },
        'tk.mech.bolt.kgf': { en: 'Target torque (kgf·m)', ko: '목표 토크 (kgf·m)' },
        'tk.mech.defl.title': { en: 'Crankshaft deflection check', ko: '크랭크샤프트 처형' },
        'tk.mech.defl.sub': {
            en: 'Allowable |ΔV| = stroke × 0.00007 mm (0.07 mm per 1000 mm stroke).',
            ko: '허용 |ΔV| = 스트로크 × 0.00007 mm.',
        },
        'tk.mech.defl.stroke': { en: 'Stroke (mm)', ko: '스트로크 (mm)' },
        'tk.mech.defl.top': { en: 'Top (T)', ko: 'Top (T)' },
        'tk.mech.defl.bottom': { en: 'Bottom (B)', ko: 'Bottom (B)' },
        'tk.mech.defl.port': { en: 'Port (P)', ko: 'Port (P)' },
        'tk.mech.defl.starboard': { en: 'Starboard (S)', ko: 'Starboard (S)' },
        'tk.mech.defl.dv': { en: 'ΔV (mm)', ko: 'ΔV (mm)' },
        'tk.mech.defl.dh': { en: 'ΔH (mm)', ko: 'ΔH (mm)' },
        'tk.mech.defl.limit': { en: 'Allowable |ΔV| (mm)', ko: '허용 |ΔV| (mm)' },
        'tk.mech.note': {
            en: 'Torque values are indicative — confirm with maker manual, joint standard, and class requirements.',
            ko: '토크는 참고값 — 메이커·조인트·선급 기준으로 확인하세요.',
        },
        'tk.tab.combustion': { en: 'Combustion', ko: '연소' },
        'tk.mod.comb.title': { en: 'Combustion & engine', ko: '연소·기관' },
        'tk.mod.comb.d': {
            en: 'Pmax / Texh balance diagnostics and cylinder oil feed rate optimizer.',
            ko: 'Pmax·Texh 균형 진단 및 실린더 오일 급유율.',
        },
        'tk.comb.title': { en: 'Combustion & engine', ko: '연소·기관' },
        'tk.comb.sub': {
            en: 'Pmax / Pcomp / Texh deviation analysis and cylinder oil feed rate vs fuel sulfur & BN (MARPOL Annex VI context).',
            ko: 'Pmax·Pcomp·Texh 편차 및 유황·BN 기반 실린더 오일 급유 (MARPOL Annex VI).',
        },
        'tk.comb.balance.title': { en: 'Combustion balance', ko: '연소 균형' },
        'tk.comb.balance.sub': { en: 'Tolerance: ±3 bar Pmax, ±30°C Texh vs cylinder mean.', ko: '허용: 평균 대비 Pmax ±3 bar, Texh ±30°C.' },
        'tk.comb.preset6': { en: 'Load 6-cyl sample', ko: '6기관 샘플 불러오기' },
        'tk.comb.lube.title': { en: 'Cylinder oil feed rate', ko: '실린더 오일 급유율' },
        'tk.comb.lube.sub': { en: 'Target SCOC from engine kW, fuel sulfur %, and cylinder oil BN.', ko: 'kW·유황%·BN으로 목표 SCOC.' },
        'tk.comb.lube.kw': { en: 'Engine power (kW)', ko: '기관 출력 (kW)' },
        'tk.comb.lube.s': { en: 'Fuel sulfur (%)', ko: '연료 유황 (%)' },
        'tk.comb.lube.bn': { en: 'Cylinder oil BN', ko: '실린더 오일 BN' },
        'tk.comb.lube.gkwh': { en: 'Target feed (g/kWh)', ko: '목표 급유 (g/kWh)' },
        'tk.comb.lube.day': { en: 'Daily volume (L/day)', ko: '일일 소모 (L/day)' },
        'tk.comb.note': {
            en: 'Diagnostics are indicative — correlate with indicator cards, drain analysis, and maker limits.',
            ko: '진단은 참고용 — 지시카드·드레인 분석·메이커 한계와 대조하세요.',
        },
        'tk.tab.auxiliary': { en: 'AUX', ko: 'AUX' },
        'tk.mod.aux.title': { en: 'Auxiliary & refrigeration (AUX)', ko: '보조기·냉동 (AUX)' },
        'tk.mod.aux.d': {
            en: 'Refrigerant superheat/subcooling and boiler water blowdown quick check.',
            ko: '냉매 과열/과냉 및 보일러 수질·블로우다운 점검.',
        },
        'tk.aux.title': { en: 'Auxiliary & refrigeration', ko: '보조기·냉동' },
        'tk.aux.sub': {
            en: 'Refrigerant P-T superheat/subcooling and auxiliary boiler water conditioning quick check.',
            ko: '냉매 P-T 과열/과냉 및 보조보일러 수질 점검.',
        },
        'tk.aux.ref.title': { en: 'Refrigerant P-T & expansion valve check', ko: '냉매 P-T·팽창밸브' },
        'tk.aux.ref.sub': {
            en: 'Gauge pressures (bar) + line surface temperatures → saturation, superheat, subcooling.',
            ko: '게이지 압력(bar)과 배관 표면온도 → 포화·과열·과냉.',
        },
        'tk.aux.ref.gas': { en: 'Refrigerant', ko: '냉매' },
        'tk.aux.ref.suctionP': { en: 'Suction (bar gauge)', ko: '흡입 (bar gauge)' },
        'tk.aux.ref.suctionT': { en: 'Suction line temp (°C)', ko: '흡입관 온도 (°C)' },
        'tk.aux.ref.dischargeP': { en: 'Discharge (bar gauge)', ko: '토출 (bar gauge)' },
        'tk.aux.ref.liquidT': { en: 'Liquid line temp (°C)', ko: '액관 온도 (°C)' },
        'tk.aux.ref.tsate': { en: 'T sat evap', ko: '포화 증발' },
        'tk.aux.ref.tsatc': { en: 'T sat cond', ko: '포화 응축' },
        'tk.aux.ref.sh': { en: 'Superheat', ko: '과열' },
        'tk.aux.ref.sc': { en: 'Subcooling', ko: '과냉' },
        'tk.aux.boiler.title': { en: 'Boiler water treatment', ko: '보일러 수질' },
        'tk.aux.boiler.sub': {
            en: 'pH, chloride, and phosphate vs auxiliary boiler limits (typ. <16–20 bar).',
            ko: 'pH·염화물·인산 vs 보조보일러 한계(통상 <16–20 bar).',
        },
        'tk.aux.boiler.ph': { en: 'pH', ko: 'pH' },
        'tk.aux.boiler.cl': { en: 'Chloride (ppm)', ko: '염화물 (ppm)' },
        'tk.aux.boiler.po4': { en: 'Phosphate (ppm PO4)', ko: '인산 (ppm PO4)' },
        'tk.aux.note': {
            en: 'Use calibrated gauges and lab kits — align blowdown with chief engineer and chemical supplier program.',
            ko: '교정 게이지·시험키트 사용 — C/E·약품 프로그램에 맞춰 블로우다운.',
        },
        'tk.loading': { en: 'Loading catalog…', ko: '카탈로그 불러오는 중…' },
        'tk.bunker.title': { en: 'Bunker & Fuel Calculator (ASTM Table 54B)', ko: '벙커·유량 계산 (ASTM Table 54B)' },
        'tk.bunker.sub': {
            en: 'VCF, weight-in-air mass, and estimated CO₂ from observed volume, density @ 15°C, and temperature.',
            ko: '관측 부피·15°C 밀도·온도로 VCF, 공기중 중량, 예상 CO₂를 계산합니다.',
        },
        'tk.bunker.fuel': { en: 'Fuel grade', ko: '유종' },
        'tk.bunker.volume': { en: 'Observed volume (m³)', ko: '관측 부피 (m³)' },
        'tk.bunker.density': { en: 'Density @ 15°C (kg/m³)', ko: '15°C 밀도 (kg/m³)' },
        'tk.bunker.temp': { en: 'Observed temperature (°C)', ko: '관측 온도 (°C)' },
        'tk.bunker.vcf': { en: 'VCF @ 15°C', ko: 'VCF (15°C 기준)' },
        'tk.bunker.alpha': { en: 'Alpha @ 15°C', ko: 'α (15°C)' },
        'tk.bunker.mass': { en: 'Mass in air (MT)', ko: '공기중 중량 (MT)' },
        'tk.bunker.co2': { en: 'Est. CO₂ (MT)', ko: '예상 CO₂ (MT)' },
        'tk.bunker.v15': { en: 'Volume @ 15°C (m³)', ko: '15°C 부피 (m³)' },
        'tk.bunker.benchmark': { en: 'Ticker benchmark', ko: '티커 기준가' },
        'tk.bunker.benchmark.hint': {
            en: 'Use observed lab density for settlement.',
            ko: '정산 시 관측·검정 밀도를 사용하세요.',
        },
        'tk.bunker.fuelPrice': { en: 'Benchmark fuel price ($/MT)', ko: '기준 연료 단가 ($/MT)' },
        'tk.bunker.fuelCost': { en: 'Total fuel cost ($)', ko: '총 연료비 ($)' },
        'tk.bunker.note': {
            en: 'ASTM Table 54B VCF (API MPMS). Verify with shore lab before commercial settlement.',
            ko: 'ASTM Table 54B VCF 적용. 상업 정산 전 육상 검정실 값으로 확인하세요.',
        },
        'tk.flange.title': { en: 'Flange & Engineering Tables', ko: '플랜지·기술 규격표' },
        'tk.flange.sub': {
            en: 'JIS B2220 (5K / 10K / 16K), ANSI 150#, DIN PN10 / PN16 — dimensions in millimetres.',
            ko: 'JIS B2220 (5K/10K/16K), ANSI 150#, DIN PN10/PN16 — 단위 mm.',
        },
        'tk.flange.standard': { en: 'Standard', ko: '규격' },
        'tk.flange.filter': { en: 'Filter nominal size', ko: '호칭 경 검색' },
        'tk.flange.note': {
            en: 'Verify against yard drawing / class certificate before procurement.',
            ko: '발주 전 조선소 도면·선급 증서와 반드시 대조하세요.',
        },
        'tk.conversion.banner': {
            en: '⚓ Looking to automate ROB tracking & 1-Click Requisitions?',
            ko: '⚓ ROB 자동 추적·원클릭 청구가 필요하신가요?',
        },
        'tk.conversion.cta': { en: 'Request TVC-SM Demo', ko: 'TVC-SM 데모 신청' },
        'tk.plg.p': {
            en: 'When the fleet needs audited maintenance and ROB, operate on <a href="/sm">TVC-SM (Vessel Core / Fleet OS)</a>.',
            ko: '감사 가능한 정비·ROB가 필요하면 <a href="/sm">TVC-SM (Vessel Core / Fleet OS)</a>에서 운영하세요.',
        },
        'tk.plg.sm': { en: 'About TVC-SM', ko: 'TVC-SM 소개' },
        'tk.plg.app': { en: 'Launch App', ko: '앱 실행' },

        'services.meta.description': {
            en: 'THE VESSEL CODE — Technical superintendent oversight and TVC-SM fleet integration.',
            ko: 'THE VESSEL CODE — 공무감독 기술 지원 및 TVC-SM 선대 통합.',
        },
        'services.document.title': { en: 'Services | THE VESSEL CODE', ko: '서비스 | THE VESSEL CODE' },
        'services.hero.title': { en: 'Professional Services', ko: '프로페셔널 서비스' },
        'services.hero.lead': {
            en: 'Superintendent-grade oversight on deck, plus TVC-SM onboarding when your fleet is ready to go digital.',
            ko: '현장 공무감독 지원과 TVC-SM 도입 온보딩.',
        },
        'services.card1.title': { en: 'Technical Superintendent Oversight', ko: '기술 공무감독' },
        'services.card1.lead': {
            en: 'ClassNK audit prep, dry-dock scope verification, and independent condition assessments for owners.',
            ko: 'ClassNK 감사 준비, 도크 검증, 선주를 위한 독립 상태 평가.',
        },
        'services.card1.m1': { en: '<strong>ClassNK</strong> audit prep', ko: '<strong>ClassNK</strong> 감사 준비' },
        'services.card1.m2': { en: '<strong>Dry-dock</strong> verification', ko: '<strong>도크</strong> 검증' },
        'services.card1.m3': { en: '<strong>Condition</strong> assessment', ko: '<strong>상태</strong> 평가' },
        'services.card2.title': { en: 'TVC-SM Fleet Integration', ko: 'TVC-SM Fleet 통합' },
        'services.card2.lead': {
            en: 'Onboarding TVC-SM (Vessel Core / Fleet OS) with offline database setup and ship–shore sync architecture.',
            ko: '오프라인 DB 구축과 선박–육상 동기화 아키텍처로 TVC-SM 온보딩.',
        },
        'services.card2.m1': { en: '<strong>100%</strong> Offline PWA', ko: '<strong>100%</strong> 오프라인 PWA' },
        'services.card2.m2': { en: '<strong>ZIP</strong> ship↔shore', ko: '<strong>ZIP</strong> 선박↔육상' },
        'services.card2.m3': { en: '<strong>Master data</strong> validation', ko: '<strong>마스터 데이터</strong> 검증' },
        'services.cta.title': { en: 'Ready for superintendent support or a fleet pilot?', ko: '공무 지원 또는 파일럿이 필요하신가요?' },
        'services.cta.p': {
            en: 'Busan engineering team — practical oversight and TVC-SM rollout.',
            ko: '부산 엔지니어링팀 — 실무 감독과 TVC-SM 롤아웃.',
        },
        'services.cta.btn': { en: 'Contact Us', ko: '문의하기' },

        'contact.meta.description': {
            en: 'Contact THE VESSEL CODE — fleet demos, partnerships, and technical support from Busan HQ.',
            ko: 'THE VESSEL CODE 문의 — 파일럿·제휴·기술지원 (부산 HQ).',
        },
        'contact.document.title': { en: 'Contact Us | THE VESSEL CODE', ko: '문의하기 | THE VESSEL CODE' },
        'contact.hero.eyebrow': { en: 'Contact Us', ko: '문의하기' },
        'contact.hero.title': { en: 'Connect with THE VESSEL CODE', ko: 'THE VESSEL CODE에 문의' },
        'contact.hotline': {
            en: '🛟 24/7 Technical Hotline · +82 10-3889-4291',
            ko: '🛟 24시간 기술 핫라인 · +82 10-3889-4291',
        },
        'contact.hero.sub': {
            en: 'Fleet demos, partnerships, and support for open maritime tools and TVC-SM.',
            ko: '열린 해운 도구와 TVC-SM — 파일럿·제휴·기술 문의를 환영합니다.',
        },
        'contact.badge.sm': { en: '⚓ TVC-SM (Vessel Core / Fleet OS)', ko: '⚓ TVC-SM (Vessel Core / Fleet OS)' },
        'contact.badge.tk': { en: '📐 Maritime Toolkit', ko: '📐 해운 실무 공구함' },
        'contact.badge.global': { en: '🌐 Global community support', ko: '🌐 글로벌 커뮤니티 지원' },
        'contact.about.title': { en: 'Maritime expertise meets practical software', ko: '해운 실무와 실용 소프트웨어' },
        'contact.about.p': {
            en: 'THE VESSEL CODE delivers TVC-SM (Vessel Core / Fleet OS) and superintendent support — built for real fleets, not generic office IT.',
            ko: 'THE VESSEL CODE는 TVC-SM과 공무감독 지원을 제공합니다 — 실제 선대를 위한 실무형 솔루션.',
        },
        'contact.touch.title': { en: 'Get in Touch', ko: '연락처' },
        'contact.touch.sub': { en: 'Speak with our maritime engineering team.', ko: '해운 엔지니어링팀과 직접 상담하세요.' },
        'contact.label.company': { en: 'Company', ko: '회사' },
        'contact.label.hq': { en: 'Headquarters', ko: '본사' },
        'contact.label.support': { en: 'Technical Support', ko: '기술 지원' },
        'contact.label.email': { en: 'Email', ko: '이메일' },
        'contact.form.title': { en: 'Send an Inquiry', ko: '문의 보내기' },
        'contact.form.sub': { en: 'Tell us about your fleet, goals, or technical questions.', ko: '선대 규모, 목표, 기술 질문을 알려주세요.' },
        'contact.field.company': { en: 'Company Name *', ko: '회사명 *' },
        'contact.field.name': { en: 'Your Name *', ko: '성함 *' },
        'contact.field.email': { en: 'Work Email *', ko: '업무 이메일 *' },
        'contact.field.emailConfirm': { en: 'Confirm Work Email *', ko: '업무 이메일 확인 *' },
        'contact.field.inquiry': { en: 'Inquiry Type *', ko: '문의 유형 *' },
        'contact.field.message': { en: 'Message *', ko: '내용 *' },
        'contact.inquiry.placeholder': { en: '— Select inquiry type —', ko: '— 문의 유형 선택 —' },
        'contact.inquiry.demo': { en: 'TVC-SM Fleet Demo & PoC', ko: 'TVC-SM 파일럿·데모' },
        'contact.inquiry.partnership': { en: 'Maritime Toolkit & Partnership', ko: '실무 공구함·제휴' },
        'contact.inquiry.support': { en: 'Technical Support & Bug Report', ko: '기술 지원·오류 신고' },
        'contact.inquiry.general': { en: 'General Inquiries', ko: '일반 문의' },
        'contact.message.placeholder': {
            en: 'Fleet size, operational needs, or your questions…',
            ko: '선대 규모, 운영 요구, 궁금한 점을 적어주세요…',
        },
        'contact.submit': { en: 'Submit Inquiry', ko: '문의 보내기' },
        'contact.form.note': { en: 'Your inquiry is sent directly to our team from this form.', ko: '이 양식으로 팀에 직접 전달됩니다.' },
        'contact.err.required': { en: 'Please complete all required fields.', ko: '필수 항목을 모두 입력해 주세요.' },
        'contact.err.email': { en: 'Please enter a valid work email address.', ko: '올바른 업무 이메일을 입력해 주세요.' },
        'contact.err.mismatch': { en: 'Work Email and Confirm Work Email do not match.', ko: '이메일과 확인 이메일이 일치하지 않습니다.' },
        'contact.status.sending': { en: 'Sending your inquiry…', ko: '문의를 보내는 중…' },
        'contact.status.okEmail': { en: 'Thank you. Your inquiry was emailed to our team.', ko: '감사합니다. 팀 이메일로 전달되었습니다.' },
        'contact.status.ok': { en: 'Thank you. Your inquiry was received by our team.', ko: '감사합니다. 문의가 접수되었습니다.' },
        'contact.status.mailto': { en: 'Opening your email client with a pre-filled inquiry…', ko: '메일 앱으로 미리 채운 문의를 엽니다…' },
        'contact.status.mailtoFallback': {
            en: 'If your email client did not open, use the email link in the contact card.',
            ko: '메일이 열리지 않으면 연락처 카드의 이메일 링크를 이용해 주세요.',
        },
        'contact.campaign.demo': {
            en: 'I would like to request a free 30-day TVC-SM fleet pilot / demo for our vessels.',
            ko: 'TVC-SM 30일 파일럿·데모를 신청합니다.',
        },
        'contact.campaign.fleetTrial': {
            en: 'I would like to start the 30-day risk-free TVC-SM fleet trial (Starter plan — $99/vessel/mo after trial).',
            ko: 'TVC-SM 30일 무위험 선대 체험을 신청합니다 (체험 후 Starter — 선박당 월 $99).',
        },
        'contact.campaign.toolkitPro': {
            en: 'I would like to subscribe to Maritime Toolkit Pro ($9.99/month) for ASTM 54B logs and offline PDF exports.',
            ko: 'Maritime Toolkit Pro(월 $9.99) 구독을 신청합니다 — ASTM 54B 로그·오프라인 PDF.',
        },

        'forum.meta.description': {
            en: 'Maritime & Industrial Exchange — open technical Q&A for troubleshooting, spares, SOP ideas, and Class/PSC topics.',
            ko: 'Maritime & Industrial Exchange — 기계·설비, 자재, 실무 개선, 선급·PSC 주제의 열린 Q&A.',
        },
        'forum.document.title': {
            en: 'Maritime & Industrial Exchange | THE VESSEL CODE',
            ko: '해양 Q&A Exchange | THE VESSEL CODE',
        },
        'forum.hero.eyebrow': { en: 'Maritime & Industrial Exchange', ko: 'Maritime & Industrial Exchange' },
        'forum.hero.title': {
            en: 'Open Q&A for sea and shore teams',
            ko: '바다와 육상을 잇는 열린 기술 Q&A',
        },
        'forum.hero.lead': {
            en: 'Ask troubleshooting questions, compare spare specs, share SOP improvements, and discuss Class/PSC readiness — without a heavy login wall.',
            ko: '트러블슈팅, 자재·호환품, 실무 SOP, 선급·검사 대응을 가볍게 나눕니다 — 복잡한 가입 없이.',
        },
        'forum.trust.xss': { en: '🛡️ XSS-safe rendering', ko: '🛡️ XSS 방어 렌더링' },
        'forum.trust.spam': { en: '🚫 Profanity & spam filters', ko: '🚫 욕설·스팸 필터' },
        'forum.trust.rate': { en: '⏱️ 30s post cooldown', ko: '⏱️ 30초 게시 간격' },
        'forum.cat.technical': {
            en: 'Technical Q&A & Troubleshooting',
            ko: '기계·설비 트러블슈팅',
        },
        'forum.cat.spare': { en: 'Spare Parts & Spec Exchange', ko: '자재·호환품 문의' },
        'forum.cat.ops': { en: 'Operational Ideas & SOP', ko: '실무 아이디어 및 개선안' },
        'forum.cat.regulations': { en: 'Regulations & Class/PSC', ko: '선급·검사 대응 질의' },
        'forum.compose.title': { en: 'Start a discussion', ko: '질문·토론 시작' },
        'forum.compose.note': {
            en: 'No account required — display name and role only. Posts are moderated by automated safety filters.',
            ko: '회원가입 없이 표시 이름과 직무 Role만 입력합니다. 자동 안전 필터가 적용됩니다.',
        },
        'forum.compose.submit': { en: 'Post to channel', ko: '채널에 게시' },
        'forum.field.name': { en: 'Display name', ko: '표시 이름' },
        'forum.field.role': { en: 'Role', ko: '직무 Role' },
        'forum.field.title': { en: 'Title', ko: '제목' },
        'forum.field.body': { en: 'Question or tip', ko: '질문 또는 팁' },
        'forum.field.comment': { en: 'Reply', ko: '답글' },
        'forum.list.empty': { en: 'No threads yet — be the first to ask.', ko: '아직 글이 없습니다 — 첫 질문을 남겨 보세요.' },
        'forum.thread.open': { en: 'Open thread', ko: '스레드 보기' },
        'forum.thread.back': { en: '← Back to channel', ko: '← 채널로 돌아가기' },
        'forum.thread.replies': { en: 'Replies', ko: '답글' },
        'forum.thread.none': { en: 'No replies yet — add a constructive tip.', ko: '답글이 없습니다 — 도움이 되는 팁을 남겨 주세요.' },
        'forum.comment.title': { en: 'Add a reply', ko: '답글 작성' },
        'forum.comment.submit': { en: 'Send reply', ko: '답글 등록' },
        'forum.cta.title': { en: 'Need fleet-grade PMS & SPARE on board?', ko: '선박용 PMS·SPARE가 필요하신가요?' },
        'forum.cta.body': {
            en: 'TVC-SM connects superintendent oversight with offline-first Vessel Core — ZIP sync, RFQ, and structured maintenance workflows.',
            ko: 'TVC-SM은 공무 감독과 오프라인 Vessel Core를 ZIP·RFQ·정형 PMS로 연결합니다.',
        },
        'forum.cta.sm': { en: 'Discover TVC-SM', ko: 'TVC-SM 알아보기' },
        'forum.cta.demo': { en: 'Fleet demo', ko: '파일럿·데모 문의' },
        'forum.err.rate': { en: 'Please wait 30 seconds between posts.', ko: '30초 후에 다시 게시할 수 있습니다.' },
        'forum.err.generic': { en: 'Could not post. Check your input and try again.', ko: '게시하지 못했습니다. 입력을 확인해 주세요.' },
        'forum.ok.posted': { en: 'Posted successfully.', ko: '게시되었습니다.' },
        'forum.ok.comment': { en: 'Reply posted.', ko: '답글이 등록되었습니다.' },
        'forum.ok.local': {
            en: 'Saved on this device (demo mode — API unavailable).',
            ko: '이 기기에 저장됨 (데모 — API 미연결).',
        },

        'intel.ticker.label': { en: 'Bunker stem', ko: '벙커 시세' },
        'intel.ticker.updated': { en: 'Indicative · UTC daily', ko: '참고가 · UTC 일일' },
        'intel.ticker.openCalc': { en: 'Open bunker calculator with this benchmark', ko: '이 기준가로 벙커 계산기 열기' },
        'intel.hub.title': {
            en: 'Commercial Intelligence & Daily Market Watch',
            ko: 'Commercial Intelligence & Daily Market Watch',
        },
        'intel.hub.lead': {
            en: 'Freight indices, bunker stems, and curated maritime news for owners, brokers, and bunker desks.',
            ko: '선주·브로커·벙커 데스크를 위한 운임 지표, 벙커 시세, 엄선 뉴스.',
        },
        'intel.market.title': { en: 'Freight & shipping indices', ko: '운임·해운 지표' },
        'intel.news.title': { en: 'Global maritime & energy stream', ko: '글로벌 해운·에너지 스트림' },
        'intel.news.leadBadge': { en: '🔴 LEAD STORY · BUNKER & ROUTE', ko: '🔴 주요 기사 · 벙커 & 항로' },
        'intel.news.streamKicker': { en: 'Live ticker stream', ko: '실시간 헤드라인' },
        'intel.news.streamLabel': { en: 'Breaking headlines', ko: '속보 헤드라인' },
        'intel.news.streamMore': {
            en: 'Additional headlines refresh with the daily market feed.',
            ko: '추가 헤드라인은 일일 마켓 피드와 함께 갱신됩니다.',
        },
        'intel.news.live': { en: 'Just in', ko: '방금' },
        'intel.market.stamp': { en: 'Updated daily benchmark', ko: '일일 벤치마크 갱신' },
        'intel.market.benchmarkAsOf': {
            en: 'Market benchmark as of',
            ko: '시장 벤치마크 기준일',
        },
        'intel.market.disclaimer': {
            en: 'Indicative levels for desk conversation — not trading or investment advice.',
            ko: '데스크 참고용이며 투자·거래 조언이 아닙니다.',
        },
        'intel.news.empty': { en: 'News feed loading…', ko: '뉴스 로딩 중…' },
        'intel.plg.title': { en: 'Automate fleet voyage fuel & noon reports', ko: '선대 항차 연료·Noon Report 자동화' },
        'intel.plg.body': {
            en: 'Track real-time ROB, simulate EU-ETS / CII carbon costs, and issue 1-click supplier RFQs.',
            ko: '실시간 ROB, EU-ETS·CII 탄소 비용 시뮬레이션, 1-클릭 Supplier RFQ.',
        },
        'intel.plg.cta': { en: '🚀 Discover TVC-SM Fleet Platform', ko: '🚀 TVC-SM 선대 플랫폼' },
        'intel.table.benchmark': { en: 'Benchmark', ko: '지표' },
        'intel.table.value': { en: 'Level', ko: '수준' },
        'intel.table.delta': { en: '24h', ko: '24h' },
        'intel.market.bdi': { en: 'Baltic Dry Index (BDI)', ko: 'Baltic Dry Index (BDI)' },
        'intel.market.capesize': { en: 'Capesize avg T/C', ko: 'Capesize 평균 용선료' },
        'intel.market.panamax': { en: 'Panamax avg T/C', ko: 'Panamax 평균 용선료' },
        'intel.market.bdti': { en: 'Baltic Dirty Tanker Index', ko: 'BDTI (Dirty Tanker)' },
        'intel.market.bcti': { en: 'Baltic Clean Tanker Index', ko: 'BCTI (Clean Tanker)' },
        'intel.market.scfi': { en: 'SCFI composite (container macro)', ko: 'SCFI 종합 (컨테이너 거시)' },
        'intel.market.container.note': {
            en: 'Indices are indicative reference levels for desk conversation — not trading advice.',
            ko: '지표는 데스크 참고용이며 투자·거래 조언이 아닙니다.',
        },
        'intel.hook.fleet': {
            en: 'Managing fleet voyage costs & fuel ROB?',
            ko: '선대 항차 비용·연료 ROB를 관리하시나요?',
        },
        'intel.hook.fleet.cta': { en: '🔒 Connect Real-Time Fleet to TVC-SM', ko: '🔒 TVC-SM 실시간 선대 연동' },
        'intel.hook.bunker': { en: 'Need fast bunker quality verification?', ko: '벙커 품질 검증이 급하신가요?' },
        'intel.hook.bunker.cta': { en: 'Launch Table 54B Estimator', ko: 'Table 54B 계산기 실행' },
        'intel.news.1.headline': {
            en: 'Singapore VLSFO stem tightens on delayed ARA cargo arrivals',
            ko: '싱가포르 VLSFO 물량 — ARA 입항 지연으로 타이트',
        },
        'intel.news.1.source': { en: 'TVC Market Desk · Bunker', ko: 'TVC Market Desk · Bunker' },
        'intel.news.1.summary': {
            en: 'Prompt 0.50%S stems firm as traders cover short positions ahead of month-end stems.',
            ko: '월말 스템 앞두고 숏 커버링으로 0.50%S 프롬프트 견조.',
        },
        'intel.news.2.headline': {
            en: 'IMO MEPC highlights unified fuel sampling procedures for 2027 enforcement',
            ko: 'IMO MEPC, 2027 시행 통합 연료 샘플링 절차 강조',
        },
        'intel.news.2.source': { en: 'Regulatory brief · IMO', ko: '규제 브리프 · IMO' },
        'intel.news.2.summary': {
            en: 'Owners advised to align BDN, seal logs, and onboard test kits with revised guidelines.',
            ko: '선주는 BDN·봉인 기록·선내 키트를 개정 지침에 맞출 것.',
        },
        'intel.news.3.headline': {
            en: 'Second-hand bulker prices hold as Panamax earnings recover',
            ko: 'Panamax 수익 회복 — 중고 벌크선 가격 유지',
        },
        'intel.news.3.source': { en: 'S&P snapshot · Clarksons-style', ko: 'S&P 스냅샷' },
        'intel.news.3.summary': {
            en: 'Five-year eco Panamax candidates see bid interest from Greek and Chinese buyers.',
            ko: '5년식 eco Panamax에 그리스·중국 매수 관심.',
        },
        'intel.news.4.headline': {
            en: 'US Gulf grain liftings support Atlantic MR tanker repositioning',
            ko: '미국 곡물 출하 — Atlantic MR 재배치 지원',
        },
        'intel.news.4.source': { en: 'Trade flow · Energy', ko: 'Trade flow · Energy' },
        'intel.news.4.summary': {
            en: 'Clean product arbitrage opens Houston–Rotterdam MR runs on improved freight.',
            ko: '운임 개선으로 Houston–Rotterdam MR 클린 제품 차익.',
        },
        'intel.news.5.headline': {
            en: 'Rotterdam HSFO inventory draws on Russian export routing changes',
            ko: '로테르담 HSFO 재고 감소 — 수출 루트 변화',
        },
        'intel.news.5.source': { en: 'TVC Market Desk · Bunker', ko: 'TVC Market Desk · Bunker' },
        'intel.news.5.summary': {
            en: '380cSt availability narrows; owners lock stems early for US Gulf ballasters.',
            ko: '380cSt 가용 축소; US Gulf ballast 선박 조기 스템.',
        },
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

    const META_DESC_KEYS = {
        home: 'home.meta.description',
        sm: 'sm.meta.description',
        toolkit: 'tk.meta.description',
        services: 'services.meta.description',
        contact: 'contact.meta.description',
        forum: 'forum.meta.description',
    };

    const DOCUMENT_TITLE_KEYS = {
        home: 'home.document.title',
        sm: 'sm.document.title',
        toolkit: 'tk.document.title',
        services: 'services.document.title',
        contact: 'contact.document.title',
        forum: 'forum.document.title',
    };

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
        if (desc && page && META_DESC_KEYS[page]) {
            const d = t(META_DESC_KEYS[page], lang);
            if (d) desc.setAttribute('content', d);
        }

        if (page && DOCUMENT_TITLE_KEYS[page]) {
            const title = t(DOCUMENT_TITLE_KEYS[page], lang);
            if (title) document.title = title;
        }

        document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
            const key = el.getAttribute('data-i18n-placeholder');
            const val = t(key, lang);
            if (val != null) el.setAttribute('placeholder', val);
        });

        document.querySelectorAll('option[data-i18n]').forEach((opt) => {
            const key = opt.getAttribute('data-i18n');
            const val = t(key, lang);
            if (val != null) opt.textContent = val;
        });

        document.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
            const key = el.getAttribute('data-i18n-aria-label');
            const val = t(key, lang);
            if (val != null) el.setAttribute('aria-label', val);
        });

        document.querySelectorAll('.mkt-lang-switch').forEach((grp) => {
            const label = t('nav.lang.group', lang);
            if (label) grp.setAttribute('aria-label', label);
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
