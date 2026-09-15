#!/usr/bin/env node
/**
 * Generates data/templates/archetypes.json — run after editing archetype definitions below.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'data', 'templates', 'archetypes.json');

const STANDARD_JOBS = [
  { job_detail: 'ROUTINE INSPECTION', period: 500, unit: 'H', pic: '3/E' },
  { job_detail: 'PERIODIC MAINTENANCE', period: 2000, unit: 'H', pic: '2/E' },
  { job_detail: 'CLASS / STATUTORY SURVEY ITEM', period: 12, unit: 'M', pic: 'C/E' },
  { job_detail: 'ANNUAL OVERHAUL INSPECTION', period: 8000, unit: 'H', pic: 'C/E' },
];

const DECK_JOBS = [
  { job_detail: 'ROUTINE INSPECTION', period: 1, unit: 'M', pic: 'BOSUN' },
  { job_detail: 'LUBRICATION & FUNCTION TEST', period: 3, unit: 'M', pic: 'BOSUN' },
  { job_detail: 'ANNUAL CLASS SURVEY', period: 12, unit: 'M', pic: 'C/O' },
];

function comp(name, category, maker_default, group_no, group_name, jobs, extra = {}) {
  return {
    name,
    category,
    maker_default,
    group_no,
    group_name,
    item_sort1: extra.item_sort1 || name,
    item_sort2: extra.item_sort2 || name,
    maker_override_key: extra.maker_override_key || null,
    jobs: jobs || (category === 'DECK' ? DECK_JOBS : STANDARD_JOBS),
  };
}

function bulkCarrierComponents() {
  const ge = (n) => comp(`No.${n} Generator Engine`, 'ENGINE', 'Yanmar', '02', 'AUXILIARY ENGINES / GENERATORS', STANDARD_JOBS, {
    item_sort1: `No.${n} G/E`,
    item_sort2: 'GENERATOR SET',
    maker_override_key: 'GEN_ENGINE',
  });
  return [
    comp('Main Engine', 'ENGINE', 'MAN B&W', '01', 'MAIN PROPULSION', STANDARD_JOBS, { maker_override_key: 'MAIN_ENGINE' }),
    comp('Turbocharger', 'ENGINE', 'ABB', '01', 'MAIN PROPULSION', STANDARD_JOBS.slice(0, 3)),
    comp('Main Engine Governor', 'ENGINE', 'Woodward', '01', 'MAIN PROPULSION', STANDARD_JOBS.slice(0, 3)),
    ge(1), ge(2), ge(3),
    comp('Auxiliary Boiler', 'ENGINE', 'Miura', '03', 'BOILERS & EXHAUST GAS ECONOMIZER', STANDARD_JOBS),
    comp('Exhaust Gas Economizer', 'ENGINE', 'Alfa Laval', '03', 'BOILERS & EXHAUST GAS ECONOMIZER', STANDARD_JOBS.slice(0, 3)),
    comp('HFO Purifier', 'ENGINE', 'Alfa Laval', '04', 'PURIFIERS / OWS', STANDARD_JOBS),
    comp('LO Purifier', 'ENGINE', 'Alfa Laval', '04', 'PURIFIERS / OWS', STANDARD_JOBS),
    comp('Oily Water Separator (15ppm)', 'ENGINE', 'RWO', '04', 'PURIFIERS / OWS', STANDARD_JOBS),
    comp('Ballast Pump', 'ENGINE', 'Shin Shin', '05', 'AUXILIARY PUMPS', STANDARD_JOBS.slice(0, 3)),
    comp('Fire Pump', 'ENGINE', 'Shin Shin', '05', 'AUXILIARY PUMPS', STANDARD_JOBS.slice(0, 3)),
    comp('General Service Pump', 'ENGINE', 'Shin Shin', '05', 'AUXILIARY PUMPS', STANDARD_JOBS.slice(0, 3)),
    comp('Steering Gear', 'ENGINE', 'Nakashima', '06', 'STEERING GEAR', STANDARD_JOBS),
    comp('Rudder Actuator', 'ENGINE', 'Nakashima', '06', 'STEERING GEAR', STANDARD_JOBS.slice(0, 3)),
    comp('Hatch Covers', 'DECK', 'MacGregor', '05', 'HATCH COVERS & CLOSING APPLIANCES', DECK_JOBS),
    comp('Hatch Cover HPU', 'DECK', 'MacGregor', '05', 'HATCH COVERS & CLOSING APPLIANCES', DECK_JOBS),
    comp('Deck Crane No.1', 'DECK', 'IHI', '01', 'CARGO HANDLING', DECK_JOBS),
    comp('Deck Crane No.2', 'DECK', 'IHI', '01', 'CARGO HANDLING', DECK_JOBS),
    comp('Cargo Winch', 'DECK', 'Brattvaag', '01', 'CARGO HANDLING', DECK_JOBS.slice(0, 2)),
    comp('Windlass', 'DECK', 'Brattvaag', '02', 'MOORING WINCH & WINDLASS', DECK_JOBS),
    comp('Forward Mooring Winch', 'DECK', 'Brattvaag', '02', 'MOORING WINCH & WINDLASS', DECK_JOBS.slice(0, 2)),
    comp('Aft Mooring Winch', 'DECK', 'Brattvaag', '02', 'MOORING WINCH & WINDLASS', DECK_JOBS.slice(0, 2)),
    comp('Lifeboat & Davit', 'DECK', 'Schottel', '03', 'LIFE-SAVING APPLIANCES', DECK_JOBS),
    comp('Fire Pumps (Deck)', 'DECK', 'FIFI', '04', 'FIRE FIGHTING SYSTEMS', DECK_JOBS),
    comp('CO2 Fixed Fire System', 'DECK', 'Kidde', '04', 'FIRE FIGHTING SYSTEMS', DECK_JOBS),
    comp('Radar', 'DECK', 'Furuno', '06', 'NAVIGATION & GMDSS', DECK_JOBS.slice(0, 2)),
    comp('ECDIS', 'DECK', 'Furuno', '06', 'NAVIGATION & GMDSS', DECK_JOBS.slice(0, 2)),
    comp('GMDSS Console', 'DECK', 'Furuno', '06', 'NAVIGATION & GMDSS', DECK_JOBS.slice(0, 2)),
    comp('Hold Ventilation Fan', 'DECK', 'Howden', '07', 'CARGO HOLDS', DECK_JOBS.slice(0, 2)),
    comp('Grab (if fitted)', 'DECK', 'Nemag', '09', 'DECK CRANES & GRABS', DECK_JOBS.slice(0, 2)),
    comp('Main Air Compressor', 'ENGINE', 'Sperre', '05', 'AUXILIARY PUMPS', STANDARD_JOBS.slice(0, 3)),
    comp('Service Air Compressor', 'ENGINE', 'Sperre', '05', 'AUXILIARY PUMPS', STANDARD_JOBS.slice(0, 2)),
    comp('Fresh Water Generator', 'ENGINE', 'Sasakura', '05', 'AUXILIARY PUMPS', STANDARD_JOBS.slice(0, 3)),
    comp('Sewage Treatment Plant', 'ENGINE', 'Hamworthy', '05', 'AUXILIARY PUMPS', STANDARD_JOBS.slice(0, 2)),
    comp('Incinerator', 'ENGINE', 'Detegasa', '05', 'AUXILIARY PUMPS', STANDARD_JOBS.slice(0, 2)),
    comp('Emergency Generator', 'ENGINE', 'Yanmar', '02', 'AUXILIARY ENGINES / GENERATORS', STANDARD_JOBS.slice(0, 3)),
    comp('Main Sea Water Pump', 'ENGINE', 'Shin Shin', '05', 'AUXILIARY PUMPS', STANDARD_JOBS.slice(0, 2)),
    comp('LT Cooler', 'ENGINE', 'Alfa Laval', '01', 'MAIN PROPULSION', STANDARD_JOBS.slice(0, 2)),
  ];
}

function oilTankerComponents() {
  const ge = (n) => comp(`No.${n} Generator Engine`, 'ENGINE', 'Daihatsu', '02', 'AUXILIARY ENGINES / GENERATORS', STANDARD_JOBS, {
    item_sort1: `No.${n} G/E`,
    item_sort2: 'GENERATOR SET',
    maker_override_key: 'GEN_ENGINE',
  });
  return [
    comp('Main Engine', 'ENGINE', 'WinGD', '01', 'MAIN PROPULSION', STANDARD_JOBS, { maker_override_key: 'MAIN_ENGINE' }),
    comp('Main Engine TC', 'ENGINE', 'MAN', '01', 'MAIN PROPULSION', STANDARD_JOBS.slice(0, 3)),
    ge(1), ge(2), ge(3),
    comp('High-Capacity Auxiliary Boiler', 'ENGINE', 'Aalborg', '03', 'BOILERS & EXHAUST GAS ECONOMIZER', STANDARD_JOBS),
    comp('Composite Boiler / EGE', 'ENGINE', 'Aalborg', '03', 'BOILERS & EXHAUST GAS ECONOMIZER', STANDARD_JOBS.slice(0, 3)),
    comp('Inert Gas Generator', 'ENGINE', 'Kashiwa', '07', 'INERT GAS SYSTEM (IGS)', STANDARD_JOBS),
    comp('IGS Deck Seal', 'ENGINE', 'Kashiwa', '07', 'INERT GAS SYSTEM (IGS)', STANDARD_JOBS.slice(0, 3)),
    comp('IGS Scrubber Tower', 'ENGINE', 'Kashiwa', '07', 'INERT GAS SYSTEM (IGS)', STANDARD_JOBS.slice(0, 3)),
    comp('Cargo Oil Pump No.1 (COP)', 'ENGINE', 'Framo', '08', 'CARGO PUMPS', STANDARD_JOBS),
    comp('Cargo Oil Pump No.2 (COP)', 'ENGINE', 'Framo', '08', 'CARGO PUMPS', STANDARD_JOBS),
    comp('Stripping Pump', 'ENGINE', 'Framo', '08', 'CARGO PUMPS', STANDARD_JOBS.slice(0, 3)),
    comp('Ballast Pump', 'ENGINE', 'Shin Shin', '05', 'AUXILIARY PUMPS', STANDARD_JOBS.slice(0, 3)),
    comp('Ballast Eductor', 'ENGINE', 'Shin Shin', '05', 'AUXILIARY PUMPS', STANDARD_JOBS.slice(0, 2)),
    comp('HFO Purifier', 'ENGINE', 'Alfa Laval', '04', 'PURIFIERS / OWS', STANDARD_JOBS),
    comp('LO Purifier', 'ENGINE', 'Alfa Laval', '04', 'PURIFIERS / OWS', STANDARD_JOBS),
    comp('Oily Water Separator', 'ENGINE', 'RWO', '04', 'PURIFIERS / OWS', STANDARD_JOBS),
    comp('Steering Gear', 'ENGINE', 'Nakashima', '06', 'STEERING GEAR', STANDARD_JOBS),
    comp('Cargo Heater', 'ENGINE', 'Alfa Laval', '09', 'CARGO SYSTEMS', STANDARD_JOBS.slice(0, 3)),
    comp('Tank Radar Level', 'DECK', 'Saab', '08', 'TANK MONITORING', DECK_JOBS.slice(0, 2)),
    comp('Cargo Temperature System', 'DECK', 'Yokogawa', '08', 'TANK MONITORING', DECK_JOBS.slice(0, 2)),
    comp('Deck Seal IGS (Deck)', 'DECK', 'Kashiwa', '09', 'INERT GAS SYSTEM (IGS)', DECK_JOBS),
    comp('Vapour Return Manifold', 'DECK', 'TGE', '10', 'VAPOUR RECOVERY', DECK_JOBS),
    comp('Mooring Winch Forward', 'DECK', 'Brattvaag', '02', 'MOORING WINCH & WINDLASS', DECK_JOBS),
    comp('Mooring Winch Aft', 'DECK', 'Brattvaag', '02', 'MOORING WINCH & WINDLASS', DECK_JOBS),
    comp('Fire Pumps', 'DECK', 'FIFI', '04', 'FIRE FIGHTING SYSTEMS', DECK_JOBS),
    comp('Foam System', 'DECK', 'Kidde', '04', 'FIRE FIGHTING SYSTEMS', DECK_JOBS.slice(0, 2)),
    comp('Lifeboat', 'DECK', 'Schottel', '03', 'LIFE-SAVING APPLIANCES', DECK_JOBS),
    comp('Radar', 'DECK', 'Furuno', '06', 'NAVIGATION & GMDSS', DECK_JOBS.slice(0, 2)),
    comp('ECDIS', 'DECK', 'Furuno', '06', 'NAVIGATION & GMDSS', DECK_JOBS.slice(0, 2)),
    comp('Cargo Hose Crane', 'DECK', 'IHI', '01', 'CARGO HANDLING', DECK_JOBS),
    comp('Manifold Valves', 'DECK', 'Korean Valve', '01', 'CARGO HANDLING', DECK_JOBS.slice(0, 2)),
    comp('Main Air Compressor', 'ENGINE', 'Sperre', '05', 'AUXILIARY PUMPS', STANDARD_JOBS.slice(0, 3)),
    comp('IGS Blower Fan', 'ENGINE', 'Kashiwa', '07', 'INERT GAS SYSTEM (IGS)', STANDARD_JOBS.slice(0, 2)),
    comp('Cargo Tank Cleaning Machine', 'DECK', 'Butterworth', '08', 'TANK MONITORING', DECK_JOBS.slice(0, 2)),
    comp('Emergency Generator', 'ENGINE', 'Yanmar', '02', 'AUXILIARY ENGINES / GENERATORS', STANDARD_JOBS.slice(0, 3)),
    comp('Fresh Water Generator', 'ENGINE', 'Sasakura', '05', 'AUXILIARY PUMPS', STANDARD_JOBS.slice(0, 3)),
    comp('Sewage Plant', 'ENGINE', 'Hamworthy', '05', 'AUXILIARY PUMPS', STANDARD_JOBS.slice(0, 2)),
    comp('Incinerator', 'ENGINE', 'Detegasa', '05', 'AUXILIARY PUMPS', STANDARD_JOBS.slice(0, 2)),
    comp('Main LT Cooler', 'ENGINE', 'Alfa Laval', '01', 'MAIN PROPULSION', STANDARD_JOBS.slice(0, 2)),
    comp('Windlass (Tanker)', 'DECK', 'Brattvaag', '02', 'MOORING WINCH & WINDLASS', DECK_JOBS.slice(0, 2)),
  ];
}

function containerComponents() {
  const ge = (n) => comp(`No.${n} Generator Engine`, 'ENGINE', 'Yanmar', '02', 'AUXILIARY ENGINES / GENERATORS', STANDARD_JOBS, {
    item_sort1: `No.${n} G/E`,
    item_sort2: 'GENERATOR SET',
    maker_override_key: 'GEN_ENGINE',
  });
  return [
    comp('Main Engine', 'ENGINE', 'MAN B&W', '01', 'MAIN PROPULSION', STANDARD_JOBS, { maker_override_key: 'MAIN_ENGINE' }),
    comp('Shaft Generator (if fitted)', 'ENGINE', 'ABB', '01', 'MAIN PROPULSION', STANDARD_JOBS.slice(0, 3)),
    ge(1), ge(2), ge(3), ge(4),
    comp('Auxiliary Boiler', 'ENGINE', 'Miura', '03', 'BOILERS & EXHAUST GAS ECONOMIZER', STANDARD_JOBS),
    comp('Exhaust Gas Boiler', 'ENGINE', 'Alfa Laval', '03', 'BOILERS & EXHAUST GAS ECONOMIZER', STANDARD_JOBS.slice(0, 3)),
    comp('Reefer Power Bus / Panel', 'ENGINE', 'ABB', '07', 'REEFER POWER', STANDARD_JOBS),
    comp('Reefer Compressor Plant', 'ENGINE', 'Carrier', '07', 'REEFER POWER', STANDARD_JOBS.slice(0, 3)),
    comp('Bow Thruster Motor', 'ENGINE', 'Schottel', '08', 'BOW THRUSTER', STANDARD_JOBS),
    comp('Bow Thruster CPP', 'ENGINE', 'Schottel', '08', 'BOW THRUSTER', STANDARD_JOBS.slice(0, 3)),
    comp('Steering Gear', 'ENGINE', 'Nakashima', '06', 'STEERING GEAR', STANDARD_JOBS),
    comp('HFO Purifier', 'ENGINE', 'Alfa Laval', '04', 'PURIFIERS / OWS', STANDARD_JOBS),
    comp('LO Purifier', 'ENGINE', 'Alfa Laval', '04', 'PURIFIERS / OWS', STANDARD_JOBS),
    comp('Ballast Pump', 'ENGINE', 'Shin Shin', '05', 'AUXILIARY PUMPS', STANDARD_JOBS.slice(0, 3)),
    comp('Fire Pump', 'ENGINE', 'Shin Shin', '05', 'AUXILIARY PUMPS', STANDARD_JOBS.slice(0, 3)),
    comp('Lashing Bridge Equipment', 'DECK', 'MacGregor', '07', 'CELL GUIDES & LASHING', DECK_JOBS),
    comp('Twistlock System', 'DECK', 'MacGregor', '07', 'CELL GUIDES & LASHING', DECK_JOBS.slice(0, 2)),
    comp('Cell Guide Structure', 'DECK', 'CSSC', '07', 'CELL GUIDES & LASHING', DECK_JOBS.slice(0, 2)),
    comp('Reefer Socket Panel (Deck)', 'DECK', 'ABB', '08', 'REEFER POWER SOCKETS', DECK_JOBS),
    comp('Reefer Cable Rack', 'DECK', 'ABB', '08', 'REEFER POWER SOCKETS', DECK_JOBS.slice(0, 2)),
    comp('Container Crane (Ship)', 'DECK', 'IHI', '01', 'CARGO HANDLING', DECK_JOBS),
    comp('Hatch Cover (Container)', 'DECK', 'MacGregor', '05', 'HATCH COVERS & CLOSING APPLIANCES', DECK_JOBS),
    comp('Windlass', 'DECK', 'Brattvaag', '02', 'MOORING WINCH & WINDLASS', DECK_JOBS),
    comp('Mooring Winch', 'DECK', 'Brattvaag', '02', 'MOORING WINCH & WINDLASS', DECK_JOBS.slice(0, 2)),
    comp('Lifeboat', 'DECK', 'Schottel', '03', 'LIFE-SAVING APPLIANCES', DECK_JOBS),
    comp('Fire Pumps', 'DECK', 'FIFI', '04', 'FIRE FIGHTING SYSTEMS', DECK_JOBS),
    comp('CO2 System', 'DECK', 'Kidde', '04', 'FIRE FIGHTING SYSTEMS', DECK_JOBS.slice(0, 2)),
    comp('Radar', 'DECK', 'Furuno', '06', 'NAVIGATION & GMDSS', DECK_JOBS.slice(0, 2)),
    comp('ECDIS', 'DECK', 'Furuno', '06', 'NAVIGATION & GMDSS', DECK_JOBS.slice(0, 2)),
    comp('GMDSS', 'DECK', 'Furuno', '06', 'NAVIGATION & GMDSS', DECK_JOBS.slice(0, 2)),
    comp('Deck Crane (Stores)', 'DECK', 'IHI', '01', 'CARGO HANDLING', DECK_JOBS.slice(0, 2)),
    comp('Main Air Compressor', 'ENGINE', 'Sperre', '05', 'AUXILIARY PUMPS', STANDARD_JOBS.slice(0, 3)),
    comp('Emergency Generator', 'ENGINE', 'Yanmar', '02', 'AUXILIARY ENGINES / GENERATORS', STANDARD_JOBS.slice(0, 3)),
    comp('Fresh Water Generator', 'ENGINE', 'Sasakura', '05', 'AUXILIARY PUMPS', STANDARD_JOBS.slice(0, 3)),
    comp('Sewage Plant', 'ENGINE', 'Hamworthy', '05', 'AUXILIARY PUMPS', STANDARD_JOBS.slice(0, 2)),
    comp('Incinerator', 'ENGINE', 'Detegasa', '05', 'AUXILIARY PUMPS', STANDARD_JOBS.slice(0, 2)),
    comp('Oily Water Separator', 'ENGINE', 'RWO', '04', 'PURIFIERS / OWS', STANDARD_JOBS.slice(0, 3)),
    comp('Hydraulic Power Pack (Deck)', 'DECK', 'Rexroth', '01', 'CARGO HANDLING', DECK_JOBS.slice(0, 2)),
    comp('Anchor Windlass Motor', 'DECK', 'Brattvaag', '02', 'MOORING WINCH & WINDLASS', DECK_JOBS.slice(0, 2)),
  ];
}

const doc = {
  version: 1,
  updated_at: new Date().toISOString().slice(0, 10),
  taxonomy_note: 'Baseline machinery trees aligned with JIS/DIN/ISO machinery groups and ClassNK PMS practice.',
  maker_options: {
    MAIN_ENGINE: ['MAN', 'Yanmar', 'Daihatsu', 'WinGD'],
    GEN_ENGINE: ['MAN', 'Yanmar', 'Daihatsu', 'WinGD'],
  },
  archetypes: {
    BULK_CARRIER: {
      key: 'BULK_CARRIER',
      label: 'Bulk Carrier',
      description: 'Dry bulk — hatch covers, deck cranes, windlass, standard engine room.',
      machinery_profile: 'bulker',
      icon: 'bulk',
      components: bulkCarrierComponents(),
    },
    OIL_TANKER: {
      key: 'OIL_TANKER',
      label: 'Oil Tanker',
      description: 'Crude/product tanker — IGS, COP, ballast, high-capacity boiler.',
      machinery_profile: 'tanker_chemical',
      icon: 'tanker',
      components: oilTankerComponents(),
    },
    CONTAINER: {
      key: 'CONTAINER',
      label: 'Container Ship',
      description: 'Cell guides, reefer power, 4× G/E, bow thruster.',
      machinery_profile: 'container',
      icon: 'container',
      components: containerComponents(),
    },
  },
};

for (const [k, a] of Object.entries(doc.archetypes)) {
  const n = a.components.length;
  if (n < 40) throw new Error(`${k} has only ${n} components (need 40+)`);
}

writeFileSync(OUT, JSON.stringify(doc, null, 2) + '\n', 'utf8');
for (const [k, a] of Object.entries(doc.archetypes)) {
  const jobs = a.components.reduce((s, c) => s + c.jobs.length, 0);
  console.log(`${k}: ${a.components.length} components, ${jobs} jobs`);
}
console.log('Wrote', OUT);
