# Fleet NOC Dashboard v1

**Status:** Architecture specification (Phase 1 — docs + contract)  
**Tier:** **Fleet** only — [`PRICING-TIERS-V1.md`](PRICING-TIERS-V1.md) ($499+ / vessel / mo or custom)  
**Audience:** Superintendents, technical directors, fleet managers (Shore HQ / SM Mode)

**Related:** [`data-scope-policy.md`](data-scope-policy.md), [`SYNC-ENVELOPE-V2.md`](SYNC-ENVELOPE-V2.md), [`SHORE-RAG-ACTION-CARDS.md`](SHORE-RAG-ACTION-CARDS.md), [`VESSEL-ARCHETYPE-V0.md`](VESSEL-ARCHETYPE-V0.md)

---

## Executive mission

When a company operates **10 to 1,000 vessels**, raw PMS feeds, defect inboxes, and SPARE ledgers cannot be monitored vessel-by-vessel. The **Fleet NOC (Network Operations Center) Dashboard** provides **exception-based situational awareness**: only vessels and conditions that need superintendent attention surface first.

Design principles:

| Principle | Meaning |
|-----------|---------|
| **Exceptions only** | No infinite scroll of “all jobs on all ships” |
| **Traffic-light fleet state** | One glance: how many vessels are at risk |
| **Drill-down without context loss** | Drawer inspection, not full page hops |
| **Audit-ready exports** | Class / PSC dossier ties maintenance, Action Cards, signed sync |
| **Scale** | Materialized summaries + virtualized UI for 1,000 rows |

Shipboard operations remain **offline-first**; NOC is a **Shore HQ** surface (IndexedDB mirror and/or Supabase cloud read).

---

## Placement in TVC architecture

```text
Ship (Vessel Core) ──signed ZIP──► Supabase sync_records / sync_package_ingest
                                        │
                                        ▼ materialized fleet_noc_vessel_summary (planned)
                                 Fleet NOC Dashboard (SM / HQ)
                                        │
                    ┌───────────────────┴───────────────────┐
                    ▼                                       ▼
         Vessel Inspection Drawer              Class/PSC Audit Export (ZIP/PDF bundle)
```

| Layer | Role |
|-------|------|
| **Ingest** | [`SYNC-ENVELOPE-V2.md`](SYNC-ENVELOPE-V2.md) verified packages → `sync_records`, `sync_package_ingest` |
| **Aggregate** | Nightly or on-ingest rollups per `company_id` + `vessel_id` |
| **Present** | NOC UI — Fleet tier entitlement |

Pro tier supplies signed sync and Action Cards; **NOC consumes** those signals but is **not** sold on Basic/Pro alone.

---

## Core exception engine — four triggers

Each trigger produces zero or more **exception rows** attached to a vessel. Vessel **overall status** is the **worst** active trigger severity (see [Traffic light](#traffic-light-fleet-categorization)).

### Trigger 1 — PMS overdue (statutory / Class machinery)

**Sources:** `maintenance_jobs` (cloud mirror or HQ IndexedDB), `is_overdue`, `next_date`, run-hour counters in `sync_vessel_meta.run_hours`.

| Condition | Detail |
|-----------|--------|
| **Overdue by calendar** | `next_date` &lt; today and job not locked/approved closed |
| **Overdue by running hours** | `unit === 'H'` and accumulated hours ≥ `period` since `last_done` |
| **Class / statutory flag** | Jobs whose `job_detail` or plan metadata marks Class survey items (configurable tag) escalate severity |

**Exception code:** `PMS_OVERDUE`  
**Payload:** `{ job_code, job_detail, department, days_overdue | hours_overdue, class_statutory: boolean }`

---

### Trigger 2 — Unresolved critical defects (off-hire risk)

**Sources:** `defect_cases` — severity, status, timestamps.

| Condition | Detail |
|-----------|--------|
| **Critical open** | Severity = critical (or equivalent) AND not `defect_cleared` |
| **Age** | Open &gt; **48 hours** since reported / confirmed (configurable) |

**Exception code:** `DEFECT_CRITICAL_OPEN`  
**Payload:** `{ defect_id, title, age_hours, department, off_hire_risk: true }`

---

### Trigger 3 — Low spare parts stock (critical machinery)

**Sources:** `spare_parts` ROB vs minimum, optionally `consume_logs` trend.

| Condition | Detail |
|-----------|--------|
| **Below minimum** | `rob_qty` (or equivalent) &lt; `min_qty` for parts tagged **critical** (category / equipment link) |
| **Scope** | Machinery-linked spares only in v1 (exclude galley/consumables) |

**Exception code:** `SPARE_BELOW_MIN`  
**Payload:** `{ part_no, description, rob, min, equipment_path }`

---

### Trigger 4 — Sync staleness (connectivity / data freshness)

**Sources:** `sync_package_ingest.ingested_at`, `sync_packages.created_at`, last successful `SHIP_TO_HQ` direction; optional ship `export_meta.export_date` in latest package.

| Condition | Detail |
|-----------|--------|
| **Warning** | No successful ingest &gt; **7 days** |
| **Critical** | No successful ingest &gt; **14 days** (also drives **Red** traffic light) |

**Exception code:** `SYNC_STALE`  
**Payload:** `{ last_ingest_at, days_since_sync, last_direction, verification_status }`

Signed envelope failures (`verification_status: REJECTED`) surface as **separate** banner on the vessel card but do not replace staleness math.

---

## Traffic light fleet categorization

Per-vessel **`fleet_health_status`** (computed):

| Status | Color | Enter when (any of) |
|--------|-------|---------------------|
| **CRITICAL** | Red | Class/statutory **PMS overdue**; **critical defect** &gt; 48h; sync **&gt; 14 days**; signed sync **REJECTED** on last package (optional hard Red) |
| **WARNING** | Amber | Non-class PMS overdue or due within **30 days**; **spare below min**; sync **&gt; 7 days** and ≤ 14 days |
| **HEALTHY** | Green | No active Red/Amber rules |

**Sort order:** Red first, then Amber, then Green; within band sort by **highest severity score** (weighted: defect &gt; class overdue &gt; sync &gt; spare).

```text
severity_score =
  (red_trigger ? 1000 : 0)
  + (amber_trigger ? 100 : 0)
  + min(days_overdue, 99)
  + min(defect_age_hours / 24, 99)
```

---

## UI layout & interactive mechanics (HQ view)

**Surface:** SM Mode fleet home or dedicated **Fleet NOC** route (desktop-first; responsive per [`MOBILE-UX.md`](MOBILE-UX.md) for read-only KPIs).

### Top bar — fleet health KPIs

| KPI | Source |
|-----|--------|
| Total vessels | Registry active count for `company_id` |
| Critical count | `fleet_health_status === CRITICAL` |
| Warning count | `WARNING` |
| Healthy count | `HEALTHY` |
| Last rollup at | Materialization timestamp |

Optional: filter by fleet subgroup, flag, superintendent assignment.

### Main view — prioritized exception grid

- **Card per vessel** (not per job): vessel name, IMO, traffic light, top 3 exception chips, last sync age.
- **Virtualized list** (windowing) — target **60 fps** scroll at 1,000 cards; server-side pagination API `?offset=&limit=` for cloud mode.
- **Strict ordering:** Red vessels pinned to top; within Red, sort by `severity_score` desc.

### Drill-down — vessel inspection drawer

Click card → **slide-over drawer** (no full page reload):

| Section | Content |
|---------|---------|
| Summary | Traffic light, sync status, envelope verify badge |
| PMS | Overdue / due-soon job table (Dept filter) |
| Defects | Open critical list |
| SPARE | Below-min lines |
| Action Cards | Last applied cards + citation links (Pro/Fleet) — [`SHORE-RAG-ACTION-CARDS.md`](SHORE-RAG-ACTION-CARDS.md) |
| Actions | Open vessel in SM PMS, request re-sync, RFQ shortcut (Fleet + SCM) |

Drawer loads detail from **HQ IndexedDB** if present else **`GET /api/sync/cloud/records`** ([`data-scope-policy.md`](data-scope-policy.md)).

### 1-click Class / PSC audit export

**Button:** “Export compliance dossier” (ClassNK / Tokyo MoU oriented pack).

**Bundle contents (v1 contract):**

| Artifact | Source |
|----------|--------|
| PMS overdue & completed maintenance log extract | `sync_records` / local DB |
| Defect register snapshot | `defect_cases` |
| Action Card usage + manual citations | `action_card_logs`, card JSON |
| Sync integrity attestation | Latest `sync_package_ingest` + envelope verify metadata — [`SYNC-ENVELOPE-V2.md`](SYNC-ENVELOPE-V2.md) |
| Cover sheet | Vessel particulars, export timestamp, superintendent ID |

Output: **ZIP** (JSON + printable PDF summary). Does not replace official Class portal submission; supports **internal and PSC interview readiness**.

---

## Data ingestion & scalability

### Read paths

| Mode | When | Read from |
|------|------|-----------|
| **Cloud-authoritative HQ** | Online sync pilot / Fleet contract | Supabase `sync_records`, `sync_vessel_meta`, `sync_package_ingest`, `sync_packages` |
| **HQ offline mirror** | ZIP-import-only customers | HQ IndexedDB merged vessels |
| **Hybrid** | Default target | Cloud rollup + local cache for drawer detail |

### Materialized summary (planned schema)

Table or view **`fleet_noc_vessel_summary`** (per `company_id`, `vessel_id`):

```json
{
  "vessel_id": "ABC Voyager",
  "company_id": "ABC_SHIPPING",
  "fleet_health_status": "WARNING",
  "severity_score": 142,
  "exception_counts": { "PMS_OVERDUE": 2, "SPARE_BELOW_MIN": 1 },
  "last_sync_at": "2026-09-15T08:00:00Z",
  "last_ingest_status": "VERIFIED",
  "computed_at": "2026-09-22T12:00:00Z"
}
```

**Refresh triggers:**

- On successful `ingestSyncPackage` (incremental update)
- Nightly cron for fleet-wide recompute
- Manual “Refresh fleet status” in Admin

### Performance targets

| Scale | Target |
|-------|--------|
| 50 vessels | KPI + grid &lt; 500 ms TTI on HQ broadband |
| 1,000 vessels | Virtualized grid; API page size 50; rollup query &lt; 2 s p95 |
| Ingest storm | Idempotent `sync_id` — no duplicate NOC thrash ([`SYNC-ENVELOPE-V2.md`](SYNC-ENVELOPE-V2.md)) |

---

## Security & entitlements

| Rule | Detail |
|------|--------|
| **Fleet tier** | `license_tier === FLEET` or HQ contract flag `features.fleet_noc` |
| **RLS** | Superintendent sees only own `company_id` vessels |
| **ADMIN** | Cross-company read for support incidents only |
| **No ship UI** | NOC is shore-only; ship keeps exception-free local PMS |

---

## Implementation roadmap

| Phase | Deliverable |
|-------|-------------|
| **1 (this doc)** | Triggers, traffic light, UI contract, export bundle list |
| **2** | `fleet_noc_vessel_summary` + rollup job |
| **3** | NOC route + virtualized grid + drawer |
| **4** | Audit export generator |
| **5** | Mobile KPI strip + push digest (optional) |

---

## Validation

Documentation-only change:

```bash
npm run verify-rbac
npm run build
```

Future: `npm run test:fleet-noc` — rollup fixtures for 4 triggers.

---

## Version history

| Version | Notes |
|---------|--------|
| **1.0.0** | Initial Fleet NOC spec; aligns with Pricing Fleet tier |
