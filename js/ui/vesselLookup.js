/**
 * Ad-free Vessel Particulars & Registry lookup (Maritime Toolkit).
 * Backed by chunked global fleet index via TVC_FleetRegistry.
 */
(function (global) {
    'use strict';

    function esc(text) {
        return String(text ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function hasValue(value) {
        if (value === null || value === undefined) return false;
        if (typeof value === 'number') return value > 0;
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
        };
    }

    function specField(label, value, wide) {
        if (!hasValue(value)) return '';
        const cls = wide ? ' tvc-vessel-lookup-field--wide' : '';
        return `<div class="tvc-vessel-lookup-field${cls}">
            <span class="tvc-vessel-lookup-field-label">${esc(label)}</span>
            <span class="tvc-vessel-lookup-value">${esc(value)}</span>
        </div>`;
    }

    function renderVesselCard(vessel) {
        const v = vesselDisplay(vessel);
        const dwtText = formatDwt(v);
        const specs = [
            specField('Technical manager', v.technical_manager),
            specField('Ship type', v.type),
            specField('DWT', dwtText),
            specField('Built year', v.built_year),
            specField('Main engine', v.engine_model, true),
        ].filter(Boolean).join('');

        return `<article class="tvc-vessel-lookup-card" data-vessel-imo="${esc(v.imo)}">
            <header class="tvc-vessel-lookup-card-head">
                <h3 class="tvc-vessel-lookup-card-name">${esc(v.name)}</h3>
                <p class="tvc-vessel-lookup-card-meta">
                    <span class="tvc-vessel-lookup-flag">${esc(v.flag || '—')}</span>
                    <span class="tvc-vessel-lookup-sep" aria-hidden="true">·</span>
                    <span>IMO ${esc(v.imo)}</span>
                </p>
            </header>
            ${specs ? `<div class="tvc-vessel-lookup-grid">${specs}</div>` : ''}
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

    function renderResults(container, vessels, message) {
        if (!container) return;
        if (!vessels.length) {
            container.classList.remove('hidden');
            container.innerHTML = message
                ? `<p class="tvc-vessel-lookup-empty">${esc(message)}</p>`
                : '';
            if (!message) container.classList.add('hidden');
            return;
        }
        container.classList.remove('hidden');
        container.innerHTML = vessels.map(renderVesselCard).join('');
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
