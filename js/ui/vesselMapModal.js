/**
 * In-house Leaflet AIS position viewer (no third-party ad embeds).
 */
(function (global) {
    'use strict';

    const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    const OSM_TILE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    const FRESH_MAX_AGE_MS = 24 * 60 * 60 * 1000;
    const AIS_BADGE_STALE = '📡 Coastal Beacon Awaiting Signal / In Ocean Transit';
    const AIS_BADGE_OCEAN = 'Ocean Transit • Awaiting Coastal Signal';

    let _leafletPromise = null;
    let _map = null;
    let _marker = null;
    let _pollTimer = null;
    let _socket = null;
    let _noteEl = null;

    function loadLeaflet() {
        if (global.L) return Promise.resolve(global.L);
        if (_leafletPromise) return _leafletPromise;
        _leafletPromise = new Promise((resolve, reject) => {
            if (!document.querySelector('link[data-tvc-leaflet]')) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = LEAFLET_CSS;
                link.setAttribute('data-tvc-leaflet', '1');
                document.head.appendChild(link);
            }
            const existing = document.querySelector('script[data-tvc-leaflet]');
            if (existing) {
                existing.addEventListener('load', () => resolve(global.L));
                existing.addEventListener('error', reject);
                return;
            }
            const script = document.createElement('script');
            script.src = LEAFLET_JS;
            script.defer = true;
            script.setAttribute('data-tvc-leaflet', '1');
            script.onload = () => resolve(global.L);
            script.onerror = reject;
            document.head.appendChild(script);
        });
        return _leafletPromise;
    }

    function ensureModal() {
        let modal = document.getElementById('tvcVesselAisModal');
        if (modal) return modal;

        modal = document.createElement('div');
        modal.id = 'tvcVesselAisModal';
        modal.className = 'tvc-vessel-ais-modal hidden';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'tvcVesselAisTitle');
        modal.innerHTML = `
            <div class="tvc-vessel-ais-backdrop" data-ais-close tabindex="-1"></div>
            <div class="tvc-vessel-ais-panel tvc-vessel-ais-panel--map">
                <header class="tvc-vessel-ais-head">
                    <div>
                        <h2 id="tvcVesselAisTitle" class="tvc-vessel-ais-title">Live position</h2>
                        <p id="tvcVesselAisStatus" class="tvc-vessel-ais-status">${AIS_BADGE_STALE}</p>
                    </div>
                    <button type="button" class="tvc-vessel-ais-close" data-ais-close aria-label="Close map">×</button>
                </header>
                <p id="tvcVesselAisNote" class="tvc-vessel-ais-note hidden" role="note"></p>
                <div id="live-ais-map" class="tvc-vessel-ais-map" role="application" aria-label="Vessel AIS map"></div>
            </div>`;
        document.body.appendChild(modal);

        modal.addEventListener('click', (ev) => {
            if (ev.target.closest('[data-ais-close]')) close();
        });
        document.addEventListener('keydown', (ev) => {
            if (ev.key === 'Escape' && !modal.classList.contains('hidden')) close();
        });

        return modal;
    }

    function vesselIcon(L, cog, stale) {
        const rotation = Number.isFinite(cog) ? cog : 0;
        const cls = stale ? 'tvc-ais-vessel-icon tvc-ais-vessel-icon--stale' : 'tvc-ais-vessel-icon';
        return L.divIcon({
            className: 'tvc-ais-vessel-icon-wrap',
            html: `<span class="${cls}" style="transform:rotate(${rotation}deg)">▲</span>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
        });
    }

    function formatTs(ts) {
        if (!ts) return '—';
        try {
            return new Date(ts).toLocaleString();
        } catch {
            return String(ts);
        }
    }

    function signalAgeMs(ts) {
        if (!ts) return Infinity;
        const ms = Date.now() - new Date(ts).getTime();
        return Number.isFinite(ms) && ms >= 0 ? ms : Infinity;
    }

    function setStatus(text) {
        const el = document.getElementById('tvcVesselAisStatus');
        if (el) el.textContent = text;
    }

    function setNote(text) {
        _noteEl = _noteEl || document.getElementById('tvcVesselAisNote');
        if (!_noteEl) return;
        if (!text) {
            _noteEl.textContent = '';
            _noteEl.classList.add('hidden');
            return;
        }
        _noteEl.textContent = text;
        _noteEl.classList.remove('hidden');
    }

    function updateMarker(L, payload, name, { stale = false } = {}) {
        const lat = Number(payload.lat);
        const lon = Number(payload.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

        const mapEl = document.getElementById('live-ais-map');
        if (!_map && mapEl) {
            _map = L.map(mapEl, { zoomControl: true, attributionControl: true }).setView([lat, lon], 8);
            L.tileLayer(OSM_TILE, {
                maxZoom: 18,
                attribution: '&copy; OpenStreetMap contributors',
            }).addTo(_map);
        } else if (_map) {
            _map.setView([lat, lon], Math.max(_map.getZoom(), 7));
        }

        const cog = Number(payload.cog);
        const sog = Number(payload.sog);
        const label = name || payload.name || `IMO ${payload.imo || ''}`;
        const dest = payload.destination || payload.next_port || '';
        const liveLine = stale
            ? 'Last verified coastal/harbor fix (not live AIS)'
            : 'Live coastal AIS position';
        const popup = `<strong>${label}</strong><br>${liveLine}<br>Speed: ${Number.isFinite(sog) ? sog.toFixed(1) : '—'} kn<br>Course: ${Number.isFinite(cog) ? cog.toFixed(0) : '—'}°${dest ? `<br>Destination: ${dest}` : ''}<br>Signal time: ${formatTs(payload.ts)}`;

        if (_marker) {
            _marker.setLatLng([lat, lon]);
            _marker.setIcon(vesselIcon(L, cog, stale));
            _marker.setPopupContent(popup);
        } else {
            _marker = L.marker([lat, lon], { icon: vesselIcon(L, cog, stale) }).addTo(_map).bindPopup(popup);
        }

        global.requestAnimationFrame(() => _map?.invalidateSize?.());
    }

    function normalizeApiPayload(data, imo) {
        if (!data || data.error === 'NO_POSITION') {
            return { fresh: false, status: AIS_BADGE_OCEAN, imo };
        }
        if (typeof data.fresh === 'boolean') return data;
        const ageMs = signalAgeMs(data.ts);
        const fresh = data.live === true || ageMs < FRESH_MAX_AGE_MS;
        const ageHours = Number.isFinite(ageMs) ? Math.round(ageMs / 3600000) : null;
        if (fresh) {
            return { ...data, imo: data.imo || imo, fresh: true };
        }
        const status =
            data.status ||
            (ageHours !== null && ageHours >= 100 ? AIS_BADGE_OCEAN : AIS_BADGE_STALE);
        const lastVerified =
            data.lastVerified ||
            (Number.isFinite(data.lat) && Number.isFinite(data.lon)
                ? { lat: data.lat, lon: data.lon, sog: data.sog, cog: data.cog, ts: data.ts }
                : null);
        return { imo: data.imo || imo, fresh: false, status, lastVerified };
    }

    async function fetchPosition(imo, mmsi) {
        const params = new URLSearchParams({ imo });
        if (mmsi) params.set('mmsi', mmsi);
        try {
            const res = await fetch(`/api/vessel-ais?${params}`);
            if (res.ok) {
                const data = await res.json();
                return normalizeApiPayload(data, imo);
            }
        } catch {
            /* static fallback */
        }
        try {
            const res = await fetch('/data/fleet-ais-positions.json');
            if (!res.ok) return null;
            const data = await res.json();
            const snap = data.positions?.[imo] || data[imo];
            if (!snap) return normalizeApiPayload({ error: 'NO_POSITION' }, imo);
            return normalizeApiPayload(snap, imo);
        } catch {
            return null;
        }
    }

    function stopPolling() {
        if (_pollTimer) {
            clearInterval(_pollTimer);
            _pollTimer = null;
        }
        if (_socket) {
            try {
                _socket.close();
            } catch {
                /* ignore */
            }
            _socket = null;
        }
    }

    function destroyMap() {
        stopPolling();
        if (_map) {
            _map.remove();
            _map = null;
        }
        _marker = null;
        const mapEl = document.getElementById('live-ais-map');
        if (mapEl) mapEl.innerHTML = '';
    }

    async function open(options) {
        const imo = String(options?.imo || '').replace(/\D/g, '');
        const name = options?.name || '';
        const mmsi = String(options?.mmsi || '').replace(/\D/g, '');
        if (imo.length !== 7) return;

        const modal = ensureModal();
        const title = document.getElementById('tvcVesselAisTitle');
        if (title) title.textContent = name ? `${name} — IMO ${imo}` : `IMO ${imo}`;
        setStatus('Connecting to coastal AIS stream…');
        setNote('');
        modal.classList.remove('hidden');
        document.body.classList.add('tvc-vessel-ais-open');

        const L = await loadLeaflet();
        destroyMap();
        const mapEl = document.getElementById('live-ais-map');
        if (mapEl) {
            _map = L.map(mapEl, { zoomControl: true, attributionControl: true }).setView([20, 0], 2);
            L.tileLayer(OSM_TILE, {
                maxZoom: 18,
                attribution: '&copy; OpenStreetMap contributors',
            }).addTo(_map);
            global.requestAnimationFrame(() => _map?.invalidateSize?.());
        }

        const applyPayload = (payload) => {
            if (!payload) {
                setStatus(AIS_BADGE_OCEAN);
                setNote('No coastal AIS fix on file. Position will appear when the vessel enters AIS coverage.');
                global.requestAnimationFrame(() => _map?.invalidateSize?.());
                return;
            }

            if (payload.fresh) {
                setNote('');
                setStatus(payload.live ? 'Coastal AIS stream connected' : 'Live coastal snapshot');
                updateMarker(
                    L,
                    {
                        lat: payload.lat,
                        lon: payload.lon,
                        sog: payload.sog,
                        cog: payload.cog,
                        ts: payload.ts,
                        destination: payload.destination,
                        next_port: payload.next_port,
                        imo: payload.imo,
                    },
                    name,
                    { stale: false }
                );
                return;
            }

            setStatus(payload.status || AIS_BADGE_STALE);
            const last = payload.lastVerified;
            if (last && Number.isFinite(Number(last.lat)) && Number.isFinite(Number(last.lon))) {
                setNote(
                    'Map shows the last verified coastal/harbor AIS fix. It is not a live open-ocean position.'
                );
                updateMarker(L, { ...last, imo: payload.imo }, name, { stale: true });
            } else {
                setNote('Awaiting the next coastal transponder signal. No verified harbor fix to plot.');
            }
        };

        const payload = await fetchPosition(imo, mmsi);
        applyPayload(payload);

        _pollTimer = setInterval(async () => {
            const next = await fetchPosition(imo, mmsi);
            applyPayload(next);
        }, 30000);
    }

    function close() {
        const modal = document.getElementById('tvcVesselAisModal');
        if (modal) modal.classList.add('hidden');
        document.body.classList.remove('tvc-vessel-ais-open');
        setNote('');
        destroyMap();
    }

    global.TVC_VesselMapModal = { open, close, loadLeaflet };
})(typeof globalThis !== 'undefined' ? globalThis : window);
