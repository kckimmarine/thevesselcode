'use strict';

const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');

const SNAPSHOT_PATHS = [
    join(process.cwd(), 'public', 'data', 'fleet-ais-positions.json'),
    join(process.cwd(), 'data', 'fleet-ais-positions.json'),
];

const OVERRIDE_PATHS = [
    join(process.cwd(), 'data', 'vessel-overrides.json'),
    join(process.cwd(), 'public', 'data', 'vessel-overrides.json'),
];

const FRESH_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const AIS_BADGE_STALE =
    '📡 Coastal Beacon Awaiting Signal / In Ocean Transit';
const AIS_BADGE_OCEAN = 'Ocean Transit • Awaiting Coastal Signal';

let _overrideCache = null;

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

function loadVesselOverrides() {
    if (_overrideCache) return _overrideCache;
    for (const p of OVERRIDE_PATHS) {
        if (!existsSync(p)) continue;
        try {
            _overrideCache = JSON.parse(readFileSync(p, 'utf8'));
            return _overrideCache;
        } catch {
            /* try next */
        }
    }
    _overrideCache = {};
    return _overrideCache;
}

function overrideForImo(imo) {
    const overrides = loadVesselOverrides();
    return overrides[imo] || null;
}

function resolveMmsi(imo, queryMmsi, snapshot) {
    const fromQuery = digitsOnly(queryMmsi);
    if (fromQuery.length >= 9) return fromQuery.slice(0, 9);
    const fromSnapshot = digitsOnly(snapshot?.mmsi);
    if (fromSnapshot.length >= 9) return fromSnapshot.slice(0, 9);
    const ov = overrideForImo(imo);
    const fromOverride = digitsOnly(ov?.mmsi || ov?.s);
    if (fromOverride.length >= 9) return fromOverride.slice(0, 9);
    return fromOverride || fromQuery || '';
}

function digitsOnly(value) {
    return String(value || '').replace(/\D/g, '');
}

function signalAgeMs(ts) {
    if (!ts) return Infinity;
    const ms = Date.now() - new Date(ts).getTime();
    return Number.isFinite(ms) && ms >= 0 ? ms : Infinity;
}

function buildLiveAisResponse(position, imo) {
    const ts = position.ts || position.timestamp || new Date().toISOString();
    return {
        imo: position.imo || imo,
        mmsi: position.mmsi || '',
        name: position.name || '',
        lat: position.lat,
        lon: position.lon,
        sog: position.sog,
        cog: position.cog,
        ts,
        timestamp: ts,
        live: true,
        fresh: true,
        status: 'Coastal AIS Stream Connected',
    };
}

function buildAisResponse(base, { live = false } = {}) {
    const ageMs = signalAgeMs(base.ts || base.timestamp);
    const ageHours = Number.isFinite(ageMs) ? Math.round(ageMs / 3600000) : null;
    const fresh = live || ageMs < FRESH_MAX_AGE_MS;
    const stale = !fresh && Number.isFinite(ageMs) && ageMs !== Infinity;
    const ts = base.ts || base.timestamp || null;

    const out = {
        imo: base.imo,
        mmsi: base.mmsi || '',
        name: base.name || '',
        ts,
        timestamp: ts,
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
                ts,
            };
        }
        return out;
    }

    out.status = AIS_BADGE_STALE;
    return out;
}

function buildVesselFinderFallback({ imo, mmsi, name }) {
    return {
        imo,
        mmsi: mmsi || '',
        name: name || '',
        live: false,
        fresh: false,
        fallback: 'vesselfinder',
        status: AIS_BADGE_OCEAN,
    };
}

async function fetchAisStreamPosition({ mmsi, imo, apiKey, timeoutMs = 8000 }) {
    if (!apiKey || !mmsi) return null;
    const WebSocketImpl = globalThis.WebSocket;
    if (!WebSocketImpl) return null;

    const targetMmsi = String(mmsi);

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
                    BoundingBoxes: [[[-90, -180], [90, 180]]],
                    FiltersShipMMSI: [targetMmsi],
                    FilterMessageTypes: ['PositionReport', 'ShipStaticData'],
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
                const metaMmsi = digitsOnly(meta.MMSI || meta.mmsi || targetMmsi);
                if (metaMmsi && metaMmsi !== targetMmsi && metaImo !== imo) return;
                const ts = meta.time_utc || new Date().toISOString();
                finish({
                    imo: imo || metaImo,
                    mmsi: metaMmsi || targetMmsi,
                    name: meta.ShipName || meta.shipName || '',
                    lat: pr.Latitude,
                    lon: pr.Longitude,
                    sog: pr.Sog,
                    cog: pr.Cog,
                    ts,
                    timestamp: ts,
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

    const override = overrideForImo(imo);
    const snapshots = loadSnapshots();
    const snapshot = snapshots[imo] || null;
    const queryMmsi = digitsOnly(req.query?.mmsi || '');
    const mmsi = resolveMmsi(imo, queryMmsi, snapshot);
    const apiKey = process.env.AISSTREAM_API_KEY || '';
    const vesselName = override?.n || snapshot?.name || '';

    let position = null;
    if (apiKey && mmsi.length >= 9) {
        position = await fetchAisStreamPosition({ imo, mmsi, apiKey });
    }

    if (position && Number.isFinite(Number(position.lat)) && Number.isFinite(Number(position.lon))) {
        const ageMs = signalAgeMs(position.ts || position.timestamp);
        if (ageMs < FRESH_MAX_AGE_MS) {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(
                JSON.stringify(
                    buildLiveAisResponse(
                        { ...position, imo, name: position.name || vesselName },
                        imo
                    )
                )
            );
            return;
        }
    }

    if (snapshot) {
        const built = buildAisResponse({ ...snapshot, imo, mmsi: mmsi || snapshot.mmsi }, { live: false });
        if (built.fresh) {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(built));
            return;
        }
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(buildVesselFinderFallback({ imo, mmsi, name: vesselName })));
};
