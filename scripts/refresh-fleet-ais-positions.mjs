#!/usr/bin/env node
/**
 * Refresh coastal AIS snapshots (requires AISSTREAM_API_KEY).
 * Usage: AISSTREAM_API_KEY=... node scripts/refresh-fleet-ais-positions.mjs
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'data', 'fleet-ais-positions.json');
const FLEET_DIR = join(ROOT, 'public', 'data', 'fleet');

function digitsOnly(v) {
    return String(v || '').replace(/\D/g, '');
}

function loadTargetImos() {
    const imos = new Set();
    for (const rel of ['data/fleet-enrichment.json', 'data/fleet-registry-enrichment.json']) {
        const path = join(ROOT, rel);
        if (!existsSync(path)) continue;
        const data = JSON.parse(readFileSync(path, 'utf8'));
        for (const v of data.vessels || []) {
            const imo = digitsOnly(v.imo);
            if (imo.length === 7) imos.add(imo);
        }
    }
    const mmsiIndexPath = join(FLEET_DIR, 'fleet-mmsi-index.json');
    if (existsSync(mmsiIndexPath)) {
        const idx = JSON.parse(readFileSync(mmsiIndexPath, 'utf8'));
        for (const imo of Object.keys(idx.imo || {})) imos.add(imo);
    }
    return [...imos];
}

function loadMmsiForImo(imo) {
    const mmsiIndexPath = join(FLEET_DIR, 'fleet-mmsi-index.json');
    if (existsSync(mmsiIndexPath)) {
        const idx = JSON.parse(readFileSync(mmsiIndexPath, 'utf8'));
        if (idx.imo?.[imo]) return digitsOnly(idx.imo[imo]);
    }
    const indexPath = join(FLEET_DIR, 'fleet-index.json');
    if (!existsSync(indexPath)) return '';
    const index = JSON.parse(readFileSync(indexPath, 'utf8'));
    const part = index.imo?.[imo];
    if (!part) return '';
    const chunkPath = join(FLEET_DIR, `fleet-${part}.json`);
    if (!existsSync(chunkPath)) return '';
    const chunk = JSON.parse(readFileSync(chunkPath, 'utf8'));
    const ship = (chunk.ships || []).find((s) => s.i === imo);
    return digitsOnly(ship?.s);
}

async function fetchAisOnce({ imo, mmsi, apiKey, timeoutMs = 14000 }) {
    const WebSocket = globalThis.WebSocket;
    if (!WebSocket) throw new Error('WebSocket unavailable in this Node runtime');

    return new Promise((resolve) => {
        let settled = false;
        const finish = (val) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            try {
                ws.close();
            } catch {
                /* ignore */
            }
            resolve(val);
        };

        const ws = new WebSocket('wss://stream.aisstream.io/v0/stream');
        const timer = setTimeout(() => finish(null), timeoutMs);

        ws.addEventListener('open', () => {
            const sub = {
                APIKey: apiKey,
                BoundingBoxes: [[[-90, -180], [90, 180]]],
                FilterMessageTypes: ['PositionReport'],
            };
            if (mmsi) sub.FiltersShipMMSI = [String(mmsi)];
            ws.send(JSON.stringify(sub));
        });

        ws.addEventListener('message', (ev) => {
            try {
                const msg = JSON.parse(String(ev.data || '{}'));
                const meta = msg?.MetaData || {};
                const pr = msg?.Message?.PositionReport;
                if (!pr) return;
                const metaImo = digitsOnly(meta.ShipId || meta.IMO || '');
                const metaMmsi = digitsOnly(meta.MMSI || meta.mmsi || '');
                if (mmsi && metaMmsi && metaMmsi !== mmsi) return;
                if (!mmsi && metaImo && metaImo !== imo) return;
                finish({
                    imo,
                    mmsi: metaMmsi || mmsi,
                    name: meta.ShipName || '',
                    lat: pr.Latitude,
                    lon: pr.Longitude,
                    sog: pr.Sog,
                    cog: pr.Cog,
                    ts: meta.time_utc || new Date().toISOString(),
                    source: 'aisstream-live',
                });
            } catch {
                /* ignore */
            }
        });

        ws.addEventListener('error', () => finish(null));
        ws.addEventListener('close', () => finish(null));
    });
}

async function main() {
    const apiKey = process.env.AISSTREAM_API_KEY || '';
    const existing = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { v: 1, positions: {} };
    const positions = { ...(existing.positions || {}) };

    const targets = loadTargetImos();
    console.log('Targets', targets.length);

    if (!apiKey) {
        console.warn('WARN AISSTREAM_API_KEY not set — keeping existing snapshots only');
        writeFileSync(
            OUT,
            JSON.stringify({ v: 1, updated: new Date().toISOString(), positions }, null, 2)
        );
        return;
    }

    for (const imo of targets) {
        const mmsi = loadMmsiForImo(imo);
        if (!mmsi) {
            console.warn('SKIP', imo, 'no MMSI');
            continue;
        }
        console.log('FETCH', imo, 'MMSI', mmsi);
        const pos = await fetchAisOnce({ imo, mmsi, apiKey });
        if (pos) {
            positions[imo] = pos;
            console.log('OK', imo, pos.lat, pos.lon, pos.ts);
        } else {
            console.warn('NO SIGNAL', imo);
        }
    }

    writeFileSync(
        OUT,
        JSON.stringify({ v: 1, updated: new Date().toISOString(), positions }, null, 2)
    );
    console.log('OK wrote', OUT);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
