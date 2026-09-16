/**
 * In-house Leaflet AIS position viewer (no third-party ad embeds).
 */
(function (global) {
    'use strict';

    const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    const OSM_TILE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    const POLL_MS = 8000;

    let _leafletPromise = null;
    let _map = null;
    let _marker = null;
    let _pollTimer = null;
    let _activeImo = '';

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
                        <p id="tvcVesselAisStatus" class="tvc-vessel-ais-status">Connecting…</p>
                    </div>
                    <button type="button" class="tvc-vessel-ais-close" data-ais-close aria-label="Close map">×</button>
                </header>
                <p id="tvcVesselAisHint" class="tvc-vessel-ais-note hidden"></p>
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

    function waitForModalPaint() {
        return new Promise((resolve) => {
            global.requestAnimationFrame(() => global.requestAnimationFrame(resolve));
        });
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

    function setHint(text) {
        const el = document.getElementById('tvcVesselAisHint');
        if (!el) return;
        if (!text) {
            el.classList.add('hidden');
            el.textContent = '';
            return;
        }
        el.classList.remove('hidden');
        el.textContent = text;
    }

    function ensureBaseMap(L, lat, lon, zoom) {
        const mapEl = document.getElementById('live-ais-map');
        if (!mapEl) return;
        const viewLat = Number.isFinite(lat) ? lat : 20;
        const viewLon = Number.isFinite(lon) ? lon : 0;
        const viewZoom = zoom || 3;
        if (!_map) {
            _map = L.map(mapEl, { zoomControl: true, attributionControl: true }).setView([viewLat, viewLon], viewZoom);
            L.tileLayer(OSM_TILE, {
                maxZoom: 18,
                attribution: '&copy; OpenStreetMap contributors',
            }).addTo(_map);
        } else {
            _map.setView([viewLat, viewLon], viewZoom);
        }
        global.requestAnimationFrame(() => _map?.invalidateSize?.());
    }

    function updateMarker(L, payload, name) {
        const lat = Number(payload.lat);
        const lon = Number(payload.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;

        ensureBaseMap(L, lat, lon, 8);

        const cog = Number(payload.cog);
        const sog = Number(payload.sog);
        const label = name || payload.name || `IMO ${payload.imo || ''}`;
        const popup = `<strong>${label}</strong><br>Speed: ${Number.isFinite(sog) ? sog.toFixed(1) : '—'} kn<br>Course: ${Number.isFinite(cog) ? cog.toFixed(0) : '—'}°<br>Last received: ${formatTs(payload.ts)}`;

        if (_marker) {
            _marker.setLatLng([lat, lon]);
            _marker.setIcon(vesselIcon(L, cog));
            _marker.setPopupContent(popup);
        } else {
            _marker = L.marker([lat, lon], { icon: vesselIcon(L, cog) }).addTo(_map).bindPopup(popup).openPopup();
        }
        global.requestAnimationFrame(() => _map?.invalidateSize?.());
        return true;
    }

    async function resolveMmsi(imo, mmsi) {
        const clean = String(mmsi || '').replace(/\D/g, '');
        if (clean) return clean;
        const Fleet = global.TVC_FleetRegistry;
        if (!Fleet?.getVesselByImo) return '';
        try {
            const v = await Fleet.getVesselByImo(imo);
            return String(v?.mmsi || v?.s || '').replace(/\D/g, '');
        } catch {
            return '';
        }
    }

    async function fetchPosition(imo, mmsi) {
        const params = new URLSearchParams({ imo });
        if (mmsi) params.set('mmsi', mmsi);

        try {
            const res = await fetch(`/api/vessel-ais?${params}`);
            if (res.ok) return await res.json();
        } catch {
            /* static fallback */
        }

        try {
            const res = await fetch('/data/fleet-ais-positions.json');
            if (!res.ok) return null;
            const data = await res.json();
            const snap = data.positions?.[imo];
            if (!snap) return null;
            const ageHours = snap.ts ? (Date.now() - Date.parse(snap.ts)) / (1000 * 60 * 60) : null;
            return {
                ...snap,
                live: false,
                ageHours,
                status: ageHours !== null && ageHours <= 6
                    ? 'Coastal AIS Stream Connected'
                    : ageHours !== null
                        ? `Snapshot position · ${Math.round(ageHours / 24)}d old`
                        : 'Awaiting Transponder Beacon',
            };
        } catch {
            return null;
        }
    }

    function stopPolling() {
        if (_pollTimer) {
            clearInterval(_pollTimer);
            _pollTimer = null;
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
        let mmsi = String(options?.mmsi || '').replace(/\D/g, '');
        if (imo.length !== 7) return;

        _activeImo = imo;
        const modal = ensureModal();
        const title = document.getElementById('tvcVesselAisTitle');
        if (title) title.textContent = name ? `${name} — IMO ${imo}` : `IMO ${imo}`;
        setStatus('Connecting to coastal AIS stream…');
        setHint('');
        modal.classList.remove('hidden');
        document.body.classList.add('tvc-vessel-ais-open');

        await waitForModalPaint();
        const L = await loadLeaflet();
        destroyMap();
        ensureBaseMap(L, 20, 0, 2);

        mmsi = await resolveMmsi(imo, mmsi);

        const applyPayload = (payload) => {
            if (!payload || _activeImo !== imo) return;
            setStatus(payload.status || (payload.live ? 'Coastal AIS Stream Connected' : 'Awaiting Transponder Beacon'));
            const placed = updateMarker(L, payload, name);
            if (!placed) {
                setHint('No recent AIS position for this vessel. Set AISSTREAM_API_KEY on the server for live coastal feed.');
                ensureBaseMap(L, 20, 0, 2);
            } else if (payload.live === false && payload.ageHours > 48) {
                setHint('Showing last known coastal snapshot. Live feed requires AISSTREAM_API_KEY or a recent AIS report.');
            } else {
                setHint('');
            }
        };

        const tick = async () => {
            const payload = await fetchPosition(imo, mmsi);
            applyPayload(payload);
        };

        await tick();
        _pollTimer = setInterval(tick, POLL_MS);
    }

    function close() {
        _activeImo = '';
        const modal = document.getElementById('tvcVesselAisModal');
        if (modal) modal.classList.add('hidden');
        document.body.classList.remove('tvc-vessel-ais-open');
        setHint('');
        destroyMap();
    }

    global.TVC_VesselMapModal = { open, close, loadLeaflet };
})(typeof globalThis !== 'undefined' ? globalThis : window);
