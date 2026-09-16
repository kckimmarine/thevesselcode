# Fleet Sync Architecture

Autonomous pipeline for the Maritime Toolkit **Vessel Particulars & Registry** lookup (~50k merchant IMOs). Human-edited JSON overrides are replaced by scheduled ingest, merge, and AIS refresh jobs.

## Golden record (concept)

| Key | Role |
|-----|------|
| **IMO** | Immutable primary key (7-digit, checksum-validated). |
| **MMSI** | Cross-index for AIS (`fleet-mmsi-index.json`, field `s` on chunk rows). |
| **Chunk store** | `public/data/fleet/fleet-XX.json` — compact search + detail fields (`i,n,t,d,y,f,m,e,s`). |
| **AIS snapshot** | `public/data/fleet-ais-positions.json` — last known position per IMO (live stream or prior snapshot). |
| **Sync status** | `public/data/fleet/sync-status.json` — last run, counts, SHA-256 of `fleet-index.json`. |

The UI reads chunks for search; the map modal uses MMSI + `/api/vessel-ais` (when deployed) or the snapshot file.

## Phase 1 (implemented)

**Orchestrator:** `npm run fleet:sync` → `scripts/run-fleet-sync.mjs`

1. **Ingest** — `scripts/ingest-global-fleet.mjs`  
   Open permitted sources (IMO CSV, Seafarer Index). No manual `fleet-enrichment.json` overlay.

2. **Generate enrichment cache** — `data/fleet-cache/generated-fleet-enrichment.json`  
   Built from Seafarer cache after ingest (gitignored cache dir).

3. **Enrich** — `scripts/enrich-fleet-registry.mjs`  
   Merges manager, DWT, year, engine, MMSI into chunks; writes `fleet-mmsi-index.json`.

4. **AIS refresh** — `scripts/refresh-fleet-ais-positions.mjs`  
   Uses `AISSTREAM_API_KEY` when set; otherwise keeps existing positions.

5. **Validate & report** — checksums and counts in `sync-status.json`.

**Offline:** `npm run fleet:sync:offline` sets `FLEET_SKIP_DOWNLOAD=1` (uses `data/fleet-cache/*.dat` only).

**Automation:** `.github/workflows/fleet-sync-cron.yml` — daily 02:00 UTC + `workflow_dispatch`. On API failure the workflow still exits successfully and leaves prior chunks in place.

## Phase 2–4 (roadmap)

| Phase | Goal |
|-------|------|
| **2** | Golden store in Postgres/Supabase; API `GET /vessel/{imo}`; chunk export from DB. |
| **3** | Licensed particulars feed (Equasis-class API) — delta sync by IMO. |
| **4** | Always-on AIS worker; IMO↔MMSI resolution at scale; sub-minute positions for subscribed fleet. |

## AI role (future)

AI is **not** a substitute for GISIS or licensed registers. Intended use:

- **Conflict scoring** when multiple open sources disagree on manager, DWT, or name.
- **Entity normalization** (flag codes, company aliases, NFKC names).
- **Anomaly flags** (missing MMSI, DWT=0 with tanker type) → enqueue re-fetch.

Human review only for unresolved high-impact conflicts.

## Operations

| Variable | Purpose |
|----------|---------|
| `FLEET_SKIP_DOWNLOAD` | `1` — use cached downloads only. |
| `AISSTREAM_API_KEY` | Live AIS snapshot refresh. |
| `FLEET_AIS_MAX_TARGETS` | Cap AIS polls per run (default `200`). |
| `ENRICH_PSIX` | `1` + `ENRICH_PSIX_IMOS=imo1,imo2` for optional USCG PSIX SOAP. |

## Related scripts

- `npm run ingest:fleet` — ingest only  
- `npm run enrich:fleet` — enrich only (requires existing chunks)  
- `npm run refresh:fleet-ais` — AIS only  
- `npm run test:global-fleet` / `npm run test:enrich-fleet` — smoke tests  
