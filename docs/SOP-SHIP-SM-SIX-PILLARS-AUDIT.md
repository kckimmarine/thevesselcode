# TVC-SM ↔ Vessel Mode — 6대 핵심 SOP 코드·테스트 검증 (Cursor Audit)

**기준일:** 2026-09-14  
**범위:** 주신 6가지 항목(통신 계층, 레포트·송수신, 파일 안정성, 파일럿 E2E, 멀티테넌트, 5대 킬포인트)과 **현재 `master` 코드베이스**의 정합성  
**자동 증거:** `npm run verify-rbac` · `npm run verify-sync-vessel` · `npm run test:e2e` (11 passed, 1 skipped) · `docs/workflow-manual-v1.md`

---

## TVC-SM Global Fleet OS — 5 Core Pillars (paradigm shift)

TVC-SM supersedes the early engine-centric prototype as a **unified Ship Management OS** (Vessel PWA/Electron + Shore SM HQ). Architecture aligns with **ClassNK 2023 Rules Annex 9.1.3** (PMS software approval) and common fleet-management patterns (decentralized vessel edge + HQ ingest of scoped ZIP deltas — comparable in role to global operators’ ship–office loops, without proprietary coupling).

| Pillar | TVC-SM mechanism | Evidence in repo |
| --- | --- | --- |
| **Scalability** | Per-vessel IndexedDB edge; `company_id` + `vessel_id` isolation; ZIP delta sync; optional cloud mirror ingest | `js/core/schema.js`, `js/services/sync.js`, §5 below |
| **Popularity** | Single product brand **TVC-SM**; **open hub** positioning on `thevesselcode.com` (`home/index.html`) — free Toolkit for all maritime roles, optional fleet SaaS; demo tenant **ABC Shipping / ABC Voyager** | `home/index.html`, `js/marketing-i18n.js`, `js/auth.js`, `AGENTS.md` |
| **Professionalism** | ClassNK measurements (An 1.3.2.1.f), damage/repair fields (An 1.3.2.1.g), revision badge (An 1.4.1) | `js/ui/pms.js` `TVC_PmsClassNk`, `js/ui/defectReport.js`, `TVC_PRODUCT_INFO` |
| **Flexibility** | Universal 2-tier machinery taxonomy (DECK/ENGINE common + vessel-profile extensions) | `data/equipment-taxonomy.json`, `js/services/machineryTaxonomy.js` |
| **Consistency** | One workflow lifecycle (Reported → Confirmed → Approved); RBAC parity; mobile ergonomics isolated to ≤768px | `verify-rbac` 31/31, `css/responsive.css`, pilot E2E A–E |

**Software revision (An 1.4.1):** `TVC-SM v2.5 (ClassNK Annex 9.1.3 Compliant)` — `#appProductVersionBadge` in app shell.

**Pilot E2E (ClassNK + mobile):** Step A expands dimensional measurements, asserts **EXCEEDED** when measured &gt; limit, persists `report_form.dimensional_measurements`, re-validates in SHIP_TO_SM ZIP (Step C).

---

## 1. 모드 간 온/오프라인 통신 계층

| SOP 계층 | 코드 반영 | 검증 |
| --- | --- | --- |
| Deck/Engine 오프라인 보루 (IndexedDB PWA) | `js/core/db.js`, `service-worker.js`, `js/pwa.js` | **Pass** — 핵심 플로우는 외부 API 없이 브라우저·IDB만 사용 (`AGENTS.md` Hard constraint #1) |
| Captain Hub 게이트웨이 | `js/space.js` (`TVC_Space`, `isCaptainHub`, Export/Import RBAC) | **Pass** — Captain만 스테이션 간 통합 Export/Import (`verify-rbac`: Officer/Engineer Export 불가) |
| 부서별 ZIP 델타 | `js/services/sync.js` (`collectDelta`, dept-scoped export) | **Pass** — DECK/ENGINE export 파일명·델타 분리 (`verify-sync-vessel`, `verify-rbac` 2단계) |
| Captain ↔ SM 하이브리드 (온라인) | `js/services/cloudMirror.js`, `api/_lib/syncCloudQuery.js`, `TVC_OnlineSync` | **Partial** — Supabase/API 미러·ingest 경로 존재. **선박 일반 운영은 ZIP-only**가 기본 (`AGENTS.md`) |
| 해상 메일 ZIP | `TVC_Sync.exportZip` / `importZip`, `TVC_DefectSync.exportUrgentBatchZip` | **Pass** — UTF-8 JSON in ZIP, `compression: 'DEFLATE'` |

**리스크 메모:** “선내 REST API” 동기화는 Electron/파일럿 문서(`docs/electron-pilot.md`) 수준의 옵션이며, **표준 ship path는 ZIP + (선택) 클라우드 미러**로 이해하는 것이 코드와 일치합니다.

---

## 2. 레포트 종류 및 송수신

| SOP 레포트 | 구현 스토어/모듈 | 송수신 | SOP 대비 |
| --- | --- | --- | --- |
| Work Report (Routine) | `daily_work_reports`, `js/app.js` | 월말/정기 `TVC_Sync` 패키지 | **Pass** |
| Defect / Trouble | `defect_cases`, `js/ui/defectReport.js`, `js/services/defectSync.js` | **Urgent ZIP** (`exportUrgentBatchZip`) | **Pass** |
| Repair Request (RR) | `requisitions`, `js/ui/spareMenu.js` | requisition ZIP (`workflow-manual-v1.md`) | **Pass** (Vendor RFQ는 SM/Supplier 로드맵과 연계) |
| Spare Requisition | 동일 | JSON in ZIP | **Pass** |
| Monthly Running Hours | `TVC_Sync` `package_type: 'MONTHLY'` | 전용 패키지 | **Pass** |
| Company Instruction | HQ reply ZIP (`exportHqReplyZip` / `defectSync`) | `HQ_to_Ship` 개념과 동일 방향 | **Pass** |

**결재선 (Reported → Confirmed → Approved):** `js/services/transaction.js`, `js/rbac.js`, `docs/workflow-manual-v1.md`. SM 승인 전 `CONFIRMED` 미만은 육상 “공식 완료”로 취급하지 않는 정책은 **코드·문서 일치 (Pass)**.

---

## 3. 레포트·파일 송수신 안정성

| SOP 요구 | 상태 | 근거 |
| --- | --- | --- |
| 이미지 1200px / JPEG 0.7 (~200KB) | **Pass (2026-09-14 보완)** | AI Help: `js/app.js` `compressImageFile`. **Defect 첨부:** `TVC_Attachments.prepareUploadFile` + `defectReport.readDfAttachmentFile` |
| Work Report ↔ SPARE 원자 차감 | **Pass** | `TVC_SpareMenu.applyConsumeLogStock`, `stock_applied_at`, `TVC_Transaction.confirmReport` 멱등 (`AGENTS.md`) |
| UTF-8 JSON 단일 ZIP | **Pass** | `js/services/sync.js` `buildExportZipBlob` |

---

## 4. 파일럿 선박 테스트 (Playwright 4 시나리오)

| 시나리오 | SOP | 자동화 (2026-09-14) |
| --- | --- | --- |
| A 선내 Engine 정비 + Spare **2** + `stock_applied_at` | 저장 즉시 재고 −2 | **`e2e/pilot-sop-scenarios.spec.js`** Step A |
| B CE Confirm + Captain Engine Confirm 거부 | CONFIRMED + RBAC | 동일 스펙 Step B |
| C Captain **SHIP_TO_SM** ZIP + JSON 무결성 | Export 검증 | 동일 스펙 Step C (`jszip` + report/spare diff) |
| D SM Import → **APPROVED** + SM **SM_TO_SHIP** feedback ZIP | 최종 락 + 역방향 패킷 | 동일 스펙 Step D |
| E Captain **SM_TO_SHIP** Import → Engineer UI lock | 내륙 루프 완결 | 동일 스펙 Step E (Captain ingest, Engineer Modify/spare disabled) |

```bash
npx playwright test e2e/pilot-sop-scenarios.spec.js
npm run test:e2e
```

**Node roundtrip:** `npm run test-xfer-status-roundtrip` — **52 passed, 0 failed** (`POSTPONE_REPLY_SM_TO_SHIP`, Captain hub `Submitted` postpone export 소스 검증).

**회귀:** `pilot-sop-scenarios` **1 passed** (~15s). Step A는 Page 2 **All Groups → scroll → checkbox → qty → Save** (UI only). 데모 호선 `alignDemoVesselScope` → **`ABC Voyager`**.

---

## 5. 신규 선사·선박 확장성

| SOP | IndexedDB (선박) | 클라우드 (SM) |
| --- | --- | --- |
| `company_id` + `vessel_id` 격리 | 스키마 인덱스 `by_vessel`, `by_company` (`js/core/schema.js`) | `api/_lib/syncCloudQuery.js` — HQ 쿼리 시 `company_id` 필수, `.eq('company_id', …)` |
| 선박별 BOM/Spare 오버라이드 | `job_bom`, `universal_catalog`, per-vessel `spare_parts` | ingest payload에 vessel scope |
| Admin 프로비저닝 (코드 재빌드 없음) | Admin registry / license (`js/auth.js` demo, `electron/license`) | Admin API + Supabase 테이블 (배포 env) |

**판정:** 선박 edge 부하는 **로컬 IDB로 분산 (Pass)**. 50~100척 SM 트래픽은 **차분 ZIP + 페이지 ingest(200/page)** 설계로 타당. **DB PK가 (company_id, vessel_id) 복합 PK인 것은 Supabase DDL 문맥** — 앱 IDB는 `id` + 인덱스 패턴 (Partial: 용어 정합만 주의).

---

## 6. 제미나이 5대 킬포인트 — Cursor 재검증

| # | 주장 | Cursor 판정 | 증거 |
| --- | --- | --- | --- |
| 1 | 오프라인 내구성 | **Pass** | SW + IDB, `npm start` / E2E on static serve |
| 2 | 권한 위계 | **Pass** | `verify-rbac` 31/31, Captain은 부서 Confirm 불가 |
| 3 | 재고 중복 차감 방지 | **Pass** | `stock_applied_at` + consume log diff |
| 4 | 모바일 / 데스크톱 격리 | **Pass (UX 이슈 별도)** | `e2e/mobile-ui.spec.js`, `css/app.css` `@media (max-width: 768px)` — `TEST_REPORT.md` P1 drawer/logout 등 **미해결 UX** |
| 5 | 확장 시 성능 | **Pass (아키텍처)** | Edge IDB + ZIP delta; 클라우드는 scoped query |

---

## 실행 체크리스트 (파일럿 전)

```bash
npm run verify-rbac && npm run verify-sync-vessel
npm run test:e2e
npm run test-xfer-status-roundtrip   # HQ export 권한 실패 시 로그 확인
npm run verify-all                   # license 빌드 artifact 필요 시 dist/license 선행
```

---

## Mobile ergonomics (≤768px, 2026-09-14)

| Guard | Implementation |
| --- | --- |
| Tap delay | `touch-action: manipulation` on body + interactive controls — `css/responsive.css` only inside `@media (max-width: 768px)` |
| Touch targets | `#btn-save`, `.btn-primary`, `.btn-action`, dept/mobile header toggles — `min-height/min-width: 48px`, flex-centered |
| Numeric keypad | `inputmode="numeric"` on Work Report / measurement `type="number"` fields |
| E2E geometry | `e2e/pilot-sop-scenarios.spec.js` @ 390×844 — `#btn-save` and `.btn-primary` `boundingBox.height >= 44` |
| E2E ClassNK | Same spec Step A — fill measurement row, **EXCEEDED** badge, `inputmode="numeric"`, IDB + ZIP roundtrip |
| Desktop | **No** changes above 768px (isolated stylesheet) |

---

## ClassNK Annex 9.1.3 compliance (2026-09-14)

| Rule | Implementation |
| --- | --- |
| An 1.3.2.1.f Measurements | Work Report `dimensional_measurements[]` (`item_name`, `design_val`, `tolerance_limit`, `measured_val`, `unit`) — UI `TVC_PmsClassNk` in `js/ui/pms.js`; **EXCEEDED** when measured &gt; limit |
| An 1.3.2.1.g Damage / repair | Defect Report fields `damage_condition`, `repair_method` in `js/ui/defectReport.js` |
| An 1.4.1 Software revision | `TVC_PRODUCT_INFO.VERSION_BADGE` — header `#appProductVersionBadge` + Menu PMS card |
| Product brand | **TVC-SM** (unified Vessel + SM HQ) — `index.html` shell, `document.title` |

---

## Universal machinery taxonomy (2026-09-14)

| Layer | Path | Notes |
| --- | --- | --- |
| Reference dataset | `data/equipment-taxonomy.json` | DECK/ENGINE **common** + per-profile extensions (bulker, container, tanker_chemical, gas) |
| Schema contract | `js/core/schema.js` → `TVC_EQUIPMENT_TAXONOMY`, `TVC_META_KEYS.VESSEL_MACHINERY_PROFILE` | No chemical-tanker-only hardcoding in schema stores |
| Runtime loader | `js/services/machineryTaxonomy.js` | Profile resolve · optional empty-vessel `maintenance_groups` seed |
| Work Plan UI | `js/ui/pms.js` (`TVC_PmsEquipmentTree`) + `js/ui/virtualList.js` | Taxonomy rail beside PMS GROUP Tree (`#actTaxonomyRail`) |
| Admin preset | `admin/registry.json` → `machinery_profile_presets`, per-vessel `machinery_profile` | Demo: **ABC Voyager** (`bulker`), **TVC Pioneer** (`tanker_chemical`) |
| Dept parity | `operational_parity` in JSON | C/O + C/E workflows unchanged; Captain hub / `verify-rbac` 31/31 |

---

## 코드베이스 정화 (legacy pilot identifiers)

| 항목 | 조치 |
| --- | --- |
| 구 domestic prototype 명칭 | 전역 제거 — 데모는 **ABC Shipping** / `ABC_SHIPPING`, 호선 **ABC Voyager** (IMO **9876543**) |
| IndexedDB 일회성 마이그레이션 | `js/services/legacyMigrationIds.js` + `TVC_DataPurge.migratePrototypePilotMasterOnce` (저장소에 남은 구 `vessel_id`만 char-code 키로 매칭) |
| 배포 SQL | `deploy/supabase-migrate-legacy-pilot-to-tvc.sql`, `deploy/supabase-sync-pilot-abc-voyager.sql` |
| 검증 | Legacy pilot label grep (removed domestic names) → **0건**; `npm run verify-rbac` · `npm run test-xfer-status-roundtrip` · `npx playwright test e2e/pilot-sop-scenarios.spec.js` |

**Dead-code audit (2026-09-14):** `scripts/codemod-hq-to-sm*.mjs`, `demo-rbac.js`, one-off migrate scripts는 `package.json` / `index.html` 미참조 — **유지** (운영·SEO·IMPA 도구와 분리된 CLI). 핵심 런타임은 `js/core/`, `js/ui/`, `js/services/`, `e2e/`만 ship path.

---

## 변경 이력

- **2026-09-14:** Defect 첨부 이미지 압축 SOP 정합 (`TVC_Attachments.prepareUploadFile`). 본 문서 최초 작성.
- **2026-09-14:** `e2e/pilot-sop-scenarios.spec.js` — SOP A–E 전 구간 E2E. `test-xfer-status-roundtrip` SM 역할/direction 수정.
- **2026-09-14:** Legacy pilot 문자열 정화 · `legacyMigrationIds` · deploy SQL rename · IMO 9876543.
- **2026-09-14:** Paradigm shift doc — 5 Core Pillars table; pilot E2E ClassNK measurement + EXCEEDED assertions.
- **2026-09-14:** Marketing home repositioned — Open Digital Commons hero, 4-pillar community grid, 상생 ethos banner (`home/index.html`).
- **2026-09-14:** Marketing KO/EN integrity — `js/marketing-i18n.js` field terminology, `tvc-mkt-lang` persistence, `/sm` Korean leakage removed, contact form alerts localized.
