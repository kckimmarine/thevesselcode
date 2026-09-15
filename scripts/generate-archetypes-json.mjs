#!/usr/bin/env node
/** One-off generator for data/templates/archetypes.json — run: node scripts/generate-archetypes-json.mjs */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const MAKER_ROLES = {
  MAIN_ENGINE: { default: 'MAN B&W', options: ['MAN B&W', 'WinGD', 'Yanmar', 'Daihatsu'] },
  GEN_ENGINE: { default: 'Yanmar', options: ['MAN B&W', 'WinGD', 'Yanmar', 'Daihatsu'] },
};

const JOB_STD = [
  { job_detail: 'ROUTINE INSPECTION', period: 1, unit: 'M', pic: '1/E' },
  { job_detail: 'FUNCTION TEST', period: 500, unit: 'H', pic: '1/E' },
  { job_detail: 'CLASS / STATUTORY SURVEY', period: 12, unit: 'M', pic: 'C/E', regulatory: 'ClassNK' },
];

function jobs(extra = []) {
  return [...JOB_STD, ...extra];
}

function comp(key, name, category, group, makerRole, extraJobs = []) {
  return {
    key,
    name,
    category,
    group,
    maker_role: makerRole || null,
    maker_default: makerRole ? MAKER_ROLES[makerRole].default : 'OEM',
    standard_spec: 'ISO 15550 / JIS F7305',
    jobs: jobs(extraJobs),
  };
}

function bulkComponents() {
  const gens = [1, 2, 3].map(n => comp(`ge${n}`, `No.${n} Generator Engine`, 'ENGINE', '02. AUXILIARY ENGINES', 'GEN_ENGINE'));
  return [
    comp('me', 'Main Engine', 'ENGINE', '01. MAIN PROPULSION', 'MAIN_ENGINE', [{ job_detail: 'CYLINDER COVER OVERHAUL', period: 8000, unit: 'H' }]),
    ...gens,
    comp('aux_boiler', 'Auxiliary Boiler', 'ENGINE', '03. BOILERS', null),
    comp('egc', 'Exhaust Gas Economizer', 'ENGINE', '03. BOILERS', null),
    comp('hfo_sep', 'HFO Purifier', 'ENGINE', '04. PURIFIERS', null),
    comp('lo_sep', 'L.O. Purifier', 'ENGINE', '04. PURIFIERS', null),
    comp('ows', 'Oily Water Separator (15ppm)', 'ENGINE', '04. PURIFIERS', null, [{ job_detail: '15PPM FUNCTION TEST', period: 3, unit: 'M', pic: '1/E' }]),
    comp('bilge_sep', 'Bilge Separator', 'ENGINE', '04. PURIFIERS', null),
    comp('fwg', 'Fresh Water Generator', 'ENGINE', '05. AUXILIARY PUMPS', null),
    comp('sw_cool', 'Sea Water Cooling Pump', 'ENGINE', '05. AUXILIARY PUMPS', null),
    comp('lo_pump', 'L.O. Supply Pump', 'ENGINE', '05. AUXILIARY PUMPS', null),
    comp('fo_pump', 'F.O. Transfer Pump', 'ENGINE', '05. AUXILIARY PUMPS', null),
    comp('steer', 'Steering Gear', 'ENGINE', '06. STEERING GEAR', null),
    comp('hatch1', 'Hatch Cover No.1', 'DECK', '05. HATCH COVERS', null),
    comp('hatch2', 'Hatch Cover No.2', 'DECK', '05. HATCH COVERS', null),
    comp('hatch_hpu', 'Hatch Cover HPU', 'DECK', '05. HATCH COVERS', null),
    comp('crane1', 'Deck Crane No.1', 'DECK', '09. DECK CRANES', null),
    comp('crane2', 'Deck Crane No.2', 'DECK', '09. DECK CRANES', null),
    comp('windlass_fwd', 'Forward Windlass', 'DECK', '02. MOORING & WINDLASS', null),
    comp('windlass_aft', 'Aft Mooring Winch', 'DECK', '02. MOORING & WINDLASS', null),
    comp('radar', 'Radar', 'DECK', '06. NAVIGATION & GMDSS', null),
    comp('ecdis', 'ECDIS', 'DECK', '06. NAVIGATION & GMDSS', null),
    comp('gmdss', 'GMDSS Console', 'DECK', '06. NAVIGATION & GMDSS', null),
    comp('fire_pump', 'Fire Pump', 'DECK', '04. FIRE FIGHTING', null),
    comp('co2', 'CO2 Fixed System', 'DECK', '04. FIRE FIGHTING', null),
    comp('lifeboat', 'Lifeboat & Davit', 'DECK', '03. LIFE-SAVING', null),
    comp('ism_doc', 'ISM DOC Audit Items', 'DECK', '07. STATUTORY ISM', null, [{ job_detail: 'ISM INTERNAL AUDIT', period: 12, unit: 'M', pic: 'Master' }]),
    comp('class_hull', 'Class Hull Survey Prep', 'DECK', '07. STATUTORY ISM', null, [{ job_detail: 'ANNUAL CLASS SURVEY', period: 12, unit: 'M', regulatory: 'ClassNK' }]),
    ...Array.from({ length: 14 }, (_, i) => comp(`hold_${i + 1}`, `Cargo Hold No.${i + 1} Ventilation`, 'DECK', '07. CARGO HOLDS', null)),
  ];
}

function tankerComponents() {
  const gens = [1, 2, 3].map(n => comp(`ge${n}`, `No.${n} Generator Engine`, 'ENGINE', '02. AUXILIARY ENGINES', 'GEN_ENGINE'));
  return [
    comp('me', 'Main Engine', 'ENGINE', '01. MAIN PROPULSION', 'MAIN_ENGINE'),
    ...gens,
    comp('boiler', 'High-Capacity Auxiliary Boiler', 'ENGINE', '03. BOILERS', null),
    comp('igs', 'Inert Gas System (IGS)', 'ENGINE', '09. INERT GAS', null, [{ job_detail: 'IGS OXYGEN ANALYSER CALIBRATION', period: 1, unit: 'M' }]),
    comp('igs_gen', 'IG Generator', 'ENGINE', '09. INERT GAS', null),
    comp('deck_seal', 'IG Deck Seal', 'DECK', '09. INERT GAS', null),
    comp('cop1', 'Cargo Oil Pump No.1', 'DECK', '07. CARGO PUMPS', null),
    comp('cop2', 'Cargo Oil Pump No.2', 'DECK', '07. CARGO PUMPS', null),
    comp('strip', 'Stripping Pump', 'DECK', '07. CARGO PUMPS', null),
    comp('ballast1', 'Ballast Pump No.1', 'ENGINE', '05. AUXILIARY PUMPS', null),
    comp('ballast2', 'Ballast Pump No.2', 'ENGINE', '05. AUXILIARY PUMPS', null),
    comp('hfo_sep', 'HFO Purifier', 'ENGINE', '04. PURIFIERS', null),
    comp('lo_sep', 'L.O. Purifier', 'ENGINE', '04. PURIFIERS', null),
    comp('ows', 'Oily Water Separator (15ppm)', 'ENGINE', '04. PURIFIERS', null),
    comp('steer', 'Steering Gear', 'ENGINE', '06. STEERING GEAR', null),
    comp('cargo_tank_mon', 'Cargo Tank Monitoring', 'DECK', '08. TANK MONITORING', null),
    comp('vapour', 'Vapour Recovery Unit', 'DECK', '10. VAPOUR RECOVERY', null),
    comp('radar', 'Radar', 'DECK', '06. NAVIGATION & GMDSS', null),
    comp('ecdis', 'ECDIS', 'DECK', '06. NAVIGATION & GMDSS', null),
    comp('fire_pump', 'Fire Pump', 'DECK', '04. FIRE FIGHTING', null),
    comp('lifeboat', 'Lifeboat & Davit', 'DECK', '03. LIFE-SAVING', null),
    comp('ism_doc', 'ISM DOC Audit Items', 'DECK', '07. STATUTORY ISM', null),
    comp('class_hull', 'Class Annual Survey', 'DECK', '07. STATUTORY ISM', null),
    ...Array.from({ length: 18 }, (_, i) => comp(`tank_${i + 1}`, `Cargo Tank No.${i + 1} Level System`, 'DECK', '08. TANK MONITORING', null)),
  ];
}

function containerComponents() {
  const gens = [1, 2, 3, 4].map(n => comp(`ge${n}`, `No.${n} Generator Engine`, 'ENGINE', '02. AUXILIARY ENGINES', 'GEN_ENGINE'));
  return [
    comp('me', 'Main Engine', 'ENGINE', '01. MAIN PROPULSION', 'MAIN_ENGINE'),
    ...gens,
    comp('aux_boiler', 'Auxiliary Boiler', 'ENGINE', '03. BOILERS', null),
    comp('reefer_bus', 'Reefers Power Bus', 'DECK', '08. REEFER POWER', null),
    comp('reefer_panel', 'Reefer Panel', 'DECK', '08. REEFER POWER', null),
    comp('lashing', 'Lashing Gear (Twistlocks)', 'DECK', '07. LASHING', null),
    comp('lashing_bridge', 'Lashing Bridge', 'DECK', '07. LASHING', null),
    comp('bow_thruster', 'Bow Thruster', 'ENGINE', '01. MAIN PROPULSION', null),
    comp('steer', 'Steering Gear', 'ENGINE', '06. STEERING GEAR', null),
    comp('hfo_sep', 'HFO Purifier', 'ENGINE', '04. PURIFIERS', null),
    comp('lo_sep', 'L.O. Purifier', 'ENGINE', '04. PURIFIERS', null),
    comp('ows', 'Oily Water Separator', 'ENGINE', '04. PURIFIERS', null),
    comp('radar', 'Radar', 'DECK', '06. NAVIGATION & GMDSS', null),
    comp('ecdis', 'ECDIS', 'DECK', '06. NAVIGATION & GMDSS', null),
    comp('fire_pump', 'Fire Pump', 'DECK', '04. FIRE FIGHTING', null),
    comp('lifeboat', 'Lifeboat & Davit', 'DECK', '03. LIFE-SAVING', null),
    comp('ism_doc', 'ISM DOC Audit Items', 'DECK', '07. STATUTORY ISM', null),
    comp('class_hull', 'Class Annual Survey', 'DECK', '07. STATUTORY ISM', null),
    ...Array.from({ length: 22 }, (_, i) => comp(`bay_${i + 1}`, `Container Bay ${i + 1} Cell Guide`, 'DECK', '07. CELL GUIDES', null)),
  ];
}

const out = {
  version: 1,
  updated_at: '2026-09-15',
  compliance_refs: ['ClassNK', 'ISM Code', 'ISO 15550', 'JIS F7305', 'DIN 86251'],
  maker_roles: MAKER_ROLES,
  archetypes: {
    BULK_CARRIER: {
      label: 'Bulk Carrier',
      taxonomy_profile: 'bulker',
      vessel_types: ['Bulk Carrier'],
      components: bulkComponents(),
    },
    OIL_TANKER: {
      label: 'Oil Tanker',
      taxonomy_profile: 'tanker_chemical',
      vessel_types: ['Oil Tanker', 'Product Tanker'],
      components: tankerComponents(),
    },
    CONTAINER: {
      label: 'Container Ship',
      taxonomy_profile: 'container',
      vessel_types: ['Container Ship'],
      components: containerComponents(),
    },
  },
};

const dest = path.join(ROOT, 'data', 'templates', 'archetypes.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out, null, 2));
for (const [k, v] of Object.entries(out.archetypes)) {
  console.log(`${k}: ${v.components.length} components`);
}
