'use strict';

const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');

const SNAPSHOT_PATHS = [
    join(process.cwd(), 'public', 'data', 'fleet-ais-positions.json'),
    join(process.cwd(), 'data', 'fleet-ais-positions.json'),
];

function loadSnapshots() {
    for (const p of SNAPSHOT_PATHS) {
        if (!existsSync(p)) continue;
        try {
            const data = JSON.parse(readFileSync(p, 'utf8'));
            return data.positions || data;
        } catch {
            /* try next */
        }
    }
    return {};
}

function digitsOnly(value) {
    return String(value || '').replace(/\D/g, '');
}

async function fetchAisStreamPosition({ mmsi, imo, apiKey, timeoutMs = 8000 }) {
    if (!apiKey || !mmsi) return null;
    const WebSocketImpl = globalThis.WebSocket;
    if (!WebSocketImpl) return null;

    return new Promise((resolve) => {
        let settled = false;
        const finish = (value) => {
            if (settled) return;
            settled = true;
            try {
                ws.close();
            } catch {
                /* ignore */
            }
            clearTimeout(timer);
            resolve(value);
        };

        const ws = new WebSocketImpl('wss://stream.aisstream.io/v0/stream');
        const timer = setTimeout(() => finish(null), timeoutMs);

        ws.addEventListener('open', () => {
            ws.send(
                JSON.stringify({
                    APIKey: apiKey,
                    FiltersShipMMSI: [Number(mmsi)],
                    FilterMessageTypes: ['PositionReport'],
                })
            );
        });

        ws.addEventListener('message', (event) => {
            try {
                const msg = JSON.parse(String(event.data || '{}'));
                const meta = msg?.MetaData || {};
                const pr = msg?.Message?.PositionReport;
                if (!pr) return;
                const metaImo = digitsOnly(meta.ShipId || meta.IMO || '');
                const metaMmsi = digitsOnly(meta.MMSI || meta.mmsi || mmsi);
                if (metaImo && imo && metaImo !== imo && metaMmsi !== mmsi) return;
                finish({
                    imo: imo || metaImo,
                    mmsi: metaMmsi || mmsi,
                    name: meta.ShipName || meta.shipName || '',
                    lat: pr.Latitude,
                    lon: pr.Longitude,
                    sog: pr.Sog,
                    cog: pr.Cog,
                    ts: meta.time_utc || new Date().toISOString(),
                    live: true,
                });
            } catch {
                /* ignore parse errors */
            }
        });

        ws.addEventListener('error', () => finish(null));
        ws.addEventListener('close', () => finish(null));
    });
}

module.exports = async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET') {
        res.statusCode = 405;
        res.setHeader('Allow', 'GET');
        res.end(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }));
        return;
    }

    const imo = digitsOnly(req.query?.imo || '');
    if (imo.length !== 7) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'INVALID_IMO' }));
        return;
    }

    const snapshots = loadSnapshots();
    const snapshot = snapshots[imo] || null;
    const mmsi = digitsOnly(req.query?.mmsi || snapshot?.mmsi || '');
    const apiKey = process.env.AISSTREAM_API_KEY || '';

    let position = null;
    if (apiKey) {
        position = await fetchAisStreamPosition({ imo, mmsi, apiKey });
    }

    if (position) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(
            JSON.stringify({
                ...position,
                status: 'Coastal AIS Stream Connected',
            })
        );
        return;
    }

    if (snapshot) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(
            JSON.stringify({
                ...snapshot,
                status: apiKey ? 'Awaiting Transponder Beacon' : 'Awaiting Transponder Beacon',
            })
        );
        return;
    }

    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'NO_POSITION', status: 'Awaiting Transponder Beacon' }));
};
