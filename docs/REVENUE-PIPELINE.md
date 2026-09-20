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

1. Enable **Google Analytics Data API** and **Search Console API** on the GCP project.
2. Service account email → **GA4** property → Access management → **Viewer**.
3. Same email → **GSC** → Users and permissions → **Full** or **Restricted** with query data.
4. Paste JSON into Vercel as `GOOGLE_SERVICE_ACCOUNT_JSON`.

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
