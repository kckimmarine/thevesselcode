/**
 * Ad-free Vessel Particulars & Registry lookup (Maritime Toolkit).
 * Backed by chunked global fleet index via TVC_FleetRegistry.
 */
(function (global) {
    'use strict';

    const AIS_SNAPSHOT_URL = '/data/fleet-ais-positions.json';
    let _aisSnapshotPromise = null;

    function esc(text) {
        return String(text ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function hasValue(value) {
        if (value === null || value === undefined) return false;
        if (typeof value === 'number') return Number.isFinite(value) && value !== 0;
        return String(value).trim().length > 0;
    }

    function formatDwt(vessel) {
        const n = Number(vessel.dwt ?? vessel.d);
        if (!n) return '';
        return `${n.toLocaleString('en-US')} MT`;
    }

    function vesselDisplay(vessel) {
        return {
            imo: vessel.imo || vessel.i,
            name: vessel.name || vessel.n,
            type: vessel.type || vessel.t,
            dwt: vessel.dwt ?? vessel.d,
            built_year: vessel.built_year ?? vessel.y,
            flag: vessel.flag || vessel.f,
            technical_manager: vessel.technical_manager || vessel.m,
            engine_model: vessel.engine_model || vessel.e,
            mmsi: vessel.mmsi || vessel.s,
            exNameMatch: vessel._exNameMatch || '',
            voyage: vessel.voyage || null,
        };
    }

    async function loadAisSnapshot() {
        if (_aisSnapshotPromise) return _aisSnapshotPromise;
        _aisSnapshotPromise = fetch(AIS_SNAPSHOT_URL)
            .then((res) => (res.ok ? res.json() : { positions: {} }))
            .catch(() => ({ positions: {} }));
        return _aisSnapshotPromise;
    }

    function mergeAisVoyage(vessel, aisEntry) {
        if (!aisEntry) return vessel.voyage || null;
        const voyage = { ...(vessel.voyage || {}) };
        if (aisEntry.last_port) voyage.last_port = aisEntry.last_port;
        if (aisEntry.next_port) voyage.next_port = aisEntry.next_port;
        if (aisEntry.destination) voyage.destination = aisEntry.destination;
        if (aisEntry.eta) voyage.eta = aisEntry.eta;
        return {
            ...voyage,
            lat: aisEntry.lat,
            lon: aisEntry.lon,
            sog: aisEntry.sog,
            cog: aisEntry.cog,
            ts: aisEntry.ts,
        };
    }

    function formatEta(iso) {
        if (!iso) return '';
        try {
            const d = new Date(iso);
            if (Number.isNaN(d.getTime())) return String(iso);
            const y = d.getUTCFullYear();
            const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
            const da = String(d.getUTCDate()).padStart(2, '0');
            const hh = String(d.getUTCHours()).padStart(2, '0');
            const mm = String(d.getUTCMinutes()).padStart(2, '0');
            return `${y}-${mo}-${da} ${hh}:${mm} UTC`;
        } catch {
            return String(iso);
        }
    }

    function formatLatLon(lat, lon) {
        const la = Number(lat);
        const lo = Number(lon);
        if (!Number.isFinite(la) || !Number.isFinite(lo)) return '';
        const latHem = la >= 0 ? 'N' : 'S';
        const lonHem = lo >= 0 ? 'E' : 'W';
        const latDeg = Math.floor(Math.abs(la));
        const latMin = ((Math.abs(la) - latDeg) * 60).toFixed(1);
        const lonDeg = Math.floor(Math.abs(lo));
        const lonMin = ((Math.abs(lo) - lonDeg) * 60).toFixed(1);
        return `Lat ${latDeg}°${latMin}' ${latHem}, Long ${lonDeg}°${lonMin}' ${lonHem}`;
    }

    function formatAgeHours(ts) {
        if (!ts) return '';
        const ms = Date.now() - new Date(ts).getTime();
        if (!Number.isFinite(ms) || ms < 0) return '';
        const hours = Math.max(1, Math.round(ms / 3600000));
        return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
    }

    function specField(label, value, wide) {
        if (!hasValue(value)) return '';
        const cls = wide ? ' tvc-vessel-lookup-field--wide' : '';
        return `<div class="tvc-vessel-lookup-field${cls}">
            <span class="tvc-vessel-lookup-field-label">${esc(label)}</span>
            <span class="tvc-vessel-lookup-value">${esc(value)}</span>
        </div>`;
    }

    function voyageRow(label, value) {
        if (!hasValue(value)) return '';
        return `<div class="tvc-vessel-voyage-row">
            <span class="tvc-vessel-voyage-label">${esc(label)}</span>
            <span class="tvc-vessel-voyage-value">${esc(value)}</span>
        </div>`;
    }

    function renderVoyageSection(voyage) {
        if (!voyage) return '';
        const speedCourse = (Number.isFinite(Number(voyage.sog)) || Number.isFinite(Number(voyage.cog)))
            ? `${Number.isFinite(Number(voyage.sog)) ? Number(voyage.sog).toFixed(1) : '—'} kts / ${Number.isFinite(Number(voyage.cog)) ? Math.round(Number(voyage.cog)) : '—'}°`
            : '';
        const position = formatLatLon(voyage.lat, voyage.lon);
        const lastSeen = formatAgeHours(voyage.ts);
        const rows = [
            voyageRow('Last port', voyage.last_port),
            voyageRow('Next port / destination', voyage.destination || voyage.next_port),
            voyageRow('ETA', formatEta(voyage.eta)),
            voyageRow('Speed & course', speedCourse),
            voyageRow('Recent position', position),
            lastSeen && position
                ? `<p class="tvc-vessel-voyage-seen">Last seen: ${esc(lastSeen)}</p>`
                : '',
        ].filter(Boolean).join('');
        if (!rows) return '';
        return `<section class="tvc-vessel-voyage-panel" aria-label="Live voyage status">
            <h4 class="tvc-vessel-voyage-title">Live voyage status</h4>
            ${rows}
        </section>`;
    }

    function renderVesselCard(vessel, aisByImo) {
        const v = vesselDisplay(vessel);
        const aisEntry = aisByImo?.[v.imo];
        const voyage = mergeAisVoyage(vessel, aisEntry);
        const dwtText = formatDwt(v);
        const exBadge = v.exNameMatch
            ? `<span class="tvc-vessel-exname-badge">(Ex: ${esc(v.exNameMatch)})</span>`
            : '';

        const specs = [
            specField('Technical manager', v.technical_manager),
            specField('DWT', dwtText),
            specField('Built year', v.built_year),
            specField('Main engine', v.engine_model, true),
        ].filter(Boolean).join('');

        const typeLine = hasValue(v.type) ? esc(v.type) : '';

        return `<article class="tvc-vessel-lookup-card" data-vessel-imo="${esc(v.imo)}">
            <header class="tvc-vessel-lookup-card-head">
                <h3 class="tvc-vessel-lookup-card-name">${esc(v.name)} ${exBadge}</h3>
                <p class="tvc-vessel-lookup-card-meta">
                    <span class="tvc-vessel-lookup-flag">${esc(v.flag || '')}</span>
                    ${v.flag ? '<span class="tvc-vessel-lookup-sep" aria-hidden="true">·</span>' : ''}
                    <span>IMO ${esc(v.imo)}</span>
                    ${typeLine ? `<span class="tvc-vessel-lookup-sep" aria-hidden="true">·</span><span>${typeLine}</span>` : ''}
                </p>
            </header>
            ${specs ? `<div class="tvc-vessel-lookup-grid" aria-label="Technical particulars">${specs}</div>` : ''}
            ${renderVoyageSection(voyage)}
            <div class="tvc-vessel-lookup-actions tvc-vessel-lookup-actions--single">
                <button type="button" class="tvc-vessel-lookup-ais home-btn home-btn-primary" data-ais-imo="${esc(v.imo)}" data-ais-name="${esc(v.name)}" data-ais-mmsi="${esc(v.mmsi || '')}">🗺️ View Live Position</button>
            </div>
        </article>`;
    }

    function openAisModal(imo, name, mmsi) {
        const MapModal = global.TVC_VesselMapModal;
        if (MapModal?.open) {
            MapModal.open({ imo, name, mmsi });
            return;
        }
        console.warn('[VesselLookup] TVC_VesselMapModal unavailable');
    }

    function closeAisModal() {
        global.TVC_VesselMapModal?.close?.();
    }

    async function renderResults(container, vessels, message) {
        if (!container) return;
        if (!vessels.length) {
            container.classList.remove('hidden');
            container.innerHTML = message
                ? `<p class="tvc-vessel-lookup-empty">${esc(message)}</p>`
                : '';
            if (!message) container.classList.add('hidden');
            return;
        }
        const snap = await loadAisSnapshot();
        const positions = snap.positions || snap;
        container.classList.remove('hidden');
        container.innerHTML = vessels.map((v) => renderVesselCard(v, positions)).join('');
    }

    function bindResultsActions(container) {
        if (!container || container.dataset.vesselBound === '1') return;
        container.dataset.vesselBound = '1';
        container.addEventListener('click', (ev) => {
            const btn = ev.target.closest('[data-ais-imo]');
            if (!btn) return;
            openAisModal(btn.dataset.aisImo, btn.dataset.aisName, btn.dataset.aisMmsi);
        });
    }

    function init(options) {
        const Fleet = global.TVC_FleetRegistry;
        const inputId = options?.inputId || 'tvcVesselLookupInput';
        const resultsId = options?.resultsId || 'tvcVesselLookupResults';
        const input = document.getElementById(inputId);
        const results = document.getElementById(resultsId);
        if (!input || !results) return;

        bindResultsActions(results);

        const minLen = Fleet?.MIN_QUERY_LEN || 3;

        const run = () => {
            const q = input.value.trim();
            if (q.length < minLen) {
                results.classList.add('hidden');
                results.innerHTML = '';
                return;
            }

            if (!Fleet?.debouncedSearch) {
                renderResults(results, [], 'Fleet index unavailable.');
                return;
            }

            results.classList.remove('hidden');
            results.innerHTML = '<p class="tvc-vessel-lookup-empty">Searching fleet register…</p>';

            Fleet.debouncedSearch(q, (hits, err) => {
                if (err) {
                    renderResults(results, [], 'Fleet search failed. Try again.');
                    console.warn('[VesselLookup]', err);
                    return;
                }
                if (!hits.length) {
                    renderResults(results, [], 'No matching vessels in the TVC fleet register.');
                    return;
                }
                renderResults(results, hits, null);
            });
        };

        input.addEventListener('input', run);

        document.addEventListener('click', (ev) => {
            const wrap = document.getElementById('tvcVesselLookupWrap');
            if (wrap && !wrap.contains(ev.target)) {
                if (!input.value.trim()) results.classList.add('hidden');
            }
        });

        Fleet?.loadIndex?.().catch((err) => console.warn('[VesselLookup] index preload', err));

        const params = new URLSearchParams(global.location?.search || '');
        const imoParam = params.get('imo') || params.get('vessel');
        if (imoParam) {
            input.value = imoParam;
            run();
        }
    }

    const api = {
        renderVesselCard,
        init,
        openAisModal,
        closeAisModal,
    };

    global.TVC_VesselLookup = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
