# Vercel → Cloudflare Pages / Netlify 이전 가이드

Vercel Hobby **fair use 초과**로 `DEPLOYMENT_DISABLED`(402)가 난 경우, GitHub 연동만으로 **5~15분 내** 대체 호스팅에 올릴 수 있습니다.  
이 저장소는 **동일 빌드**(`npm run build` → `dist/`)와 **기존 `api/` 핸들러**를 Netlify·Cloudflare에서 재사용합니다.

---

## 공통 준비

1. **Vercel Environment Variables** 목록을 복사해 새 플랫폼 Production env에 붙여넣기  
   (예: `SUPABASE_*`, `STRIPE_*`, `RESEND_API_KEY`, `GEMINI_API_KEY`, `STORE_SEO_ORIGIN=https://www.thevesselcode.com` 등)  
   참고: `deploy/SETUP-ONLINE-SYNC.ps1` Step 4
2. 빌드 설정 (Vercel과 동일):

   | 항목 | 값 |
   |------|-----|
   | Install | `npm install` |
   | Build | `npm run build` |
   | Output | `dist` |

3. DNS는 **Vercel CNAME을 끊고** 새 호스팅이 안내하는 CNAME으로 변경합니다.

---

## 방법 A — Cloudflare Pages (권장)

**장점:** 정적 트래픽·대역폭 한도가 넉넉함.  
**Functions:** 저장소 루트 `functions/` (Node `nodejs_compat`, `wrangler.toml` 참고)

### 절차

1. [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create application**
2. **중요:** 기본 UI가 **Worker**(`Deploy command` 필수, `npx wrangler deploy`)이면 **thevesselcode에 맞지 않습니다.**  
   저장소 선택 화면 **맨 위** 링크 **「Need to use the legacy Pages workflow? Continue to Pages」** 를 클릭 → **Pages(legacy)** 로 진행하세요.
3. **Connect to Git** → GitHub **`kckimmarine/thevesselcode`** 선택
4. Build settings:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Environment variable:** `CF_PAGES=1` (Production) — `dist/_redirects`를 Cloudflare용으로 생성
5. **Settings → Environment variables:** Vercel에서 쓰던 Production 변수 전부 추가
6. **Custom domains:** `thevesselcode.com`, `www.thevesselcode.com`, `app.thevesselcode.com`
7. DNS (도메인이 Cloudflare에 있으면 자동 제안됨):
   - `@` / `www` → Pages 프로젝트
   - `app` → 동일 Pages 프로젝트 (서브도메인)

### Worker UI에 갇혔을 때 (Deploy command Required)

**Back** → 저장소 목록 **위** **Continue to Pages (legacy)** 를 못 찾으면 Worker Git Builds를 씁니다.

| 필드 | 값 |
|------|-----|
| Build command | `CF_PAGES=1 npm run build` |
| Deploy command | **`npx wrangler@3 deploy`** (또는 `npm run deploy:cf-worker`) |

`wrangler pages deploy` 는 **Pages 프로젝트**용입니다. Worker Builds로 만든 `thevesselcode` 에서는 **Deploying 실패**가 납니다.  
저장소 `wrangler.toml` 의 `[assets] directory = "./dist"` + `cloudflare/worker-site-router.js` 가 함께 배포되어야 합니다 (**master에 merge 필요**).

Preview builds 를 켰다면 Preview command 도 **`npx wrangler@3 deploy`** 또는 Preview builds **OFF**.

**Environment variables:** Vercel Production 변수 + `CF_PAGES=1`.  
Worker 정적 배포만으로는 **`/api/*` Pages Functions** 가 없을 수 있습니다 — 문의·결제 API까지 필요하면 **legacy Pages** 로 재연결하세요.

### 라우팅

| 기능 | 파일 |
|------|------|
| `/` 호스트별 홈 (마케팅 vs PMS) | `functions/_middleware.js` |
| `/api/*` | `functions/api/[[path]].js` |
| `/store/:code` (IMPA SEO) | `functions/store/[code].js` |
| 정적 경로·301 | `dist/_redirects` (빌드 시 생성) |

---

## 방법 B — Netlify

**장점:** Node serverless와 Vercel 스타일 `api/` 핸들러를 **한 함수**로 라우팅 (`netlify/functions/tvc-api.js`).  
설정: 저장소 루트 **`netlify.toml`**

### 절차

1. [Netlify](https://app.netlify.com) → **Add new site** → **Import an existing project** → GitHub **`kckimmarine/thevesselcode`**
2. `netlify.toml`이 자동 적용됨 (build/publish/functions)
3. **Site configuration → Environment variables:** Vercel Production 변수 복사
4. **Domain management:** `thevesselcode.com`, `www`, `app` 연결
5. DNS: Netlify가 제공하는 **A/CNAME** 레코드로 변경 (Vercel `cname.vercel-dns.com` 제거)

### API

`netlify.toml`의 redirect:

- `/api/*` → `tvc-api` function  
- `/store/:code` → `tvc-api` function  

로컬 검증: `node scripts/test-hosting-api-router.mjs`

---

## DNS 체크리스트 (Vercel 해제)

| 레코드 | 이전 (Vercel) | 이후 |
|--------|----------------|------|
| `app` CNAME | `cname.vercel-dns.com` | Cloudflare Pages / Netlify 대상 |
| apex `thevesselcode.com` | Vercel A/CNAME | 새 호스팅 안내값 |

전파 후 `curl -sI https://thevesselcode.com | head` 에서 `server: cloudflare` 또는 `netlify` 확인.

---

## Stripe / Webhook URL

Billing webhook이 Vercel URL을 가리키면 이전 후 **Stripe Dashboard**에서 endpoint를 새 origin으로 갱신:

- `https://app.thevesselcode.com/api/billing/webhook` (경로 동일)

---

## 롤백

Vercel Pro 업그레이드 후 unpause 하면 기존 배포로 되돌릴 수 있습니다. DNS만 다시 Vercel로 두면 됩니다.

---

## 관련 파일

- `vercel.json` — 기존 Vercel (참조용)
- `netlify.toml` — Netlify
- `wrangler.toml` + `functions/` — Cloudflare Pages Functions
- `api/_lib/hostingApiRouter.cjs` — 공통 API 라우터
- `scripts/generate-hosting-routes.mjs` — `dist/_redirects`, `_headers`
