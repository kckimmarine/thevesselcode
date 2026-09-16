/**
 * Live vessel map — Leaflet for fresh coastal AIS; VesselFinder embed fallback offshore.
 */
(function (global) {
    'use strict';

    const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    const OSM_TILE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    const FRESH_MAX_AGE_MS = 24 * 60 * 60 * 1000;
    const AIS_BADGE_STALE = '📡 Coastal Beacon Awaiting Signal / In Ocean Transit';
    const AIS_BADGE_OCEAN = 'Ocean Transit • Awaiting Coastal Signal';
    const VESSELFINDER_EMBED = (imo) =>
        `https://www.vesselfinder.com/embed?imo=${encodeURIComponent(imo)}&show_track=true`;

    let _leafletPromise = null;
    let _map = null;
    let _marker = null;
    let _pollTimer = null;
    let _noteEl = null;
    let _mapEl = null;
    let _embedWrap = null;
    let _embedFrame = null;
    let _embedLink = null;
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
                        <p id="tvcVesselAisStatus" class="tvc-vessel-ais-status">${AIS_BADGE_STALE}</p>
                    </div>
                    <button type="button" class="tvc-vessel-ais-close" data-ais-close aria-label="Close map">×</button>
                </header>
                <p id="tvcVesselAisNote" class="tvc-vessel-ais-note hidden" role="note"></p>
                <div id="live-ais-map" class="tvc-vessel-ais-map" role="application" aria-label="Vessel AIS map"></div>
                <div id="tvcVesselAisEmbedWrap" class="tvc-vessel-ais-embed-wrap hidden">
                    <iframe id="tvcVesselAisEmbed" class="tvc-vessel-ais-embed" title="Vessel track embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
                    <p class="tvc-vessel-ais-embed-foot">
                        <a id="tvcVesselAisEmbedLink" class="tvc-vessel-ais-embed-link" href="#" target="_blank" rel="noopener noreferrer">Open full screen tracker in new tab ↗</a>
                    </p>
                </div>
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

    function cacheDomRefs() {
        _mapEl = document.getElementById('live-ais-map');
        _embedWrap = document.getElementById('tvcVesselAisEmbedWrap');
        _embedFrame = document.getElementById('tvcVesselAisEmbed');
        _embedLink = document.getElementById('tvcVesselAisEmbedLink');
        _noteEl = document.getElementById('tvcVesselAisNote');
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
        if (!_noteEl) cacheDomRefs();
        if (!_noteEl) return;
        if (!text) {
            _noteEl.textContent = '';
            _noteEl.classList.add('hidden');
            return;
        }
        _noteEl.textContent = text;
        _noteEl.classList.remove('hidden');
    }

    function tooltipLabel(name, sog, cog) {
        const sogText = Number.isFinite(sog) ? `${sog.toFixed(1)} kts` : '— kts';
        const cogText = Number.isFinite(cog) ? `${Math.round(cog)}°` : '—°';
        return `${name} | SOG: ${sogText} | COG: ${cogText}`;
    }

    function showLeafletView() {
        cacheDomRefs();
        _mapEl?.classList.remove('hidden');
        _embedWrap?.classList.add('hidden');
        if (_embedFrame) _embedFrame.removeAttribute('src');
    }

    function showEmbedView(imo) {
        cacheDomRefs();
        const url = VESSELFINDER_EMBED(imo);
        const fullUrl = `https://www.vesselfinder.com/vessels/details/${encodeURIComponent(imo)}`;
        _mapEl?.classList.add('hidden');
        _embedWrap?.classList.remove('hidden');
        if (_embedFrame) _embedFrame.src = url;
        if (_embedLink) {
            _embedLink.href = fullUrl;
        }
        global.requestAnimationFrame(() => _map?.invalidateSize?.());
    }

    function updateMarker(L, payload, name) {
        const lat = Number(payload.lat);
        const lon = Number(payload.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

        showLeafletView();
        if (!_mapEl) return;

        if (!_map) {
            _map = L.map(_mapEl, { zoomControl: true, attributionControl: true }).setView([lat, lon], 8);
            L.tileLayer(OSM_TILE, {
                maxZoom: 18,
                attribution: '&copy; OpenStreetMap contributors',
            }).addTo(_map);
        } else {
            _map.setView([lat, lon], Math.max(_map.getZoom(), 7));
        }

        const cog = Number(payload.cog);
        const sog = Number(payload.sog);
        const label = name || payload.name || `IMO ${payload.imo || ''}`;
        const tip = tooltipLabel(label, sog, cog);
        const popup = `<strong>${label}</strong><br>Live coastal AIS<br>Updated: ${formatTs(payload.ts)}`;

        if (_marker) {
            _marker.setLatLng([lat, lon]);
            _marker.setIcon(vesselIcon(L, cog));
            _marker.setPopupContent(popup);
            _marker.setTooltipContent(tip);
        } else {
            _marker = L.marker([lat, lon], { icon: vesselIcon(L, cog) })
                .addTo(_map)
                .bindPopup(popup)
                .bindTooltip(tip, { permanent: true, direction: 'top', offset: [0, -12], className: 'tvc-ais-map-tooltip' });
        }

        global.requestAnimationFrame(() => _map?.invalidateSize?.());
    }

    function normalizeApiPayload(data, imo) {
        if (!data || data.error === 'NO_POSITION') {
            return { fresh: false, status: AIS_BADGE_OCEAN, imo, fallback: 'vesselfinder' };
        }
        if (data.fallback === 'vesselfinder') {
            return {
                imo: data.imo || imo,
                mmsi: data.mmsi || '',
                fresh: false,
                live: false,
                fallback: 'vesselfinder',
                status: data.status || AIS_BADGE_OCEAN,
            };
        }
        if (typeof data.fresh === 'boolean') return data;
        const ageMs = signalAgeMs(data.ts || data.timestamp);
        const fresh = data.live === true || (data.fresh && ageMs < FRESH_MAX_AGE_MS);
        const ageHours = Number.isFinite(ageMs) ? Math.round(ageMs / 3600000) : null;
        if (fresh && Number.isFinite(Number(data.lat)) && Number.isFinite(Number(data.lon))) {
            return { ...data, imo: data.imo || imo, fresh: true };
        }
        const status =
            data.status ||
            (ageHours !== null && ageHours >= 100 ? AIS_BADGE_OCEAN : AIS_BADGE_STALE);
        return { imo: data.imo || imo, fresh: false, status, lastVerified: data.lastVerified };
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
    }

    function destroyMap() {
        stopPolling();
        if (_map) {
            _map.remove();
            _map = null;
        }
        _marker = null;
        if (_mapEl) _mapEl.innerHTML = '';
    }

    function applyPayload(L, payload, name, imo) {
        if (payload?.fresh && Number.isFinite(Number(payload.lat)) && Number.isFinite(Number(payload.lon))) {
            setNote('');
            setStatus(payload.live ? 'Coastal AIS stream connected' : 'Live coastal snapshot (< 24 h)');
            updateMarker(
                L,
                {
                    lat: payload.lat,
                    lon: payload.lon,
                    sog: payload.sog,
                    cog: payload.cog,
                    ts: payload.ts,
                    imo: payload.imo || imo,
                },
                name
            );
            return;
        }

        setStatus(payload?.status || AIS_BADGE_OCEAN);
        setNote(
            'No coastal AIS fix within the last 24 hours. Showing third-party track embed (may include provider branding).'
        );
        destroyMap();
        showEmbedView(imo);
    }

    async function open(options) {
        const imo = String(options?.imo || '').replace(/\D/g, '');
        const name = options?.name || '';
        const mmsi = String(options?.mmsi || '').replace(/\D/g, '');
        if (imo.length !== 7) return;

        _activeImo = imo;
        const modal = ensureModal();
        cacheDomRefs();
        const title = document.getElementById('tvcVesselAisTitle');
        if (title) title.textContent = name ? `${name} — IMO ${imo}` : `IMO ${imo}`;
        setStatus('Connecting to coastal AIS stream…');
        setNote('');
        showLeafletView();
        modal.classList.remove('hidden');
        document.body.classList.add('tvc-vessel-ais-open');

        const L = await loadLeaflet();
        destroyMap();
        if (_mapEl) {
            _map = L.map(_mapEl, { zoomControl: true, attributionControl: true }).setView([20, 0], 2);
            L.tileLayer(OSM_TILE, {
                maxZoom: 18,
                attribution: '&copy; OpenStreetMap contributors',
            }).addTo(_map);
            global.requestAnimationFrame(() => _map?.invalidateSize?.());
        }

        const payload = await fetchPosition(imo, mmsi);
        applyPayload(L, payload, name, imo);

        stopPolling();
        _pollTimer = setInterval(async () => {
            if (_activeImo !== imo) return;
            const next = await fetchPosition(imo, mmsi);
            applyPayload(L, next, name, imo);
        }, 30000);
    }

    function close() {
        _activeImo = '';
        const modal = document.getElementById('tvcVesselAisModal');
        if (modal) modal.classList.add('hidden');
        document.body.classList.remove('tvc-vessel-ais-open');
        setNote('');
        destroyMap();
        cacheDomRefs();
        if (_embedFrame) _embedFrame.removeAttribute('src');
        _embedWrap?.classList.add('hidden');
        _mapEl?.classList.remove('hidden');
    }

    global.TVC_VesselMapModal = { open, close, loadLeaflet };
})(typeof globalThis !== 'undefined' ? globalThis : window);
