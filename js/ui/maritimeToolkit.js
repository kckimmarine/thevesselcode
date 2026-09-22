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
        { category: 'Trunk Piston Oil', grade: '40BN', shell: 'Gadinia 40', mobil: 'Mobil Delvac 1640', castrol: 'Cyltech 40', total: 'Aurelia X 400' },
        { category: 'Trunk Piston Oil', grade: '50BN', shell: 'Gadinia 50', mobil: 'Mobil Delvac 1 SHC', castrol: 'Cyltech 50', total: 'Aurelia X 500' },
        { category: 'Hydraulic Oil', grade: 'ISO VG 32', shell: 'Tellus S2 M 32', mobil: 'Mobil DTE 10 Excel 32', castrol: 'Hyspin AWS 32', total: 'Azolla ZS 32' },
        { category: 'Hydraulic Oil', grade: 'ISO VG 46', shell: 'Tellus S2 M 46', mobil: 'Mobil DTE 10 Excel 46', castrol: 'Hyspin AWS 46', total: 'Azolla ZS 46' },
        { category: 'Hydraulic Oil', grade: 'ISO VG 68', shell: 'Tellus S2 M 68', mobil: 'Mobil DTE 10 Excel 68', castrol: 'Hyspin AWS 68', total: 'Azolla ZS 68' },
        { category: 'Hydraulic Oil', grade: 'ISO VG 100', shell: 'Tellus S2 M 100', mobil: 'Mobil DTE 10 Excel 100', castrol: 'Hyspin AWS 100', total: 'Azolla ZS 100' },
        { category: 'Cylinder Oil', grade: '40BN', shell: 'Alexia 40', mobil: 'Mobil Gard 540', castrol: 'Cleeton 40', total: 'Disola A 30' },
        { category: 'Cylinder Oil', grade: '50BN', shell: 'Alexia 50', mobil: 'Mobil Gard 560', castrol: 'Cleeton 50', total: 'Disola A 40' },
        { category: 'Cylinder Oil', grade: '120BN', shell: 'Alexia 120', mobil: 'Mobil Gard 620', castrol: 'Cleeton 120', total: 'Disola A 80' },
        { category: 'Trunk Piston Oil', grade: '30BN', shell: 'Gadinia 30', mobil: 'Mobil Delvac 1300', castrol: 'Cyltech 30', total: 'Aurelia X 300' },
        { category: 'Trunk Piston Oil', grade: '60BN', shell: 'Gadinia 60', mobil: 'Mobil Delvac 1 SHC', castrol: 'Cyltech 60', total: 'Aurelia X 600' },
        { category: 'Trunk Piston Oil', grade: '70BN', shell: 'Gadinia 70', mobil: 'Mobil Delvac 1 SHC', castrol: 'Cyltech 70', total: 'Aurelia X 700' },
        { category: 'System Oil', grade: 'SAE 20', shell: 'Gadinia 20', mobil: 'Mobil Delvac 1220', castrol: 'Cyltech 20', total: 'Aurelia X 200' },
        { category: 'System Oil', grade: 'TPEO 30', shell: 'Argina S3 30', mobil: 'Mobilgard ADL 30', castrol: 'Cyltech TPEO 30', total: 'Aurelia TI 3030' },
        { category: 'System Oil', grade: 'TPEO 40', shell: 'Argina S3 40', mobil: 'Mobilgard ADL 40', castrol: 'Cyltech TPEO 40', total: 'Aurelia TI 3040' },
        { category: 'Hydraulic Oil', grade: 'ISO VG 22', shell: 'Tellus S2 M 22', mobil: 'Mobil DTE 10 Excel 22', castrol: 'Hyspin AWS 22', total: 'Azolla ZS 22' },
        { category: 'Hydraulic Oil', grade: 'ISO VG 32 EP', shell: 'Tellus S2 MX 32', mobil: 'Mobil DTE 25', castrol: 'Hyspin AWS 32', total: 'Azolla ZS 32' },
        { category: 'Hydraulic Oil', grade: 'ISO VG 46 EP', shell: 'Tellus S2 MX 46', mobil: 'Mobil DTE 26', castrol: 'Hyspin AWS 46', total: 'Azolla ZS 46' },
    ];

    const CIC_ROWS = [
        ['OWS 15 ppm', '15 ppm alarm, automatic stopping, and 15 ppm overboard interlock records (MARPOL Annex I).'],
        ['Emergency fire pump', 'Independent power, priming arrangement, and delivery pressure at remotest hydrant.'],
        ['Quick-closing valves', 'Remote operation from safe position; marking and periodic function test per FSS Code.'],
        ['Fire dampers', 'Fire integrity, closing devices, and indication at fire control station.'],
        ['Lifesaving appliances', 'Launching appliances, on-load release hooks, and maintenance records.'],
        ['ISM familiarization', 'Crew certificates, drill records, and SMS evidence for Tokyo/Paris MoU focus.'],
    ];

    const PAINT_ROWS = [
        { type: 'Antifouling (A/F)', product: 'Self-Polishing SPC', chugoku: 'SeaGrandfather 880', jotun: 'SeaQuantum Pro', hempel: 'Globic 9500', ip: 'Interswift SPC' },
        { type: 'Antifouling (A/F)', product: 'Controlled Depletion', chugoku: 'SeaGrandfather 700', jotun: 'SeaForce 90', hempel: 'Oceanic+', ip: 'Interspeed 640' },
        { type: 'Anticorrosive (A/C)', product: 'Aluminium A/C', chugoku: 'Marine Alumi', jotun: 'Pilot A/C', hempel: 'Aluminium 15360', ip: 'Intershield 300' },
        { type: 'Anticorrosive (A/C)', product: 'Vinyl A/C', chugoku: 'Marine Vinyl', jotun: 'Pilot II', hempel: 'Light Primer 45550', ip: 'Intergard 269' },
        { type: 'Epoxy Primer', product: 'Pure Epoxy', chugoku: 'Epicon B-13', jotun: 'Barrier 77', hempel: 'Hempadur 15553', ip: 'Intershield 300' },
        { type: 'Epoxy Primer', product: 'High-Build Epoxy', chugoku: 'Epicon HB', jotun: 'Barrier 80', hempel: 'Hempadur 17240', ip: 'Intershield 803' },
        { type: 'Epoxy Primer', product: 'Tank Coating', chugoku: 'Tankguard 100', jotun: 'Tankguard Storage', hempel: 'Hempadur Mastic 45880', ip: 'Interline 984' },
        { type: 'Zinc Silicate', product: 'Ethyl Silicate', chugoku: 'Zinc Rich Primer', jotun: 'Barrier SmartPack', hempel: 'Hempadur Zinc 17360', ip: 'Interzinc 52' },
        { type: 'Zinc Silicate', product: 'Waterborne ZS', chugoku: 'SeaGrandfather ZS', jotun: 'Tankguard Zinc', hempel: 'Hempadur Zinc 85530', ip: 'Interzinc 22' },
        { type: 'Polyurethane Topcoat', product: 'Gloss White', chugoku: 'Marine Alkyd Gloss', jotun: 'Hardtop AX', hempel: 'Hempel\'s Classic', ip: 'Interthane 990' },
        { type: 'Polyurethane Topcoat', product: 'Gloss Grey', chugoku: 'Marine Alkyd Grey', jotun: 'Hardtop XP', hempel: 'Hempathane 55210', ip: 'Interthane 878' },
        { type: 'Polyurethane Topcoat', product: 'Satin', chugoku: 'Marine Satin', jotun: 'Pilot II Topcoat', hempel: 'Hempathane 45530', ip: 'Interthane 870' },
        { type: 'Antifouling (A/F)', product: 'Hard A/F', chugoku: 'SeaGrandfather 500', jotun: 'SeaForce 30', hempel: 'Olympic+', ip: 'Interspeed 663' },
        { type: 'Anticorrosive (A/C)', product: 'Epoxy A/C', chugoku: 'Epicon A/C', jotun: 'Penguard Express', hempel: 'Hempadur 45143', ip: 'Intergard 269' },
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
        const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
        const portHint = params.get('port') || 'Singapore';
        const benchmark = params.get('benchmark');
        const intelStrip = typeof globalThis.TVC_MarketFeed !== 'undefined'
            ? globalThis.TVC_MarketFeed.renderBunkerIntelStrip(portHint)
            : '';
        const benchNote = benchmark
            ? `<p class="maritime-note" style="margin-top:0">${esc(mkt('tk.bunker.benchmark', 'Ticker benchmark'))}: <strong>$${esc(benchmark)}/MT</strong> (${esc(portHint)}) — ${esc(mkt('tk.bunker.benchmark.hint', 'use observed lab density for settlement.'))}</p>`
            : '';
        host.innerHTML = `
            ${intelStrip}
            ${benchNote}
            <div class="maritime-panel-head">
                <h2 class="maritime-panel-title" data-i18n="tk.bunker.title">Bunker &amp; Fuel Calculator (ASTM Table 54B)</h2>
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
                <label class="maritime-field">
                    <span data-i18n="tk.bunker.fuelPrice">Benchmark fuel price ($/MT)</span>
                    <input type="number" id="bunkerFuelPrice" min="0" step="0.01" inputmode="decimal" placeholder="Optional" value="${benchmark ? esc(benchmark) : ''}">
                </label>
            </form>
            <div class="maritime-bunker-result" id="bunkerResult" aria-live="polite">
                <div class="maritime-bunker-metrics maritime-bunker-metrics-extended">
                    <div><span data-i18n="tk.bunker.vcf">VCF @ 15°C</span><strong id="bunkerVcfValue">—</strong></div>
                    <div><span data-i18n="tk.bunker.alpha">Alpha @ 15°C</span><strong id="bunkerAlphaValue">—</strong></div>
                    <div><span data-i18n="tk.bunker.mass">Mass in air (MT)</span><strong id="bunkerMassValue">—</strong></div>
                    <div><span data-i18n="tk.bunker.fuelCost">Total fuel cost ($)</span><strong id="bunkerFuelCostValue">—</strong></div>
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
            const priceMt = host.querySelector('#bunkerFuelPrice')?.value;
            const spend = globalThis.TVC_BunkerCalc?.calcFuelExpenditureUsd?.(result.mt, priceMt);
            host.querySelector('#bunkerMassValue').textContent = `${result.mt.toFixed(3)} MT`;
            host.querySelector('#bunkerV15Value').textContent = result.v15.toFixed(3);
            host.querySelector('#bunkerVcfValue').textContent = result.vcf.toFixed(4);
            host.querySelector('#bunkerAlphaValue').textContent = result.alpha.toExponential(4);
            host.querySelector('#bunkerCo2Value').textContent = `${(result.co2Mt || 0).toFixed(3)} MT`;
            host.querySelector('#bunkerFuelCostValue').textContent =
                spend != null ? `$${spend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
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

    function applyBunkerPrefill(params) {
        const p = params instanceof URLSearchParams ? params : new URLSearchParams(params || '');
        const fuel = p.get('fuel');
        const density = p.get('density');
        const benchmark = p.get('benchmark') || p.get('fuelPrice');
        const host = document.getElementById('storeToolBunker');
        if (!host) return;
        const fuelSelect = host.querySelector('#bunkerFuelType');
        const denInput = host.querySelector('#bunkerDensity');
        const priceInput = host.querySelector('#bunkerFuelPrice');
        const grades = globalThis.TVC_BunkerCalc?.FUEL_GRADES || {};
        if (fuel && grades[fuel] && fuelSelect) {
            fuelSelect.value = fuel;
        }
        if (density && denInput) {
            denInput.value = density;
        }
        if (benchmark && priceInput) {
            priceInput.value = benchmark;
        }
        fuelSelect?.dispatchEvent(new Event('change'));
        host.querySelector('#bunkerCalcForm')?.dispatchEvent(new Event('input'));
    }

    function renderLubePanel(host) {
        host.innerHTML = `
            <div class="maritime-panel-head">
                <h2 class="maritime-panel-title" data-i18n="tk.lube.title">Lubricant cross-reference</h2>
                <p class="maritime-panel-sub" data-i18n="tk.lube.sub">Cylinder, system, trunk piston, and hydraulic grades across major makers.</p>
            </div>
            <div class="maritime-flange-controls">
                <label class="maritime-field">
                    <span>Category</span>
                    <select id="lubeCategoryFilter">
                        <option value="">All categories</option>
                        <option value="Cylinder Oil">Cylinder Oil</option>
                        <option value="System Oil">System Oil</option>
                        <option value="Trunk Piston Oil">Trunk Piston Oil</option>
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
                <h2 class="maritime-panel-title" data-i18n="tk.paint.title">Marine paint cross-reference</h2>
                <p class="maritime-panel-sub" data-i18n="tk.paint.sub">Antifouling (A/F), anticorrosive (A/C), and epoxy primer equivalents.</p>
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

    function verdictClass(color) {
        if (color === 'green') return 'mkt-verdict mkt-verdict--normal';
        if (color === 'yellow') return 'mkt-verdict mkt-verdict--attention';
        if (color === 'red') return 'mkt-verdict mkt-verdict--exceeded';
        return 'mkt-verdict';
    }

    function boilerStatusClass(status) {
        if (status === 'NORMAL') return 'mkt-verdict mkt-verdict--normal';
        if (status === 'WARNING') return 'mkt-verdict mkt-verdict--attention';
        return 'mkt-verdict mkt-verdict--exceeded';
    }

    function renderAuxiliaryPanel(host) {
        const Aux = globalThis.TVC_AuxiliaryCalc;
        host.innerHTML = `
            <div class="maritime-panel-head">
                <h2 class="maritime-panel-title" data-i18n="tk.aux.title">Auxiliary &amp; refrigeration</h2>
                <p class="maritime-panel-sub" data-i18n="tk.aux.sub">Refrigerant P-T superheat/subcooling and auxiliary boiler water conditioning quick check.</p>
            </div>
            <div class="mkt-mechanical-grid">
                <article class="mkt-glass-card mkt-mechanical-card">
                    <h3 class="maritime-subheading" data-i18n="tk.aux.ref.title">Refrigerant P-T &amp; expansion valve check</h3>
                    <p class="mkt-prose" data-i18n="tk.aux.ref.sub">Gauge pressures (bar) + line surface temperatures → saturation, superheat, subcooling.</p>
                    <form class="maritime-bunker-form" id="refrigForm">
                        <label class="maritime-field">
                            <span data-i18n="tk.aux.ref.gas">Refrigerant</span>
                            <select id="refrigGas">
                                <option value="R134a">R134a</option>
                                <option value="R404A">R404A</option>
                                <option value="R407C">R407C</option>
                            </select>
                        </label>
                        <label class="maritime-field">
                            <span data-i18n="tk.aux.ref.suctionP">Suction (bar gauge)</span>
                            <input type="number" id="refrigSuctionP" step="0.01" value="1.0" inputmode="decimal">
                        </label>
                        <label class="maritime-field">
                            <span data-i18n="tk.aux.ref.suctionT">Suction line temp (°C)</span>
                            <input type="number" id="refrigSuctionT" step="0.1" value="0" inputmode="decimal">
                        </label>
                        <label class="maritime-field">
                            <span data-i18n="tk.aux.ref.dischargeP">Discharge (bar gauge)</span>
                            <input type="number" id="refrigDischargeP" step="0.01" value="8" inputmode="decimal">
                        </label>
                        <label class="maritime-field">
                            <span data-i18n="tk.aux.ref.liquidT">Liquid line temp (°C)</span>
                            <input type="number" id="refrigLiquidT" step="0.1" value="25" inputmode="decimal">
                        </label>
                    </form>
                    <div class="maritime-bunker-result" aria-live="polite">
                        <div class="maritime-bunker-metrics maritime-bunker-metrics-extended">
                            <div><span data-i18n="tk.aux.ref.tsate">T sat evap</span><strong id="refrigTsatE">—</strong></div>
                            <div><span data-i18n="tk.aux.ref.tsatc">T sat cond</span><strong id="refrigTsatC">—</strong></div>
                            <div><span data-i18n="tk.aux.ref.sh">Superheat</span><strong id="refrigShBadge">—</strong></div>
                            <div><span data-i18n="tk.aux.ref.sc">Subcooling</span><strong id="refrigScBadge">—</strong></div>
                        </div>
                        <p id="refrigAdvice" class="mkt-prose comb-advice">—</p>
                    </div>
                </article>
                <article class="mkt-glass-card mkt-mechanical-card">
                    <h3 class="maritime-subheading" data-i18n="tk.aux.boiler.title">Boiler water treatment</h3>
                    <p class="mkt-prose" data-i18n="tk.aux.boiler.sub">pH, chloride, and phosphate vs auxiliary boiler limits (typ. &lt;16–20 bar).</p>
                    <form class="maritime-bunker-form" id="boilerWaterForm">
                        <label class="maritime-field">
                            <span data-i18n="tk.aux.boiler.ph">pH</span>
                            <input type="number" id="boilerPh" step="0.1" value="10.2" inputmode="decimal">
                        </label>
                        <label class="maritime-field">
                            <span data-i18n="tk.aux.boiler.cl">Chloride (ppm)</span>
                            <input type="number" id="boilerCl" step="1" value="120" inputmode="numeric">
                        </label>
                        <label class="maritime-field">
                            <span data-i18n="tk.aux.boiler.po4">Phosphate (ppm PO4)</span>
                            <input type="number" id="boilerPo4" step="1" value="35" inputmode="numeric">
                        </label>
                    </form>
                    <div class="maritime-bunker-result" aria-live="polite">
                        <p id="boilerStatus" class="mkt-verdict mkt-verdict--normal">—</p>
                        <ul id="boilerActions" class="comb-hint-list"></ul>
                    </div>
                </article>
            </div>
            <p class="maritime-note" data-i18n="tk.aux.note">Use calibrated gauges and lab kits — align blowdown with chief engineer and chemical supplier program.</p>`;

        const shInRange = (sh) => sh >= 4 && sh <= 8;
        const scInRange = (sc) => sc >= 3 && sc <= 6;

        const paintRefrig = () => {
            const r = Aux?.diagnoseRefrigerant?.({
                refrigerant: host.querySelector('#refrigGas')?.value,
                suctionBarGauge: host.querySelector('#refrigSuctionP')?.value,
                suctionLineTempC: host.querySelector('#refrigSuctionT')?.value,
                dischargeBarGauge: host.querySelector('#refrigDischargeP')?.value,
                liquidLineTempC: host.querySelector('#refrigLiquidT')?.value,
            });
            if (!r || r.error) return;
            host.querySelector('#refrigTsatE').textContent = `${r.tSatEvap} °C`;
            host.querySelector('#refrigTsatC').textContent = `${r.tSatCond} °C`;
            const shEl = host.querySelector('#refrigShBadge');
            shEl.textContent = `${r.superheat} °C`;
            shEl.className = shInRange(r.superheat) ? 'mkt-metric mkt-metric--ok' : 'mkt-metric mkt-metric--warn';
            const scEl = host.querySelector('#refrigScBadge');
            scEl.textContent = `${r.subcooling} °C`;
            scEl.className = scInRange(r.subcooling) ? 'mkt-metric mkt-metric--ok' : 'mkt-metric mkt-metric--warn';
            host.querySelector('#refrigAdvice').textContent = r.diagnosisAdvice;
        };

        const paintBoiler = () => {
            const r = Aux?.diagnoseBoilerWater?.({
                ph: host.querySelector('#boilerPh')?.value,
                chloridePpm: host.querySelector('#boilerCl')?.value,
                phosphatePpm: host.querySelector('#boilerPo4')?.value,
            });
            if (!r) return;
            const statusEl = host.querySelector('#boilerStatus');
            statusEl.textContent = `${r.status}${r.blowdownRequired ? ' — Blowdown required' : ''}`;
            statusEl.className = boilerStatusClass(r.status);
            const list = host.querySelector('#boilerActions');
            list.innerHTML = r.actions.map((a) => `<li class="mkt-prose">${esc(a)}</li>`).join('');
        };

        host.querySelector('#refrigForm')?.addEventListener('input', paintRefrig);
        host.querySelector('#boilerWaterForm')?.addEventListener('input', paintBoiler);
        paintRefrig();
        paintBoiler();
        globalThis.TVC_MarketingI18n?.applyLang?.(globalThis.TVC_MarketingI18n.getLang());
    }

    function renderCombustionPanel(host) {
        const Comb = globalThis.TVC_CombustionCalc;
        const sample = Comb?.sampleSixCylinderBalanced?.() || [];

        const cylRows = sample.map((c) => `
            <tr data-comb-cyl="${c.cylNo}">
                <td>${c.cylNo}</td>
                <td><input type="number" class="comb-input" data-pmax step="0.1" value="${c.pMax}" inputmode="decimal"></td>
                <td><input type="number" class="comb-input" data-pcomp step="0.1" value="${c.pComp}" inputmode="decimal"></td>
                <td><input type="number" class="comb-input" data-texh step="1" value="${c.tExh}" inputmode="numeric"></td>
                <td class="comb-result-dpmax">—</td>
                <td class="comb-result-dtexh">—</td>
                <td class="comb-result-status">—</td>
            </tr>`).join('');

        host.innerHTML = `
            <div class="maritime-panel-head">
                <h2 class="maritime-panel-title" data-i18n="tk.comb.title">Combustion &amp; engine</h2>
                <p class="maritime-panel-sub" data-i18n="tk.comb.sub">Pmax / Pcomp / Texh deviation analysis and cylinder oil feed rate vs fuel sulfur &amp; BN (MARPOL Annex VI context).</p>
            </div>
            <div class="mkt-mechanical-grid">
                <article class="mkt-glass-card mkt-mechanical-card">
                    <div class="comb-panel-head">
                        <h3 class="maritime-subheading" data-i18n="tk.comb.balance.title">Combustion balance</h3>
                        <button type="button" class="home-btn home-btn-secondary" id="combPreset6" data-i18n="tk.comb.preset6">Load 6-cyl sample</button>
                    </div>
                    <p class="mkt-prose" data-i18n="tk.comb.balance.sub">Tolerance: ±3 bar Pmax, ±30°C Texh vs cylinder mean.</p>
                    <div class="maritime-table-wrap">
                        <table class="maritime-table" id="combInputTable">
                            <thead>
                                <tr>
                                    <th>Cyl</th>
                                    <th>Pmax (bar)</th>
                                    <th>Pcomp (bar)</th>
                                    <th>Texh (°C)</th>
                                    <th>ΔPmax</th>
                                    <th>ΔTexh</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>${cylRows}</tbody>
                        </table>
                    </div>
                    <div id="combMeansHost" class="comb-means" aria-live="polite"></div>
                    <div id="combHintsHost"></div>
                </article>
                <article class="mkt-glass-card mkt-mechanical-card">
                    <h3 class="maritime-subheading" data-i18n="tk.comb.lube.title">Cylinder oil feed rate</h3>
                    <p class="mkt-prose" data-i18n="tk.comb.lube.sub">Target SCOC from engine kW, fuel sulfur %, and cylinder oil BN.</p>
                    <form class="maritime-bunker-form" id="cylLubeForm">
                        <label class="maritime-field">
                            <span data-i18n="tk.comb.lube.kw">Engine power (kW)</span>
                            <input type="number" id="cylLubeKw" min="100" step="100" value="10000" inputmode="numeric">
                        </label>
                        <label class="maritime-field">
                            <span data-i18n="tk.comb.lube.s">Fuel sulfur (%)</span>
                            <input type="number" id="cylLubeSulfur" min="0" step="0.01" value="0.5" inputmode="decimal">
                        </label>
                        <label class="maritime-field">
                            <span data-i18n="tk.comb.lube.bn">Cylinder oil BN</span>
                            <select id="cylLubeBn">
                                <option value="40">40</option>
                                <option value="70">70</option>
                                <option value="100">100</option>
                            </select>
                        </label>
                    </form>
                    <div class="maritime-bunker-result" aria-live="polite">
                        <div class="maritime-bunker-metrics">
                            <div><span data-i18n="tk.comb.lube.gkwh">Target feed (g/kWh)</span><strong id="cylLubeGkwh">—</strong></div>
                            <div><span data-i18n="tk.comb.lube.day">Daily volume (L/day)</span><strong id="cylLubeDay">—</strong></div>
                        </div>
                        <p id="cylLubeAdvice" class="mkt-prose comb-advice">—</p>
                    </div>
                </article>
            </div>
            <p class="maritime-note" data-i18n="tk.comb.note">Diagnostics are indicative — correlate with indicator cards, drain analysis, and maker limits.</p>`;

        const readCylinders = () =>
            [...host.querySelectorAll('#combInputTable tbody tr[data-comb-cyl]')].map((row) => ({
                cylNo: Number(row.getAttribute('data-comb-cyl')),
                pMax: Number(row.querySelector('[data-pmax]')?.value),
                pComp: Number(row.querySelector('[data-pcomp]')?.value),
                tExh: Number(row.querySelector('[data-texh]')?.value),
            }));

        const paintCombustion = () => {
            if (!Comb?.diagnoseCombustion) return;
            const result = Comb.diagnoseCombustion(readCylinders());
            host.querySelector('#combMeansHost').textContent =
                `Mean Pmax ${result.meanPmax} bar · Pcomp ${result.meanPcomp} bar · Texh ${result.meanTexh} °C`;

            const hintsHost = host.querySelector('#combHintsHost');
            hintsHost.innerHTML = '';

            result.cylinders.forEach((c) => {
                const row = host.querySelector(`tr[data-comb-cyl="${c.cylNo}"]`);
                if (!row) return;
                row.querySelector('.comb-result-dpmax').innerHTML =
                    `${c.deltaPmax >= 0 ? '+' : ''}${c.deltaPmax} <span class="mkt-deviation-bar" aria-hidden="true"><span style="width:${Math.min(100, Math.abs(c.deltaPmax) * 10)}%"></span></span>`;
                row.querySelector('.comb-result-dtexh').textContent =
                    `${c.deltaTexh >= 0 ? '+' : ''}${c.deltaTexh}`;
                const statusCell = row.querySelector('.comb-result-status');
                statusCell.innerHTML = `<span class="${verdictClass(c.color)}">${c.status}</span>`;
                if (c.hints?.length) {
                    const box = document.createElement('p');
                    box.className = 'comb-hint mkt-prose';
                    box.textContent = `Cyl ${c.cylNo}: ${c.hints.join(' ')}`;
                    hintsHost.appendChild(box);
                }
            });
        };

        const paintLube = () => {
            if (!Comb?.calculateCylinderLube) return;
            const r = Comb.calculateCylinderLube({
                powerKw: host.querySelector('#cylLubeKw')?.value,
                sulfurPercent: host.querySelector('#cylLubeSulfur')?.value,
                bn: host.querySelector('#cylLubeBn')?.value,
            });
            if (r.error) {
                host.querySelector('#cylLubeGkwh').textContent = '—';
                host.querySelector('#cylLubeDay').textContent = '—';
                return;
            }
            host.querySelector('#cylLubeGkwh').textContent = String(r.targetFeedRateGPerKwh);
            host.querySelector('#cylLubeDay').textContent = String(r.dailyLiters);
            host.querySelector('#cylLubeAdvice').textContent = r.statusAdvice;
        };

        host.querySelector('#combInputTable')?.addEventListener('input', paintCombustion);
        host.querySelector('#combPreset6')?.addEventListener('click', () => {
            Comb.sampleSixCylinderBalanced().forEach((c) => {
                const row = host.querySelector(`tr[data-comb-cyl="${c.cylNo}"]`);
                if (!row) return;
                row.querySelector('[data-pmax]').value = String(c.pMax);
                row.querySelector('[data-pcomp]').value = String(c.pComp);
                row.querySelector('[data-texh]').value = String(c.tExh);
            });
            paintCombustion();
        });
        host.querySelector('#cylLubeForm')?.addEventListener('input', paintLube);

        paintCombustion();
        paintLube();
        globalThis.TVC_MarketingI18n?.applyLang?.(globalThis.TVC_MarketingI18n.getLang());
    }

    function renderMechanicalPanel(host) {
        const Mech = globalThis.TVC_MechanicalCalc;
        const sizes = Mech?.listBoltSizes?.() || [];
        const classes = Mech?.listPropertyClasses?.() || ['8.8', '10.9', '12.9'];
        const sizeOptions = sizes.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
        const classOptions = classes.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('');

        host.innerHTML = `
            <div class="maritime-panel-head">
                <h2 class="maritime-panel-title" data-i18n="tk.mech.title">Mechanical elements</h2>
                <p class="maritime-panel-sub" data-i18n="tk.mech.sub">Bolt tightening torque (ISO property class) and crankshaft deflection vs stroke — machine design &amp; alignment checks.</p>
            </div>
            <div class="mkt-mechanical-grid">
                <article class="mkt-glass-card mkt-mechanical-card">
                    <h3 class="maritime-subheading" data-i18n="tk.mech.bolt.title">Bolt torque guide</h3>
                    <p class="mkt-prose" data-i18n="tk.mech.bolt.sub">T = K × d × Fm — metric coarse threads, lightly oiled (K=0.14) or dry (K=0.18).</p>
                    <form class="maritime-bunker-form" id="boltTorqueForm">
                        <label class="maritime-field">
                            <span data-i18n="tk.mech.bolt.size">Bolt size</span>
                            <select id="boltSizeSelect">${sizeOptions}</select>
                        </label>
                        <label class="maritime-field">
                            <span data-i18n="tk.mech.bolt.class">Property class</span>
                            <select id="boltClassSelect">${classOptions}</select>
                        </label>
                        <label class="maritime-field">
                            <span data-i18n="tk.mech.bolt.lube">Lubrication</span>
                            <select id="boltLubeSelect">
                                <option value="oiled" data-i18n="tk.mech.bolt.oiled">Lightly oiled (K=0.14)</option>
                                <option value="dry" data-i18n="tk.mech.bolt.dry">Dry (K=0.18)</option>
                            </select>
                        </label>
                    </form>
                    <div class="maritime-bunker-result" aria-live="polite">
                        <div class="maritime-bunker-metrics">
                            <div><span data-i18n="tk.mech.bolt.nm">Target torque (N·m)</span><strong id="boltTorqueNm">—</strong></div>
                            <div><span data-i18n="tk.mech.bolt.kgf">Target torque (kgf·m)</span><strong id="boltTorqueKgf">—</strong></div>
                        </div>
                    </div>
                    <div id="boltTorqueTableHost"></div>
                </article>
                <article class="mkt-glass-card mkt-mechanical-card">
                    <h3 class="maritime-subheading" data-i18n="tk.mech.defl.title">Crankshaft deflection check</h3>
                    <p class="mkt-prose" data-i18n="tk.mech.defl.sub">Allowable |ΔV| = stroke × 0.00007 mm (0.07 mm per 1000 mm stroke).</p>
                    <form class="maritime-bunker-form" id="deflectionForm">
                        <label class="maritime-field">
                            <span data-i18n="tk.mech.defl.stroke">Stroke (mm)</span>
                            <input type="number" id="deflStroke" min="100" step="1" value="1200" inputmode="numeric">
                        </label>
                        <label class="maritime-field">
                            <span data-i18n="tk.mech.defl.top">Top (T)</span>
                            <input type="number" id="deflTop" step="0.001" value="0.05" inputmode="decimal">
                        </label>
                        <label class="maritime-field">
                            <span data-i18n="tk.mech.defl.bottom">Bottom (B)</span>
                            <input type="number" id="deflBottom" step="0.001" value="0" inputmode="decimal">
                        </label>
                        <label class="maritime-field">
                            <span data-i18n="tk.mech.defl.port">Port (P)</span>
                            <input type="number" id="deflPort" step="0.001" value="0" inputmode="decimal">
                        </label>
                        <label class="maritime-field">
                            <span data-i18n="tk.mech.defl.starboard">Starboard (S)</span>
                            <input type="number" id="deflStarboard" step="0.001" value="0" inputmode="decimal">
                        </label>
                    </form>
                    <div class="maritime-bunker-result" aria-live="polite">
                        <div class="maritime-bunker-metrics maritime-bunker-metrics-extended">
                            <div><span data-i18n="tk.mech.defl.dv">ΔV (mm)</span><strong id="deflDeltaV">—</strong></div>
                            <div><span data-i18n="tk.mech.defl.dh">ΔH (mm)</span><strong id="deflDeltaH">—</strong></div>
                            <div><span data-i18n="tk.mech.defl.limit">Allowable |ΔV| (mm)</span><strong id="deflLimit">—</strong></div>
                        </div>
                        <p id="deflVerdict" class="mkt-verdict mkt-verdict--normal">—</p>
                    </div>
                </article>
            </div>
            <p class="maritime-note" data-i18n="tk.mech.note">Torque values are indicative — confirm with maker manual, joint standard, and class requirements.</p>`;

        const paintBolt = () => {
            if (!Mech?.calcBoltTorque) return;
            const size = host.querySelector('#boltSizeSelect')?.value;
            const propertyClass = host.querySelector('#boltClassSelect')?.value;
            const lubrication = host.querySelector('#boltLubeSelect')?.value;
            const r = Mech.calcBoltTorque({ size, propertyClass, lubrication });
            if (r.error) {
                host.querySelector('#boltTorqueNm').textContent = '—';
                host.querySelector('#boltTorqueKgf').textContent = '—';
                return;
            }
            host.querySelector('#boltTorqueNm').textContent = String(r.torqueNm);
            host.querySelector('#boltTorqueKgf').textContent = String(r.torqueKgfM);
        };

        const paintBoltTable = () => {
            const tableHost = host.querySelector('#boltTorqueTableHost');
            if (!tableHost || !Mech?.buildTorqueLookupTable) return;
            const lub = host.querySelector('#boltLubeSelect')?.value === 'dry' ? 'dry' : 'oiled';
            const rows = Mech.buildTorqueLookupTable().map((row) => {
                const nm = lub === 'dry' ? row.torqueNmDry : row.torqueNmOiled;
                const kgf = lub === 'dry' ? row.torqueKgfMDry : row.torqueKgfMOiled;
                return [row.size, row.propertyClass, String(nm), String(kgf)];
            });
            tableHost.innerHTML = tableHtml(
                ['Size', 'Class', 'N·m', 'kgf·m'],
                rows,
            );
        };

        const paintDefl = () => {
            if (!Mech?.diagnoseDeflection) return;
            const r = Mech.diagnoseDeflection({
                strokeMm: host.querySelector('#deflStroke')?.value,
                top: host.querySelector('#deflTop')?.value,
                bottom: host.querySelector('#deflBottom')?.value,
                port: host.querySelector('#deflPort')?.value,
                starboard: host.querySelector('#deflStarboard')?.value,
                unit: 'mm',
            });
            host.querySelector('#deflDeltaV').textContent = Number.isFinite(r.deltaV) ? r.deltaV.toFixed(3) : '—';
            host.querySelector('#deflDeltaH').textContent = Number.isFinite(r.deltaH) ? r.deltaH.toFixed(3) : '—';
            host.querySelector('#deflLimit').textContent = Number.isFinite(r.allowableLimitMm)
                ? r.allowableLimitMm.toFixed(3)
                : '—';
            const verdict = host.querySelector('#deflVerdict');
            verdict.textContent = `${r.status} — ${r.advice}`;
            verdict.className = verdictClass(r.color);
        };

        host.querySelector('#boltTorqueForm')?.addEventListener('input', () => {
            paintBolt();
            paintBoltTable();
        });
        host.querySelector('#boltLubeSelect')?.addEventListener('change', () => {
            paintBolt();
            paintBoltTable();
        });
        host.querySelector('#deflectionForm')?.addEventListener('input', paintDefl);

        const m16 = sizes.includes('M16') ? 'M16' : sizes[0];
        if (m16 && host.querySelector('#boltSizeSelect')) host.querySelector('#boltSizeSelect').value = m16;
        paintBolt();
        paintBoltTable();
        paintDefl();
        globalThis.TVC_MarketingI18n?.applyLang?.(globalThis.TVC_MarketingI18n.getLang());
    }

    function renderEngineeringPanel(host) {
        const stdOptions = standards().map(s =>
            `<option value="${esc(s)}">${esc(s)}</option>`).join('');
        host.innerHTML = `
            <div class="maritime-panel-head">
                <h2 class="maritime-panel-title" data-i18n="tk.flange.title">Flange &amp; piping tables</h2>
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

    function renderElectricalPanel(host) {
        const Elec = globalThis.TVC_ElectricalCalc;
        host.innerHTML = `
            <div class="maritime-panel-head">
                <h2 class="maritime-panel-title" data-i18n="tk.electrical.title">Electrical &amp; controls (EE)</h2>
                <p class="maritime-panel-sub" data-i18n="tk.electrical.sub">PT100 RTD inversion (IEC 60751) and 3-phase motor FLC with DOL inrush and EOCR relay guidance.</p>
            </div>
            <div class="mkt-mechanical-grid">
                <article class="mkt-glass-card mkt-mechanical-card">
                    <h3 class="maritime-subheading" data-i18n="tk.electrical.pt100card">PT100 temperature lookup</h3>
                    <p class="mkt-prose" data-i18n="tk.electrical.pt100sub">Measured resistance (Ω) → equivalent temperature (°C).</p>
                    <form class="maritime-bunker-form" id="pt100InvertForm">
                        <label class="maritime-field">
                            <span data-i18n="tk.electrical.pt100ohms">Measured resistance (Ω)</span>
                            <input type="number" id="pt100Ohms" min="0" step="0.01" value="119.4" inputmode="decimal">
                        </label>
                    </form>
                    <div class="maritime-bunker-result" aria-live="polite">
                        <div class="maritime-bunker-metrics">
                            <div><span data-i18n="tk.electrical.pt100temp">Equivalent temperature</span><strong id="pt100TempOut">—</strong></div>
                        </div>
                    </div>
                    <button type="button" class="home-btn home-btn-secondary" id="pt100TableToggle" data-i18n="tk.electrical.pt100toggle">Show IEC 60751 reference table</button>
                    <div id="pt100TableHost" class="hidden" hidden></div>
                </article>
                <article class="mkt-glass-card mkt-mechanical-card">
                    <h3 class="maritime-subheading" data-i18n="tk.electrical.motorcard">3-phase motor current &amp; protection</h3>
                    <p class="mkt-prose" data-i18n="tk.electrical.motorsub">FLC, DOL starting current, and recommended EOCR setting.</p>
                    <form class="maritime-bunker-form" id="motorCalcForm">
                        <label class="maritime-field">
                            <span data-i18n="tk.electrical.kw">Motor power (kW)</span>
                            <input type="number" id="motorKw" min="0" step="0.1" value="15" inputmode="decimal">
                        </label>
                        <label class="maritime-field">
                            <span data-i18n="tk.electrical.voltage">Line voltage (V)</span>
                            <select id="motorVoltage">
                                <option value="220">220 V</option>
                                <option value="440" selected>440 V</option>
                                <option value="6600">6600 V</option>
                            </select>
                        </label>
                        <label class="maritime-field">
                            <span data-i18n="tk.electrical.eff">Efficiency η</span>
                            <input type="number" id="motorEff" min="0.5" max="1" step="0.01" value="0.90" inputmode="decimal">
                        </label>
                        <label class="maritime-field">
                            <span data-i18n="tk.electrical.pf">Power factor cos φ</span>
                            <input type="number" id="motorPf" min="0.5" max="1" step="0.01" value="0.85" inputmode="decimal">
                        </label>
                    </form>
                    <div class="maritime-bunker-result" aria-live="polite">
                        <div class="maritime-bunker-metrics maritime-bunker-metrics-extended">
                            <div><span data-i18n="tk.electrical.flc">FLC (A)</span><strong id="motorFlc">—</strong></div>
                            <div><span data-i18n="tk.electrical.dol">DOL start (A)</span><strong id="motorDol">—</strong></div>
                            <div><span data-i18n="tk.electrical.eocr">EOCR set (A)</span><strong id="motorEocr">—</strong></div>
                        </div>
                        <p id="motorAdvice" class="mkt-prose comb-advice">—</p>
                    </div>
                </article>
            </div>
            <p class="maritime-note" data-i18n="tk.electrical.note">Confirm against nameplate, sequence control interlocks, and HV safety procedures before energizing.</p>`;

        const paintPt100 = () => {
            const ohms = host.querySelector('#pt100Ohms')?.value;
            const t = Elec?.pt100ToTemperature?.(ohms);
            host.querySelector('#pt100TempOut').textContent =
                t != null ? `${t.toFixed(1)} °C` : '—';
        };

        const tableHost = host.querySelector('#pt100TableHost');
        const toggleBtn = host.querySelector('#pt100TableToggle');
        toggleBtn?.addEventListener('click', () => {
            const open = tableHost.classList.toggle('hidden');
            tableHost.hidden = open;
            if (!open && Elec?.getPt100ReferenceTable) {
                const rows = Elec.getPt100ReferenceTable().map((r) => [
                    String(r.tempC),
                    r.ohms.toFixed(2),
                ]);
                tableHost.innerHTML = tableHtml(['Temp (°C)', 'R (Ω)'], rows);
            }
        });

        const paintMotor = () => {
            const r = Elec?.calculateMotorSpecs?.({
                powerKw: host.querySelector('#motorKw')?.value,
                voltage: host.querySelector('#motorVoltage')?.value,
                powerFactor: host.querySelector('#motorPf')?.value,
                efficiency: host.querySelector('#motorEff')?.value,
            });
            if (!r || r.error) {
                host.querySelector('#motorFlc').textContent = '—';
                host.querySelector('#motorDol').textContent = '—';
                host.querySelector('#motorEocr').textContent = '—';
                return;
            }
            host.querySelector('#motorFlc').textContent = `${r.flcAmps.toFixed(1)} A`;
            host.querySelector('#motorDol').textContent = `${r.dolStartingAmps.toFixed(0)} A`;
            host.querySelector('#motorEocr').textContent = `${r.eocrSettingAmps.toFixed(1)} A`;
            host.querySelector('#motorAdvice').textContent = r.adviceText;
        };

        host.querySelector('#pt100InvertForm')?.addEventListener('input', paintPt100);
        host.querySelector('#motorCalcForm')?.addEventListener('input', paintMotor);
        paintPt100();
        paintMotor();
        globalThis.TVC_MarketingI18n?.applyLang?.(globalThis.TVC_MarketingI18n.getLang());
    }

    function renderCompliancePanel(host) {
        host.innerHTML = `
            <div class="maritime-panel-head">
                <h2 class="maritime-panel-title" data-i18n="tk.compliance.title">Statutory &amp; survey compliance</h2>
                <p class="maritime-panel-sub" data-i18n="tk.compliance.sub">Tokyo / Paris MoU concentrated inspection campaign (CIC) style checkpoints — verify against current PSC circular.</p>
            </div>
            <div id="cicTableHost"></div>
            <p class="maritime-note" data-i18n="tk.compliance.note">Reference only. Always use the official MoU CIC questionnaire and class/statutory requirements in force.</p>`;
        host.querySelector('#cicTableHost').innerHTML = tableHtml(
            ['Focus area', 'Inspection checkpoint'],
            CIC_ROWS,
        );
        globalThis.TVC_MarketingI18n?.applyLang?.(globalThis.TVC_MarketingI18n.getLang());
    }

    function renderConversionBanner() {
        document.getElementById('toolkitFooterConversionBand')?.remove();
        return null;
    }

    let _engSearchHighlightId = null;

    function renderEngineeringSearchTray(tray, hits) {
        if (!tray) return;
        if (!hits.length) {
            tray.classList.add('hidden');
            tray.innerHTML = '';
            return;
        }
        tray.classList.remove('hidden');
        tray.innerHTML = hits
            .slice(0, 8)
            .map(({ entry }) => {
                const steps = Array.isArray(entry.actionSteps) ? entry.actionSteps[0] : entry.actionSteps;
                return `<article class="mkt-eng-search-card" role="option" data-eng-id="${esc(entry.id)}" data-eng-tab="${esc(entry.calculatorTab)}">
                    <h3 class="mkt-eng-search-card-title">${esc(entry.title)}</h3>
                    <p class="mkt-eng-search-meta"><span class="mkt-eng-search-tag">${esc(entry.discipline)}</span></p>
                    <dl class="mkt-eng-search-dl">
                        <div><dt>Principle</dt><dd>${esc(entry.principle)}</dd></div>
                        <div><dt>Standard</dt><dd>${esc(entry.standardValue)}</dd></div>
                        <div><dt>Action</dt><dd>${esc(steps || '')}</dd></div>
                    </dl>
                    <button type="button" class="mkt-eng-search-open home-btn home-btn-secondary" data-eng-open="${esc(entry.id)}">Open Calculator</button>
                </article>`;
            })
            .join('');
    }

    function highlightEngineeringCard(entryId) {
        document.querySelectorAll('.mkt-eng-search-card').forEach((el) => {
            el.classList.toggle('mkt-eng-search-card--active', el.dataset.engId === entryId);
        });
        const active = document.querySelector(`.mkt-eng-search-card[data-eng-id="${entryId}"]`);
        active?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    }

    const TOOL_PANEL_HASH = {
        bunker: 'tab-bunker',
        engineering: 'tab-flange',
        mechanical: 'tab-mechanical',
        combustion: 'tab-combustion',
        lube: 'tab-luboil',
        paint: 'tab-paint',
        electrical: 'tab-electrical',
        compliance: 'tab-psc-guard',
        auxiliary: 'tab-auxiliary',
        catalog: 'tab-impa',
    };
    const HASH_TO_TOOL = Object.fromEntries(
        Object.entries(TOOL_PANEL_HASH).map(([tool, hash]) => [hash, tool]),
    );

    function resolveToolkitToolFromLocation(loc = globalThis.location) {
        if (!loc) return null;
        const params = new URLSearchParams(loc.search || '');
        const fromQuery = params.get('tool');
        if (fromQuery && TOOL_PANEL_HASH[fromQuery]) return fromQuery;
        const hash = (loc.hash || '').replace(/^#/, '');
        return HASH_TO_TOOL[hash] || null;
    }

    function syncToolkitLocation(tool) {
        const tab = tool || 'catalog';
        if (!TOOL_PANEL_HASH[tab] || !globalThis.history?.replaceState) return;
        const params = new URLSearchParams(globalThis.location?.search || '');
        params.set('tool', tab);
        const hash = TOOL_PANEL_HASH[tab];
        const path = globalThis.location?.pathname || '/toolkit';
        const qs = params.toString();
        globalThis.history.replaceState(null, '', `${path}${qs ? `?${qs}` : ''}#${hash}`);
    }

    function openToolkitModule(tool, { scroll = true, syncUrl = true } = {}) {
        const tab = TOOL_PANEL_HASH[tool] ? tool : 'catalog';
        setActiveTool(tab);
        if (syncUrl) syncToolkitLocation(tab);
        if (tab === 'bunker') {
            applyBunkerPrefill(new URLSearchParams(globalThis.location?.search || ''));
        }
        if (scroll) {
            globalThis.document.getElementById('storePublicToolkit')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
        }
    }

    function initEngineeringModuleCards() {
        const grid = document.querySelector('.mkt-engineering-modules');
        if (!grid) return;
        grid.querySelectorAll('.module-card[data-tool-tab]').forEach((card) => {
            const activate = (ev) => {
                ev.preventDefault();
                openToolkitModule(card.dataset.toolTab);
            };
            card.addEventListener('click', activate);
            card.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter' || ev.key === ' ') activate(ev);
            });
        });
    }

    function jumpToEngineeringCalculator(tab, entryId) {
        _engSearchHighlightId = entryId || null;
        openToolkitModule(tab || 'catalog', { scroll: true, syncUrl: true });
        const panel = document.querySelector(`[data-tool-panel="${tab}"]`);
        if (panel) {
            panel.classList.add('mkt-tool-panel--search-focus');
            globalThis.setTimeout(() => panel.classList.remove('mkt-tool-panel--search-focus'), 2400);
        }
        const tray = document.getElementById('mktEngSearchTray');
        if (tray && entryId) {
            tray.querySelectorAll('.mkt-eng-search-card').forEach((el) => {
                el.classList.toggle('mkt-eng-search-card--active', el.dataset.engId === entryId);
            });
        }
    }

    function initEngineeringSearch() {
        const input = document.getElementById('mktEngSearchInput');
        const tray = document.getElementById('mktEngSearchTray');
        const Search = globalThis.TVC_EngineeringSearch;
        if (!input || !tray || !Search?.searchEngineeringKnowledge) return;

        const runSearch = () => {
            const q = input.value.trim();
            if (!q) {
                tray.classList.add('hidden');
                tray.innerHTML = '';
                return;
            }
            const hits = Search.searchEngineeringKnowledge(q);
            renderEngineeringSearchTray(tray, hits);
            if (_engSearchHighlightId) highlightEngineeringCard(_engSearchHighlightId);
        };

        input.addEventListener('input', runSearch);
        input.addEventListener('focus', runSearch);

        tray.addEventListener('click', (ev) => {
            const btn = ev.target.closest('[data-eng-open]');
            const card = ev.target.closest('[data-eng-tab]');
            if (btn || card) {
                const el = btn ? btn.closest('[data-eng-tab]') : card;
                const tab = el?.dataset?.engTab;
                const id = el?.dataset?.engId;
                if (tab) jumpToEngineeringCalculator(tab, id);
            }
        });

        document.addEventListener('click', (ev) => {
            const wrap = document.getElementById('mktEngSearchWrap');
            if (wrap && !wrap.contains(ev.target)) {
                tray.classList.add('hidden');
            }
        });
    }

    async function loadEngineeringKnowledgeIndex() {
        const Search = globalThis.TVC_EngineeringSearch;
        if (!Search?.loadKnowledgeIndexFromJson) return;
        try {
            await Search.loadKnowledgeIndexFromJson('/data/engineering-knowledge-index.json');
        } catch (err) {
            console.warn('[MaritimeToolkit] engineering knowledge index load', err);
        }
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

        if (globalThis.TVC_MechanicalCalc?.loadStandardsFromJson) {
            try {
                await globalThis.TVC_MechanicalCalc.loadStandardsFromJson('/data/bolt-torque-standards.json');
            } catch (err) {
                console.warn('[MaritimeToolkit] bolt torque standards load', err);
            }
        }

        await loadEngineeringKnowledgeIndex();
        initEngineeringSearch();

        if (globalThis.TVC_FleetRegistry?.loadIndex) {
            try {
                await globalThis.TVC_FleetRegistry.loadIndex();
            } catch (err) {
                console.warn('[MaritimeToolkit] fleet index preload', err);
            }
        }
        globalThis.TVC_VesselLookup?.init?.();

        const hosts = {
            bunker: document.getElementById('storeToolBunker'),
            lube: document.getElementById('storeToolLube'),
            paint: document.getElementById('storeToolPaint'),
            engineering: document.getElementById('storeToolEngineering'),
            electrical: document.getElementById('storeToolElectrical'),
            compliance: document.getElementById('storeToolCompliance'),
            mechanical: document.getElementById('storeToolMechanical'),
            combustion: document.getElementById('storeToolCombustion'),
            auxiliary: document.getElementById('storeToolAuxiliary'),
        };
        if (hosts.bunker) renderBunkerPanel(hosts.bunker);
        if (hosts.lube) renderLubePanel(hosts.lube);
        if (hosts.paint) renderPaintPanel(hosts.paint);
        if (hosts.engineering) renderEngineeringPanel(hosts.engineering);
        if (hosts.mechanical) renderMechanicalPanel(hosts.mechanical);
        if (hosts.combustion) renderCombustionPanel(hosts.combustion);
        if (hosts.electrical) renderElectricalPanel(hosts.electrical);
        if (hosts.compliance) renderCompliancePanel(hosts.compliance);
        if (hosts.auxiliary) renderAuxiliaryPanel(hosts.auxiliary);
        renderConversionBanner();
        initEngineeringModuleCards();
        globalThis.addEventListener('tvc-mkt-lang', () => {
            if (hosts.bunker) renderBunkerPanel(hosts.bunker);
            if (hosts.lube) renderLubePanel(hosts.lube);
            if (hosts.paint) renderPaintPanel(hosts.paint);
            if (hosts.engineering) renderEngineeringPanel(hosts.engineering);
            if (hosts.mechanical) renderMechanicalPanel(hosts.mechanical);
            if (hosts.combustion) renderCombustionPanel(hosts.combustion);
            if (hosts.electrical) renderElectricalPanel(hosts.electrical);
            if (hosts.compliance) renderCompliancePanel(hosts.compliance);
            if (hosts.auxiliary) renderAuxiliaryPanel(hosts.auxiliary);
            renderConversionBanner();
        });
        const deeplinkTool = resolveToolkitToolFromLocation();
        setActiveTool(deeplinkTool || 'catalog');
        if (deeplinkTool) syncToolkitLocation(deeplinkTool);
    }

    return {
        init,
        setActiveTool,
        openToolkitModule,
        resolveToolkitToolFromLocation,
        syncToolkitLocation,
        calcVolumeToMt,
        calcBunkerMassAstM54B,
        filterFlanges,
        applyBunkerPrefill,
    };
})();
