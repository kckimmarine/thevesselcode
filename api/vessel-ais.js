'use strict';

const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');

const SNAPSHOT_PATHS = [
    join(process.cwd(), 'public', 'data', 'fleet-ais-positions.json'),
    join(process.cwd(), 'data', 'fleet-ais-positions.json'),
];

const FRESH_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const AIS_BADGE_STALE =
    '📡 Coastal Beacon Awaiting Signal / In Ocean Transit';
const AIS_BADGE_OCEAN = '📡 In Ocean Transit';

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

function signalAgeMs(ts) {
    if (!ts) return Infinity;
    const ms = Date.now() - new Date(ts).getTime();
    return Number.isFinite(ms) && ms >= 0 ? ms : Infinity;
}

function buildAisResponse(base, { live = false } = {}) {
    const ageMs = signalAgeMs(base.ts);
    const ageHours = Number.isFinite(ageMs) ? Math.round(ageMs / 3600000) : null;
    const fresh = live || ageMs < FRESH_MAX_AGE_MS;
    const stale = !fresh && Number.isFinite(ageMs) && ageMs !== Infinity;

    const out = {
        imo: base.imo,
        mmsi: base.mmsi || '',
        name: base.name || '',
        ts: base.ts || null,
        live: Boolean(live),
        fresh,
        ageHours,
        destination: base.destination || base.next_port || '',
        last_port: base.last_port || '',
        next_port: base.next_port || '',
        eta: base.eta || '',
    };

    if (fresh) {
        out.lat = base.lat;
        out.lon = base.lon;
        out.sog = base.sog;
        out.cog = base.cog;
        out.status = live ? 'Coastal AIS Stream Connected' : 'Snapshot position';
        return out;
    }

    if (stale) {
        out.status = ageHours >= 100 ? AIS_BADGE_OCEAN : AIS_BADGE_STALE;
        if (Number.isFinite(base.lat) && Number.isFinite(base.lon)) {
            out.lastVerified = {
                lat: base.lat,
                lon: base.lon,
                sog: base.sog,
                cog: base.cog,
                ts: base.ts || null,
            };
        }
        return out;
    }

    out.status = AIS_BADGE_STALE;
    return out;
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
    if (apiKey && mmsi) {
        position = await fetchAisStreamPosition({ imo, mmsi, apiKey });
    }

    if (position) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(buildAisResponse({ ...position, imo }, { live: true })));
        return;
    }

    if (snapshot) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(buildAisResponse({ ...snapshot, imo }, { live: false })));
        return;
    }

    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(
        JSON.stringify({
            imo,
            mmsi,
            fresh: false,
            status: AIS_BADGE_OCEAN,
            error: 'NO_POSITION',
        })
    );
};
