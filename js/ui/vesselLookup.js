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

    function formatDwt(vessel) {
        const n = Number(vessel.dwt ?? vessel.d);
        if (!n) return '—';
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
        };
    }

    function renderVesselCard(vessel) {
        const v = vesselDisplay(vessel);
        return `<article class="tvc-vessel-lookup-card" data-vessel-imo="${esc(v.imo)}">
            <header class="tvc-vessel-lookup-card-head">
                <h3 class="tvc-vessel-lookup-card-name">${esc(v.name)}</h3>
                <p class="tvc-vessel-lookup-card-meta">
                    <span class="tvc-vessel-lookup-flag">${esc(v.flag)}</span>
                    <span class="tvc-vessel-lookup-sep" aria-hidden="true">·</span>
                    <span>IMO ${esc(v.imo)}</span>
                </p>
            </header>
            <div class="tvc-vessel-lookup-grid">
                <div class="tvc-vessel-lookup-field">
                    <span class="tvc-vessel-lookup-field-label">Technical manager</span>
                    <span class="tvc-vessel-lookup-value">${esc(v.technical_manager || '—')}</span>
                </div>
                <div class="tvc-vessel-lookup-field">
                    <span class="tvc-vessel-lookup-field-label">Ship type</span>
                    <span class="tvc-vessel-lookup-value">${esc(v.type || '—')}</span>
                </div>
                <div class="tvc-vessel-lookup-field">
                    <span class="tvc-vessel-lookup-field-label">DWT</span>
                    <span class="tvc-vessel-lookup-value">${esc(formatDwt(v))}</span>
                </div>
                <div class="tvc-vessel-lookup-field">
                    <span class="tvc-vessel-lookup-field-label">Built year</span>
                    <span class="tvc-vessel-lookup-value">${esc(v.built_year || '—')}</span>
                </div>
                <div class="tvc-vessel-lookup-field tvc-vessel-lookup-field--wide">
                    <span class="tvc-vessel-lookup-field-label">Main engine</span>
                    <span class="tvc-vessel-lookup-value">${esc(v.engine_model || '—')}</span>
                </div>
            </div>
            <div class="tvc-vessel-lookup-actions tvc-vessel-lookup-actions--single">
                <button type="button" class="tvc-vessel-lookup-ais home-btn home-btn-primary" data-ais-imo="${esc(v.imo)}" data-ais-name="${esc(v.name)}">🗺️ View Live Position</button>
            </div>
        </article>`;
    }

    function ensureAisModal() {
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
            <div class="tvc-vessel-ais-panel">
                <header class="tvc-vessel-ais-head">
                    <h2 id="tvcVesselAisTitle" class="tvc-vessel-ais-title">Live position</h2>
                    <button type="button" class="tvc-vessel-ais-close" data-ais-close aria-label="Close map">×</button>
                </header>
                <p class="tvc-vessel-ais-note">AIS map by IMO — TVC viewer shell only (no video ads).</p>
                <div class="tvc-vessel-ais-frame-wrap">
                    <iframe class="tvc-vessel-ais-frame" title="Vessel AIS map" loading="lazy" referrerpolicy="no-referrer-when-downgrade" sandbox="allow-scripts allow-same-origin allow-popups"></iframe>
                </div>
            </div>`;
        document.body.appendChild(modal);

        modal.addEventListener('click', (ev) => {
            if (ev.target.closest('[data-ais-close]')) closeAisModal();
        });
        document.addEventListener('keydown', (ev) => {
            if (ev.key === 'Escape' && !modal.classList.contains('hidden')) closeAisModal();
        });

        return modal;
    }

    function digitsOnly(str) {
        return String(str || '').replace(/\D/g, '');
    }

    function openAisModal(imo, name) {
        const modal = ensureAisModal();
        const imoClean = digitsOnly(imo);
        const title = document.getElementById('tvcVesselAisTitle');
        const frame = modal.querySelector('.tvc-vessel-ais-frame');
        if (title) title.textContent = name ? `${name} — IMO ${imoClean}` : `IMO ${imoClean}`;
        if (frame) {
            frame.removeAttribute('src');
            frame.src = `https://www.vesselfinder.com/?imo=${encodeURIComponent(imoClean)}`;
        }
        modal.classList.remove('hidden');
        document.body.classList.add('tvc-vessel-ais-open');
    }

    function closeAisModal() {
        const modal = document.getElementById('tvcVesselAisModal');
        if (!modal) return;
        modal.classList.add('hidden');
        document.body.classList.remove('tvc-vessel-ais-open');
        const frame = modal.querySelector('.tvc-vessel-ais-frame');
        if (frame) frame.removeAttribute('src');
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
            openAisModal(btn.dataset.aisImo, btn.dataset.aisName);
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
