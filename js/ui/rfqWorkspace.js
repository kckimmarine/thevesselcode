/* THE VESSEL CODE — SM Mode RFQ case workspace */
const TVC_RfqWorkspace = (function () {
    const MODAL_ID = 'smRfqWorkspaceModal';
    let currentUser = null;
    let selectedCaseId = null;
    let createDraftLines = [];

    function el(id) { return document.getElementById(id); }

    function esc(s) {
        return String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function fmtMoney(n, cur) {
        const v = Number(n);
        if (!Number.isFinite(v)) return '—';
        return `${cur || 'USD'} ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    async function renderCaseList() {
        const host = el('smRfqCaseList');
        if (!host) return;
        const cases = await TVC_SupplierRfqPipeline.listSmCases();
        const newBtn = `<button type="button" class="btn btn-sm btn-green sm-rfq-new-btn" id="smRfqNewCaseBtn">＋ New RFQ Case</button>`;
        if (!cases.length) {
            host.innerHTML = `${newBtn}<p class="muted">No RFQ cases yet.</p>`;
            el('smRfqNewCaseBtn')?.addEventListener('click', () => openCreateDrawer());
            return;
        }
        host.innerHTML = newBtn + cases.map(c => {
            const active = c.rfq_id === selectedCaseId ? ' active' : '';
            return `<button type="button" class="sm-rfq-case-btn${active}" data-rfq-id="${esc(c.rfq_id)}">
                <span class="sm-rfq-case-id">${esc(c.rfq_id)}</span>
                <span class="sm-rfq-case-meta">${esc(c.vessel_name)} · ${esc(c.status)}</span>
            </button>`;
        }).join('');
        el('smRfqNewCaseBtn')?.addEventListener('click', () => openCreateDrawer());
        host.querySelectorAll('.sm-rfq-case-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                selectedCaseId = btn.dataset.rfqId;
                void renderCaseDetail();
                void renderCaseList();
            });
        });
    }

    function equivFlagCell(it) {
        if (!it.allow_equivalent) return '—';
        return '<span class="badge-resilience badge-resilience--compact">🛡️ KR MRO</span>';
    }

    function renderItemsTable(items) {
        if (!items?.length) return '<p class="muted">No line items.</p>';
        const rows = items.map(it => `<tr>
            <td>${esc(it.part_no || '—')}</td>
            <td>${esc(it.description)}</td>
            <td class="num">${esc(it.qty)}</td>
            <td>${esc(it.unit || 'PCS')}</td>
            <td>${equivFlagCell(it)}</td>
        </tr>`).join('');
        return `<table class="supplier-table sm-rfq-items-table">
            <thead><tr><th>Part No</th><th>Description</th><th>Qty</th><th>Unit</th><th>Domestic alt.</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>`;
    }

    async function renderQuotesSummary(smRfqId) {
        const quotes = await TVC_SupplierRfqPipeline.listQuotesForSmCase(smRfqId);
        if (!quotes.length) return '<p class="muted">No supplier quotes received yet.</p>';
        const rows = quotes.map(q => {
            const total = (q.lines || []).reduce((sum, ln) => {
                const p = Number(ln.unit_price);
                const qty = Number(ln.qty) || 1;
                return sum + (Number.isFinite(p) ? p * qty : 0);
            }, 0);
            return `<tr>
                <td>${esc(q.supplier_name || q.supplier_id)}</td>
                <td>${esc(q.lead_time_days)} days</td>
                <td class="num">${esc(fmtMoney(total, q.currency))}</td>
                <td>${esc(q.maker_remarks || '—')}</td>
                <td><button type="button" class="btn btn-sm btn-green sm-rfq-award-btn" data-quote-id="${esc(q.id)}">🏆 Award / Issue PO</button></td>
            </tr>`;
        }).join('');
        return `<table class="supplier-table sm-rfq-quotes-table">
            <thead><tr><th>Supplier</th><th>Lead time</th><th>Est. total</th><th>Maker / remark</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
        </table>`;
    }

    async function renderCaseDetail() {
        const host = el('smRfqCaseDetail');
        if (!host) return;
        if (!selectedCaseId) {
            host.innerHTML = '<p class="muted">Select an RFQ case.</p>';
            return;
        }
        const c = await TVC_SupplierRfqPipeline.getSmCase(selectedCaseId);
        if (!c) {
            host.innerHTML = '<p class="muted">Case not found.</p>';
            return;
        }
        const canToss = c.status === TVC_SupplierRfqPipeline.SM_STATUS.DRAFT
            || c.status === TVC_SupplierRfqPipeline.SM_STATUS.OUT_TO_VENDOR
            || c.status === TVC_SupplierRfqPipeline.SM_STATUS.QUOTES_IN;
        const tossBtn = canToss
            ? `<button type="button" class="btn btn-green" id="smRfqTossBtn">🚀 Toss to Supplier</button>
               <button type="button" class="btn" id="smRfqQuickDispatchBtn" title="Dispatch with domestic equivalent providers enabled">🛡️ Quick Dispatch (KR MRO Pool)</button>`
            : '';
        const tossed = (c.tossed_suppliers || []).map(t => esc(t.company_name || t.supplier_id)).join(', ') || '—';
        const domesticPool = c.include_domestic_equivalents
            ? '<p class="sm-rfq-domestic-note"><span class="badge-resilience">🛡️ Domestic Equivalent Providers (KR MRO Pool) enabled on this case</span></p>'
            : '';

        host.innerHTML = `
            <header class="sm-rfq-detail-head">
                <h3>${esc(c.rfq_id)}</h3>
                <span class="sm-rfq-status-pill">${esc(c.status)}</span>
            </header>
            <p class="sm-rfq-detail-meta"><b>Vessel:</b> ${esc(c.vessel_name)} · <b>Category:</b> ${esc(c.category)} · <b>Due:</b> ${esc(c.response_deadline || '—')}</p>
            <p class="muted sm-rfq-tossed">Sent to suppliers: ${tossed}</p>
            ${domesticPool}
            <h4>Line items</h4>
            ${renderItemsTable(c.items)}
            <div class="sm-rfq-detail-actions">${tossBtn}</div>
            <h4>Supplier quotes</h4>
            <div id="smRfqQuotesHost"></div>`;

        const quotesHost = el('smRfqQuotesHost');
        if (quotesHost) quotesHost.innerHTML = await renderQuotesSummary(c.rfq_id);

        el('smRfqTossBtn')?.addEventListener('click', () => openTossModal(c, { domesticPool: false }));
        el('smRfqQuickDispatchBtn')?.addEventListener('click', () => openTossModal(c, { domesticPool: true }));
        host.querySelectorAll('.sm-rfq-award-btn').forEach(btn => {
            btn.addEventListener('click', () => void awardQuote(btn.dataset.quoteId));
        });
    }

    async function awardQuote(quoteId) {
        if (!selectedCaseId) return;
        const ok = await TVC_Dialog.confirm('Award this quote and issue a purchase order to the supplier?');
        if (!ok) return;
        try {
            await TVC_SupplierRfqPipeline.awardPurchaseOrder(selectedCaseId, quoteId);
            await TVC_Dialog.alert('PO issued. Supplier Delivery / Repair step is now unlocked.');
            await renderCaseDetail();
            await renderCaseList();
        } catch (e) {
            await TVC_Dialog.alert(e.message || String(e));
        }
    }

    function defaultDeadline() {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        return d.toISOString().slice(0, 10);
    }

    function renderCreateLinesTable() {
        const host = el('smRfqCreateLines');
        if (!host) return;
        if (!createDraftLines.length) {
            createDraftLines.push({
                part_no: '', description: '', qty: 1, unit: 'PCS', allow_equivalent: true,
            });
        }
        host.innerHTML = `<table class="supplier-table sm-rfq-create-lines">
            <thead><tr>
                <th>Part No</th><th>Description</th><th>Qty</th><th>Unit</th>
                <th>Include Domestic Equivalent Providers (KR MRO Pool)</th><th></th>
            </tr></thead>
            <tbody>${createDraftLines.map((ln, i) => `<tr data-line-idx="${i}">
                <td><input class="sm-rfq-inp" data-field="part_no" value="${esc(ln.part_no)}"></td>
                <td><input class="sm-rfq-inp" data-field="description" value="${esc(ln.description)}"></td>
                <td><input class="sm-rfq-inp sm-rfq-inp-num" data-field="qty" type="number" min="1" value="${esc(ln.qty)}"></td>
                <td><input class="sm-rfq-inp sm-rfq-inp-unit" data-field="unit" value="${esc(ln.unit)}"></td>
                <td class="sm-rfq-equiv-cell">
                    <label class="sm-rfq-equiv-toggle">
                        <input type="checkbox" data-field="allow_equivalent" ${ln.allow_equivalent ? 'checked' : ''}>
                        <span>Include domestic equivalents</span>
                    </label>
                </td>
                <td><button type="button" class="btn btn-sm sm-rfq-rm-line" data-idx="${i}">×</button></td>
            </tr>`).join('')}</tbody>
        </table>
        <button type="button" class="btn btn-sm" id="smRfqAddLineBtn">＋ Add line</button>`;

        host.querySelectorAll('.sm-rfq-inp').forEach(inp => {
            inp.addEventListener('change', () => syncCreateDraftFromDom());
        });
        host.querySelectorAll('input[data-field="allow_equivalent"]').forEach(inp => {
            inp.addEventListener('change', () => syncCreateDraftFromDom());
        });
        host.querySelectorAll('.sm-rfq-rm-line').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = Number(btn.dataset.idx);
                createDraftLines.splice(idx, 1);
                renderCreateLinesTable();
            });
        });
        el('smRfqAddLineBtn')?.addEventListener('click', () => {
            createDraftLines.push({
                part_no: '', description: '', qty: 1, unit: 'PCS', allow_equivalent: true,
            });
            renderCreateLinesTable();
        });
    }

    function syncCreateDraftFromDom() {
        const host = el('smRfqCreateLines');
        if (!host) return;
        const rows = host.querySelectorAll('tbody tr');
        createDraftLines = [];
        rows.forEach(tr => {
            createDraftLines.push({
                part_no: tr.querySelector('[data-field="part_no"]')?.value?.trim() || '',
                description: tr.querySelector('[data-field="description"]')?.value?.trim() || '',
                qty: Math.max(1, Number(tr.querySelector('[data-field="qty"]')?.value) || 1),
                unit: tr.querySelector('[data-field="unit"]')?.value?.trim() || 'PCS',
                allow_equivalent: !!tr.querySelector('[data-field="allow_equivalent"]')?.checked,
            });
        });
    }

    async function enrichLinesWithEquivalents(lines) {
        if (typeof TVC_EquivalentParts === 'undefined') return lines;
        await TVC_EquivalentParts.ensureLoaded();
        const out = [];
        for (const ln of lines) {
            const row = { ...ln };
            if (ln.part_no) {
                const eq = await TVC_EquivalentParts.lookup(ln.part_no);
                if (eq?.domestic_equivalent) {
                    row.domestic_equivalent_hint = eq.domestic_equivalent;
                }
            }
            out.push(row);
        }
        return out;
    }

    function openCreateDrawer() {
        const modal = el('smRfqCreateModal');
        if (!modal) return;
        createDraftLines = [{
            part_no: 'FF-2201',
            description: 'Fuel filter element',
            qty: 4,
            unit: 'PCS',
            allow_equivalent: true,
        }];
        const deadline = el('smRfqCreateDeadline');
        if (deadline) deadline.value = defaultDeadline();
        const globalToggle = el('smRfqCreateDomesticGlobal');
        if (globalToggle) globalToggle.checked = true;
        renderCreateLinesTable();
        modal.classList.remove('hidden');
    }

    function closeCreateDrawer() {
        el('smRfqCreateModal')?.classList.add('hidden');
    }

    async function saveCreateCase() {
        syncCreateDraftFromDom();
        const deadline = el('smRfqCreateDeadline')?.value;
        const globalDomestic = !!el('smRfqCreateDomesticGlobal')?.checked;
        const lines = await enrichLinesWithEquivalents(createDraftLines.map(ln => ({
            ...ln,
            allow_equivalent: ln.allow_equivalent || globalDomestic,
        })));
        if (!lines.some(l => l.part_no || l.description)) {
            await TVC_Dialog.alert('Enter at least one part number or description.');
            return;
        }
        try {
            const row = await TVC_SupplierRfqPipeline.createSmCase(currentUser, {
                items: lines,
                response_deadline: deadline,
                include_domestic_equivalents: globalDomestic,
            });
            closeCreateDrawer();
            selectedCaseId = row.rfq_id;
            await TVC_Dialog.alert('RFQ case created. Use Toss or Quick Dispatch to send to suppliers.');
            await renderCaseList();
            await renderCaseDetail();
        } catch (e) {
            await TVC_Dialog.alert(e.message || String(e));
        }
    }

    async function openTossModal(caseRow, opts = {}) {
        const modal = el('smRfqTossModal');
        if (!modal) return;
        const sel = el('smRfqTossSupplier');
        const deadline = el('smRfqTossDeadline');
        const domesticChk = el('smRfqTossDomestic');
        if (deadline) deadline.value = caseRow.response_deadline || defaultDeadline();
        if (domesticChk) {
            domesticChk.checked = !!(opts.domesticPool || caseRow.include_domestic_equivalents);
        }
        const profiles = await TVC_SupplierRfqPipeline.listSupplierProfiles();
        if (sel) {
            if (!profiles.length) {
                sel.innerHTML = '<option value="">— Register a supplier on the login screen —</option>';
            } else {
                sel.innerHTML = profiles.map(p =>
                    `<option value="${esc(p.supplier_id)}">${esc(p.company_name)}</option>`
                ).join('');
            }
        }
        modal.dataset.rfqId = caseRow.rfq_id;
        modal.classList.remove('hidden');
    }

    function closeTossModal() {
        el('smRfqTossModal')?.classList.add('hidden');
    }

    async function applyDomesticFlagsToCase(smRfqId, enabled) {
        if (!enabled) return;
        const sm = await TVC_SupplierRfqPipeline.getSmCase(smRfqId);
        if (!sm) return;
        const items = (sm.items || []).map(it => ({ ...it, allow_equivalent: true }));
        await TVC_DB.put('sm_rfq_cases', {
            ...sm,
            items,
            include_domestic_equivalents: true,
            updated_at: new Date().toISOString(),
        });
    }

    async function confirmToss() {
        const modal = el('smRfqTossModal');
        const smRfqId = modal?.dataset.rfqId;
        const supplierId = el('smRfqTossSupplier')?.value;
        const deadline = el('smRfqTossDeadline')?.value;
        const domesticPool = !!el('smRfqTossDomestic')?.checked;
        if (!smRfqId || !supplierId) {
            await TVC_Dialog.alert('Select a registered supplier.');
            return;
        }
        if (!deadline) {
            await TVC_Dialog.alert('Set a response deadline.');
            return;
        }
        try {
            await applyDomesticFlagsToCase(smRfqId, domesticPool);
            await TVC_SupplierRfqPipeline.tossToSupplier(smRfqId, supplierId, { deadline });
            closeTossModal();
            await TVC_Dialog.alert('RFQ dispatched to supplier inbox (status RECEIVED).');
            await renderCaseDetail();
            await renderCaseList();
        } catch (e) {
            await TVC_Dialog.alert(e.message || String(e));
        }
    }

    function bindOnce() {
        const root = el(MODAL_ID);
        if (!root || root.dataset.bound === '1') return;
        root.dataset.bound = '1';
        el('smRfqWorkspaceClose')?.addEventListener('click', () => close());
        root.addEventListener('click', (e) => {
            if (e.target === root) close();
        });
        el('smRfqTossCancel')?.addEventListener('click', () => closeTossModal());
        el('smRfqTossConfirm')?.addEventListener('click', () => void confirmToss());
        el('smRfqTossModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'smRfqTossModal') closeTossModal();
        });
        el('smRfqCreateCancel')?.addEventListener('click', () => closeCreateDrawer());
        el('smRfqCreateSave')?.addEventListener('click', () => void saveCreateCase());
        el('smRfqCreateModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'smRfqCreateModal') closeCreateDrawer();
        });
    }

    async function open(user) {
        currentUser = user;
        bindOnce();
        await TVC_SupplierRfqPipeline.ensureSmDemoCases(user);
        if (typeof TVC_EquivalentParts !== 'undefined') {
            await TVC_EquivalentParts.ensureLoaded();
        }
        const cases = await TVC_SupplierRfqPipeline.listSmCases();
        selectedCaseId = cases[0]?.rfq_id || null;
        el(MODAL_ID)?.classList.remove('hidden');
        await renderCaseList();
        await renderCaseDetail();
    }

    function close() {
        el(MODAL_ID)?.classList.add('hidden');
        currentUser = null;
    }

    return { open, close };
})();
if (typeof window !== 'undefined') window.TVC_RfqWorkspace = TVC_RfqWorkspace;
