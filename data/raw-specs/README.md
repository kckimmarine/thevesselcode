# Raw specs ingestion — operational SOP

## 1. Overview

The **`data/raw-specs/`** directory is the **drop zone** for structured mechanical/marine specification extracts (from PDFs, OEM manuals, class circulars, or spreadsheet exports). Nothing in this folder is served directly to the public site.

**Pipeline:**

```text
PDF / manual / drawing table  →  (human or LLM) JSON file  →  data/raw-specs/*.json
        →  npm run enrich:vault  →  data/industrial-mro-index.json
```

- **Input:** one or more `*.json` files in this directory.
- **Processor:** `scripts/tools/enrich-domain-vault.mjs` (via `npm run enrich:vault`).
- **Output:** `data/industrial-mro-index.json` — merged, validated, deduplicated entries keyed by content hash (`id`).
- **Rejected rows** are listed in `industrial-mro-index.json` → `rejected_samples` (first 50) for audit; the ingest script does **not** crash on bad rows.

See sample fixtures: `flange-jis-10k-sample.json`, `bolt-torque-sample.json`, `reject-malformed-sample.json`.

---

## 2. Standard attributes

Each **record** inside a file’s `records[]` array should map to the normalized vault fields below. Use **exact field names** when possible; the enrich script also accepts common aliases (`pcd`, `nominal`, `standard`, `pressure`).

| Attribute | Required | Type / values | Normalized output |
|-----------|----------|---------------|-------------------|
| `item_code` / `catalog_ref` | Recommended | string | Stored in `label` or future cross-ref (use `label` today) |
| `flange_standard` | When flange-related | `JIS` \| `DIN` \| `ANSI` \| `ASME` \| `ISO` | `flange_standard` |
| `nominal_diameter` | Recommended | e.g. `50A`, `2 inch`, `DN50` | `nominal_diameter` |
| `pcd_mm` | When flange-related | **positive number** | `pcd_mm` |
| `bolt_holes` | Optional | positive integer | Not in index today; keep in raw JSON for traceability |
| `tightening_torque_nm` | When fastener-related | **positive number** (N·m) | `tightening_torque_nm` |
| `pressure_rating` | Recommended | e.g. `10K`, `150LB`, `PN16`, `150#` | `pressure_rating` |

**Validation rules (automatic):**

- `pcd_mm` / `tightening_torque_nm` must be numeric and **> 0** if present.
- Unknown `flange_standard` values are **rejected** when a standard field is supplied.
- Rows with **no mappable fields** are rejected (see `reject-malformed-sample.json`).

**Wrapper file shape:**

```json
{
  "source": "vendor-manual-2026-q1",
  "category": "flange",
  "records": [ { "...": "..." } ]
}
```

---

## 3. LLM extraction prompt template

Copy the block below, paste your **OCR text or table excerpt** at the end, and save the model output as `data/raw-specs/your-source-name.json`.

```text
You are a marine/industrial MRO data extractor for THE VESSEL CODE.

Convert the SOURCE TEXT into ONE JSON object only (no markdown fences), matching this schema:

{
  "source": "<short provenance string>",
  "category": "flange|fastener|valve|pipe|other",
  "records": [
    {
      "label": "<human readable line description>",
      "item_code": "<optional OEM or catalog ref>",
      "catalog_ref": "<optional IMPA or internal ref>",
      "flange_standard": "JIS|DIN|ANSI|ASME|ISO",
      "nominal_diameter": "<e.g. 50A or 2 inch>",
      "pcd_mm": <number or omit>,
      "bolt_holes": <integer or omit>,
      "tightening_torque_nm": <number or omit>,
      "pressure_rating": "<e.g. 10K, PN16, 150LB>"
    }
  ]
}

Rules:
- Use JSON numbers for pcd_mm, bolt_holes, tightening_torque_nm (not strings).
- Do NOT invent values missing from the source; omit fields instead.
- flange_standard must be one of JIS, DIN, ANSI, ASME, ISO when specified.
- One physical spec row = one records[] element.

SOURCE TEXT:
<<< paste OCR / table here >>>
```

**Agent checklist after LLM output:**

1. Validate JSON (`node -e "JSON.parse(require('fs').readFileSync('data/raw-specs/FILE.json'))"`).
2. Run `npm run enrich:vault` and confirm `accepted` count increased.
3. Inspect `data/industrial-mro-index.json` → `rejected_samples` for any bad rows.

---

## 4. Execution and CI guard commands

| Step | Command | Purpose |
|------|---------|---------|
| Ingest | `npm run enrich:vault` | Merge all `raw-specs/*.json` → `industrial-mro-index.json` |
| Fleet stress | `npm run test:fleet-stress` | 50-vessel / 200-delta idempotency + Envelope v2 crypto guard |
| RBAC guard | `npm run verify-rbac` | 31/31 (also run inside fleet-stress) |
| Envelope guard | `npm run verify-sync-envelope-v2` | Signed ZIP contract (also run inside fleet-stress) |
| Marketing build | `npm run build` | Ensure static bundle still compiles |

**Typical commit flow:**

```bash
# 1. Add or update JSON under data/raw-specs/
npm run enrich:vault
git add data/raw-specs/ data/industrial-mro-index.json
git commit -m "data: ingest <source> mechanical specs"
npm run test:fleet-stress
npm run build
```

---

## Related docs

- Enrich script: `scripts/tools/enrich-domain-vault.mjs`
- Stress harness: `scripts/tools/stress-fleet-sync.mjs`
- IMPA programmatic SEO (separate path): `docs/IMPA-SEO-SCALING-CHECKLIST.md`
