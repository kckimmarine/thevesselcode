/**
 * Ad-free Vessel Particulars & Registry lookup (Maritime Toolkit).
 * Dataset: data/vessel-registry-sample.json
 */
(function (global) {
    'use strict';

    /** @type {Array<object> | null} */
    let _vessels = null;

    const REGISTRY_JSON = '/data/vessel-registry-sample.json';

    const CROSS_LINKS = [
        { label: 'ASTM 54B Calc', href: '/toolkit?tool=bunker' },
        { label: 'Flange Table', href: '/toolkit?tool=engineering' },
        { label: 'IMPA Stores', href: '/toolkit?tool=catalog' },
    ];

    function normalize(str) {
        return String(str || '')
            .trim()
            .toLowerCase()
            .normalize('NFKC')
            .replace(/[,\s]+/g, ' ');
    }

    function digitsOnly(str) {
        return String(str || '').replace(/\D/g, '');
    }

    function setVesselRegistry(data) {
        const list = Array.isArray(data) ? data : data?.vessels;
        if (!Array.isArray(list)) {
            throw new Error('Invalid vessel-registry payload');
        }
        _vessels = list.map((v) => ({ ...v }));
    }

    function getVessels() {
        return _vessels ? [..._vessels] : [];
    }

    /**
     * @param {string} query
     * @returns {Array<object>}
     */
    function searchVessels(query) {
        const vessels = _vessels || [];
        const q = normalize(query);
        if (!q) return [];

        const qImo = digitsOnly(query);
        const results = [];

        for (const vessel of vessels) {
            const name = normalize(vessel.name);
            const imo = digitsOnly(vessel.imo);
            let score = 0;

            if (qImo && imo === qImo) {
                score = 1000;
            } else if (qImo && imo.includes(qImo)) {
                score = 900;
            } else if (name === q) {
                score = 850;
            } else if (name.includes(q) || q.includes(name)) {
                score = 750;
            } else {
                const tokens = q.split(/\s+/).filter(Boolean);
                for (const tok of tokens) {
                    if (name.includes(tok)) score = Math.max(score, 500);
                    if (tok.length >= 4 && imo.includes(digitsOnly(tok))) score = Math.max(score, 600);
                }
            }

            if (score > 0) results.push({ vessel, score });
        }

        results.sort((a, b) => b.score - a.score || String(a.vessel.name).localeCompare(b.vessel.name));
        return results.map((r) => r.vessel);
    }

    function esc(text) {
        return String(text ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function renderVesselCard(vessel) {
        const links = CROSS_LINKS.map(
            (l) => `<a class="tvc-vessel-lookup-link home-btn home-btn-secondary" href="${esc(l.href)}">${esc(l.label)}</a>`
        ).join('');

        return `<article class="tvc-vessel-lookup-card" data-vessel-imo="${esc(vessel.imo)}">
            <header class="tvc-vessel-lookup-card-head">
                <h3 class="tvc-vessel-lookup-card-name">${esc(vessel.name)}</h3>
                <p class="tvc-vessel-lookup-card-meta">
                    <span class="tvc-vessel-lookup-flag">${esc(vessel.flag)}</span>
                    <span class="tvc-vessel-lookup-sep" aria-hidden="true">·</span>
                    <span>IMO ${esc(vessel.imo)}</span>
                    <span class="tvc-vessel-lookup-sep" aria-hidden="true">·</span>
                    <span>${esc(vessel.call_sign)}</span>
                </p>
            </header>
            <div class="tvc-vessel-lookup-grid">
                <div class="tvc-vessel-lookup-field">
                    <span class="tvc-vessel-lookup-field-label">Technical manager</span>
                    <span class="tvc-vessel-lookup-value">${esc(vessel.technical_manager)}</span>
                </div>
                <div class="tvc-vessel-lookup-field">
                    <span class="tvc-vessel-lookup-field-label">Ship type</span>
                    <span class="tvc-vessel-lookup-value">${esc(vessel.type)}</span>
                </div>
                <div class="tvc-vessel-lookup-field">
                    <span class="tvc-vessel-lookup-field-label">DWT</span>
                    <span class="tvc-vessel-lookup-value">${esc(vessel.dwt)}</span>
                </div>
                <div class="tvc-vessel-lookup-field">
                    <span class="tvc-vessel-lookup-field-label">Built year</span>
                    <span class="tvc-vessel-lookup-value">${esc(vessel.built_year)}</span>
                </div>
                <div class="tvc-vessel-lookup-field tvc-vessel-lookup-field--wide">
                    <span class="tvc-vessel-lookup-field-label">Main engine</span>
                    <span class="tvc-vessel-lookup-value">${esc(vessel.engine_model)}</span>
                </div>
            </div>
            <div class="tvc-vessel-lookup-actions">
                <div class="tvc-vessel-lookup-cross">${links}</div>
                <button type="button" class="tvc-vessel-lookup-ais home-btn home-btn-primary" data-ais-imo="${esc(vessel.imo)}" data-ais-name="${esc(vessel.name)}">🗺️ View Live Position</button>
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
                <p class="tvc-vessel-ais-note">Sample AIS view by IMO — no video ads or tracking popups in this viewer.</p>
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

    function renderResults(container, vessels) {
        if (!container) return;
        if (!vessels.length) {
            container.classList.add('hidden');
            container.innerHTML = '';
            return;
        }
        container.classList.remove('hidden');
        container.innerHTML = vessels.slice(0, 6).map(renderVesselCard).join('');
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
        const inputId = options?.inputId || 'tvcVesselLookupInput';
        const resultsId = options?.resultsId || 'tvcVesselLookupResults';
        const input = document.getElementById(inputId);
        const results = document.getElementById(resultsId);
        if (!input || !results) return;

        bindResultsActions(results);

        const run = () => {
            const q = input.value.trim();
            if (!q) {
                results.classList.add('hidden');
                results.innerHTML = '';
                return;
            }
            const hits = searchVessels(q);
            renderResults(results, hits);
        };

        input.addEventListener('input', run);
        input.addEventListener('focus', run);

        document.addEventListener('click', (ev) => {
            const wrap = document.getElementById('tvcVesselLookupWrap');
            if (wrap && !wrap.contains(ev.target)) {
                if (!input.value.trim()) results.classList.add('hidden');
            }
        });

        const params = new URLSearchParams(global.location?.search || '');
        const imoParam = params.get('imo') || params.get('vessel');
        if (imoParam) {
            input.value = imoParam;
            run();
        }
    }

    async function loadFromJson(url) {
        const res = await fetch(url || REGISTRY_JSON);
        if (!res.ok) throw new Error(`vessel registry fetch failed: ${res.status}`);
        const data = await res.json();
        setVesselRegistry(data);
        return getVessels();
    }

    const api = {
        setVesselRegistry,
        getVessels,
        searchVessels,
        renderVesselCard,
        loadFromJson,
        init,
        normalize,
        digitsOnly,
    };

    global.TVC_VesselLookup = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
