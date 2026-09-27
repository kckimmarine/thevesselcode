/**
 * Interactive SOx/NOx ECA map & port environmental dossiers (#eca-map).
 */
(function (global) {
    'use strict';

    const LEAFLET_CSS = '/vendor/leaflet/leaflet.css';
    const LEAFLET_JS = '/vendor/leaflet/leaflet.js';
    const DATA_URL = '/data/maritime-regulations.json';
    const LIGHT_TILE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    const LAYER_STYLES = {
        sox_010: { color: '#0284c7', fillColor: '#0ea5e9', fillOpacity: 0.18, weight: 2 },
        nox_tier3: { color: '#7c3aed', fillColor: '#a78bfa', fillOpacity: 0.12, weight: 2, dashArray: '6,4' },
    };

    /** @type {Promise<typeof L>|null} */
    let _leafletPromise = null;
    /** @type {import('leaflet').Map|null} */
    let _map = null;
    let _data = null;
    let _layerGroups = { sox_010: null, nox_tier3: null, scrubber_ban: null };
    let _regionById = {};
    let _portById = {};
    let _modalEl = null;
    let _mounted = false;
    let _defaultOptions = {};

    function esc(text) {
        return String(text ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function t(key, fallback) {
        const i18n = global.TVC_MarketingI18n;
        if (i18n?.t) {
            const v = i18n.t(key, i18n.getLang?.());
            if (v && v !== key) return v;
        }
        return fallback ?? key;
    }

    function loadLeaflet() {
        if (global.L) return Promise.resolve(global.L);
        if (_leafletPromise) return _leafletPromise;
        _leafletPromise = new Promise((resolve, reject) => {
            if (!document.querySelector('link[data-tvc-leaflet-eca]')) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = LEAFLET_CSS;
                link.setAttribute('data-tvc-leaflet-eca', '1');
                document.head.appendChild(link);
            }
            const existing = document.querySelector('script[data-tvc-leaflet-eca]');
            if (existing) {
                existing.addEventListener('load', () => resolve(global.L), { once: true });
                existing.addEventListener('error', reject, { once: true });
                return;
            }
            const script = document.createElement('script');
            script.src = LEAFLET_JS;
            script.defer = true;
            script.setAttribute('data-tvc-leaflet-eca', '1');
            script.onload = () => resolve(global.L);
            script.onerror = reject;
            document.head.appendChild(script);
        });
        return _leafletPromise;
    }

    async function loadData() {
        if (_data) return _data;
        const res = await fetch(DATA_URL, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`Failed to load ${DATA_URL}`);
        _data = await res.json();
        _regionById = Object.fromEntries((_data.ecaRegions || []).map((r) => [r.id, r]));
        _portById = Object.fromEntries((_data.ports || []).map((p) => [p.id, p]));
        return _data;
    }

    function ensureModal() {
        if (_modalEl) return _modalEl;
        _modalEl = document.createElement('div');
        _modalEl.id = 'tvcEcaPortModal';
        _modalEl.className = 'tvc-eca-port-modal hidden';
        _modalEl.setAttribute('role', 'dialog');
        _modalEl.setAttribute('aria-modal', 'true');
        _modalEl.innerHTML = `
            <div class="tvc-eca-port-backdrop" data-eca-close tabindex="-1"></div>
            <div class="tvc-eca-port-card mkt-glass-card">
                <header class="tvc-eca-port-head">
                    <h2 id="tvcEcaPortTitle" class="tvc-eca-port-title"></h2>
                    <button type="button" class="tvc-eca-port-close" data-eca-close aria-label="Close">×</button>
                </header>
                <div id="tvcEcaPortBody" class="tvc-eca-port-body"></div>
            </div>`;
        document.body.appendChild(_modalEl);
        _modalEl.querySelectorAll('[data-eca-close]').forEach((el) => {
            el.addEventListener('click', closePortModal);
        });
        return _modalEl;
    }

    function closePortModal() {
        _modalEl?.classList.add('hidden');
    }

    function renderPortDossierHtml(port) {
        const d = port.dossier || {};
        const lists = (items) => (items || []).map((x) => `<li>${esc(x)}</li>`).join('');
        return `
            <p class="tvc-eca-dossier-meta">${esc(port.country)}</p>
            <dl class="tvc-eca-dossier-dl">
                <div><dt>${esc(t('tk.eca.dossier.atBerth', 'Fuel sulphur — at berth'))}</dt><dd>${esc(d.fuelSulphurAtBerth)}</dd></div>
                <div><dt>${esc(t('tk.eca.dossier.inPort', 'In port limits'))}</dt><dd>${esc(d.fuelSulphurInPort)}</dd></div>
                <div><dt>${esc(t('tk.eca.dossier.anchorage', 'Anchorage'))}</dt><dd>${esc(d.fuelSulphurAnchorage)}</dd></div>
                <div><dt>${esc(t('tk.eca.dossier.scrubber', 'Open-loop scrubber washwater'))}</dt><dd><strong>${esc(d.openLoopScrubberWashwater)}</strong></dd></div>
                <div><dt>${esc(t('tk.eca.dossier.bw', 'Ballast / biofouling'))}</dt><dd>${esc(d.ballastWaterBiofouling)}</dd></div>
            </dl>
            <h3 class="tvc-eca-dossier-sub">${esc(t('tk.eca.dossier.logs', 'Logbook entries'))}</h3>
            <ul class="tvc-eca-dossier-list">${lists(d.logbookEntries)}</ul>
            <h3 class="tvc-eca-dossier-sub">${esc(t('tk.eca.dossier.psc', 'Class / PSC audit checkpoints'))}</h3>
            <ul class="tvc-eca-dossier-list">${lists(d.pscAuditCheckpoints)}</ul>
            <p class="tvc-eca-dossier-mro">
                <a href="/mro/valves">${esc(t('tk.eca.mro.valves', 'Low-sulphur fuel valves RFQ ↗'))}</a>
                · <a href="/mro/pipes-fittings">${esc(t('tk.eca.mro.pipes', 'Scrubber bypass piping RFQ ↗'))}</a>
            </p>`;
    }

    function openPortModal(port) {
        ensureModal();
        _modalEl.querySelector('#tvcEcaPortTitle').textContent = port.name;
        _modalEl.querySelector('#tvcEcaPortBody').innerHTML = renderPortDossierHtml(port);
        _modalEl.classList.remove('hidden');
    }

    function regionPopupHtml(region) {
        const source = region.boundarySource
            ? `<p class="tvc-eca-popup-sop"><span class="tvc-eca-popup-label">${esc(t('tk.eca.popup.coords', 'Boundary data'))}</span> ${esc(region.boundarySource)}</p>`
            : '';
        return `
            <div class="tvc-eca-popup">
                <strong>${esc(region.name)}</strong>
                <p><span class="tvc-eca-popup-label">${esc(t('tk.eca.popup.regulation', 'Regulation'))}</span> ${esc(region.regulation)}</p>
                <p><span class="tvc-eca-popup-label">${esc(t('tk.eca.popup.sulphur', 'Sulphur limit'))}</span> ${esc(region.sulphurLimit)}</p>
                <p class="tvc-eca-popup-sop"><span class="tvc-eca-popup-label">${esc(t('tk.eca.popup.sop', 'Fuel change-over SOP'))}</span> ${esc(region.fuelChangeoverSop)}</p>
                ${source}
            </div>`;
    }

    function scrubberIconHtml() {
        return `<div class="tvc-eca-scrubber-marker" aria-hidden="true">⛔</div>`;
    }

    function portIconHtml() {
        return `<div class="tvc-eca-port-marker" aria-hidden="true">⚓</div>`;
    }

    function applyLayerVisibility() {
        const root = document.getElementById('eca-map');
        if (!root || !_map) return;
        const soxOn = root.querySelector('#ecaLayerSox')?.checked !== false;
        const noxOn = root.querySelector('#ecaLayerNox')?.checked !== false;
        const banOn = root.querySelector('#ecaLayerScrubberBan')?.checked !== false;
        if (_layerGroups.sox_010) {
            soxOn ? _map.addLayer(_layerGroups.sox_010) : _map.removeLayer(_layerGroups.sox_010);
        }
        if (_layerGroups.nox_tier3) {
            noxOn ? _map.addLayer(_layerGroups.nox_tier3) : _map.removeLayer(_layerGroups.nox_tier3);
        }
        if (_layerGroups.scrubber_ban) {
            banOn ? _map.addLayer(_layerGroups.scrubber_ban) : _map.removeLayer(_layerGroups.scrubber_ban);
        }
    }

    function buildMap(L, container) {
        if (_map) {
            _map.remove();
            _map = null;
        }
        _layerGroups = { sox_010: L.layerGroup(), nox_tier3: L.layerGroup(), scrubber_ban: L.layerGroup() };

        _map = L.map(container, { scrollWheelZoom: true, worldCopyJump: true }).setView([30, 10], 3);
        L.tileLayer(LIGHT_TILE, {
            maxZoom: 18,
            attribution: '&copy; OpenStreetMap contributors',
        }).addTo(_map);

        (_data.ecaRegions || []).forEach((region) => {
            const rings = (region.polygons && region.polygons.length)
                ? region.polygons
                : (region.polygon ? [region.polygon] : []);
            rings.forEach((ring) => {
                const latlngs = (ring || []).map(([lat, lng]) => [lat, lng]);
                if (latlngs.length < 3) return;
                (region.layers || []).forEach((layerKey) => {
                    const style = { ...LAYER_STYLES[layerKey] };
                    const poly = L.polygon(latlngs, style);
                    poly.bindPopup(regionPopupHtml(region), { maxWidth: 320, className: 'tvc-eca-popup-wrap' });
                    poly.on('click', () => poly.openPopup());
                    poly.addTo(_layerGroups[layerKey] || _layerGroups.sox_010);
                });
            });
        });

        const portIcon = L.divIcon({
            className: 'tvc-eca-port-icon-wrap',
            html: portIconHtml(),
            iconSize: [28, 28],
            iconAnchor: [14, 14],
        });
        const banIcon = L.divIcon({
            className: 'tvc-eca-scrubber-icon-wrap',
            html: scrubberIconHtml(),
            iconSize: [28, 28],
            iconAnchor: [14, 14],
        });

        (_data.ports || []).forEach((port) => {
            const marker = L.marker([port.lat, port.lng], { icon: portIcon });
            marker.on('click', () => openPortModal(port));
            marker.bindTooltip(port.name, { direction: 'top', className: 'tvc-ais-map-tooltip' });
            marker.addTo(_layerGroups.sox_010);

            if (port.scrubberBanOpenLoop) {
                const ban = L.marker([port.lat, port.lng], { icon: banIcon });
                ban.bindTooltip(`${port.name} — ${t('tk.eca.scrubberBan', 'Open-loop scrubber washwater restricted')}`, {
                    direction: 'bottom',
                    className: 'tvc-ais-map-tooltip',
                });
                ban.on('click', () => openPortModal(port));
                ban.addTo(_layerGroups.scrubber_ban);
            }
        });

        applyLayerVisibility();

        if (_defaultOptions.focusPortId && _portById[_defaultOptions.focusPortId]) {
            focusPort(_defaultOptions.focusPortId, { openModal: false });
        } else if (_defaultOptions.focusRegionId && _regionById[_defaultOptions.focusRegionId]) {
            focusRegion(_defaultOptions.focusRegionId);
        }
    }

    function focusRegion(regionId) {
        const region = _regionById[regionId];
        if (!region || !_map) return;
        const rings = (region.polygons && region.polygons.length)
            ? region.polygons
            : (region.polygon ? [region.polygon] : []);
        const latlngs = rings.flat();
        if (latlngs.length) {
            _map.fitBounds(latlngs, { padding: [40, 40], maxZoom: 7 });
        }
    }

    function focusPort(portId, opts = {}) {
        const port = _portById[portId];
        if (!port || !_map) return;
        _map.setView([port.lat, port.lng], Math.max(_map.getZoom(), 8));
        if (opts.openModal !== false) openPortModal(port);
    }

    function resolveSearchQuery(raw) {
        const q = String(raw || '').trim().toLowerCase();
        if (!q || !_data) return null;
        const aliases = _data.searchAliases || {};
        if (aliases[q]) {
            const id = aliases[q];
            if (_portById[id]) return { type: 'port', id };
            if (_regionById[id]) return { type: 'region', id };
        }
        for (const port of _data.ports || []) {
            if (port.id === q || port.name.toLowerCase().includes(q)) return { type: 'port', id: port.id };
            if ((port.aliases || []).some((a) => String(a).toLowerCase().includes(q))) return { type: 'port', id: port.id };
        }
        for (const region of _data.ecaRegions || []) {
            if (region.id === q || region.name.toLowerCase().includes(q)) return { type: 'region', id: region.id };
        }
        if (q.includes('china') && q.includes('deca')) return { type: 'region', id: 'china-coastal-deca' };
        if (q.includes('med')) return { type: 'region', id: 'mediterranean-sea-eca' };
        if (q.includes('korea') && q.includes('eca')) return { type: 'region', id: 'korea-coastal-eca' };
        return null;
    }

    function runSearch(inputEl) {
        const hit = resolveSearchQuery(inputEl?.value);
        if (!hit) {
            inputEl?.setAttribute('aria-invalid', 'true');
            return;
        }
        inputEl?.removeAttribute('aria-invalid');
        if (hit.type === 'port') focusPort(hit.id);
        else focusRegion(hit.id);
    }

    function wireControls(root) {
        root.querySelectorAll('.eca-layer-toggle').forEach((cb) => {
            cb.addEventListener('change', applyLayerVisibility);
        });
        const form = root.querySelector('#ecaMapSearchForm');
        const input = root.querySelector('#ecaMapSearchInput');
        form?.addEventListener('submit', (e) => {
            e.preventDefault();
            runSearch(input);
        });
    }

    function paintShell(root) {
        if (root.dataset.ecaMapMounted === '1') return;
        root.dataset.ecaMapMounted = '1';
        root.innerHTML = `
            <div class="tvc-eca-map-toolbar">
                <fieldset class="tvc-eca-layer-fieldset">
                    <legend data-i18n="tk.eca.layers.legend">${esc(t('tk.eca.layers.legend', 'Map layers'))}</legend>
                    <label class="tvc-eca-layer-chip"><input type="checkbox" id="ecaLayerSox" class="eca-layer-toggle" checked> ${esc(t('tk.eca.layers.sox', 'SOx 0.10% ECA'))}</label>
                    <label class="tvc-eca-layer-chip"><input type="checkbox" id="ecaLayerNox" class="eca-layer-toggle" checked> ${esc(t('tk.eca.layers.nox', 'NOx Tier III'))}</label>
                    <label class="tvc-eca-layer-chip"><input type="checkbox" id="ecaLayerScrubberBan" class="eca-layer-toggle" checked> ${esc(t('tk.eca.layers.scrubberBan', 'Scrubber ban ports'))}</label>
                </fieldset>
            </div>
            <div class="tvc-eca-map-shell">
                <div id="eca-map-canvas" class="tvc-eca-map-canvas tvc-eca-map-canvas--loading" role="application" aria-label="${esc(t('tk.eca.mapAria', 'Global SOx and NOx ECA map'))}"></div>
            </div>
            <form id="ecaMapSearchForm" class="tvc-eca-search-form" role="search">
                <label for="ecaMapSearchInput" class="tvc-eca-search-label" data-i18n="tk.eca.search.label">${esc(t('tk.eca.search.label', 'Enter Port or Country (e.g. Busan, Singapore, China DECA)'))}</label>
                <div class="tvc-eca-search-row">
                    <input type="search" id="ecaMapSearchInput" name="q" autocomplete="off" spellcheck="false" placeholder="${esc(t('tk.eca.search.placeholder', 'Busan, Singapore, China DECA…'))}">
                    <button type="submit" class="home-btn home-btn-primary">${esc(t('tk.eca.search.btn', 'Focus map'))}</button>
                </div>
            </form>
            <p class="tvc-eca-enterprise-hook mkt-prose">
                ${esc(t('tk.eca.enterprise.lead', 'Need automated Fuel Switch calculation and PSC Class Inspection Audit export? Managed via'))}
                <a href="/contact-us?inquiry=fleet-trial&ref=eca-map" target="_blank" rel="noopener noreferrer">${esc(t('tk.eca.enterprise.link', 'TVC-SM Fleet OS'))} ↗</a>
            </p>
            <p class="tvc-eca-mro-links mkt-prose">
                <a href="/mro/pipes-fittings">${esc(t('tk.eca.mro.pipes', 'Scrubber bypass piping RFQ ↗'))}</a>
                · <a href="/mro/valves">${esc(t('tk.eca.mro.valves', 'Low-sulphur fuel valves RFQ ↗'))}</a>
                · <a href="/services/korea-ports-hub">${esc(t('tk.eca.koreaHub', 'Korea Port Environmental Hub ↗'))}</a>
            </p>`;
        wireControls(root);
        global.TVC_MarketingI18n?.apply?.(root);
    }

    async function init(selectorOrOptions) {
        let selector = '#eca-map';
        if (typeof selectorOrOptions === 'string') selector = selectorOrOptions;
        if (selectorOrOptions && typeof selectorOrOptions === 'object') {
            _defaultOptions = { ...selectorOrOptions };
            if (selectorOrOptions.selector) selector = selectorOrOptions.selector;
        }
        const root = document.querySelector(selector);
        if (!root) return;
        if (root.dataset.ecaMapReady === '1') return;
        paintShell(root);
        const canvas = root.querySelector('#eca-map-canvas');
        try {
            await loadData();
            const L = await loadLeaflet();
            canvas.classList.remove('tvc-eca-map-canvas--loading');
            canvas.classList.add('tvc-eca-map-canvas--ready');
            buildMap(L, canvas);
            root.dataset.ecaRegions = String((_data.ecaRegions || []).length);
            root.dataset.ecaPorts = String((_data.ports || []).length);
            _mounted = true;
            root.dataset.ecaMapReady = '1';

            const params = new URLSearchParams(global.location?.search || '');
            const q = params.get('q') || (global.location?.hash || '').replace(/^#eca-map[?=&]?/, '');
            if (q) {
                const input = root.querySelector('#ecaMapSearchInput');
                if (input) input.value = decodeURIComponent(q);
                runSearch(input);
            }
        } catch (err) {
            console.warn('[ecaMapRenderer] init failed', err);
            canvas.classList.remove('tvc-eca-map-canvas--loading');
            canvas.classList.add('tvc-eca-map-canvas--error');
            canvas.textContent = t('tk.eca.loadError', 'Unable to load ECA map data.');
        }
    }

    function getDataset() {
        return _data;
    }

    function isMounted() {
        return _mounted;
    }

    global.TVC_EcaMapRenderer = {
        init,
        focusPort,
        focusRegion,
        resolveSearchQuery,
        getDataset,
        isMounted,
        loadData,
    };

    document.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('eca-map')) init('#eca-map');
    });
}(typeof globalThis !== 'undefined' ? globalThis : window));
