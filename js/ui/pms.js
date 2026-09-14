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
