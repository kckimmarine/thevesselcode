# THE VESSEL CODE — 모두의 창업 2차 & 상용 출시 마스터 플랜

**출시 목표일:** 2026-09-17 (지원서 최종 제출)  
**공고:** [모두의 창업](https://www.modoo.or.kr) · 일반/기술 분야(Tech Track) 권장  
**한 줄:** 오프라인 선박 코어 + 온라인 SM·Supplier + 무료 Maritime Toolkit PLG

---

## 1. 제품 아키텍처 (심사·영상·웹 공통 스토리)

| 모드 | 사용자 | 연결성 | 핵심 역할 |
|------|--------|--------|-----------|
| **SM Mode** | 선주·선박관리사·공무감독 (`abc shipping`, `hq`) | **온라인** (웹/클라우드 HQ) | 다선박 관제, 승인, RFQ→Supplier, fleet ZIP Import |
| **Vessel · Captain Hub** | 선장 (`captain`) | **온라인 + 오프라인** | 기관·갑판 ZIP 취합, SM 송수신, VSAT 시 온라인 동기화 옵션 |
| **Vessel · Deck / Engine** | C/O, C/E (`officer`/`co`, `engineer`/`ce`) | **오프라인 완결** | PMS·SPARE·Defect·Permit, 선내 IndexedDB, ZIP Export |
| **Supplier Mode** | 부품사·수리 협력사 | **온라인** | RFQ Inbox, 견적, Delivery/Repair, Invoice |

**선박 일반 운항:** 상시 클라우드 API **필수 아님** — Deck/Engine은 ZIP 기반; Captain은 Hub·SM 연계; SM/Supplier는 웹.

**코드 근거:** `js/space.js`, `AGENTS.md`, `docs/workflow-manual-v1.md`

---

## 2. 공개 채널 출시 범위 (thevesselcode.com)

| URL | 상태 | 9/17 전 Done 기준 |
|-----|------|-------------------|
| `/` | 홈 | 한·영 히어로, 3모드·3이해관계자, TVC-SM·Toolkit CTA |
| `/sm` | TVC-SM | 3모드 표, ZIP 다이어그램, 비교표, 앱·데모 CTA |
| `/toolkit` | Maritime Toolkit | 15,000+ IMPA 통일, PLG→SM CTA, 모바일 UX |
| `/contact-us` | 문의 | 데모·파일럿 문의 동작 |
| `app.thevesselcode.com` | 앱 | SM·Supplier·Vessel 로그인 경로 안내 (마케팅 링크) |

**배포:** `master` merge → Vercel/Bluehost 기존 파이프라인 (`npm run build`)

---

## 3. 모두의 창업 2차 제출 체크리스트

### 지원서 (modoo.or.kr)

- [ ] 분야: **일반/기술** (글로벌 SaaS·PLG)
- [ ] Q1~Q4, Q7-1, Q8, Q9, Q11 — Gemini 최종안 + IMPA **15,000+** 수치 통일
- [ ] Q5 **유튜브 일부공개** — `docs/EXPORT-q5-hybrid-conti-for-gemini.md` (콘티) 준수
- [ ] 사진 3장 — 콘티 「사진 첨부 가이드」
- [ ] 멘토 기관 선택
- [ ] 제출 전 **미리보기** (제출 후 수정 불가 → 회수 후 재제출만 가능)

### 영상 (창업자 PC 제작)

- [ ] 90초: 애니 60초 + 실화면 30초
- [ ] 실화면: `engineer` / Engine / Menu → **Data Export & Import**
- [ ] 유튜브 Unlisted URL → Q5

---

## 4. 이해관계자 내러티브 (선주 · 공무 · 조선소)

| 이해관계자 | Pain | TVC-SM 가치 |
|------------|------|-------------|
| **선주** | Off-hire, 중복 발주, 감사 추적성 | 월 구독 SaaS, 재고·정비 일원화, ZIP으로 데이터 주권 |
| **공무감독** | 다선박 엑셀 취합, RFQ 지연 | SM Mode 온라인 관제, lifecycle 승인, Supplier 연계 |
| **조선소·수리·부품사** | 견적 단절, 사양 오발주 | Toolkit IMPA + Supplier Mode RFQ·견적 파이프라인 |

---

## 5. 미결 항목 — 우선순위 (9/17 전)

### P0 — 출시·심사 동시

| # | 항목 | 담당 | 상태 |
|---|------|------|------|
| 1 | `/sm` 마케팅 3모드 섹션 | Cursor | 진행 |
| 2 | `/` 홈 출시 메시지·3이해관계자 | Cursor | 진행 |
| 3 | `/toolkit` PLG·15k 메타 통일 | Cursor | 진행 |
| 4 | Q5 유튜브 업로드 | 창업자 | 대기 |
| 5 | 지원서 최종 제출 | 창업자+Gemini | 대기 |
| 6 | PR #118 등 마케팅 → `master` merge | 창업자 | 대기 |

### P1 — 실현 가능성 (제품)

| # | 항목 | 메모 |
|---|------|------|
| 7 | Deck SPARE 빈 목록 (E2E P2) | `TEST_REPORT.md` |
| 8 | 모바일 390px PMS/드로어 | 심사 데모는 **데스크톱 녹화** 우선 |
| 9 | RFQ SM→Supplier E2E | 마케팅은 「로드맵/단계적」 표현 유지 |

### P2 — 출시 후

| # | 항목 |
|---|------|
| 10 | 한국어 앱 UI 전면화 (선택) |
| 11 | Installer 다운로드 페이지 정리 (`/downloads`) |
| 12 | 2라운드 MVP 자금 계획 (최대 2천만) |

---

## 6. 검증 명령

```bash
npm start                    # http://localhost:3000
node scripts/test-home-landing.mjs
npm run test:e2e             # 선택, 시간 허용 시
npm run build                # 배포 전
```

---

## 7. 관련 EXPORT

| 파일 | 용도 |
|------|------|
| `docs/EXPORT-moduri-changup-2nd-review-for-gemini.md` | 지원서 문안 (브랜치 `cursor/moduri-changup-export-d523`) |
| `docs/EXPORT-q5-hybrid-conti-for-gemini.md` | 90초 영상 콘티 |

---

*Last updated: 2026-09-14 — Cursor launch sprint*
