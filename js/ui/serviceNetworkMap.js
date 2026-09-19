/**
 * Global Operational Hubs — enterprise dark maritime network map (Leaflet + CartoDB Dark).
 */
(function (global) {
    'use strict';

    const LEAFLET_CSS = '/vendor/leaflet/leaflet.css';
    const LEAFLET_JS = '/vendor/leaflet/leaflet.js';
    const DARK_TILE = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    const WA_BASE = 'https://wa.me/821038894291?text=';

    /** @type {Promise<typeof L>|null} */
    let _leafletPromise = null;
    /** @type {import('leaflet').Map|null} */
    let _map = null;

    const HUBS = [
        {
            id: 'busan',
            name: 'Busan',
            portLabel: 'Busan HQ',
            country: 'Republic of Korea',
            flag: '🇰🇷',
            lat: 35.1028,
            lng: 129.0403,
            hq: true,
            capabilities: ['IMPA / stores RFQ dispatch', 'TVC-SM fleet onboarding', 'Class & dry-dock oversight'],
        },
        {
            id: 'singapore',
            name: 'Singapore',
            portLabel: 'Singapore',
            country: 'Singapore',
            flag: '🇸🇬',
            lat: 1.2902,
            lng: 103.8519,
            capabilities: ['Straits bunkering & lube support', 'Stores consolidation hub', 'PSC prep liaison'],
        },
        {
            id: 'shanghai',
            name: 'Shanghai / Ningbo',
            portLabel: 'Shanghai / Ningbo',
            country: 'China',
            flag: '🇨🇳',
            lat: 31.2304,
            lng: 121.4737,
            capabilities: ['Yard & dry-dock coordination', 'Critical spares expediting', 'MRO technical survey'],
        },
        {
            id: 'rotterdam',
            name: 'Rotterdam',
            portLabel: 'Rotterdam',
            country: 'Netherlands',
            flag: '🇳🇱',
            lat: 51.9244,
            lng: 4.4777,
            capabilities: ['North Europe stores hub', 'Bunker quality liaison', 'EU MRV / compliance support'],
        },
        {
            id: 'houston',
            name: 'Houston',
            portLabel: 'Houston',
            country: 'United States',
            flag: '🇺🇸',
            lat: 29.7604,
            lng: -95.3698,
            capabilities: ['Gulf of Mexico logistics', 'Offshore supply RFQ', 'Engineering superintendent cover'],
        },
        {
            id: 'panama',
            name: 'Panama Canal',
            portLabel: 'Panama Canal',
            country: 'Panama',
            flag: '🇵🇦',
            lat: 8.9824,
            lng: -79.5199,
            capabilities: ['Canal transit coordination', 'Americas routing hub', 'Stores cross-dock'],
        },
        {
            id: 'dubai',
            name: 'Dubai',
            portLabel: 'Dubai',
            country: 'United Arab Emirates',
            flag: '🇦🇪',
            lat: 25.2048,
            lng: 55.2708,
            capabilities: ['Middle East supply desk', 'Offshore crew change support', 'Lube & stores staging'],
        },
    ];

    const HUB_BY_ID = Object.fromEntries(HUBS.map((h) => [h.id, h]));

    const ROUTE_WAYPOINTS = {
        suez: { lat: 29.9668, lng: 32.5498 },
    };

    const ROUTES = [
        ['busan', 'singapore', 'dubai', 'suez', 'rotterdam'],
        ['busan', 'panama', 'houston'],
    ];

    const ROUTE_STYLE = {
        color: '#0284c7',
        weight: 1.5,
        opacity: 0.35,
        dashArray: '4, 8',
    };

    function esc(text) {
        return String(text ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function loadLeaflet() {
        if (global.L) return Promise.resolve(global.L);
        if (_leafletPromise) return _leafletPromise;
        _leafletPromise = new Promise((resolve, reject) => {
            if (!document.querySelector('link[data-tvc-leaflet-network]')) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = LEAFLET_CSS;
                link.setAttribute('data-tvc-leaflet-network', '1');
                document.head.appendChild(link);
            }
            const existing = document.querySelector('script[data-tvc-leaflet-network]');
            if (existing) {
                existing.addEventListener('load', () => resolve(global.L), { once: true });
                existing.addEventListener('error', reject, { once: true });
                return;
            }
            const script = document.createElement('script');
            script.src = LEAFLET_JS;
            script.defer = true;
            script.setAttribute('data-tvc-leaflet-network', '1');
            script.onload = () => resolve(global.L);
            script.onerror = reject;
            document.head.appendChild(script);
        });
        return _leafletPromise;
    }

    function hubIconHtml(hub) {
        const hqClass = hub.hq ? ' tvc-network-hub-marker--hq' : '';
        const hqLabel = hub.hq ? '<span class="tvc-network-hub-hq-label">HQ</span>' : '';
        return `
            <div class="tvc-network-hub-marker${hqClass}" aria-hidden="true">
                <span class="tvc-network-hub-pulse"></span>
                <span class="tvc-network-hub-core">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="5" fill="#38bdf8"/>
                        <circle cx="12" cy="12" r="9" stroke="#38bdf8" stroke-width="1.5" opacity="0.55"/>
                    </svg>
                </span>
                ${hqLabel}
            </div>`;
    }

    function hubIcon(L, hub) {
        return L.divIcon({
            className: 'tvc-network-hub-icon-wrap',
            html: hubIconHtml(hub),
            iconSize: hub.hq ? [52, 52] : [36, 36],
            iconAnchor: hub.hq ? [26, 26] : [18, 18],
            popupAnchor: [0, -20],
        });
    }

    function contactRfqUrl(portLabel) {
        const params = new URLSearchParams();
        params.set('inquiry', 'rfq');
        params.set('port', portLabel);
        return `/contact-us?${params.toString()}`;
    }

    function whatsAppUrl(portLabel) {
        const text = `Hello TVC, inquiring about supply/logistics at ${portLabel} hub.`;
        return `${WA_BASE}${encodeURIComponent(text)}`;
    }

    function popupHtml(hub) {
        const caps = (hub.capabilities || [])
            .map((c) => `<li>${esc(c)}</li>`)
            .join('');
        const portLabel = hub.portLabel || hub.name;
        return `
            <div class="tvc-network-popup-card">
                <header class="tvc-network-popup-head">
                    <span class="tvc-network-popup-flag" aria-hidden="true">${hub.flag || '🌐'}</span>
                    <div>
                        <strong class="tvc-network-popup-title">${esc(portLabel)}</strong>
                        <span class="tvc-network-popup-country">${esc(hub.country)}</span>
                    </div>
                </header>
                <p class="tvc-network-popup-cap-label">Verified capabilities</p>
                <ul class="tvc-network-popup-caps">${caps}</ul>
                <div class="tvc-network-popup-actions">
                    <a class="tvc-network-popup-rfq" href="${contactRfqUrl(portLabel)}">📋 Quick RFQ</a>
                    <a class="tvc-network-popup-wa" href="${whatsAppUrl(portLabel)}" target="_blank" rel="noopener noreferrer">🟢 WhatsApp</a>
                </div>
            </div>`;
    }

    function resolveRouteLatLng(id) {
        if (HUB_BY_ID[id]) return [HUB_BY_ID[id].lat, HUB_BY_ID[id].lng];
        if (ROUTE_WAYPOINTS[id]) {
            const w = ROUTE_WAYPOINTS[id];
            return [w.lat, w.lng];
        }
        return null;
    }

    function buildMap(L, container) {
        if (_map) {
            _map.remove();
            _map = null;
        }

        const map = L.map(container, {
            center: [20, 0],
            zoom: 2.2,
            minZoom: 2,
            maxZoom: 8,
            worldCopyJump: true,
            scrollWheelZoom: false,
            zoomControl: true,
            attributionControl: true,
        });

        L.tileLayer(DARK_TILE, {
            subdomains: 'abcd',
            maxZoom: 8,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        }).addTo(map);

        map.on('click', () => {
            if (!map.scrollWheelZoom.enabled()) {
                map.scrollWheelZoom.enable();
            }
        });

        const canvasRenderer = L.canvas({ padding: 0.5 });
        ROUTES.forEach((ids) => {
            const latlngs = ids.map(resolveRouteLatLng).filter(Boolean);
            if (latlngs.length < 2) return;
            L.polyline(latlngs, { ...ROUTE_STYLE, renderer: canvasRenderer }).addTo(map);
        });

        HUBS.forEach((hub) => {
            const marker = L.marker([hub.lat, hub.lng], {
                icon: hubIcon(L, hub),
                riseOnHover: true,
            });
            marker.bindPopup(popupHtml(hub), {
                className: 'tvc-network-popup',
                maxWidth: 280,
                minWidth: 240,
                closeButton: true,
                autoPan: true,
            });
            marker.addTo(map);
        });

        _map = map;
        requestAnimationFrame(() => {
            map.invalidateSize();
        });
        return map;
    }

    function init(selector = '#tvc-service-network-map') {
        const container = document.querySelector(selector);
        if (!container || container.dataset.networkMapReady === '1') return Promise.resolve(_map);

        container.dataset.networkMapReady = '1';
        container.classList.add('tvc-service-network-map--loading');

        return loadLeaflet()
            .then((L) => {
                buildMap(L, container);
                container.classList.remove('tvc-service-network-map--loading');
                container.classList.add('tvc-service-network-map--ready');
                return _map;
            })
            .catch((err) => {
                console.warn('[serviceNetworkMap] init failed', err);
                container.classList.remove('tvc-service-network-map--loading');
                container.classList.add('tvc-service-network-map--error');
                container.setAttribute('role', 'alert');
                container.textContent = 'Network map unavailable — check connection and reload.';
                return null;
            });
    }

    function destroy() {
        if (_map) {
            _map.remove();
            _map = null;
        }
    }

    global.TVC_ServiceNetworkMap = { init, destroy, HUBS };

    function boot() {
        const el = document.getElementById('tvc-service-network-map');
        if (!el) return;
        init('#tvc-service-network-map');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})(typeof globalThis !== 'undefined' ? globalThis : window);
