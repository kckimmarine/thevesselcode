/* 3-step vessel onboarding — name/IMO → archetype → maker tweaks → Initialize Fleet */
const TVC_VesselRegistryModal = (function () {
    const MODAL_ID = 'vesselArchetypeModal';

    const state = {
        step: 1,
        vesselName: '',
        imoNo: '',
        archetypeKey: 'BULK_CARRIER',
        companyId: '',
        makerMain: '',
        makerGen: '',
    };

    function el(id) { return document.getElementById(id); }

    function esc(s) {
        return String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function showModal() {
        const m = el(MODAL_ID);
        if (!m) return;
        m.classList.remove('hidden');
    }

    function hideModal() {
        el(MODAL_ID)?.classList.add('hidden');
    }

    function resetWizard(opts = {}) {
        state.step = 1;
        state.vesselName = '';
        state.imoNo = '';
        state.archetypeKey = 'BULK_CARRIER';
        state.companyId = String(opts.companyId || '').trim();
        state.makerMain = '';
        state.makerGen = '';
    }

    function makerSelectHtml(id, selected) {
        const opts = (typeof TVC_TemplateService !== 'undefined'
            ? TVC_TemplateService.makerOptions()
            : { MAIN_ENGINE: ['MAN', 'Yanmar', 'Daihatsu', 'WinGD'] });
        const list = opts.MAIN_ENGINE || opts.GEN_ENGINE || [];
        const sel = String(selected || '').trim();
        let html = '<option value="">— Template default —</option>';
        for (const m of list) {
            html += `<option value="${esc(m)}"${m === sel ? ' selected' : ''}>${esc(m)}</option>`;
        }
        return html;
    }

    function archetypeCardsHtml(selectedKey) {
        const list = typeof TVC_TemplateService !== 'undefined'
            ? TVC_TemplateService.listArchetypes()
            : [];
        const icons = { bulk: '🚢', tanker: '🛢️', container: '📦' };
        return list.map(a => {
            const active = a.key === selectedKey ? ' vessel-archetype-card--active' : '';
            const icon = icons[a.icon] || '⚓';
            return `<button type="button" class="vessel-archetype-card${active}" data-archetype="${esc(a.key)}"
                onclick="TVC_VesselRegistryModal.pickArchetype('${esc(a.key)}')">
                <span class="vessel-archetype-card-icon" aria-hidden="true">${icon}</span>
                <span class="vessel-archetype-card-title">${esc(a.label)}</span>
                <span class="vessel-archetype-card-desc">${esc(a.description)}</span>
                <span class="vessel-archetype-card-meta muted">${a.component_count} machinery items</span>
            </button>`;
        }).join('');
    }

    function stepIndicator() {
        const steps = [
            { n: 1, label: 'Vessel' },
            { n: 2, label: 'Archetype' },
            { n: 3, label: 'Makers' },
        ];
        return `<div class="vessel-wizard-steps" role="tablist" aria-label="Onboarding steps">
            ${steps.map(s => `<span class="vessel-wizard-step${state.step === s.n ? ' is-active' : ''}${state.step > s.n ? ' is-done' : ''}">
                <span class="vessel-wizard-step-num">${s.n}</span> ${esc(s.label)}
            </span>`).join('')}
        </div>`;
    }

    function render() {
        const body = el('vesselArchetypeBody');
        if (!body) return;
        const errEl = el('vesselArchetypeErr');
        if (errEl) errEl.textContent = '';

        let inner = `
            <button type="button" class="modal-x" onclick="TVC_VesselRegistryModal.close()" aria-label="Close">×</button>
            <h3 class="spare-sync-title">Initialize vessel machinery</h3>
            <p class="spare-sync-hint muted">Offline archetype templates — components &amp; Class/ISM job intervals in one step.</p>
            ${stepIndicator()}`;

        if (state.step === 1) {
            inner += `
            <div class="vessel-wizard-panel">
                <label class="login-field">Vessel name / ID
                    <input id="vesselArchetypeName" type="text" autocomplete="off" placeholder="e.g. MV Pacific Star"
                        value="${esc(state.vesselName)}">
                </label>
                <label class="login-field">IMO number
                    <input id="vesselArchetypeImo" type="text" inputmode="numeric" placeholder="7 digits"
                        value="${esc(state.imoNo)}">
                </label>
            </div>
            <div class="modal-actions vessel-wizard-actions">
                <button type="button" class="btn" onclick="TVC_VesselRegistryModal.close()">Cancel</button>
                <button type="button" class="btn btn-green" onclick="TVC_VesselRegistryModal.nextFromStep1()">Next</button>
            </div>`;
        } else if (state.step === 2) {
            inner += `
            <div class="vessel-wizard-panel">
                <p class="spare-sync-note muted">Select ship type (JIS / ISO machinery taxonomy baseline)</p>
                <div class="vessel-archetype-grid">${archetypeCardsHtml(state.archetypeKey)}</div>
            </div>
            <div class="modal-actions vessel-wizard-actions">
                <button type="button" class="btn" onclick="TVC_VesselRegistryModal.back()">Back</button>
                <button type="button" class="btn btn-green" onclick="TVC_VesselRegistryModal.nextFromStep2()">Next</button>
            </div>`;
        } else {
            inner += `
            <div class="vessel-wizard-panel">
                <p class="spare-sync-note muted">Optional — override template makers (spares accumulate via Work Reports later)</p>
                <label class="login-field">Main engine maker
                    <select id="vesselArchetypeMe">${makerSelectHtml('me', state.makerMain)}</select>
                </label>
                <label class="login-field">Generator engine maker
                    <select id="vesselArchetypeGe">${makerSelectHtml('ge', state.makerGen)}</select>
                </label>
                <p class="spare-sync-note"><strong>${esc(state.vesselName)}</strong> · ${esc(state.archetypeKey.replace(/_/g, ' '))}</p>
            </div>
            <div class="modal-actions vessel-wizard-actions">
                <button type="button" class="btn" onclick="TVC_VesselRegistryModal.back()">Back</button>
                <button type="button" class="btn btn-green" id="vesselArchetypeInitBtn"
                    onclick="TVC_VesselRegistryModal.initialize()">Initialize Fleet</button>
            </div>`;
        }

        body.innerHTML = inner;
        if (state.step === 1) el('vesselArchetypeName')?.focus();
    }

    async function open(opts = {}) {
        if (typeof TVC_TemplateService === 'undefined') {
            await TVC_Dialog?.alert?.('Archetype template service not loaded.');
            return;
        }
        await TVC_TemplateService.loadArchetypes();
        resetWizard(opts);
        if (opts.vesselName) state.vesselName = String(opts.vesselName).trim();
        if (opts.imoNo) state.imoNo = String(opts.imoNo).trim();
        if (opts.archetypeKey) state.archetypeKey = opts.archetypeKey;
        render();
        showModal();
    }

    function close() {
        hideModal();
    }

    function pickArchetype(key) {
        state.archetypeKey = String(key || '').trim() || 'BULK_CARRIER';
        render();
    }

    function readStep1() {
        state.vesselName = String(el('vesselArchetypeName')?.value || '').trim();
        state.imoNo = String(el('vesselArchetypeImo')?.value || '').trim();
    }

    function nextFromStep1() {
        readStep1();
        const errEl = el('vesselArchetypeErr');
        if (!state.vesselName) {
            if (errEl) errEl.textContent = 'Vessel name is required.';
            return;
        }
        if (state.imoNo && !/^\d{7}$/.test(state.imoNo.replace(/\s/g, ''))) {
            if (errEl) errEl.textContent = 'IMO should be 7 digits (or leave blank).';
            return;
        }
        state.step = 2;
        render();
    }

    function nextFromStep2() {
        state.step = 3;
        render();
    }

    function back() {
        state.step = Math.max(1, state.step - 1);
        render();
    }

    async function registerFleetRecord() {
        const id = state.vesselName;
        const imo = state.imoNo.replace(/\s/g, '') || '—';
        const delivery = new Date().toISOString().slice(0, 10);

        if (typeof TVC_AdminRegistry !== 'undefined' && state.companyId) {
            try {
                await TVC_AdminRegistry.load();
                const used = TVC_AdminRegistry.usedVesselCodes(state.companyId, null);
                let code = '';
                for (let i = 1; i <= 200; i++) {
                    if (!used.has(i)) { code = String(i); break; }
                }
                TVC_AdminRegistry.upsertVessel(state.companyId, {
                    vessel_id: id,
                    imo_no: imo,
                    delivery,
                    status: 'active',
                    code: code || '1',
                    machinery_profile: TVC_TemplateService.getArchetype(state.archetypeKey)?.machinery_profile || '',
                });
                await TVC_AdminRegistry.save();
            } catch (e) {
                console.warn('[TVC_VesselRegistryModal] registry upsert', e);
            }
        }

        if (typeof TVC_Fleet !== 'undefined') {
            TVC_Fleet.upsert({
                id,
                name: id,
                imo_no: imo,
                delivery,
                company_id: state.companyId || TVC_Fleet.licenseCompanyId(),
            });
            TVC_Fleet.select(id);
        }

        await TVC_DB.setMeta(TVC_META_KEYS.VESSEL_ID, id).catch(() => {});
        return id;
    }

    async function initialize() {
        const errEl = el('vesselArchetypeErr');
        const btn = el('vesselArchetypeInitBtn');
        state.makerMain = String(el('vesselArchetypeMe')?.value || '').trim();
        state.makerGen = String(el('vesselArchetypeGe')?.value || '').trim();

        const makerOverrides = {};
        if (state.makerMain) makerOverrides.MAIN_ENGINE = state.makerMain;
        if (state.makerGen) makerOverrides.GEN_ENGINE = state.makerGen;

        if (btn) { btn.disabled = true; btn.textContent = 'Initializing…'; }

        try {
            const vesselId = await registerFleetRecord();
            const hasData = await TVC_TemplateService.vesselHasMachineryData(vesselId);
            if (hasData) {
                throw Object.assign(new Error('This vessel already has PMS data. Choose another name or clear data first.'), { code: 'VESSEL_NOT_EMPTY' });
            }

            const result = await TVC_TemplateService.applyVesselArchetype(
                vesselId,
                state.archetypeKey,
                makerOverrides,
                { companyId: state.companyId || (typeof TVC_Fleet !== 'undefined' ? TVC_Fleet.licenseCompanyId() : '') }
            );

            if (typeof TVC_Fleet !== 'undefined' && TVC_Fleet.syncFromAdminRegistry) {
                TVC_Fleet.syncFromAdminRegistry();
            }

            if (typeof TVC_App !== 'undefined') {
                if (TVC_App.state) {
                    TVC_App.state.selectedVesselId = vesselId;
                    TVC_App.state.fleet = typeof TVC_Fleet !== 'undefined' ? TVC_Fleet.getVisible(TVC_App.state.user) : [];
                }
                if (typeof TVC_App.onVesselArchetypeInitialized === 'function') {
                    await TVC_App.onVesselArchetypeInitialized(result);
                } else if (typeof TVC_App.refreshPmsTree === 'function') {
                    await TVC_App.refreshPmsTree();
                }
                if (typeof TVC_App.renderMainMenu === 'function') TVC_App.renderMainMenu();
            }

            close();
            const msg = `Fleet initialized.\n${result.components} equipment nodes · ${result.jobs} maintenance jobs · ${result.archetype_key}`;
            if (typeof TVC_Dialog !== 'undefined') await TVC_Dialog.alert(msg);
            else if (typeof TVC_App?.showLoginToast === 'function') TVC_App.showLoginToast(msg.replace(/\n/g, ' '));
        } catch (e) {
            if (errEl) errEl.textContent = e.message || String(e);
            if (btn) { btn.disabled = false; btn.textContent = 'Initialize Fleet'; }
        }
    }

    return {
        open,
        close,
        pickArchetype,
        nextFromStep1,
        nextFromStep2,
        back,
        initialize,
    };
})();

if (typeof window !== 'undefined') window.TVC_VesselRegistryModal = TVC_VesselRegistryModal;
