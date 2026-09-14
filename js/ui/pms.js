/* PMS equipment taxonomy tree — profile-aware navigation helpers (Work Plan / GROUP Tree). */
const TVC_PmsEquipmentTree = (function () {
    const ROW_H = TVC_VirtualList?.ROW_H || 40;

    function deptForUser(user) {
        const u = user || (typeof TVC_Auth !== 'undefined' ? TVC_Auth.getCurrentUser() : null);
        const d = String(u?.department || '').trim().toUpperCase();
        if (d.includes('DECK')) return 'DECK';
        if (d.includes('ENGINE')) return 'ENGINE';
        return d || 'ENGINE';
    }

    async function loadContext(vesselId) {
        await TVC_MachineryTaxonomy.loadTaxonomy();
        const profileId = await TVC_MachineryTaxonomy.resolveActiveProfile(vesselId);
        const profile = TVC_MachineryTaxonomy.getProfile(profileId);
        return { profileId, profile };
    }

    /** Flat rows for virtual list: group label + equipment chips */
    async function buildTaxonomyRows(opts = {}) {
        const { profileId } = await loadContext(opts.vesselId);
        const dept = normDept(opts.department || deptForUser(opts.user));
        const groups = TVC_MachineryTaxonomy.groupsForDepartment(profileId, dept);
        return groups.map(g => ({
            key: `${dept}|${g.label}`,
            department: dept,
            label: g.label,
            equipment: g.equipment || [],
            tier: g.tier,
        }));
    }

    function normDept(dept) {
        const d = String(dept || '').trim().toUpperCase();
        if (d.includes('DECK')) return 'DECK';
        if (d.includes('ENGINE')) return 'ENGINE';
        return d;
    }

    function renderRowHtml(row, selectedKey) {
        const sel = row.key === selectedKey ? ' spare-tax-row-selected' : '';
        const tier = row.tier === 'extension' ? '<span class="muted">ext</span>' : '';
        const eq = (row.equipment || []).slice(0, 3).map(e => `<span class="spare-tax-eq">${escapeHtml(e)}</span>`).join('');
        const more = (row.equipment || []).length > 3 ? `<span class="muted">+${row.equipment.length - 3}</span>` : '';
        return `<button type="button" class="spare-tax-row${sel}" data-tax-key="${escapeAttr(row.key)}">
          <span class="spare-tax-label">${escapeHtml(row.label)}</span>${tier}
          <span class="spare-tax-eq-wrap">${eq}${more}</span>
        </button>`;
    }

    function escapeHtml(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    }

    function escapeAttr(s) {
        return escapeHtml(s);
    }

    /**
     * Mount taxonomy rail beside GROUP Tree (mobile-safe; does not alter desktop >768 layout unless container provided).
     * @param {HTMLElement} container
     * @param {{ department?: string, vesselId?: string, onSelect?: (key: string) => void }} opts
     */
    async function mountTaxonomyRail(container, opts = {}) {
        if (!container || typeof TVC_VirtualList === 'undefined') return null;
        const rows = await buildTaxonomyRows(opts);
        let selectedKey = opts.selectedKey || '';
        const { profile } = await loadContext(opts.vesselId);
        const head = document.createElement('div');
        head.className = 'spare-tax-head muted';
        head.textContent = profile?.demo_label || profile?.label || 'Machinery catalog';
        container.innerHTML = '';
        container.appendChild(head);

        const scroll = document.createElement('div');
        scroll.className = 'spare-tax-scroll';
        scroll.style.maxHeight = opts.maxHeight || '240px';
        container.appendChild(scroll);

        const vl = TVC_VirtualList.mount(scroll, {
            rowHeight: ROW_H,
            getCount: () => rows.length,
            renderRow: (i) => renderRowHtml(rows[i], selectedKey),
        });

        scroll.addEventListener('click', (ev) => {
            const btn = ev.target.closest('[data-tax-key]');
            if (!btn) return;
            selectedKey = btn.getAttribute('data-tax-key') || '';
            vl.refresh();
            if (typeof opts.onSelect === 'function') opts.onSelect(selectedKey, rows.find(r => r.key === selectedKey));
        });

        return {
            refresh: async () => {
                const next = await buildTaxonomyRows(opts);
                rows.splice(0, rows.length, ...next);
                vl.refresh();
            },
            destroy: () => { vl.destroy(); container.innerHTML = ''; },
            getRows: () => rows.slice(),
        };
    }

    /** Jump GROUP Tree selection from taxonomy key (DECK|01. …). */
    function navigateGroupKey(state, groupKey) {
        if (!state || !groupKey) return false;
        state.selectedGroupKey = groupKey;
        return true;
    }

    return {
        buildTaxonomyRows,
        mountTaxonomyRail,
        navigateGroupKey,
        deptForUser,
    };
})();

/** ClassNK Annex 9.1.3 — Work Report dimensional measurements (An 1.3.2.1.f) */
const TVC_PmsClassNk = (function () {
    const MAX_ROWS = 12;

    function escapeHtml(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    }

    function getRows(form) {
        const raw = form?.dimensional_measurements;
        const list = TVC_WorkReport.normalizeMeasurements(Array.isArray(raw) ? raw : []);
        while (list.length < 2) list.push(TVC_WorkReport.blankMeasurementRow());
        return list.slice(0, MAX_ROWS);
    }

    function renderMeasurementsSection(form, opts = {}) {
        const ro = !!opts.ro;
        const forPrint = !!opts.forPrint;
        const rows = getRows(form);
        const open = forPrint || !!opts.open;
        const toggleLabel = open ? '[−]' : '[+]';
        const bodyCls = open ? '' : ' hidden';

        const head = `<button type="button" class="wr-meas-toggle" onclick="TVC_PmsClassNk.toggleMeasurementsSection()" aria-expanded="${open}">${toggleLabel} Dimensional Measurements &amp; Clearances</button>`;
        if (forPrint && !rows.some(r => r.item_name || r.measured_val != null)) return '';

        const rowHtml = rows.map((row, idx) => {
            const exceeded = TVC_WorkReport.isMeasurementExceeded(row);
            const badge = exceeded ? '<span class="wr-meas-exceeded">EXCEEDED</span>' : '';
            const dis = ro ? ' disabled' : '';
            const roCls = ro ? ' wr-ro' : '';
            if (forPrint) {
                return `<tr class="${exceeded ? 'wr-meas-row-alert' : ''}">
                  <td>${escapeHtml(row.item_name)}${badge}</td>
                  <td>${row.design_val ?? '—'}</td>
                  <td>${row.tolerance_limit ?? '—'}</td>
                  <td>${row.measured_val ?? '—'}</td>
                  <td>${escapeHtml(row.unit)}</td>
                </tr>`;
            }
            return `<tr class="wr-meas-row${exceeded ? ' wr-meas-row-alert' : ''}" data-meas-idx="${idx}">
              <td><input class="wr-meas-inp${roCls}" data-meas="item_name" value="${escapeHtml(row.item_name)}"${dis}></td>
              <td><input type="number" inputmode="numeric" step="any" class="wr-meas-inp${roCls}" data-meas="design_val" value="${row.design_val ?? ''}"${dis}></td>
              <td><input type="number" inputmode="numeric" step="any" class="wr-meas-inp${roCls}" data-meas="tolerance_limit" value="${row.tolerance_limit ?? ''}"${dis}></td>
              <td><input type="number" inputmode="numeric" step="any" class="wr-meas-inp${roCls}" data-meas="measured_val" value="${row.measured_val ?? ''}"${dis} oninput="TVC_PmsClassNk.refreshMeasurementAlerts()">${badge}</td>
              <td><input class="wr-meas-inp wr-meas-unit${roCls}" data-meas="unit" value="${escapeHtml(row.unit)}"${dis}></td>
            </tr>`;
        }).join('');

        return `<section class="wr-meas-section wr-maint-span-all wr-maint-grid-gap" id="wrMeasSection">
          ${head}
          <div class="wr-meas-body${bodyCls}" id="wrMeasBody">
            <table class="wr-meas-table">
              <thead><tr>
                <th>Parameter</th><th>Design</th><th>Max limit</th><th>Measured</th><th>Unit</th>
              </tr></thead>
              <tbody id="wrMeasTbody">${rowHtml}</tbody>
            </table>
            ${ro || forPrint ? '' : '<button type="button" class="btn btn-sm wr-meas-add" onclick="TVC_PmsClassNk.addMeasurementRow()">+ Add row</button>'}
          </div>
        </section>`;
    }

    function toggleMeasurementsSection() {
        const body = document.getElementById('wrMeasBody');
        const btn = document.querySelector('.wr-meas-toggle');
        if (!body || !btn) return;
        body.classList.toggle('hidden');
        const open = !body.classList.contains('hidden');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        btn.textContent = `${open ? '[−]' : '[+]'} Dimensional Measurements & Clearances`;
    }

    function refreshMeasurementAlerts() {
        document.querySelectorAll('#wrMeasTbody .wr-meas-row').forEach(tr => {
            const get = (k) => {
                const el = tr.querySelector(`[data-meas="${k}"]`);
                return el ? el.value : '';
            };
            const exceeded = TVC_WorkReport.isMeasurementExceeded({
                measured_val: get('measured_val'),
                tolerance_limit: get('tolerance_limit'),
            });
            tr.classList.toggle('wr-meas-row-alert', exceeded);
            let badge = tr.querySelector('.wr-meas-exceeded');
            const measCell = tr.querySelector('[data-meas="measured_val"]')?.parentElement;
            if (exceeded) {
                if (!badge && measCell) {
                    badge = document.createElement('span');
                    badge.className = 'wr-meas-exceeded';
                    badge.textContent = 'EXCEEDED';
                    measCell.appendChild(badge);
                }
            } else if (badge) badge.remove();
        });
    }

    function captureMeasurements(host, form) {
        if (!host || !form) return;
        const tbody = host.querySelector('#wrMeasTbody');
        if (!tbody) return;
        const out = [];
        tbody.querySelectorAll('tr.wr-meas-row').forEach(tr => {
            const row = {};
            tr.querySelectorAll('[data-meas]').forEach(el => {
                row[el.dataset.meas] = el.value;
            });
            out.push(TVC_WorkReport.normalizeMeasurementRow(row));
        });
        form.dimensional_measurements = TVC_WorkReport.normalizeMeasurements(out);
    }

    function addMeasurementRow() {
        const tbody = document.getElementById('wrMeasTbody');
        if (!tbody || tbody.querySelectorAll('tr').length >= MAX_ROWS) return;
        const idx = tbody.querySelectorAll('tr').length;
        const tr = document.createElement('tr');
        tr.className = 'wr-meas-row';
        tr.dataset.measIdx = String(idx);
        tr.innerHTML = `
          <td><input class="wr-meas-inp" data-meas="item_name" value=""></td>
          <td><input type="number" inputmode="numeric" step="any" class="wr-meas-inp" data-meas="design_val" value=""></td>
          <td><input type="number" inputmode="numeric" step="any" class="wr-meas-inp" data-meas="tolerance_limit" value=""></td>
          <td><input type="number" inputmode="numeric" step="any" class="wr-meas-inp" data-meas="measured_val" value="" oninput="TVC_PmsClassNk.refreshMeasurementAlerts()"></td>
          <td><input class="wr-meas-inp wr-meas-unit" data-meas="unit" value="mm"></td>`;
        tbody.appendChild(tr);
    }

    return {
        renderMeasurementsSection,
        captureMeasurements,
        toggleMeasurementsSection,
        refreshMeasurementAlerts,
        addMeasurementRow,
    };
})();
