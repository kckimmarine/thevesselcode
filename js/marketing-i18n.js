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
        'nav.sm': { en: 'TVC-SM', ko: 'TVC-SM 선박관리' },
        'nav.contact': { en: 'Contact Us', ko: '문의하기' },
        'nav.menu': { en: 'Menu', ko: '메뉴' },
        'nav.brand.tag': {
            en: 'Engineering · Operations · Open maritime hub',
            ko: '해운 기술 · 운항 · 열린 해양 플랫폼',
        },
        'nav.lang.group': { en: 'Language', ko: '언어' },
        'lang.ko': { en: 'KO', ko: 'KO' },
        'lang.en': { en: 'EN', ko: 'EN' },
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
            ko: '바다와 육상을 잇는 열린 해운 지식 & 선박관리 플랫폼',
        },
        'home.tagline': {
            en: 'Empowering seafarers, superintendents, owners, suppliers, surveyors, and cadets worldwide with open engineering tools and modern fleet software.',
            ko: '실습생부터 선원, 공무감독, 선주, 선용품·수리업체까지 — 누구나 무료로 쓰는 실무 공구함과 부담 없는 초경량 선박관리 솔루션을 제공합니다.',
        },
        'home.ethos.label': { en: 'Mutual growth platform', ko: '상생 플랫폼' },
        'home.document.title': {
            en: 'THE VESSEL CODE | Open Digital Commons for Global Maritime',
            ko: 'THE VESSEL CODE | 열린 해운 지식 & 선박관리',
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
            en: 'The resilient, local-first ship management operating system engineered by superintendents.',
            ko: '공무감독이 직접 설계한, 끊김 없는 현장형 선박관리 운영체제',
        },
        'sm.hero.lead': {
            en: 'Shipboard-first program that starts in milliseconds — full PMS and SPARE when the link is down. PC and mobile ready.',
            ko: '인터넷이 끊겨도 0.1초 만에 구동되는 현장 중심 선박관리 프로그램 (PC 및 모바일 지원).',
        },
        'sm.hero.approval': {
            en: 'Structured workflow: Drafted (ship staff) → Verified (Chief Officer / Chief Engineer) → Final approval (Superintendent).',
            ko: '작성(사관) ➔ 확인(선·기장) ➔ 최종 승인(공무감독)의 체계적인 결재선',
        },
        'sm.philosophy': {
            en: 'A mutual-growth ship management system — without legacy PMS markup, priced so small owners can adopt with confidence.',
            ko: '비싼 외산 프로그램의 거품을 빼고, 영세 선사도 부담 없이 도입할 수 있는 상생형 선박관리 시스템',
        },
        'sm.cta.launch': { en: '🚀 Launch TVC-SM App', ko: '🚀 TVC-SM 앱 실행' },
        'sm.cta.demo': { en: 'Request Fleet Demo', ko: '파일럿 데모 문의' },
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

        'tk.meta.description': {
            en: 'Maritime Toolkit — IMPA catalog, bunker, flange, lube and paint cross-reference tools. Free for global seafarers.',
            ko: '해운 실무 공구함 — IMPA·벙커·플랜지·윤활·페인트 조견. 선원·공무 모두 무료.',
        },
        'tk.document.title': {
            en: 'Maritime Toolkit | THE VESSEL CODE',
            ko: '해운 실무 공구함 | THE VESSEL CODE',
        },
        'tk.eyebrow': { en: 'Free · For global seafarers', ko: '무료 · 바다와 육상 실무자용' },
        'tk.hero.title': {
            en: 'Maritime Toolkit',
            ko: '해운 실무 공구함 (Maritime Toolkit)',
        },
        'tk.lead': {
            en: '<strong>50,000+</strong> marine store specs and calculators in your browser. Onboard ROB &amp; PMS via <a href="/sm">TVC-SM</a>.',
            ko: '브라우저에서 <strong>5만 개</strong> 선용품 규격·도판과 계산기. 본선 재고·정비는 <a href="/sm">TVC-SM</a>으로 연결합니다.',
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
        'tk.tab.catalog': { en: '📦 IMPA Catalog', ko: '📦 IMPA 선용품' },
        'tk.tab.bunker': { en: '⛽ Bunker & Fuel Calc', ko: '⛽ 벙커·유량 계산' },
        'tk.tab.lube': { en: '🛢️ Lub-Oil Cross-Ref', ko: '🛢️ 윤활유 조견' },
        'tk.tab.paint': { en: '🎨 Paint Cross-Ref', ko: '🎨 페인트 조견' },
        'tk.tab.engineering': { en: '📐 Flange & Engineering', ko: '📐 플랜지·기술표' },
        'tk.loading': { en: 'Loading catalog…', ko: '카탈로그 불러오는 중…' },
        'tk.plg.p': {
            en: '<strong>Open tools first:</strong> practitioners use the Toolkit free → fleets pilot TVC-SM when ready.',
            ko: '<strong>무료 도구 먼저:</strong> 실무자는 공구함을 쓰고 → 선대는 준비되면 TVC-SM 파일럿.',
        },
        'tk.plg.sm': { en: 'About TVC-SM', ko: 'TVC-SM 소개' },
        'tk.plg.app': { en: 'Launch App', ko: '앱 실행' },

        'services.meta.description': {
            en: 'THE VESSEL CODE services — superintendent, retrofit, PSC & vetting, repair engineering, and strategic supply.',
            ko: 'THE VESSEL CODE 서비스 — 공무감독, 개조, PSC·vetting, 수리 엔지니어링, 전략 조달.',
        },
        'services.document.title': { en: 'Services | THE VESSEL CODE', ko: '서비스 | THE VESSEL CODE' },
        'services.hero.title': { en: 'Services', ko: '서비스' },
        'services.hero.lead': {
            en: 'Five integrated pillars — superintendent representation, retrofit, compliance, repair engineering, and supply.',
            ko: '다섯 가지 실무 영역 — 공무감독, 개조, 컴플라이언스, 수리 엔지니어링, 조달.',
        },
        'services.cta.title': { en: 'Discuss your fleet requirements', ko: '선대 요구사항 상담' },
        'services.cta.p': {
            en: 'Superintendent support, retrofit management, or a TVC-SM pilot — Busan engineering team.',
            ko: '공무감독, 개조 관리, TVC-SM 파일럿 — 부산 엔지니어링팀이 도와드립니다.',
        },
        'services.cta.btn': { en: 'Contact Us', ko: '문의하기' },

        'contact.meta.description': {
            en: 'Contact THE VESSEL CODE — fleet demos, partnerships, and technical support from Busan HQ.',
            ko: 'THE VESSEL CODE 문의 — 파일럿·제휴·기술지원 (부산 HQ).',
        },
        'contact.document.title': { en: 'Contact Us | THE VESSEL CODE', ko: '문의하기 | THE VESSEL CODE' },
        'contact.hero.eyebrow': { en: 'Contact Us', ko: '문의하기' },
        'contact.hero.title': { en: 'Connect with THE VESSEL CODE', ko: 'THE VESSEL CODE에 문의' },
        'contact.hero.sub': {
            en: 'Fleet demos, partnerships, and support for open maritime tools and TVC-SM.',
            ko: '열린 해운 도구와 TVC-SM — 파일럿·제휴·기술 문의를 환영합니다.',
        },
        'contact.badge.sm': { en: '⚓ TVC-SM — Vessel Core (PMS + SPARE)', ko: '⚓ TVC-SM — 정비·예비품' },
        'contact.badge.tk': { en: '📐 Maritime Toolkit', ko: '📐 해운 실무 공구함' },
        'contact.badge.global': { en: '🌐 Global community support', ko: '🌐 글로벌 커뮤니티 지원' },
        'contact.about.title': { en: 'Maritime expertise meets practical software', ko: '해운 실무와 실용 소프트웨어' },
        'contact.about.p': {
            en: 'THE VESSEL CODE builds shipboard-ready PMS, spare inventory, and superintendent workflows — for real fleets, not generic office IT.',
            ko: 'THE VESSEL CODE는 사무용 IT가 아닌, 실제 선박·선대 운영을 위한 정비·재고·공무 워크플로를 만듭니다.',
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
    };

    const DOCUMENT_TITLE_KEYS = {
        home: 'home.document.title',
        sm: 'sm.document.title',
        toolkit: 'tk.document.title',
        services: 'services.document.title',
        contact: 'contact.document.title',
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
