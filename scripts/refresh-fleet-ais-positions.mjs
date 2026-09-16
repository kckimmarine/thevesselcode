#!/usr/bin/env node
/**
 * Refresh AIS snapshots (AISStream when AISSTREAM_API_KEY is set).
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
    const mmsiIndexPath = join(FLEET_DIR, 'fleet-mmsi-index.json');
    if (existsSync(mmsiIndexPath)) {
        const idx = JSON.parse(readFileSync(mmsiIndexPath, 'utf8'));
        for (const imo of Object.keys(idx.imo || {})) imos.add(imo);
    }
    if (!imos.size && existsSync(join(FLEET_DIR, 'fleet-index.json'))) {
        const chunkFiles = readdirSync(FLEET_DIR).filter((f) => /^fleet-\d{2}\.json$/.test(f));
        for (const file of chunkFiles) {
            const payload = JSON.parse(readFileSync(join(FLEET_DIR, file), 'utf8'));
            for (const ship of payload.ships || []) {
                if (ship.s) imos.add(ship.i);
            }
        }
    }
    const maxTargets = Number(process.env.FLEET_AIS_MAX_TARGETS || 200);
    return [...imos].slice(0, maxTargets);
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

export async function refreshFleetAisPositions() {
    const apiKey = process.env.AISSTREAM_API_KEY || '';
    const existing = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { v: 1, positions: {} };
    const positions = { ...(existing.positions || {}) };

    const targets = loadTargetImos();
    const result = {
        ok: true,
        targets: targets.length,
        fetched: 0,
        skippedNoMmsi: 0,
        apiKeySet: Boolean(apiKey),
        warnings: [],
    };

    if (!apiKey) {
        result.warnings.push('AISSTREAM_API_KEY not set — preserving existing snapshots');
        writeFileSync(
            OUT,
            JSON.stringify({ v: 1, updated: new Date().toISOString(), positions }, null, 2)
        );
        return result;
    }

    for (const imo of targets) {
        const mmsi = loadMmsiForImo(imo);
        if (!mmsi) {
            result.skippedNoMmsi++;
            continue;
        }
        const pos = await fetchAisOnce({ imo, mmsi, apiKey });
        if (pos) {
            positions[imo] = pos;
            result.fetched++;
        }
    }

    writeFileSync(
        OUT,
        JSON.stringify({ v: 1, updated: new Date().toISOString(), positions }, null, 2)
    );
    return result;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
    refreshFleetAisPositions()
        .then((result) => {
            console.log('OK AIS refresh', JSON.stringify(result));
        })
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
}
