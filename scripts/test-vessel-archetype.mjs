#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const stores = { ship_components: [], maintenance_jobs: [], meta: {} };

global.TVC_DB = {
  async getMeta(k) { return stores.meta[k] ?? null; },
  async setMeta(k, v) { stores.meta[k] = v; },
  async getAll(n) { return [...(stores[n] || [])]; },
  async bulkPut(n, rows) {
    stores[n] = [...(stores[n] || []), ...rows];
  },
};
global.TVC_MachineryTaxonomy = {
  async setStoredProfileId() {},
  async ensureCatalogGroupDefs() { return {}; },
};
global.fetch = async () => ({
  ok: true,
  json: async () => JSON.parse(fs.readFileSync(path.join(ROOT, 'data/templates/archetypes.json'), 'utf8')),
});

const code = fs.readFileSync(path.join(ROOT, 'js/services/templateService.js'), 'utf8')
  + '\nglobalThis.TVC_TemplateService = TVC_TemplateService;';
eval(code);

let fail = 0;
function assert(name, ok) {
  if (ok) console.log(`  ✓ ${name}`);
  else { console.log(`  ✗ ${name}`); fail++; }
}

const arch = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/templates/archetypes.json'), 'utf8'));
assert('BULK_CARRIER >= 40 components', arch.archetypes.BULK_CARRIER.components.length >= 40);
assert('OIL_TANKER >= 40 components', arch.archetypes.OIL_TANKER.components.length >= 40);
assert('CONTAINER >= 40 components', arch.archetypes.CONTAINER.components.length >= 40);

const r1 = await TVC_TemplateService.applyVesselArchetype('MV Archetype Test', 'CONTAINER', { MAIN_ENGINE: 'WinGD' });
assert('apply creates components', r1.components >= 40);
assert('apply creates jobs', r1.jobs > r1.components);
const me = stores.ship_components.find(c => c.label === 'Main Engine');
assert('maker override WinGD', me?.maker === 'WinGD');

const r2 = await TVC_TemplateService.applyVesselArchetype('MV Archetype Test', 'CONTAINER');
assert('idempotent skip', r2.skipped === true);

console.log(fail ? `\n${fail} failed` : '\nAll archetype checks passed.');
process.exit(fail ? 1 : 0);
