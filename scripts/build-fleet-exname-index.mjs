#!/usr/bin/env node
/**
 * Build ex-name search tokens from public/data/fleet/fleet-profiles.json
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROFILES = join(ROOT, 'public', 'data', 'fleet', 'fleet-profiles.json');
const OUT = join(ROOT, 'public', 'data', 'fleet', 'fleet-exname-index.json');

function normalizeSearch(str) {
    return String(str || '')
        .trim()
        .normalize('NFKC')
        .replace(/[^a-zA-Z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .toLowerCase();
}

function main() {
    if (!existsSync(PROFILES)) {
        console.error('Missing', PROFILES);
        process.exit(1);
    }
    const data = JSON.parse(readFileSync(PROFILES, 'utf8'));
    const exact = {};
    const tokens = {};
    for (const [imo, profile] of Object.entries(data.vessels || {})) {
        for (const raw of profile.ex_names || []) {
            const key = normalizeSearch(raw);
            if (!key) continue;
            exact[key] = imo;
            const parts = key.split(/\s+/).filter(Boolean);
            if (!tokens[key]) tokens[key] = [];
            if (!tokens[key].includes(imo)) tokens[key].push(imo);
            for (const part of parts) {
                if (part.length < 3) continue;
                if (!tokens[part]) tokens[part] = [];
                if (!tokens[part].includes(imo)) tokens[part].push(imo);
            }
        }
    }
    writeFileSync(OUT, JSON.stringify({ v: 1, exact, tokens }, null, 0));
    console.log('OK fleet-exname-index.json', Object.keys(exact).length, 'ex-names');
}

main();
