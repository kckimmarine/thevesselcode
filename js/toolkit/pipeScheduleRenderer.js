/**
 * Pipe schedule interactive table for Maritime Toolkit (#pipe-schedule).
 */
(function (global) {
    'use strict';

    let _mounted = false;
    let _selectedKey = '';
    let _selectedSchedule = 'sch40';
    let _unitMode = 'metric';

    function esc(s) {
        return String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function fmtWall(v, unitMode) {
        if (v == null || !Number.isFinite(Number(v))) return '—';
        const mm = Number(v);
        if (unitMode === 'imperial') {
            return `${(mm / 25.4).toFixed(3)}"`;
        }
        if (unitMode === 'dual') {
            return `${mm.toFixed(2)} mm (${(mm / 25.4).toFixed(3)}")`;
        }
        return `${mm.toFixed(2)} mm`;
    }

    function fmtOd(row, unitMode) {
        if (unitMode === 'imperial') return `${row.odIn.toFixed(3)}"`;
        if (unitMode === 'dual') return `${row.odMm.toFixed(1)} mm (${row.odIn.toFixed(3)}")`;
        return `${row.odMm.toFixed(1)} mm`;
    }

    function fmtWeight(row, unitMode) {
        const kg = row.weightStdKgM;
        if (kg == null) return '—';
        if (unitMode === 'imperial') {
            const lb = row.weightSch40LbFt ?? (kg * 0.671968975);
            return `${lb.toFixed(2)} lb/ft`;
        }
        if (unitMode === 'dual') {
            const lb = row.weightSch40LbFt ?? (kg * 0.671968975);
            return `${kg.toFixed(2)} kg/m (${lb.toFixed(2)} lb/ft)`;
        }
        return `${kg.toFixed(2)} kg/m`;
    }

    function weightForSchedule(row, scheduleKey, unitMode) {
        const kg = scheduleKey === 'sch80' ? row.weightSch80KgM : scheduleKey === 'sch160' ? row.weightSch160KgM : row.weightSch40KgM;
        if (kg == null) return '—';
        if (unitMode === 'imperial') {
            const lb = scheduleKey === 'sch80' ? row.weightSch80LbFt : scheduleKey === 'sch160' ? row.weightSch160LbFt : row.weightSch40LbFt;
            return `${(lb ?? kg * 0.671968975).toFixed(2)} lb/ft`;
        }
        if (unitMode === 'dual') {
            const lb = scheduleKey === 'sch80' ? row.weightSch80LbFt : scheduleKey === 'sch160' ? row.weightSch160LbFt : row.weightSch40LbFt;
            return `${kg.toFixed(2)} kg/m (${(lb ?? kg * 0.671968975).toFixed(2)} lb/ft)`;
        }
        return `${kg.toFixed(2)} kg/m`;
    }

    function buildRfqUrl(row, scheduleKey) {
        const Data = global.TVC_PipeScheduleData;
        const name = Data?.formatSpecSummary?.(row, scheduleKey) || `${row.nps} pipe schedule`;
        const params = new URLSearchParams({
            inquiry: 'rfq',
            ref: '/toolkit#pipe-schedule',
            name,
        });
        return `/contact-us?${params.toString()}`;
    }

    function rowKey(row) {
        return row.jisA;
    }

    function paintTable(root, rows) {
        const tbody = root.querySelector('#pipeScheduleTableBody');
        if (!tbody) return;
        tbody.innerHTML = rows.map((row) => {
            const key = rowKey(row);
            const selected = _selectedKey === key ? ' pipe-schedule-row-selected' : '';
            return `<tr class="pipe-schedule-row${selected}" data-pipe-key="${esc(key)}" tabindex="0" role="button">
                <th scope="row">${esc(row.nps)}<br><span class="muted">${esc(row.jisA)} · ${esc(row.dn)}</span></th>
                <td>${esc(fmtOd(row, _unitMode))}</td>
                <td>${esc(fmtWall(row.sch40, _unitMode))}</td>
                <td>${esc(fmtWall(row.sch80, _unitMode))}</td>
                <td>${esc(fmtWall(row.sch160, _unitMode))}</td>
                <td>${esc(weightForSchedule(row, 'sch40', _unitMode))}</td>
            </tr>`;
        }).join('');
        const section = root.closest('#pipe-schedule');
        if (section) {
            section.dataset.pipeScheduleRows = String(rows.length);
        }
    }

    function updateRfqButton(root) {
        const btn = root.querySelector('#pipeScheduleRfqBtn');
        if (!btn) return;
        const Data = global.TVC_PipeScheduleData;
        const row = Data?.getRowByKey?.(_selectedKey) || Data?.allRows?.()?.[0];
        if (row && !_selectedKey) _selectedKey = rowKey(row);
        const active = Data?.getRowByKey?.(_selectedKey) || row;
        if (!active) {
            btn.setAttribute('aria-disabled', 'true');
            btn.href = '/contact-us?inquiry=rfq&ref=%2Ftoolkit%23pipe-schedule';
            return;
        }
        btn.removeAttribute('aria-disabled');
        btn.href = buildRfqUrl(active, _selectedSchedule);
    }

    function mountShell(host) {
        host.innerHTML = `
            <div class="maritime-panel-head">
                <h2 class="maritime-panel-title" data-i18n="tk.pipeSchedule.title">Pipe schedule &amp; dimensions</h2>
                <p class="maritime-panel-sub" data-i18n="tk.pipeSchedule.sub">ASME B36.10M and JIS G3452/G3454 reference — SCH 40 (STD), SCH 80 (XS), SCH 160 wall thickness, OD, and weight.</p>
            </div>
            <div class="pipe-schedule-controls maritime-flange-controls">
                <label class="maritime-field maritime-field-grow">
                    <span data-i18n="tk.pipeSchedule.filter">Filter nominal bore</span>
                    <input type="search" id="pipeScheduleFilter" placeholder="e.g. 50A, 2&quot;, DN100" autocomplete="off">
                </label>
                <label class="maritime-field">
                    <span data-i18n="tk.pipeSchedule.units">Units</span>
                    <select id="pipeScheduleUnits">
                        <option value="metric" data-i18n="tk.pipeSchedule.units.metric">Metric (mm / kg·m⁻¹)</option>
                        <option value="imperial" data-i18n="tk.pipeSchedule.units.imperial">Imperial (in / lb·ft⁻¹)</option>
                        <option value="dual" data-i18n="tk.pipeSchedule.units.dual">Dual columns</option>
                    </select>
                </label>
                <label class="maritime-field">
                    <span data-i18n="tk.pipeSchedule.rfqSchedule">RFQ schedule</span>
                    <select id="pipeScheduleRfqSchedule">
                        <option value="sch40">SCH 40 (STD)</option>
                        <option value="sch80">SCH 80 (XS)</option>
                        <option value="sch160">SCH 160</option>
                    </select>
                </label>
            </div>
            <div class="pipe-schedule-table-wrap mro-hub-spec-wrap">
                <table class="pipe-schedule-table mro-hub-spec-table spec-table" id="pipeScheduleTable">
                    <thead>
                        <tr>
                            <th scope="col" data-i18n="tk.pipeSchedule.col.nominal">Nominal (NPS / JIS)</th>
                            <th scope="col" data-i18n="tk.pipeSchedule.col.od">Outside Ø</th>
                            <th scope="col">SCH 40</th>
                            <th scope="col">SCH 80</th>
                            <th scope="col">SCH 160</th>
                            <th scope="col" data-i18n="tk.pipeSchedule.col.weight">Weight (SCH 40 ref)</th>
                        </tr>
                    </thead>
                    <tbody id="pipeScheduleTableBody"></tbody>
                </table>
            </div>
            <div class="pipe-schedule-actions impa-detail-commerce-actions">
                <a class="btn-action-rfq" id="pipeScheduleRfqBtn" href="/contact-us?inquiry=rfq&ref=%2Ftoolkit%23pipe-schedule">📋 Inquire Pipe &amp; Fitting RFQ</a>
            </div>
            <p class="pipe-schedule-crosslink mkt-prose">
                <span data-i18n="tk.pipeSchedule.mroLead">Looking for compatible flanges &amp; valves?</span>
                <a href="/mro/pipes-fittings" data-i18n="tk.pipeSchedule.mroLink">Visit MRO Pipes &amp; Fittings ↗</a>
            </p>
            <p class="maritime-note" data-i18n="tk.pipeSchedule.note">Reference only — confirm mill certificate, class, and procurement spec before order.</p>`;
    }

    function bindEvents(host) {
        const Data = global.TVC_PipeScheduleData;
        const filter = host.querySelector('#pipeScheduleFilter');
        const units = host.querySelector('#pipeScheduleUnits');
        const sched = host.querySelector('#pipeScheduleRfqSchedule');
        const tbody = host.querySelector('#pipeScheduleTableBody');

        const repaint = () => {
            const rows = Data?.filterRows?.(filter?.value || '') || [];
            paintTable(host, rows);
            updateRfqButton(host);
        };

        filter?.addEventListener('input', repaint);
        units?.addEventListener('change', () => {
            _unitMode = units.value || 'metric';
            repaint();
        });
        sched?.addEventListener('change', () => {
            _selectedSchedule = sched.value || 'sch40';
            updateRfqButton(host);
        });

        tbody?.addEventListener('click', (ev) => {
            const tr = ev.target.closest('[data-pipe-key]');
            if (!tr) return;
            _selectedKey = tr.dataset.pipeKey || '';
            host.querySelectorAll('.pipe-schedule-row-selected').forEach((el) => el.classList.remove('pipe-schedule-row-selected'));
            tr.classList.add('pipe-schedule-row-selected');
            updateRfqButton(host);
        });

        const first = Data?.allRows?.()?.[0];
        if (first) _selectedKey = rowKey(first);
        repaint();
        global.TVC_MarketingI18n?.applyLang?.(global.TVC_MarketingI18n.getLang());
    }

    function init(selector) {
        if (_mounted) return;
        const host = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!host || !global.TVC_PipeScheduleData) return;
        mountShell(host);
        bindEvents(host);
        _mounted = true;
    }

    global.TVC_PipeScheduleRenderer = { init };
}(typeof globalThis !== 'undefined' ? globalThis : window));
