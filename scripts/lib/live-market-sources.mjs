/**
 * Live bunker + freight benchmarks (OilPriceAPI).
 * Bunker: /v1/prices/marine-fuels/latest (public) + optional per-port codes with API key.
 * Indices: /v1/prices/latest?by_code=… (requires OILPRICE_API_KEY).
 */
const MARINE_LATEST_URL = 'https://api.oilpriceapi.com/v1/prices/marine-fuels/latest';
const PRICES_LATEST_URL = 'https://api.oilpriceapi.com/v1/prices/latest';

export const BUNKER_HUBS = [
    { port: 'Singapore', portCode: 'SGSIN' },
    { port: 'Rotterdam', portCode: 'NLRTM' },
    { port: 'Busan', portCode: 'KRPUS', keySuffix: 'KRPUS' },
    { port: 'Houston', portCode: 'USHOU' },
];

export const BUNKER_GRADES = [
    { gradeKey: 'VLSFO', gradeLabel: 'VLSFO', fuel: 'VLSFO', defaultDensity: 991, fuelType: 'VLSFO', codeSuffix: 'VLSFO' },
    { gradeKey: 'LSMGO', gradeLabel: 'LSMGO', fuel: 'LSMGO', defaultDensity: 850, fuelType: 'MGO_05S', codeSuffix: 'MGO_05S' },
    { gradeKey: 'HSFO380', gradeLabel: 'HSFO 380', fuel: 'HSFO', defaultDensity: 991, fuelType: 'HFO_380', codeSuffix: 'HFO_380' },
];

/** OilPriceAPI-documented Baltic codes (fetch per-code; invalid codes are skipped). */
export const FREIGHT_INDEX_CODES = {
    bdi: { apiCode: 'BALTIC_DRY_INDEX', unit: 'pts' },
    capesizeTc: { apiCode: 'BALTIC_CAPESIZE_INDEX', unit: 'pts' },
    panamaxTc: { apiCode: 'BALTIC_PANAMAX_INDEX', unit: 'pts', optional: true },
    bdti: { apiCode: 'BALTIC_DIRTY_TANKER_INDEX', unit: 'pts', optional: true },
    bcti: { apiCode: 'BALTIC_CLEAN_TANKER_INDEX', unit: 'pts', optional: true },
};

const FETCH_TIMEOUT_MS = 15_000;

function pctChange(current, previous, priorQuote) {
    if (priorQuote && priorQuote.provider !== 'OilPriceAPI' && priorQuote.source !== 'market_reporting') {
        return 0;
    }
    if (previous == null || !Number.isFinite(previous) || previous === 0) return 0;
    const pct = Math.round(((current - previous) / previous) * 10000) / 100;
    if (Math.abs(pct) > 15) return 0;
    return pct;
}

export async function fetchJson(url, { headers = {} } = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
        const res = await fetch(url, {
            signal: ctrl.signal,
            headers: {
                'User-Agent': 'TVC-MarketFeed/2.0 (+https://thevesselcode.com)',
                Accept: 'application/json',
                ...headers,
            },
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
            const msg = json?.error?.message || json?.message?.body || `HTTP ${res.status}`;
            throw new Error(msg);
        }
        return json;
    } finally {
        clearTimeout(timer);
    }
}

function normalizeLatestPrices(json) {
    if (!json || json.status === 'error') return [];
    const raw = json?.data?.prices ?? json?.data;
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === 'object' && raw.price != null) {
        return [{ ...raw, code: raw.code || raw.commodity_code }];
    }
    return [];
}

async function fetchLatestByCode(apiKey, code) {
    const url = `${PRICES_LATEST_URL}?by_code=${encodeURIComponent(code)}`;
    const json = await fetchJson(url, {
        headers: { Authorization: `Token ${apiKey}` },
    });
    const list = normalizeLatestPrices(json);
    return list.find((p) => p.code === code) || list[0] || null;
}

async function fetchLatestByCodes(apiKey, codes) {
    const prices = new Map();
    const errors = [];
    for (const code of codes) {
        try {
            const row = await fetchLatestByCode(apiKey, code);
            if (row?.price != null) prices.set(code, row);
            else errors.push(`${code}: empty response`);
        } catch (e) {
            errors.push(`${code}: ${e.message || e}`);
        }
    }
    return { prices, errors };
}

export async function fetchMarineBunkerLatest() {
    const json = await fetchJson(MARINE_LATEST_URL);
    if (json?.status !== 'success' || !Array.isArray(json?.data?.prices)) {
        throw new Error('Invalid marine-fuels/latest payload');
    }
    return json.data.prices;
}

function marinePortMap(ports) {
    const map = new Map();
    for (const row of ports) {
        map.set(String(row.port_code || '').toUpperCase(), row);
    }
    return map;
}

function fuelFromMarinePort(portRow, fuelType) {
    const fuels = portRow?.fuels || [];
    return fuels.find((f) => f.fuel_type === fuelType) || null;
}

function quoteFromFuel(port, grade, fuelRow, deltaPct) {
    return {
        port,
        gradeKey: grade.gradeKey,
        gradeLabel: grade.gradeLabel,
        fuel: grade.fuel,
        defaultDensity: grade.defaultDensity,
        priceUsdMt: Math.round(Number(fuelRow.price) * 100) / 100,
        deltaPct,
        asOf: fuelRow.as_of || fuelRow.timestamp || null,
        source: fuelRow.source || 'market_reporting',
        provider: 'OilPriceAPI',
    };
}

function previousQuoteMap(previousQuotes) {
    const map = new Map();
    for (const q of previousQuotes || []) {
        map.set(`${q.port}|${q.gradeKey}`, q);
    }
    return map;
}

function oilPriceCodeForHubGrade(hub, grade) {
    if (!hub.keySuffix) return null;
    return `${grade.codeSuffix}_${hub.keySuffix}_USD`;
}

export function buildBunkerQuotesFromMarine(ports, previousQuotes = []) {
    const byPort = marinePortMap(ports);
    const prev = previousQuoteMap(previousQuotes);
    const quotes = [];
    const asOfDates = [];

    for (const hub of BUNKER_HUBS) {
        const row = byPort.get(hub.portCode);
        if (!row) continue;
        for (const grade of BUNKER_GRADES) {
            const fuelRow = fuelFromMarinePort(row, grade.fuelType);
            if (!fuelRow || fuelRow.price == null) continue;
            const key = `${hub.port}|${grade.gradeKey}`;
            const prior = prev.get(key);
            const deltaPct = pctChange(Number(fuelRow.price), prior?.priceUsdMt, prior);
            quotes.push(quoteFromFuel(hub.port, grade, fuelRow, deltaPct));
            if (fuelRow.as_of) asOfDates.push(String(fuelRow.as_of).slice(0, 10));
        }
    }

    return { quotes, asOfDates };
}

export async function fetchBunkerQuotesByApiKey(apiKey, previousQuotes = []) {
    const codes = [];
    for (const hub of BUNKER_HUBS) {
        if (!hub.keySuffix) continue;
        for (const grade of BUNKER_GRADES) {
            const code = oilPriceCodeForHubGrade(hub, grade);
            if (code) codes.push({ hub, grade, code });
        }
    }
    if (!codes.length) return { quotes: [], asOfDates: [], errors: [] };

    const { prices: byApiCode, errors } = await fetchLatestByCodes(
        apiKey,
        codes.map((c) => c.code),
    );
    const prev = previousQuoteMap(previousQuotes);
    const quotes = [];
    const asOfDates = [];

    for (const { hub, grade, code } of codes) {
        const p = byApiCode.get(code);
        if (!p || p.price == null) continue;
        const key = `${hub.port}|${grade.gradeKey}`;
        const prior = prev.get(key);
        const deltaPct =
            p.change_24h != null && Number.isFinite(Number(p.change_24h))
                ? Math.round(Number(p.change_24h) * 100) / 100
                : pctChange(Number(p.price), prior?.priceUsdMt, prior);
        const fuelRow = {
            price: p.price,
            as_of: p.updated_at || p.as_of,
            source: p.source || 'OilPriceAPI',
        };
        quotes.push(quoteFromFuel(hub.port, grade, fuelRow, deltaPct));
        if (fuelRow.as_of) asOfDates.push(String(fuelRow.as_of).slice(0, 10));
    }

    return { quotes, asOfDates, errors };
}

export async function fetchFreightIndices(apiKey, previousIndices = {}) {
    const apiCodes = Object.values(FREIGHT_INDEX_CODES).map((x) => x.apiCode);
    const { prices: byCode, errors } = await fetchLatestByCodes(apiKey, apiCodes);

    const indices = {};
    const asOfDates = [];

    for (const [key, spec] of Object.entries(FREIGHT_INDEX_CODES)) {
        const p = byCode.get(spec.apiCode);
        if (!p || p.price == null) {
            if (previousIndices[key]?.value != null) indices[key] = previousIndices[key];
            continue;
        }
        const value = Math.round(Number(p.price));
        let deltaPct = 0;
        if (p.change_24h != null && Number.isFinite(Number(p.change_24h))) {
            deltaPct = Math.round(Number(p.change_24h) * 100) / 100;
        } else {
            const prevVal = previousIndices[key]?.value;
            deltaPct = pctChange(value, prevVal);
        }
        indices[key] = {
            value,
            deltaPct,
            unit: spec.unit,
            source: p.source || 'Baltic Exchange via OilPriceAPI',
            asOf: p.updated_at || null,
        };
        if (indices[key].asOf) asOfDates.push(String(indices[key].asOf).slice(0, 10));
    }

    return { indices, asOfDates, errors };
}

export function mergeBunkerQuotes(primary, supplemental) {
    const map = new Map();
    for (const q of primary) map.set(`${q.port}|${q.gradeKey}`, q);
    for (const q of supplemental) {
        const k = `${q.port}|${q.gradeKey}`;
        if (!map.has(k)) map.set(k, q);
    }
    return [...map.values()];
}

export function pickBenchmarkAsOf(...dateLists) {
    const flat = dateLists.flat().filter(Boolean);
    if (!flat.length) return new Date().toISOString().slice(0, 10);
    return flat.sort().at(-1);
}
