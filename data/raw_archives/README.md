# TVC domain archive intake

Drop historical maritime exports here, then run:

```bash
node scripts/ingest-domain-archives.mjs
```

Output is consolidated into `data/tvc-knowledge-base.json` for TVC Brain grounding.

## Accepted formats

| Extension | Notes |
|-----------|--------|
| `.csv` | Repair logs, spare price lists, PMS exports (header row required) |
| `.xlsx` | Excel PMS / quotation sheets (first worksheet, header row) |
| `.json` | Arrays of records or `{ "records": [...] }` with maritime field names |
| `.txt` | One record per line: `key=value` pairs separated by `\|` or tab |

## Expected columns (CSV / Excel)

Preferred headers (aliases are mapped automatically):

- `equipment_name`, `job_title`, `part_number`, `unit_price_usd`, `vendor_name`
- `trouble_cause`, `corrective_action`, `class_remarks`

See `sample-historical-repairs.csv` for a working example.

## Ignored files

- `README.md`, dotfiles, and non-data extensions
- Files whose names start with `_` (scratch / staging)
