# Market feed (BUNKER STEM + freight indices)

Production values are written to `public/data/market-feed.json` by `scripts/fetch-market-feed.mjs` (also run via `npm run pipeline:market` and the **Maritime ingestion cron** every 6 hours).

## Data sources

| UI block | Source | Update cadence |
|----------|--------|----------------|
| **BUNKER STEM** (Singapore, Rotterdam, Houston) | [OilPriceAPI](https://www.oilpriceapi.com/) `GET /v1/prices/marine-fuels/latest` (`market_reporting`) | When provider publishes (typically daily per port/grade) |
| **BUNKER STEM** (Busan) | OilPriceAPI per-port codes (`VLSFO_KRPUS_USD`, etc.) | Same (requires API key) |
| **Freight & shipping indices** | OilPriceAPI `GET /v1/prices/latest?by_code=BALTIC_*` (Baltic Exchange benchmarks) | London business days for BDI/BCI; other codes when available |

The browser **does not** re-randomize prices. It displays `market-feed.json` as fetched.

## Required secret

Add **`OILPRICE_API_KEY`** (or `OILPRICEAPI_KEY`) to:

- GitHub Actions → repository **Secrets** (used by `.github/workflows/maritime-ingestion-cron.yml`)
- Any manual/CI run of `npm run fetch-market-feed`

Without the key, bunker stems for three hubs still update from the public marine-fuels endpoint; **Busan** and **live Baltic indices** stay on the last cached JSON until a keyed fetch succeeds.

## Local refresh

```bash
OILPRICE_API_KEY=your_token npm run fetch-market-feed
```
