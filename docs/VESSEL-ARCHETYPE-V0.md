# Vessel Archetype Engine v0

**Status:** Production (offline-first)  
**Data:** `data/templates/archetypes.json`  
**Runtime:** `js/services/templateService.js` (`TVC_TemplateService`)  
**UI:** `js/ui/vesselRegistryModal.js` (3-step wizard)

---

## Executive purpose

Scale fleet onboarding from **1 → 1,000 vessels** without manual equipment-tree typing. Archetype v0 **clones a Class-aligned machinery taxonomy** (components + planned maintenance jobs) into IndexedDB in one local operation (**target &lt; 1 second** on a typical ship PC).

Spare part numbers and BOM depth are **not** seeded at onboarding; they accumulate through **Daily Work Reports**, **Requisitions**, and SPARE imports (differential accumulation).

---

## Taxonomy and archetype scope

### Standards alignment

Baseline trees follow **JIS / DIN / ISO machinery grouping** practice and **ClassNK-style PMS** intervals (routine inspection, periodic maintenance, class/statutory items). Archetypes are **templates**, not a substitute for owner-specific Class job lists or maker manuals.

### v0 archetypes (bundled)

| Key | Label | Machinery profile | Components | Jobs |
|-----|--------|-------------------|------------|------|
| `BULK_CARRIER` | Bulk Carrier | `bulker` | **40** | **116** |
| `OIL_TANKER` | Oil Tanker | `tanker` | **42** | **125** |
| `CONTAINER` | Container | `container` | **41** | **121** |

Each **component** row in JSON defines:

- `name`, `category` (`DECK` | `ENGINE`), `group_no`, `group_name`
- `maker_default`, optional `maker_override_key` (`MAIN_ENGINE` | `GEN_ENGINE`)
- `item_sort1` / `item_sort2` (tree labels)
- `jobs[]`: `job_detail`, `period`, `unit` (`H` | `M`), `pic`

### Deck vs Engine parity

- **Category** drives department: `DECK` → deck jobs/PIC (e.g. BOSUN); `ENGINE` → engine room (e.g. 3/E, C/E).
- Job codes are generated as `ARC-DK-####` / `ARC-EN-####` during apply.
- Component tree paths are rebuilt from job hierarchy: `DEPARTMENT → GROUP → SORT → EQUIPMENT → ITEM_L1 → ITEM_L2`.

---

## Onboarding mechanics (3-step flow)

Implemented in `TVC_VesselRegistryModal`:

| Step | User action | System |
|------|-------------|--------|
| **1. Name & IMO** | Vessel name/ID, optional 7-digit IMO | Validates name; IMO format if present |
| **2. Archetype card** | Choose Bulk / Tanker / Container | Reads counts from `listArchetypes()` |
| **3. Maker overrides** | Optional main engine & generator maker | Maps to `makerOverrides.MAIN_ENGINE` / `GEN_ENGINE` |

**Initialize Fleet** then:

1. Registers fleet/registry record (`TVC_Fleet`, optional `TVC_AdminRegistry`)
2. Sets `TVC_META_KEYS.VESSEL_ID`
3. Calls `TVC_TemplateService.applyVesselArchetype(vesselId, archetypeKey, makerOverrides, { companyId })`
4. Links machinery profile via `TVC_MachineryTaxonomy` when available

### Maker options (template-level)

From `archetypes.json` → `maker_options`:

- **MAIN_ENGINE:** MAN, Yanmar, Daihatsu, WinGD  
- **GEN_ENGINE:** MAN, Yanmar, Daihatsu, WinGD  

Template defaults (e.g. **MAN B&W** on main engine) apply when override is blank. Overrides replace maker on components/jobs that declare `maker_override_key`.

### Provisioning speed

- Single bundled JSON fetch (`data/templates/archetypes.json`, cached in memory)
- One `bulkPut` batch each for `maintenance_jobs`, `ship_components`, `maintenance_groups`
- No network API required after initial JSON load (offline-safe)

---

## Integrity and safety invariants

### Idempotency guard — `VESSEL_NOT_EMPTY`

Before writing, `vesselHasMachineryData(vesselId)` checks IndexedDB for any `ship_components` or `maintenance_jobs` with matching `vessel_id`.

If data exists and `opts.force !== true`:

- Throws `Error` with **`code: 'VESSEL_NOT_EMPTY'`**
- Message: vessel already has machinery/jobs; apply skipped to avoid pollution

The wizard performs the same check before apply. Re-applying the same archetype requires an empty vessel scope or explicit `force: true` (admin tooling only).

### Multi-tenant isolation

Every provisioned record MUST carry:

- **`vessel_id`** — required (apply throws if missing)
- **`company_id`** — set from `opts.companyId`, else `TVC_Fleet.licenseCompanyId()` when available

Applies to: `maintenance_jobs`, `ship_components`, `maintenance_groups`. Cloud sync and HQ RLS rely on `export_meta.company_id` + row-level `vessel_id`; stamping at source prevents cross-company merge ambiguity.

### Differential spare accumulation

Archetype v0 **does not** create `spare_parts`, `job_bom`, or IMPA links. Part numbers enter the system only via:

- Work Report spare page / consume logs  
- Requisitions and SPARE master import  
- HQ feedback packages  

This keeps onboarding idempotent and avoids fake stock.

### Audit meta

After successful apply, meta key `vessel_archetype_applied_{sanitized_vessel_id}` stores:

`{ archetypeKey, at, jobs, components }`

---

## API surface (`TVC_TemplateService`)

| Method | Role |
|--------|------|
| `loadArchetypes()` | Fetch/cache JSON |
| `listArchetypes()` | UI cards (counts, labels) |
| `getArchetype(key)` | Single archetype |
| `makerOptions()` | Step 3 dropdowns |
| `vesselHasMachineryData(vesselId)` | Idempotency probe |
| `applyVesselArchetype(vesselId, key, makerOverrides, opts)` | Provision IndexedDB |
| `getAppliedMeta(vesselId)` | Read apply stamp |

### Apply result

```javascript
{
  vessel_id,
  archetype_key,
  jobs,           // count written
  components,     // tree nodes
  maintenance_groups,
  machinery_profile
}
```

---

## Validation

```bash
npm run test:vessel-archetypes   # JSON schema + exact v0 counts
npm run verify-rbac              # RBAC regression
npm run build                    # Static build
```

Expected test output:

```text
OK BULK_CARRIER: 40 components, 116 jobs
OK OIL_TANKER: 42 components, 125 jobs
OK CONTAINER: 41 components, 121 jobs
vessel archetypes data OK
```

---

## Roadmap (out of v0 scope)

- Additional archetypes (general cargo, chemical, LNG)
- Owner-approved Class job CSV import overlay
- HQ-side archetype versioning + signed template bundles (see [`SYNC-ENVELOPE-V2.md`](SYNC-ENVELOPE-V2.md))
- Shore Vault RAG → **Action Cards** on ship (see [`SHORE-RAG-ACTION-CARDS.md`](SHORE-RAG-ACTION-CARDS.md))

---

## Version history

| Version | Notes |
|---------|--------|
| **v0** | Three archetypes, 3-step wizard, offline JSON, `VESSEL_NOT_EMPTY` guard |
