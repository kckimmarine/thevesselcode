# ECA boundary coordinate sources

Polygons in `data/maritime-regulations.json` are rebuilt by `node scripts/build-maritime-regulations.mjs`.

| Region | Source |
|--------|--------|
| Baltic / North Sea / North American segments | `sources/maritime-naval-foss-seca.csv` ([Maritime-Naval-FOSS/map-areas](https://github.com/Maritime-Naval-FOSS/map-areas), GPL-2.0) — outline points aligned with IMO MARPOL Annex VI SECA/ECA definitions |
| US Caribbean | `sources/us-caribbean-eca-mepc755.txt` (extract of IMO **MEPC.1/Circ.755** Annex 2) |
| China coastal DECA + Hainan | `sources/china-deca-implementation-scheme.pdf` (PRC MOT Implementation Scheme, Table 1 & 2) |
| Mediterranean Sea SOx ECA | IMO **MEPC.361(79)** gate lines (Gibraltar, Çanakkale, Suez) plus outer sea-area ring for map display |
| Korea port control areas | 12 NM planning octagons around published hub coordinates (Busan, Ulsan, Yeosu/Gwangyang, Incheon, Pyeongtaek) |

**Disclaimer:** Map overlays are for compliance planning and training. Always verify against flag, class, port state, and official ENC/ECDIS data before operation.
