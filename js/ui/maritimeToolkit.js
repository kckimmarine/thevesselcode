/* THE VESSEL CODE — Maritime Toolkit (public utilities) */
const TVC_MaritimeToolkit = (function () {
    function mkt(key, fallback) {
        const i18n = globalThis.TVC_MarketingI18n;
        if (i18n?.t) {
            const v = i18n.t(key, i18n.getLang());
            if (v) return v;
        }
        return fallback ?? key;
    }

    function fuelTypes() {
        const grades = globalThis.TVC_BunkerCalc?.FUEL_GRADES || {};
        const lang = globalThis.TVC_MarketingI18n?.getLang?.() || 'en';
        return Object.values(grades).map((g) => ({
            key: g.key,
            label: lang === 'ko' && g.labelKo ? g.labelKo : g.label,
            defaultDensity: g.defaultDensity,
        }));
    }

    function calcBunkerMassAstM54B(volume, density15, tempC, fuelKey) {
        const calc = globalThis.TVC_BunkerCalc?.calcBunkerAstM54B;
        if (!calc) return { mt: 0, v15: 0, vcf: 1, alpha: 0, co2Mt: 0 };
        const r = calc({ volumeM3: volume, density15, tempC, fuelKey });
        return {
            mt: r.mt,
            v15: r.v15,
            vcf: r.vcf,
            alpha: r.alpha,
            densityInAir: r.densityInAir,
            co2Mt: r.co2Mt,
            rho15: r.density15,
        };
    }

    const LUB_OIL_ROWS = [
        { category: 'Cylinder Oil', grade: '70BN', shell: 'Alexia 50', mobil: 'Mobil Gard 570', castrol: 'Cleeton 70', total: 'Disola A 40' },
        { category: 'Cylinder Oil', grade: '80BN', shell: 'Alexia 70', mobil: 'Mobil Gard 570', castrol: 'Cleeton 80', total: 'Disola A 50' },
        { category: 'Cylinder Oil', grade: '100BN', shell: 'Alexia 100', mobil: 'Mobil Gard 610', castrol: 'Cleeton 100', total: 'Disola A 70' },
        { category: 'Cylinder Oil', grade: '140BN', shell: 'Alexia 140', mobil: 'Mobil Gard 640', castrol: 'Cleeton 140', total: 'Disola A 100' },
        { category: 'System Oil', grade: 'SAE 30', shell: 'Gadinia 30', mobil: 'Mobil Delvac 1300', castrol: 'Cyltech 30', total: 'Aurelia X 300' },
        { category: 'System Oil', grade: 'SAE 40', shell: 'Gadinia 40', mobil: 'Mobil Delvac 1640', castrol: 'Cyltech 40', total: 'Aurelia X 400' },
        { category: 'System Oil', grade: 'SAE 50', shell: 'Gadinia 50', mobil: 'Mobil Delvac 1 SHC', castrol: 'Cyltech 50', total: 'Aurelia X 500' },
        { category: 'Hydraulic Oil', grade: 'ISO VG 32', shell: 'Tellus S2 M 32', mobil: 'Mobil DTE 10 Excel 32', castrol: 'Hyspin AWS 32', total: 'Azolla ZS 32' },
        { category: 'Hydraulic Oil', grade: 'ISO VG 46', shell: 'Tellus S2 M 46', mobil: 'Mobil DTE 10 Excel 46', castrol: 'Hyspin AWS 46', total: 'Azolla ZS 46' },
        { category: 'Hydraulic Oil', grade: 'ISO VG 68', shell: 'Tellus S2 M 68', mobil: 'Mobil DTE 10 Excel 68', castrol: 'Hyspin AWS 68', total: 'Azolla ZS 68' },
        { category: 'Hydraulic Oil', grade: 'ISO VG 100', shell: 'Tellus S2 M 100', mobil: 'Mobil DTE 10 Excel 100', castrol: 'Hyspin AWS 100', total: 'Azolla ZS 100' },
    ];

    const PAINT_ROWS = [
        { type: 'Antifouling (A/F)', product: 'Self-Polishing SPC', chugoku: 'SeaGrandfather 880', jotun: 'SeaQuantum Pro', hempel: 'Globic 9500', ip: 'Interswift SPC' },
        { type: 'Antifouling (A/F)', product: 'Controlled Depletion', chugoku: 'SeaGrandfather 700', jotun: 'SeaForce 90', hempel: 'Oceanic+', ip: 'Interspeed 640' },
        { type: 'Anticorrosive (A/C)', product: 'Aluminium A/C', chugoku: 'Marine Alumi', jotun: 'Pilot A/C', hempel: 'Aluminium 15360', ip: 'Intershield 300' },
        { type: 'Anticorrosive (A/C)', product: 'Vinyl A/C', chugoku: 'Marine Vinyl', jotun: 'Pilot II', hempel: 'Light Primer 45550', ip: 'Intergard 269' },
        { type: 'Epoxy Primer', product: 'Pure Epoxy', chugoku: 'Epicon B-13', jotun: 'Barrier 77', hempel: 'Hempadur 15553', ip: 'Intershield 300' },
        { type: 'Epoxy Primer', product: 'High-Build Epoxy', chugoku: 'Epicon HB', jotun: 'Barrier 80', hempel: 'Hempadur 17240', ip: 'Intershield 803' },
        { type: 'Epoxy Primer', product: 'Tank Coating', chugoku: 'Tankguard 100', jotun: 'Tankguard Storage', hempel: 'Hempadur Mastic 45880', ip: 'Interline 984' },
    ];

    let _activeTool = 'catalog';

    function esc(text) {
        return String(text ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function standards() {
        if (globalThis.TVC_FlangeData?.standards) return globalThis.TVC_FlangeData.standards();
        return [];
    }

    function filterFlanges(standard, query) {
        if (globalThis.TVC_FlangeData?.filterFlanges) {
            return globalThis.TVC_FlangeData.filterFlanges(standard, query);
        }
        return [];
    }

    function calcVolumeToMt(volume, density15, tempC, fuelKey) {
        return calcBunkerMassAstM54B(volume, density15, tempC, fuelKey).mt;
    }

    function tableHtml(headers, rows) {
        if (!rows.length) return '<p class="maritime-empty">No matches found.</p>';
        const head = headers.map(h => `<th>${esc(h)}</th>`).join('');
        const body = rows.map(cells =>
            `<tr>${cells.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('');
        return `
            <div class="maritime-table-wrap">
                <table class="maritime-table">
                    <thead><tr>${head}</tr></thead>
                    <tbody>${body}</tbody>
                </table>
            </div>`;
    }

    function renderBunkerPanel(host) {
        const fuels = fuelTypes();
        const fuelOptions = fuels.map((f) =>
            `<option value="${esc(f.key)}">${esc(f.label)}</option>`).join('');
        host.innerHTML = `
            <div class="maritime-panel-head">
                <h2 class="maritime-panel-title" data-i18n="tk.bunker.title">⛽ Bunker &amp; Fuel Calculator (ASTM Table 54B)</h2>
                <p class="maritime-panel-sub" data-i18n="tk.bunker.sub">VCF, weight-in-air mass, and estimated CO₂ from observed volume, density @ 15°C, and temperature.</p>
            </div>
            <form class="maritime-bunker-form" id="bunkerCalcForm">
                <label class="maritime-field">
                    <span data-i18n="tk.bunker.fuel">Fuel grade</span>
                    <select id="bunkerFuelType">${fuelOptions}</select>
                </label>
                <label class="maritime-field">
                    <span data-i18n="tk.bunker.volume">Observed volume (m³)</span>
                    <input type="number" id="bunkerVolume" min="0" step="0.001" value="500" inputmode="decimal">
                </label>
                <label class="maritime-field">
                    <span data-i18n="tk.bunker.density">Density @ 15°C (kg/m³)</span>
                    <input type="number" id="bunkerDensity" min="770" max="1075" step="0.1" value="991" inputmode="decimal">
                </label>
                <label class="maritime-field">
                    <span data-i18n="tk.bunker.temp">Observed temperature (°C)</span>
                    <input type="number" id="bunkerTemp" step="0.1" value="40" inputmode="decimal">
                </label>
            </form>
            <div class="maritime-bunker-result" id="bunkerResult" aria-live="polite">
                <div class="maritime-bunker-metrics maritime-bunker-metrics-extended">
                    <div><span data-i18n="tk.bunker.vcf">VCF @ 15°C</span><strong id="bunkerVcfValue">—</strong></div>
                    <div><span data-i18n="tk.bunker.alpha">Alpha @ 15°C</span><strong id="bunkerAlphaValue">—</strong></div>
                    <div><span data-i18n="tk.bunker.mass">Mass in air (MT)</span><strong id="bunkerMassValue">—</strong></div>
                    <div><span data-i18n="tk.bunker.co2">Est. CO₂ (MT)</span><strong id="bunkerCo2Value">—</strong></div>
                    <div><span data-i18n="tk.bunker.v15">Volume @ 15°C (m³)</span><strong id="bunkerV15Value">—</strong></div>
                </div>
            </div>
            <p class="maritime-note" data-i18n="tk.bunker.note">ASTM Table 54B VCF (API MPMS). Verify with shore lab before commercial settlement.</p>`;

        const form = host.querySelector('#bunkerCalcForm');
        const fuelSelect = host.querySelector('#bunkerFuelType');
        const paint = () => {
            const fuelKey = fuelSelect.value;
            const fuel = fuels.find((f) => f.key === fuelKey) || fuels[0];
            const vol = host.querySelector('#bunkerVolume')?.value;
            const den = host.querySelector('#bunkerDensity')?.value;
            const temp = host.querySelector('#bunkerTemp')?.value;
            const result = calcBunkerMassAstM54B(vol, den, temp, fuelKey);
            host.querySelector('#bunkerMassValue').textContent = `${result.mt.toFixed(3)} MT`;
            host.querySelector('#bunkerV15Value').textContent = result.v15.toFixed(3);
            host.querySelector('#bunkerVcfValue').textContent = result.vcf.toFixed(4);
            host.querySelector('#bunkerAlphaValue').textContent = result.alpha.toExponential(4);
            host.querySelector('#bunkerCo2Value').textContent = `${(result.co2Mt || 0).toFixed(3)} MT`;
        };
        fuelSelect.addEventListener('change', () => {
            const fuel = fuels.find((f) => f.key === fuelSelect.value);
            if (fuel) host.querySelector('#bunkerDensity').value = String(fuel.defaultDensity);
            paint();
        });
        form.addEventListener('input', paint);
        paint();
        globalThis.TVC_MarketingI18n?.applyLang?.(globalThis.TVC_MarketingI18n.getLang());
    }

    function renderLubePanel(host) {
        host.innerHTML = `
            <div class="maritime-panel-head">
                <h2 class="maritime-panel-title">🛢️ Lubricant Cross-Reference</h2>
                <p class="maritime-panel-sub">Compare cylinder, system, and hydraulic oil grades across major makers.</p>
            </div>
            <div class="maritime-flange-controls">
                <label class="maritime-field">
                    <span>Category</span>
                    <select id="lubeCategoryFilter">
                        <option value="">All categories</option>
                        <option value="Cylinder Oil">Cylinder Oil</option>
                        <option value="System Oil">System Oil</option>
                        <option value="Hydraulic Oil">Hydraulic Oil</option>
                    </select>
                </label>
                <label class="maritime-field maritime-field-grow">
                    <span>Search grade or product</span>
                    <input type="search" id="lubeSearch" placeholder="e.g. 80BN, Tellus, Mobil Gard" autocomplete="off">
                </label>
            </div>
            <div id="lubeTableHost"></div>
            <p class="maritime-note">Reference equivalents for procurement — always confirm OEM / maker approval before change-over.</p>`;

        const catFilter = host.querySelector('#lubeCategoryFilter');
        const search = host.querySelector('#lubeSearch');
        const tableHost = host.querySelector('#lubeTableHost');

        const paint = () => {
            const cat = catFilter.value;
            const q = (search.value || '').trim().toLowerCase();
            const rows = LUB_OIL_ROWS.filter(r => {
                if (cat && r.category !== cat) return false;
                if (!q) return true;
                const hay = [r.category, r.grade, r.shell, r.mobil, r.castrol, r.total].join(' ').toLowerCase();
                return hay.includes(q);
            });
            tableHost.innerHTML = tableHtml(
                ['Category', 'Grade', 'Shell', 'Mobil', 'Castrol', 'Total'],
                rows.map(r => [r.category, r.grade, r.shell, r.mobil, r.castrol, r.total]),
            );
        };
        catFilter.addEventListener('change', paint);
        search.addEventListener('input', paint);
        paint();
    }

    function renderPaintPanel(host) {
        host.innerHTML = `
            <div class="maritime-panel-head">
                <h2 class="maritime-panel-title">🎨 Marine Paint Cross-Reference</h2>
                <p class="maritime-panel-sub">Antifouling, anticorrosive, and epoxy primer equivalents across leading makers.</p>
            </div>
            <div class="maritime-flange-controls">
                <label class="maritime-field">
                    <span>Coating type</span>
                    <select id="paintTypeFilter">
                        <option value="">All types</option>
                        <option value="Antifouling">Antifouling (A/F)</option>
                        <option value="Anticorrosive">Anticorrosive (A/C)</option>
                        <option value="Epoxy">Epoxy Primer</option>
                    </select>
                </label>
                <label class="maritime-field maritime-field-grow">
                    <span>Search product</span>
                    <input type="search" id="paintSearch" placeholder="e.g. SeaQuantum, Globic, Barrier" autocomplete="off">
                </label>
            </div>
            <div id="paintTableHost"></div>
            <p class="maritime-note">Yard / class approval required. Data for cross-reference only — not a coating specification.</p>`;

        const typeFilter = host.querySelector('#paintTypeFilter');
        const search = host.querySelector('#paintSearch');
        const tableHost = host.querySelector('#paintTableHost');

        const paint = () => {
            const type = typeFilter.value;
            const q = (search.value || '').trim().toLowerCase();
            const rows = PAINT_ROWS.filter(r => {
                if (type === 'Antifouling' && !r.type.includes('Antifouling')) return false;
                if (type === 'Anticorrosive' && !r.type.includes('Anticorrosive')) return false;
                if (type === 'Epoxy' && !r.type.includes('Epoxy')) return false;
                if (!q) return true;
                const hay = [r.type, r.product, r.chugoku, r.jotun, r.hempel, r.ip].join(' ').toLowerCase();
                return hay.includes(q);
            });
            tableHost.innerHTML = tableHtml(
                ['Type', 'Product class', 'Chugoku', 'Jotun', 'Hempel', 'International'],
                rows.map(r => [r.type, r.product, r.chugoku, r.jotun, r.hempel, r.ip]),
            );
        };
        typeFilter.addEventListener('change', paint);
        search.addEventListener('input', paint);
        paint();
    }

    function renderEngineeringPanel(host) {
        const stdOptions = standards().map(s =>
            `<option value="${esc(s)}">${esc(s)}</option>`).join('');
        host.innerHTML = `
            <div class="maritime-panel-head">
                <h2 class="maritime-panel-title" data-i18n="tk.flange.title">📐 Flange &amp; Engineering Tables</h2>
                <p class="maritime-panel-sub" data-i18n="tk.flange.sub">JIS B2220 (5K / 10K / 16K), ANSI 150#, DIN PN10 / PN16 — dimensions in millimetres.</p>
            </div>
            <div class="maritime-flange-controls">
                <label class="maritime-field">
                    <span data-i18n="tk.flange.standard">Standard</span>
                    <select id="flangeStandardSelect">${stdOptions}</select>
                </label>
                <label class="maritime-field maritime-field-grow">
                    <span data-i18n="tk.flange.filter">Filter nominal size</span>
                    <input type="search" id="flangeSizeSearch" placeholder="e.g. 50A, DN80, 4&quot;" autocomplete="off">
                </label>
            </div>
            <div id="flangeTableHost"></div>
            <p class="maritime-note" data-i18n="tk.flange.note">Verify against yard drawing / class certificate before procurement.</p>`;

        const stdSelect = host.querySelector('#flangeStandardSelect');
        const search = host.querySelector('#flangeSizeSearch');
        const tableHost = host.querySelector('#flangeTableHost');

        const paint = () => {
            const rows = filterFlanges(stdSelect.value, search.value);
            tableHost.innerHTML = tableHtml(
                ['Nominal', 'OD (mm)', 'PCD (mm)', 'Bolts', 'Hole Ø (mm)', 'Bolt size'],
                rows.map(r => [r.nb, r.od, r.pcd, r.bolts, `Ø${r.hole}`, r.bolt]),
            );
        };
        stdSelect.addEventListener('change', paint);
        search.addEventListener('input', paint);
        paint();
        globalThis.TVC_MarketingI18n?.applyLang?.(globalThis.TVC_MarketingI18n.getLang());
    }

    function renderConversionBanner() {
        const existing = document.getElementById('toolkitFooterConversionBand');
        if (existing) return existing;
        const shell = document.querySelector('.store-public-shell') || document.querySelector('.home-shell');
        if (!shell) return null;
        const band = document.createElement('section');
        band.id = 'toolkitFooterConversionBand';
        band.className = 'toolkit-conversion-band mkt-glass-card';
        band.setAttribute('aria-label', 'TVC-SM upgrade');
        band.innerHTML = `
            <p data-i18n="tk.conversion.banner">⚓ Looking to automate ROB tracking &amp; 1-Click Requisitions?</p>
            <a class="home-btn home-btn-primary" href="/contact-us?inquiry=tvc-sm-demo" data-i18n="tk.conversion.cta">Request TVC-SM Demo</a>`;
        const footer = document.getElementById('marketing-footer');
        if (footer) shell.insertBefore(band, footer);
        else shell.appendChild(band);
        globalThis.TVC_MarketingI18n?.applyLang?.(globalThis.TVC_MarketingI18n.getLang());
        return band;
    }

    function setActiveTool(tool) {
        _activeTool = tool || 'catalog';
        document.querySelectorAll('[data-tool-tab]').forEach(btn => {
            const active = btn.dataset.toolTab === _activeTool;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        document.querySelectorAll('[data-tool-panel]').forEach(panel => {
            const show = panel.dataset.toolPanel === _activeTool;
            panel.classList.toggle('hidden', !show);
            panel.classList.toggle('store-panel-active', show);
        });
        document.body.className = document.body.className
            .replace(/store-tool-\w+/g, '')
            .trim();
        document.body.classList.add(`store-tool-${_activeTool}`);
        if (!document.body.classList.contains('store-public-body')) {
            document.body.classList.add('store-public-body');
        }
    }

    async function init() {
        const nav = document.getElementById('storePublicToolkit');
        if (!nav) return;

        nav.querySelectorAll('[data-tool-tab]').forEach(btn => {
            btn.addEventListener('click', () => setActiveTool(btn.dataset.toolTab));
        });

        if (globalThis.TVC_FlangeData?.loadFromJson) {
            try {
                await globalThis.TVC_FlangeData.loadFromJson('/data/flange-standards.json');
            } catch (err) {
                console.warn('[MaritimeToolkit] flange data load', err);
            }
        }

        const hosts = {
            bunker: document.getElementById('storeToolBunker'),
            lube: document.getElementById('storeToolLube'),
            paint: document.getElementById('storeToolPaint'),
            engineering: document.getElementById('storeToolEngineering'),
        };
        if (hosts.bunker) renderBunkerPanel(hosts.bunker);
        if (hosts.lube) renderLubePanel(hosts.lube);
        if (hosts.paint) renderPaintPanel(hosts.paint);
        if (hosts.engineering) renderEngineeringPanel(hosts.engineering);
        renderConversionBanner();
        globalThis.addEventListener('tvc-mkt-lang', () => {
            if (hosts.bunker) renderBunkerPanel(hosts.bunker);
            renderConversionBanner();
        });
        setActiveTool('catalog');
    }

    return {
        init,
        setActiveTool,
        calcVolumeToMt,
        calcBunkerMassAstM54B,
        filterFlanges,
    };
})();
