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
    ];

    const PT100_ROWS = [
        [-20, 92.16], [-10, 96.09], [0, 100.0], [10, 103.9], [20, 107.79], [30, 111.67], [40, 115.54],
        [50, 119.4], [60, 123.24], [70, 127.08], [80, 130.9], [90, 134.71], [100, 138.51], [110, 142.29],
        [120, 146.07], [130, 149.83], [140, 153.58], [150, 157.33],
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
        host.innerHTML = `
            <div class="maritime-panel-head">
                <h2 class="maritime-panel-title" data-i18n="tk.electrical.title">Electrical &amp; control diagnostics</h2>
                <p class="maritime-panel-sub" data-i18n="tk.electrical.sub">Three-phase motor full-load current (FLC) estimate and PT100 resistance–temperature (IEC 60751, α = 0.00385).</p>
            </div>
            <form class="maritime-bunker-form" id="flcCalcForm">
                <label class="maritime-field">
                    <span data-i18n="tk.electrical.kw">Motor power (kW)</span>
                    <input type="number" id="flcKw" min="0" step="0.1" value="75" inputmode="decimal">
                </label>
                <label class="maritime-field">
                    <span data-i18n="tk.electrical.voltage">Line voltage (V)</span>
                    <input type="number" id="flcVoltage" min="100" step="1" value="440" inputmode="numeric">
                </label>
                <label class="maritime-field">
                    <span data-i18n="tk.electrical.eff">Efficiency η</span>
                    <input type="number" id="flcEff" min="0.5" max="1" step="0.01" value="0.92" inputmode="decimal">
                </label>
                <label class="maritime-field">
                    <span data-i18n="tk.electrical.pf">Power factor cos φ</span>
                    <input type="number" id="flcPf" min="0.5" max="1" step="0.01" value="0.85" inputmode="decimal">
                </label>
            </form>
            <div class="maritime-bunker-result" aria-live="polite">
                <div class="maritime-bunker-metrics">
                    <div><span data-i18n="tk.electrical.flc">Est. FLC (A)</span><strong id="flcValue">—</strong></div>
                </div>
            </div>
            <h3 class="maritime-subheading" data-i18n="tk.electrical.pt100">PT100 resistance vs temperature</h3>
            <div id="pt100TableHost"></div>
            <p class="maritime-note" data-i18n="tk.electrical.note">FLC is indicative — use nameplate, class rules, and cable sizing standards before alteration.</p>`;

        const paintFlc = () => {
            const kw = Number(host.querySelector('#flcKw')?.value) || 0;
            const v = Number(host.querySelector('#flcVoltage')?.value) || 440;
            const eff = Number(host.querySelector('#flcEff')?.value) || 0.92;
            const pf = Number(host.querySelector('#flcPf')?.value) || 0.85;
            const denom = Math.sqrt(3) * v * eff * pf;
            const flc = denom > 0 ? (kw * 1000) / denom : 0;
            host.querySelector('#flcValue').textContent = flc > 0 ? `${flc.toFixed(1)} A` : '—';
        };
        host.querySelector('#flcCalcForm')?.addEventListener('input', paintFlc);
        paintFlc();
        host.querySelector('#pt100TableHost').innerHTML = tableHtml(
            ['Temp (°C)', 'R (Ω)'],
            PT100_ROWS.map(([t, r]) => [String(t), r.toFixed(2)]),
        );
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
        const existing = document.getElementById('toolkitFooterConversionBand');
        if (existing) return existing;
        const shell = document.querySelector('.store-public-shell') || document.querySelector('.home-shell');
        if (!shell) return null;
        const band = document.createElement('section');
        band.id = 'toolkitFooterConversionBand';
        band.className = 'toolkit-conversion-band mkt-glass-card';
        band.setAttribute('aria-label', 'TVC-SM upgrade');
        band.innerHTML = `
            <p data-i18n="tk.conversion.banner">ROB tracking and superintendent requisitions are operated in TVC-SM Fleet.</p>
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

        if (globalThis.TVC_MechanicalCalc?.loadStandardsFromJson) {
            try {
                await globalThis.TVC_MechanicalCalc.loadStandardsFromJson('/data/bolt-torque-standards.json');
            } catch (err) {
                console.warn('[MaritimeToolkit] bolt torque standards load', err);
            }
        }

        const hosts = {
            bunker: document.getElementById('storeToolBunker'),
            lube: document.getElementById('storeToolLube'),
            paint: document.getElementById('storeToolPaint'),
            engineering: document.getElementById('storeToolEngineering'),
            electrical: document.getElementById('storeToolElectrical'),
            compliance: document.getElementById('storeToolCompliance'),
            mechanical: document.getElementById('storeToolMechanical'),
            combustion: document.getElementById('storeToolCombustion'),
        };
        if (hosts.bunker) renderBunkerPanel(hosts.bunker);
        if (hosts.lube) renderLubePanel(hosts.lube);
        if (hosts.paint) renderPaintPanel(hosts.paint);
        if (hosts.engineering) renderEngineeringPanel(hosts.engineering);
        if (hosts.mechanical) renderMechanicalPanel(hosts.mechanical);
        if (hosts.combustion) renderCombustionPanel(hosts.combustion);
        if (hosts.electrical) renderElectricalPanel(hosts.electrical);
        if (hosts.compliance) renderCompliancePanel(hosts.compliance);
        renderConversionBanner();
        globalThis.addEventListener('tvc-mkt-lang', () => {
            if (hosts.bunker) renderBunkerPanel(hosts.bunker);
            if (hosts.lube) renderLubePanel(hosts.lube);
            if (hosts.paint) renderPaintPanel(hosts.paint);
            if (hosts.engineering) renderEngineeringPanel(hosts.engineering);
            if (hosts.mechanical) renderMechanicalPanel(hosts.mechanical);
            if (hosts.combustion) renderCombustionPanel(hosts.combustion);
            if (hosts.electrical) renderElectricalPanel(hosts.electrical);
            if (hosts.compliance) renderCompliancePanel(hosts.compliance);
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
        applyBunkerPrefill,
    };
})();
