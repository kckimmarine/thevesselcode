# IMPA 카탈로그 단계적 확장 체크리스트 (→ ~50,000 URL)

Programmatic SEO용 `/store/:code` 페이지를 **한 번에 5만 URL로 올리지 않고**, 품질·크롤·색인을 보면서 단계적으로 늘리기 위한 운영 체크리스트입니다.

**관련 코드**

| 역할 | 경로 / 명령 |
|------|-------------|
| 카탈로그 병합 | `scripts/merge-impa-chapters.mjs` |
| SEO 인덱스 (서버리스 `/store`) | `scripts/generate-impa-seo-index.mjs` → `api/_data/impa-seo-index.json` |
| 사이트맵 (10,000 URL/파일) | `scripts/generate-sitemap.mjs` |
| 스토어 HTML / JSON-LD | `api/_lib/impaSeo.js` |
| 검증 | `npm run test:seo-sitemap`, `npm run test:store-seo` |
| 일괄 생성 | `npm run generate:impa-seo` (= index + sitemap) |

**GSC 용어**

- **사이트맵 «발견»**: 구글이 URL **목록**을 읽은 것 (검색 노출 ≠ 색인 완료).
- **색인**: `site:thevesselcode.com/store/812101` 등으로 확인.

---

## 1. 단계별 목표 (권장)

| 단계 | SEO 인덱스 코드 수 (약) | 비고 |
|------|-------------------------|------|
| **기준선** | ~5,600 | Phase A 이전 · GSC 사이트맵 성공 확인됨 |
| **Phase A** | **~15,022** | **완료** (2026-09-12) · `sitemap-store-1` + `store-2` |
| **Phase B** | **~24,247** (SM exhaust) / ~30,000 aspirational | GSC 색인·오류율 안정 후 · Space-Marine 전 챕터 스크랩 완료 (2026-09-14) |
| **Phase C** | **30,000+** (Berth) → ~50,000 | Berth Marine `phase-c:berth-ingest` · `sitemap-store-4+` |

각 Phase마다 **한 번의 배포 = 한 번의 사이트맵 증가**로 진행합니다. Phase 사이 **최소 1~2주** 간격을 두고 GSC를 봅니다.

### Phase B 후보 챕터 (~15k → ~30k)

Space-Marine (`scripts/scrape_spacemarine.py`) 기준 **대형·미수집·부분 수집** 우선. Phase A에서 이미 반영된 대형 챕터(예: 63, 73, 75, 61)는 중복 스크랩을 피합니다.

| 우선순위 | Chapter | 주제 (요약) | 비고 |
|----------|---------|-------------|------|
| **High** | **17** | Galley / Cabin | `impa-17.json` 없음 · SM ~689건 |
| **High** | **55** | (SM 카테고리 55) | 인덱스 일부만 존재 · SM ~299건 |
| **High** | **69** | — | SM ~147건 |
| **High** | **19** | — | SM ~88건 |
| **High** | **15** | — | SM ~209건 |
| **High** | **21** | — | SM ~29건 |
| **High** | **67** | — | Phase A에서 **220건만** 수집 · SM ~2,600건 **완료 스크랩** |

**보강·검수 (이미 chapter 파일 있음):** Ch **79** (Paints/Chemicals, ~629), Ch **49** (Hose 등, ~59) — Phase B에서 **재스크랩·gate 검수** 후 인덱스 증분 확인.

**Phase B 권장 워크플로 (챕터당 반복):**

```bash
python3 scripts/scrape_spacemarine.py --category 17
node scripts/merge-impa-chapters.mjs
npm run generate:impa-seo
npm run inspect:impa-chapters -- 17 79 49
npm run test:seo-sitemap
npm run build
```

대량 배치: `node scripts/phase-a-scrape.mjs --target=30000 --chapters=17,55,69,19,15,21,67,...` (목표 count·챕터 목록 조정).

**Phase C (Berth Marine) 워크플로:**

```bash
npm run phase-c:berth-discover
npm run phase-c:berth-ingest          # sitemap codes → scrape batches → merge + SEO
node scripts/phase-c-berth-ingest.mjs --merge-only
```

- 스크래퍼: `scripts/scrape-berthmarine.mjs` (WebP 800px / q80 → `public/data/plates/berth-*.webp`)
- 병합: `scripts/merge-impa-chapters.mjs` (SM baseline + Berth upsert/enrich)
- **Plate backfill (sitemap bulk, ~9.8k missing):** polite batch + tmux

```bash
npm run phase-c:berth-plates              # full queue
node scripts/batch-berth-plates.mjs --limit 20   # smoke test
./scripts/run-plate-backfill-tmux.sh      # session tvc-plate-backfill
tail -f .data/berth-plates-backfill.log
```

State under `.data/berth-plates-{progress,failed,backfill.log}` (git-ignored). Skips existing `public/data/plates/berth-*.webp`.

**Toolkit:** Phase B 배포 시 `js/services/storeManager.js`의 `CATALOG_SOURCE_VERSION`와 `toolkit.html`의 `storeManager.js?v=`를 함께 bump (Phase A: `20260912-phase-a-15022`).

---

## 2. 품질 게이트 (SEO 인덱스에 넣을 코드)

`generate-impa-seo-index.mjs`는 `impa-full.json`의 항목을 compact map으로 옮깁니다. **아래를 만족하는 행만** chapters/카탈로그에 포함하고, 불확실한 대량 raw dump는 Phase를 나눠 넣습니다.

| # | 조건 | 이유 |
|---|------|------|
| 1 | **IMPA 코드** 4~6자리 숫자, 정규화 후 유일 | 중복·잘못된 코드는 thin/duplicate URL |
| 2 | **`name` (설명)** 비어 있지 않음 | title / H1 / Product `name` |
| 3 | **`specs` 또는 unit/category** 중 최소 1개 이상 유의미 | 메타 description·표 스펙 |
| 4 | **플레이트** `plate_id` 또는 `PL-{chapter}-{segment}.webp` 실파일 존재 (가능하면) | `og:image` · Image Search; 없으면 Phase 후반으로 미루거나 fallback 명시 |
| 5 | **스팸·자동 생성 문구** 없음 (동일 description 대량 복제 등) | 대량 색인 저품질 신호 |

**선별 워크플로 (로컬)**

```bash
npm run generate:impa-seo   # merge는 test 스크립트가 호출함
node -e "const i=require('./api/_data/impa-seo-index.json'); console.log('count', i.count);"
```

Phase마다 **이전 count 대비 증가분**과 **샘플 20코드**를 스프레드시트에 기록해 두면 롤백·감사에 유리합니다.

---

## 3. 배포 전 체크리스트 (매 Phase 공통)

### 3.1 데이터

- [ ] 신규 IMPA 소스를 `public/data/chapters/*.json` 또는 정책에 맞는 경로에 반영
- [ ] `node scripts/merge-impa-chapters.mjs` 성공
- [ ] `public/data/impa-full.json` 항목 수가 **이번 Phase 목표**와 일치 (또는 그 이하)
- [ ] 품질 게이트 샘플 검수 (무작위 50코드 + 신규 청크 전체 스팟 체크)

### 3.2 SEO 아티팩트

- [ ] `npm run generate:impa-seo` (또는 `generate-impa-seo-index` + `generate-sitemap` 각각)
- [ ] `api/_data/impa-seo-index.json` **`count`** 확인
- [ ] `public/sitemap.xml` 인덱스에 **`sitemap-store-N.xml`** 개수 확인 (10,000 URL당 +1 파일)
- [ ] `public/robots.txt`에 **새 `sitemap-store-*.xml`** `Allow` + `Sitemap` 줄 자동 반영 확인 (`generate-sitemap.mjs`)

### 3.3 빌드·테스트

- [ ] `npm run test:seo-sitemap`
- [ ] `npm run test:store-seo`
- [ ] `npm run build` (0 error)
- [ ] 스테이징 또는 로컬에서 샘플 URL 3~5개:
  - `/store/812101` (기존)
  - 신규 청크에서 **무작위 2코드**
  - 플레이트 없는 경계 케이스 1코드 (있다면)

### 3.4 스토어 페이지 수동 확인 (샘플)

- [ ] `<title>` · canonical · `og:image`
- [ ] JSON-LD **Product 1건** + `offers` (GSC 리치 결과 **실시간 테스트**)
- [ ] 404 없음 (`/store/999999`는 404 유지)

### 3.5 Git / 배포

- [ ] `impa-seo-index` + sitemap + (필요 시) `impa-full` 커밋
- [ ] PR → `master` 머지 → Vercel 프로덕션 배포 완료 대기 (~1–2분)

---

## 4. 배포 후 GSC 체크리스트

### 4.1 사이트맵

- [ ] **Sitemaps** → `/sitemap.xml` · `/sitemap-store-*.xml` **성공**, «발견된 페이지» 수가 Phase 목표에 근접
- [ ] 새 `sitemap-store-2.xml` 등이 생긴 Phase면 GSC에 **파일 URL 직접 제출** (선택, 인덱스에 이미 있으면 생략 가능)

### 4.2 URL 검사 (대표 샘플)

- [ ] **실시간 테스트** → 제품 스니펫 / 판매자 목록 **유효** (심각 오류 0)
- [ ] **GOOGLE 색인** → «색인 생성 요청» (신규 대표 URL 5~10개, 전체 5만 푸시 불필요)

### 4.3 모니터링 (Phase 후 1~2주)

- [ ] **색인 생성 → 페이지** — `/store/` URL 증가 추세
- [ ] **색인 생성 → Sitemaps** — «색인생성됨» vs «발견됨» 비율
- [ ] **경험 → Google 검색 결과** — 노출·클릭 (홈은 별도; 스토어 URL은 코드 검색으로 유입)
- [ ] **개선사항 → 제품 스니펫** — invalid 항목 급증 없음

**검색 노출 확인**

```text
site:thevesselcode.com/store/
site:thevesselcode.com/store/812101
```

---

## 5. 인프라·한도 참고

| 항목 | 참고 |
|------|------|
| 사이트맵 청크 | `URLS_PER_SITEMAP = 10_000` (`scripts/generate-sitemap.mjs`) |
| 50k URL | `sitemap-store-1` … `sitemap-store-5` + `sitemap-core.xml` |
| Indexing API | `npm run push:indexing` — **일일 한도** 있음; 전량 5만 건 일괄 푸시 비권장 |
| `STORE_SEO_ORIGIN` | 프로덕션 canonical은 `https://www.thevesselcode.com` (Vercel env) |

---

## 6. 롤백

1. Git에서 **이전 Phase 커밋**의 `impa-seo-index.json` + `sitemap-*.xml` 복원  
2. `npm run generate:impa-seo` 재실행 후 `count` 확인  
3. `npm run build` → 배포  
4. GSC 사이트맵 재읽기 (발견 수 감소는 며칠 지연 가능)  
5. 이미 색인된 URL은 **즉시 사라지지 않음** — `noindex`는 사용하지 않는 전제 (카탈로그 유지)

---

## 7. 하지 말 것

- [ ] **품질 게이트 없이** 하룻밤에 5만 코드 SEO 인덱스에 일괄 반영  
- [ ] JSON-LD에 **가짜 `review` / `aggregateRating`**  
- [ ] 동일 description·스펙 **대량 복제** 페이지  
- [ ] 사이트맵만 늘리고 **내부 링크**(홈·툴킷 Popular IMPA 등) 갱신 없음  
- [ ] GSC «발견»을 **검색 1페이지**와 동일시

---

## 8. Phase 완료 기록 (템플릿)

각 Phase 종료 시 아래를 PR 설명 또는 내부 로그에 남깁니다.

```markdown
### IMPA SEO Phase __ (YYYY-MM-DD)
- SEO index count: ______ (이전: ______)
- Sitemap files: sitemap-store-1 … store-__
- Deploy: commit ______ / PR #__
- Toolkit catalog: CATALOG_SOURCE_VERSION ______
- GSC discovered: ______
- Sample indexed (manual): store/______, store/______
- Issues: none / …
- Next phase earliest date: ______
```

### IMPA SEO Phase A (2026-09-12) — 완료 기록

- SEO index count: **15,022** (이전: **~5,605**)
- Sitemap files: `sitemap-core.xml`, `sitemap-store-1` (10,000), `sitemap-store-2` (5,022)
- Deploy: commit **`73f42b4`** / PR **#113**
- Toolkit catalog: **`20260912-phase-a-15022`** (`storeManager.js` + `toolkit.html` cache-bust; PR **#114**)
- GSC discovered: _(운영 확인 — 목표 ~15,022 store URL)_
- Sample indexed (manual): `store/211141`, `store/230157`, `store/610645`, `store/812101`
- Issues: none (30-code audit + `test:seo-sitemap` / `test:store-seo` / `build` pass)
- Next phase earliest date: **2026-09-26** (2주 관찰; 최소 1주면 **2026-09-19**)

### IMPA SEO Phase B (2026-09-14) — 완료 기록

- SEO index count: **24,247** (이전: **15,022**)
- Sitemap files: `sitemap-core.xml`, `sitemap-store-1` (10,000), `sitemap-store-2` (10,000), `sitemap-store-3` (4,247)
- Deploy: PR Phase B / `scripts/phase-b-scrape.mjs`
- Toolkit catalog: **`20260914-phase-b-24247`**
- Note: Space-Marine 공개 카탈로그 **전 챕터(33개) 스크랩·품질 게이트 후 ~24.2k** — 3만 목표는 **Berth/추가 소스(Phase C)** 필요
- Sample indexed (manual): `store/170101`, `store/673303`, `store/991000`
- Issues: none (`test:seo-sitemap`, `test:store-seo`, `build` pass)
- Next phase earliest date: **2026-09-28**

### IMPA SEO Phase C prep (2026-09-14) — Berth Marine ingest

- SEO index count: **34,092** (SM baseline **24,247** + Berth **+9,845** new, **18** enriched)
- Sitemap chunks: `sitemap-store-1` … `store-4` (10k + 10k + 10k + 4,092)
- Pipeline: `fetch-berth-sitemaps` → `berth-sitemap-to-import` → `merge-impa-chapters` (upsert)
- Toolkit: **`20260914-phase-c-34092`**
- Follow-up: run `berth-sitemap-to-import` **without** `--skip-plates` to backfill WebP plates (rate-limit aware)

### IMPA SEO Phase C gap (2026-09-14) — sitemap 16–20 + missing codes

- Discover: `node scripts/discover-berth-sitemap-codes.mjs` (caches `public/data/berth/sitemaps/product-sitemap*.xml`, ~19.9k Berth URLs)
- Gap vs `impa-full.json`: codes in sitemap discovery **not** yet in catalog (~2.9k; Yoast `image:title` often empty → **product scrape required**)
- Ingest: `node scripts/ingest-missing-berth-codes.mjs --scrape --batch=100 --delay=1100 --merge`
  - Quality: `scripts/lib/impa-quality-gate.mjs` + reject generic `Marine stores item {code}` on **new** gap rows
  - Output: `public/data/berth/imports/berth-gap-ingest.json` + per-batch `codes-batch-*.json`
- Sitemap chunk **5** auto when SEO index **> 40,000** (`generate-sitemap.mjs` + `test-seo-sitemap.mjs`)

---

## 9. 홈·브랜드 검색과의 관계

- **5만 `/store/` URL**은 주로 **IMPA 코드·부품명 긴 꼬리** 유입용입니다.  
- **관련 검색어 1페이지 홈**은 도메인 권위·백링크·서비스 콘텐츠·체류 시간이 필요하며, 사이트맵 확장과 **별도 트랙**으로 `Services`, `SM`, `toolkit`, `contact-us`를 유지·강화합니다.

---

*마지막 정리: 2026-09-13 · THE VESSEL CODE programmatic SEO 운영*
