/**
 * In-house Leaflet AIS position viewer (no third-party ad embeds).
 */
(function (global) {
    'use strict';

    const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    const OSM_TILE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    let _leafletPromise = null;
    let _map = null;
    let _marker = null;
    let _pollTimer = null;
    let _socket = null;

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
                        <p id="tvcVesselAisStatus" class="tvc-vessel-ais-status">Awaiting Transponder Beacon</p>
                    </div>
                    <button type="button" class="tvc-vessel-ais-close" data-ais-close aria-label="Close map">×</button>
                </header>
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

    function vesselIcon(L, cog) {
        const rotation = Number.isFinite(cog) ? cog : 0;
        return L.divIcon({
            className: 'tvc-ais-vessel-icon-wrap',
            html: `<span class="tvc-ais-vessel-icon" style="transform:rotate(${rotation}deg)">▲</span>`,
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

    function setStatus(text) {
        const el = document.getElementById('tvcVesselAisStatus');
        if (el) el.textContent = text;
    }

    function updateMarker(L, payload, name) {
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
        const popup = `<strong>${label}</strong><br>Speed: ${Number.isFinite(sog) ? sog.toFixed(1) : '—'} kn<br>Course: ${Number.isFinite(cog) ? cog.toFixed(0) : '—'}°${dest ? `<br>Destination: ${dest}` : ''}<br>Last received: ${formatTs(payload.ts)}`;

        if (_marker) {
            _marker.setLatLng([lat, lon]);
            _marker.setIcon(vesselIcon(L, cog));
            _marker.setPopupContent(popup);
        } else {
            _marker = L.marker([lat, lon], { icon: vesselIcon(L, cog) }).addTo(_map).bindPopup(popup);
        }

        global.requestAnimationFrame(() => _map?.invalidateSize?.());
    }

    async function fetchPosition(imo, mmsi) {
        const params = new URLSearchParams({ imo });
        if (mmsi) params.set('mmsi', mmsi);
        const urls = [`/api/vessel-ais?${params}`, `/data/fleet-ais-positions.json`];
        for (const url of urls) {
            try {
                const res = await fetch(url);
                if (!res.ok) continue;
                const data = await res.json();
                if (url.endsWith('fleet-ais-positions.json')) {
                    const snap = data.positions?.[imo] || data[imo];
                    if (snap) {
                        return { ...snap, status: 'Awaiting Transponder Beacon' };
                    }
                    continue;
                }
                return data;
            } catch {
                /* try fallback */
            }
        }
        return null;
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
            if (!payload || !Number.isFinite(Number(payload.lat)) || !Number.isFinite(Number(payload.lon))) {
                setStatus('Awaiting Transponder Beacon');
                global.requestAnimationFrame(() => _map?.invalidateSize?.());
                return;
            }
            const ageMs = payload.ts ? Date.now() - new Date(payload.ts).getTime() : 0;
            const ageHours = ageMs > 0 ? Math.round(ageMs / 3600000) : null;
            let status = payload.status || (payload.live ? 'Coastal AIS Stream Connected' : 'Snapshot position');
            if (ageHours !== null && !payload.live) {
                status = `Snapshot position · ${ageHours}h old`;
            }
            setStatus(status);
            updateMarker(L, payload, name);
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
        destroyMap();
    }

    global.TVC_VesselMapModal = { open, close, loadLeaflet };
})(typeof globalThis !== 'undefined' ? globalThis : window);
