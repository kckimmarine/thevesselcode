# Pricing Tiers v1 — Commercial & Seat License Alignment

**Status:** Single source of truth (commercial + product contract)  
**Audience:** Sales, grants (e.g. Q3-2), marketing, engineering, support  
**Related:** [`seat-license.md`](seat-license.md), [`SYNC-ENVELOPE-V2.md`](SYNC-ENVELOPE-V2.md), [`SHORE-RAG-ACTION-CARDS.md`](SHORE-RAG-ACTION-CARDS.md), [`VESSEL-ARCHETYPE-V0.md`](VESSEL-ARCHETYPE-V0.md), [`FLEET-NOC-DASHBOARD-V1.md`](FLEET-NOC-DASHBOARD-V1.md)

**Marketing surfaces:** [`sm/index.html`](../sm/index.html) (Track A/B cards), [`js/marketing-i18n.js`](../js/marketing-i18n.js), billing hooks [`js/billing/checkout.js`](../js/billing/checkout.js)

---

## Executive summary

TVC monetization is a **two-track model**:

| Track | Product | Buyer | Billing unit |
|-------|---------|-------|----------------|
| **A — PLG** | Maritime Toolkit Pro | Individual crew, surveyors, 3rd engineers | **$9.99 / user / month** |
| **B — Enterprise** | TVC-SM Fleet OS (Vessel Core + SM) | Shipowners, managers, superintendents | **Per vessel / month** (Basic / Pro / Fleet) |

Track B starts with a **30-day risk-free fleet trial**, then converts to a **seat license** on each designated ship PC ([`seat-license.md`](seat-license.md)). Shore HQ features (Vault RAG, fleet NOC) bill at the **company/fleet** contract tier.

---

## Track A — Individual / PLG

### Maritime Toolkit Pro — **$9.99 / month**

**Target:** Officers, engineers, surveyors needing daily reference tools—not fleet PMS.

| Included | Notes |
|----------|--------|
| Unlimited ASTM Table 54B calculation logs | Toolkit module |
| Offline PDF downloads (plates & calculators) | No live API required for core flows |
| Full-plate bookmarking across IMPA catalog | PLG funnel to RFQ / Fleet |

**Not included:** Vessel Core PMS/SPARE, ZIP fleet sync, seat license, Action Cards.

**CTA (marketing):** `inquiry=toolkit-pro`, billing plan `toolkit-pro` ([`sm/index.html`](../sm/index.html)).

---

## Track B — Enterprise Fleet OS / B2B SaaS

### Trial & conversion

| Phase | Duration | Commercial meaning | License artifact |
|-------|----------|--------------------|------------------|
| **30-day risk-free trial** | 30 calendar days | Full evaluation; cancel anytime | Trial token / time-boxed seat (no charge) |
| **Pilot seat (new company)** | **3 months** | First paid or pre-paid pilot | Ed25519 `license.json` — `--months 3` ([`seat-license.md`](seat-license.md)) |
| **Production seat** | **12 months** | Established customer | Ed25519 `license.json` — `--months 12` |

After trial: customer selects **Basic, Pro, or Fleet** per vessel; TVC issues seat licenses matching **SKU + tier** (see [Seat licensing](#seat-licensing--billing-lifecycle)).

**Marketing label:** `$99 / vessel / month (Starter)` on [`sm/index.html`](../sm/index.html) = **Tier 1 Basic** entry price (same product family).

### Enterprise tier breakdown (per vessel / month)

List prices (USD). **Pro benchmark:** ~**$300 USD / ~₩400,000 KRW** per vessel/month at list (grant and regional quotes may use KRW anchor).

| Tier | List price | Marketing alias |
|------|------------|-----------------|
| **Basic** | **$99 / vessel / mo** | Fleet **Starter** |
| **Pro** | **$299 / vessel / mo** | Core intelligence tier |
| **Fleet** | **$499 / vessel / mo** or **Custom** | Multi-vessel NOC + SCM |

Volume discounts (10–50, 50–300, 300+ vessels) are **contract overlays**—not encoded in v1 list prices.

---

### Tier 1 — Basic ($99 / vessel / mo)

**Positioning:** Offline-first Class-ready PMS & SPARE for a single vessel install—**zero mandatory cloud**.

| Capability | Detail |
|------------|--------|
| Vessel Core PMS & SPARE | IndexedDB, RBAC, Deck/Engine scope |
| Electron / PWA local execution | No live cloud API in normal ship operation |
| Standard ZIP export/import | Ship ↔ HQ / Captain Hub consolidation (legacy or v1 compliance hash) |
| Archetype onboarding | [`VESSEL-ARCHETYPE-V0.md`](VESSEL-ARCHETYPE-V0.md) |
| ISM / IACS alignment (product) | UR Z20 PMS practice, ISM Code Section 10 workflows (as shipped) |

**Not included:** Signed ZIP v2 mandate, Shore Vault RAG, Action Cards, fleet NOC dashboard, RFQ platform fee module.

---

### Tier 2 — Pro ($299 / vessel / mo)

**Positioning:** **Signed, auditable sync** + **Shore intelligence** with **offline Action Cards** on ship.

| Capability | Detail |
|------------|--------|
| **All Basic features** | |
| **Signed ZIP v2** | Ed25519 + SHA-256 — [`SYNC-ENVELOPE-V2.md`](SYNC-ENVELOPE-V2.md) |
| **Shore HQ Vessel-Specific Vault RAG** | Supabase pgvector; `company_id` + `vessel_id` partition |
| **Action Card pipeline** | HQ approve → `SM_TO_SHIP` bundle → ship offline viewer — [`SHORE-RAG-ACTION-CARDS.md`](SHORE-RAG-ACTION-CARDS.md) |
| **Citation & ISM Element 10 audit** | Mandatory manual citations on cards; `action_card_logs` in signed export |

Ship remains **LLM-free**; Pro enables **HQ-side** LLM/RAG only.

---

### Tier 3 — Fleet ($499 / vessel / mo or Custom)

**Positioning:** Superintendent **fleet command** (10–1,000 vessels) + optional **supply chain** revenue.

| Capability | Detail |
|------------|--------|
| **All Pro features** | |
| **Fleet NOC exception dashboard** | Prioritized overdue jobs, defect alerts, low ROB/stock across fleet — [`FLEET-NOC-DASHBOARD-V1.md`](FLEET-NOC-DASHBOARD-V1.md) |
| **Enterprise multi-tenant** | Company-wide admin, RLS-aligned cloud ingest — [`data-scope-policy.md`](data-scope-policy.md) |
| **RFQ / Supplier Mode (optional)** | 1-click RFQ; **1–3% platform transaction fee** on matched supply (TVC does not hold inventory) |

Custom pricing for >300 vessels, FOC fleets, or bundled manning services.

---

## Feature flag mapping (Track B)

Logical flags for seat license, HQ entitlements, and future `license.json` fields (`license_tier`: `BASIC` | `PRO` | `FLEET`).

| Feature / capability | Basic | Pro | Fleet |
|----------------------|:-----:|:---:|:-----:|
| Offline PMS & SPARE (Vessel Core) | ✓ | ✓ | ✓ |
| ZIP ship ↔ shore (standard) | ✓ | ✓ | ✓ |
| Vessel archetype onboarding | ✓ | ✓ | ✓ |
| Captain Hub / station ZIP paths | ✓ | ✓ | ✓ |
| Signed SYNC-ENVELOPE-V2 (Ed25519) | — | ✓ | ✓ |
| Cloud ingest verify + audit columns | — | ✓ | ✓ |
| Shore Vault RAG (HQ) | — | ✓ | ✓ |
| Action Card publish & ship bundle | — | ✓ | ✓ |
| `action_card_logs` signed return | — | ✓ | ✓ |
| Fleet NOC exception dashboard | — | — | ✓ ([spec](FLEET-NOC-DASHBOARD-V1.md)) |
| Multi-tenant company admin / restore | — | — | ✓ |
| Supplier RFQ + platform fee (1–3%) | — | — | ✓ (optional) |
| **List USD / vessel / mo** | **$99** | **$299** | **$499+** |

**Enforcement (roadmap):** Ship `license.json` tier gates envelope v2 signing keys; HQ Supabase role gates Vault and NOC UI.

---

## Seat licensing & billing lifecycle

See **[`seat-license.md`](seat-license.md)** for operational steps.

```text
Contact / Trial (30d) → PoC signed → Tier selected (Basic/Pro/Fleet)
    → Machine ID request from ship PC
    → TVC issues Ed25519 license.json (3mo pilot OR 12mo production)
    → Import on vessel; SKU stamp must match installer
    → Renewal: new license.json same machineId before expiresAt
```

| Topic | Policy |
|-------|--------|
| **Binding** | One seat = one designated ship PC (`LICENSE_MACHINE`) |
| **Signing** | Ed25519 offline verification (`electron/license.js`) |
| **Admin Mode** | `ADMIN_TVC` — no seat license |
| **Tier in license** | Future: `license_tier` + `features[]` in signed payload (v1 doc contract) |

### Data portability (contractual guarantee)

Customers retain **100% operational data** regardless of tier or churn:

- Standard **ZIP / JSON export** (incremental sync packages) from Vessel Core and HQ import paths
- No lock-in via proprietary-only formats; envelope v2 is documented JSON inside ZIP
- Cloud copies (if used) exportable via HQ restore ZIP — [`data-scope-policy.md`](data-scope-policy.md)

TVC does **not** delete customer sync archives without retention policy + customer request.

---

## Alignment checklist

| Source | Alignment |
|--------|-----------|
| [`sm/index.html`](../sm/index.html) | Track A $9.99; Track B $99 Starter + 30-day trial CTA |
| [`seat-license.md`](seat-license.md) | 3-month pilot / 12-month production; Ed25519 seat |
| [`SYNC-ENVELOPE-V2.md`](SYNC-ENVELOPE-V2.md) | Pro+ signed sync |
| [`SHORE-RAG-ACTION-CARDS.md`](SHORE-RAG-ACTION-CARDS.md) | Pro+ Action Cards + audit logs |
| Grant / Q3-2 narratives | Use **Pro ~$300 / ₩400k** benchmark and Fleet scale story |

**Gap (known):** Marketing page shows **Starter ($99)** only; Pro/Fleet cards may land in a follow-up UI pass—**this document** is authoritative for tier names and prices.

---

## Validation

Documentation-only change:

```bash
npm run verify-rbac
npm run build
```

---

## Version history

| Version | Change |
|---------|--------|
| **1.0.0** | Initial two-track model; Basic / Pro / Fleet; seat alignment |
