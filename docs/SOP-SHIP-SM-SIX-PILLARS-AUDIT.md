# TVC-SM ↔ Vessel Mode — 6대 핵심 SOP 코드·테스트 검증 (Cursor Audit)

**기준일:** 2026-09-14  
**범위:** 주신 6가지 항목(통신 계층, 레포트·송수신, 파일 안정성, 파일럿 E2E, 멀티테넌트, 5대 킬포인트)과 **현재 `master` 코드베이스**의 정합성  
**자동 증거:** `npm run verify-rbac` · `npm run verify-sync-vessel` · `npm run test:e2e` (11 passed, 1 skipped) · `docs/workflow-manual-v1.md`

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
| D SM Import → **APPROVED** + 선박 편집 락 | 최종 락 | 동일 스펙 Step D (`abc shipping`) |

```bash
npx playwright test e2e/pilot-sop-scenarios.spec.js
npm run test:e2e
```

**Node roundtrip:** `npm run test-xfer-status-roundtrip` — Monthly 체인은 `SM_SUPERINTENDENT` + `SHIP_TO_SM` / `SM_TO_SHIP` (legacy `HQ_SUPERVISOR` + `HQ_TO_SHIP`는 `EXPORT_SHIP_SYNC` 거부가 **정상**). Postpone HQ Reply ZIP 2건·소스 문자열 1건은 별도 추적.

**회귀:** `pilot-sop-scenarios` **1 passed** (~21s). 데모 호선 `alignDemoVesselScope` → **`ABC Voyager`** (SM fleet vs IDB meta 일치).

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

## 변경 이력

- **2026-09-14:** Defect 첨부 이미지 압축 SOP 정합 (`TVC_Attachments.prepareUploadFile`). 본 문서 최초 작성.
- **2026-09-14:** `e2e/pilot-sop-scenarios.spec.js` — SOP A–D 전 구간 E2E. `test-xfer-status-roundtrip` SM 역할/direction 수정.
