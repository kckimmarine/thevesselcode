# Revenue pipeline — GSC + GA4 → money actions

Turn **Search Console**, **GA4**, and **contact leads** into a weekly action list (RFQ, PoC, superintendent calls)—not vanity metrics.

## Flow

```text
Google Search (GSC) ──┐
GA4 (sessions, events) ├──► /api/revenue-pipeline ──► JSON + digestText
GitHub [Contact] issues ┘         │
                                  ├── Weekly cron → email / Slack / Kakao Work
                                  └── npm run revenue:report (local)
```

**Already wired on the site**

- `js/marketing-attribution.js` — UTM + organic Google → contact form
- `js/marketing-analytics.js` — `poc_cta_click`, `lead_form_submit`
- `/api/contact` — stores UTM, landing page, IMPA code; GitHub issue fallback

## Vercel environment variables

| Variable | Purpose |
|----------|---------|
| `GA4_PROPERTY_ID` | Numeric GA4 property ID (Admin → Property settings), e.g. `123456789` |
| `GSC_SITE_URL` | Exact GSC property URL, e.g. `https://www.thevesselcode.com/` or `sc-domain:thevesselcode.com` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Service account JSON (raw or base64). Same key as indexing is OK if APIs enabled |
| `REVENUE_PIPELINE_SECRET` | Bearer token for `GET /api/revenue-pipeline` |
| `CRON_SECRET` | Vercel Cron auth (also accepts as pipeline secret) |
| `REVENUE_DIGEST_TO` | Optional email override for weekly digest (defaults to `CONTACT_TO_EMAILS`) |
| `CONTACT_SLACK_WEBHOOK_URL` / `CONTACT_KAKAO_WORK_WEBHOOK_URL` | Optional instant digest |
| `RESEND_API_KEY` | Weekly digest email |
| `GITHUB_TOKEN` | List open `[Contact]` issues |

### Google Cloud setup (one-time)

1. Enable **Google Analytics Data API** and **Search Console API** on the GCP project (`weighty-time-508206-s8` or your indexing project).
2. Add the **service account robot email** (not your personal Gmail) to GA4 and GSC — see below.
3. Paste the **entire** service-account `.json` file into Vercel as `GOOGLE_SERVICE_ACCOUNT_JSON` (or reuse `GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON` if already set for Indexing API).

#### Important: who gets “Viewer” in GA4?

| Account | Role in GA4 | Action |
|---------|-------------|--------|
| `ktechship@gmail.com` (founder) | Usually **Administrator** already | **Do nothing** — do not add again as Viewer |
| `indexing-bot@….iam.gserviceaccount.com` (or similar) | **None** until you add it | **Add as Viewer** — this is what the revenue API uses |

The pipeline runs as the **service account**, not as ktechship@gmail.com. If only the human account has access, Vercel will return Google auth errors even though you can see GA4 in the browser.

#### Find `GOOGLE_SERVICE_ACCOUNT_JSON` and `client_email` (~2 min)

1. On your PC, open **Downloads** and look for a JSON key from Google Cloud, e.g. `weighty-time-508206-s8-….json` or `thevesselcode-seo-….json` (same file created for [Google Indexing API](scripts/push-indexing.mjs)).
2. Open it in a text editor. It looks like:

```json
{
  "type": "service_account",
  "project_id": "weighty-time-508206-s8",
  "client_email": "indexing-bot@weighty-time-508206-s8.iam.gserviceaccount.com",
  "private_key": "-----BEGIN PRIVATE KEY-----\n..."
}
```

3. **Vercel value:** copy **the whole file** from `{` through `}` into `GOOGLE_SERVICE_ACCOUNT_JSON` (one line is fine; base64 also works).
4. **Robot email:** copy **`client_email`** — that string goes into GA4 and GSC user lists.

If the JSON is lost: [Google Cloud → IAM → Service accounts](https://console.cloud.google.com/iam-admin/serviceaccounts) → your bot (e.g. `indexing-bot`) → **Keys** → **Add key** → **JSON** (new download; store securely, never commit to git).

#### GA4: add the robot as Viewer

1. GA4 → **Admin** (gear) → **Property access management**.
2. Click **+** → **Add users**.
3. **Email:** paste `client_email` (e.g. `indexing-bot@weighty-time-508206-s8.iam.gserviceaccount.com`).
4. **Role:** **Viewer** only.
5. **Add**.

#### GSC: same robot email

1. [Google Search Console](https://search.google.com/search-console) → **Settings** → **Users and permissions**.
2. **Add user** → paste the same `client_email`.
3. Permission: **Full** or **Restricted** with performance/read access (needs query data for the pipeline).

#### Vercel checklist (Production)

| Variable | Example / note |
|----------|----------------|
| `GA4_PROPERTY_ID` | Admin → Property settings → numeric **Property ID** (not `G-XB1B5NY3NB`) |
| `GSC_SITE_URL` | Must match GSC exactly, e.g. `https://www.thevesselcode.com/` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Full JSON from the key file |
| `REVENUE_PIPELINE_SECRET` | Random string; use in `Authorization: Bearer …` |
| `CRON_SECRET` | Same or separate; Vercel Cron sends `Authorization: Bearer $CRON_SECRET` |

## API

```bash
curl -s -H "Authorization: Bearer $REVENUE_PIPELINE_SECRET" \
  "https://www.thevesselcode.com/api/revenue-pipeline?days=7" | jq '.actions[:5]'
```

Response includes `actions[]` with `priority`, `message`, and `revenue` hint.

## Weekly cron

Vercel runs `GET /api/cron/revenue-digest` every **Monday 00:00 UTC** (09:00 KST).

Manual trigger:

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  https://www.thevesselcode.com/api/cron/revenue-digest
```

## Local report

```bash
export GA4_PROPERTY_ID=...
export GSC_SITE_URL=https://www.thevesselcode.com/
export GOOGLE_SERVICE_ACCOUNT_JSON='...'
export GITHUB_TOKEN=...
npm run revenue:report
npm run test:revenue-pipeline   # offline rule smoke test
```

## How to use actions (operator SOP)

| Action type | Do this week |
|-------------|----------------|
| `open_lead` | Reply within 12h; RFQ → quote draft; PoC → calendar |
| `gsc_rfq` | Improve `/store/{code}` + RFQ CTA; consider Google Ads to that IMPA URL |
| `gsc_saas` | Boost `/sm` title/meta; outreach with PoC offer |
| `conversion_gap` | PoC clicks > submits → simplify contact or add phone CTA |
| `impa_plg` | Template quote for that IMPA code |

Track closes in a sheet: **Inquiry → Quote sent → PoC signed → MRR**.
