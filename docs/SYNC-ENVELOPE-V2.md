# SYNC-ENVELOPE-V2 — Signed sync package contract

**Status:** Implemented (export + cloud ingest + client import verification)  
**Related:** [`data-scope-policy.md`](data-scope-policy.md), [`FLEET-SYNC-ARCHITECTURE.md`](FLEET-SYNC-ARCHITECTURE.md), [`PRICING-TIERS-V1.md`](PRICING-TIERS-V1.md) (Pro+ tier), [`FLEET-NOC-DASHBOARD-V1.md`](FLEET-NOC-DASHBOARD-V1.md) (sync staleness signals)

---

## Purpose

Ship ↔ shore ZIP payloads carry operational data (PMS, SPARE, defects, permits). **Envelope v2** wraps the inner `payload` with:

- **Idempotency** (`sync_id`)
- **Integrity** (SHA-256 over canonical payload JSON)
- **Authenticity** (Ed25519 signature over the hash)
- **Tenant scope** (`metadata.company_id`, `metadata.vessel_id`)
- **PQC roadmap** (`pqc_extension` metadata only — no quantum algorithms in v2.0.0)

Legacy packages (flat `tvc_sync.json` with optional v1 `compliance.package_hash_sha256`) remain importable when legacy fallback is enabled.

---

## File layout in ZIP

| Path | Content |
|------|---------|
| `tvc_sync.json` | Envelope v2 **or** legacy document |
| `tvc_station_export.json` | Same document as `tvc_sync.json` (mirror for station tools) |
| `README.txt` | Human-readable summary |

---

## JSON schema (envelope v2)

```json
{
  "envelope_version": "2.0.0",
  "sync_id": "SYNC-{VESSEL_ID}-{ISO_TIMESTAMP}-{NONCE}",
  "metadata": {
    "company_id": "ABC_SHIPPING",
    "vessel_id": "ABC Voyager",
    "imo_no": "9876543",
    "department": "ENGINE",
    "exported_at": "2026-09-22T12:00:00.000Z",
    "exported_by": "engineer",
    "direction": "SHIP_TO_HQ",
    "sync_type": "DELTA_ONLY",
    "station_id": null,
    "schema_version": 6
  },
  "compliance": {
    "standard": "IACS UR E26/E27 Cyber-Resilient",
    "integrity_algorithm": "SHA-256",
    "signature_algorithm": "Ed25519",
    "payload_hash": "<sha256 hex of canonical payload>",
    "digital_signature": "<base64 Ed25519 signature over payload_hash bytes>",
    "signer_public_key_spki_base64": "<SPKI DER base64 for HQ registry>"
  },
  "pqc_extension": {
    "ready": true,
    "mode": "HYBRID_READY",
    "kem_algorithm": "RESERVED_NIST_ML_KEM",
    "dsa_algorithm": "RESERVED_NIST_ML_DSA"
  },
  "payload": {
    "export_meta": { "...": "..." },
    "maintenance_jobs": [],
    "daily_work_reports": [],
    "run_hours": {},
    "company_comments": [],
    "action_cards": [],
    "action_card_logs": []
  }
}
```

### Intelligence payload extensions (Action Cards)

Defined in [`SHORE-RAG-ACTION-CARDS.md`](SHORE-RAG-ACTION-CARDS.md). Optional arrays inside **`payload`** (participate in `payload_hash` signing):

| Field | Typical direction | Merge rule |
|-------|-------------------|------------|
| `action_cards` | `SM_TO_SHIP` | Upsert by `card_id`; only `governance.status === 'APPROVED_FOR_FLEET'` |
| `action_card_logs` | `SHIP_TO_HQ` / station export | Upsert by log `id`; append-only audit |

Ship edge **must not** require these keys to be present (empty or omitted = valid). Ingest treats unknown payload keys as inert until Phase 2 store registration.

**Work Report linkage:** `daily_work_reports[].action_card_id` (optional) references a card delivered in a prior import; export collector denormalizes into `action_card_logs[]` for HQ audit.

### `sync_id` format

`SYNC-{VESSEL_ID}-{TIMESTAMP}-{NONCE}`

- `VESSEL_ID`: spaces → `_`, max 48 chars  
- `TIMESTAMP`: ISO-8601 with `:` and `.` replaced by `-`  
- `NONCE`: 8 hex chars (CSPRNG)

Used for **idempotent cloud ingest** (duplicate `sync_id` → no double-apply).

### Canonical payload hashing

1. Take object **`payload`** only (inner body).  
2. Serialize with **stable key order** (`stableStringify` — sorted object keys, recursive).  
3. UTF-8 SHA-256 → lowercase hex → `compliance.payload_hash`.

### Digital signature

- Algorithm: **Ed25519**  
- Message: **32-byte buffer** of `payload_hash` (hex decoded), not the raw JSON string.  
- Encoding: **base64** in `digital_signature`.

### PQC extension

**Metadata only.** No ML-KEM / ML-DSA operations in v2.0.0. Reserved for a future hybrid envelope without breaking v2 parsers.

---

## Rejection conditions (ingest / import)

| Condition | Code | Action |
|-----------|------|--------|
| `payload_hash` ≠ recalculated hash | `ERR_TAMPERED_PACKAGE` | Abort merge / ingest |
| Missing or invalid Ed25519 signature | `ERR_INVALID_SIGNATURE` | Abort |
| `metadata.vessel_id` ≠ expected tenant | `ERR_TENANT_MISMATCH` | Abort |
| `metadata.company_id` ≠ expected tenant | `ERR_TENANT_MISMATCH` | Abort |
| Missing `metadata.vessel_id` | `ERR_UNKNOWN_VESSEL` | Abort |
| No public key in registry and none in envelope | `ERR_MISSING_PUBLIC_KEY` | Abort (strict) |
| Duplicate `sync_id` already ingested | `ERR_DUPLICATE_SYNC_ID` | Idempotent skip (audit `DUPLICATE`) |

---

## Keys

| Layer | Storage |
|-------|---------|
| **Ship export** | Browser / Electron `localStorage` key `tvc_sync_ed25519_key_v1` (PKCS8 + SPKI PEM JSON) |
| **Cloud ingest** | Env `SYNC_VESSEL_PUBLIC_KEYS_JSON` — map `{ "vessel_id": "PEM or SPKI base64" }` |
| **HQ import (browser)** | `localStorage` `tvc_sync_trusted_public_keys_v1` — auto-pin from first verified `signer_public_key_spki_base64` per vessel |

License signing keys (`electron/keys/`) are **separate** from sync package keys.

---

## Environment flags (cloud)

| Variable | Default | Meaning |
|----------|---------|---------|
| `SYNC_ENVELOPE_LEGACY_ALLOW` | `1` | Allow unsigned / legacy flat packages |
| `SYNC_ENVELOPE_REQUIRE_SIGNATURE` | `0` | When `1`, reject non-v2 envelopes |
| `SYNC_VESSEL_PUBLIC_KEYS_JSON` | — | Vessel → public key map for verify |

---

## Audit (Supabase)

Optional migration: `deploy/supabase-sync-envelope-v2.sql`

- `sync_package_ingest.sync_id`  
- `sync_package_ingest.verification_status` — `VERIFIED`, `REJECTED`, `DUPLICATE`, `LEGACY`, `SKIPPED`

When columns are absent, ingest still writes `status` + `error_message`.

---

## Implementation map

| Component | Path |
|-----------|------|
| Spec | `docs/SYNC-ENVELOPE-V2.md` |
| Action Cards (Shore RAG) | [`docs/SHORE-RAG-ACTION-CARDS.md`](SHORE-RAG-ACTION-CARDS.md) |
| Browser export / import verify | `js/services/dataExchangeService.js` |
| Node shared crypto | `api/_lib/syncEnvelopeV2.js` |
| Cloud ingest | `api/_lib/syncIngest.js` |
| Offline test | `scripts/verify-sync-envelope-v2.mjs` |

---

## Backward compatibility

| Package type | Export | Import |
|--------------|--------|--------|
| Envelope v2 signed | Default when Web Crypto + key available | Verify then merge |
| Legacy flat + v1 hash | Older builds | Hash check optional; no signature |
| Legacy flat, no compliance | Dev / tests | Allowed if `SYNC_ENVELOPE_LEGACY_ALLOW=1` |

---

## Version history

| Version | Change |
|---------|--------|
| **2.0.0** | Envelope wrapper, Ed25519, `sync_id`, `pqc_extension` |
