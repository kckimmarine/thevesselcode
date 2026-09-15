/* 3-step vessel onboarding wizard — archetype template injection */
const TVC_VesselRegistryModal = (function () {
    const MODAL_ID = 'vesselRegistryModal';
    const STEPS = ['identity', 'archetype', 'makers'];
    let step = 0;
    let draft = {
        vessel_name: '',
        imo_no: '',
        archetype_key: 'BULK_CARRIER',
        makers: { MAIN_ENGINE: 'MAN B&W', GEN_ENGINE: 'Yanmar' },
    };
    let onComplete = null;

    function el(id) { return document.getElementById(id); }

    function esc(s) {
        return String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    let _makerRoles = null;

    async function ensureMakerRoles() {
        if (_makerRoles) return _makerRoles;
        const data = await TVC_TemplateService.loadArchetypes();
        _makerRoles = data.maker_roles || {};
        return _makerRoles;
    }

    function makerOptions(role, selected, roles) {
        const opts = roles?.[role]?.options || ['MAN B&W', 'WinGD', 'Yanmar', 'Daihatsu'];
        return opts.map(o => `<option value="${esc(o)}"${o === selected ? ' selected' : ''}>${esc(o)}</option>`).join('');
    }

    async function archetypeCards() {
        await TVC_TemplateService.loadArchetypes();
        const list = TVC_TemplateService.listArchetypes();
        return list.map(a => {
            const active = a.key === draft.archetype_key ? ' active' : '';
            return `<button type="button" class="vreg-archetype-card${active}" data-arch="${esc(a.key)}">
                <span class="vreg-archetype-title">${esc(a.label)}</span>
                <span class="vreg-archetype-meta">${a.component_count} machinery items · ${esc(a.taxonomy_profile || '')}</span>
            </button>`;
        }).join('');
    }

    function stepIndicator() {
        const labels = ['1. Vessel', '2. Archetype', '3. Makers'];
        return `<div class="vreg-steps" role="tablist">${labels.map((lab, i) =>
            `<span class="vreg-step${i === step ? ' active' : ''}${i < step ? ' done' : ''}">${esc(lab)}</span>`
        ).join('')}</div>`;
    }

    async function renderBody() {
        const host = el('vesselRegistryBody');
        if (!host) return;
        let inner = stepIndicator();
        if (step === 0) {
            inner += `
                <div class="vreg-pane">
                    <label>Vessel name / ID<input id="vregVesselName" value="${esc(draft.vessel_name)}" placeholder="e.g. MV Pacific Star" required></label>
                    <label>IMO number<input id="vregImo" value="${esc(draft.imo_no)}" placeholder="7 digits" inputmode="numeric" maxlength="7"></label>
                    <p class="muted vreg-hint">Used as fleet <code>vessel_id</code> and PMS scope key.</p>
                </div>`;
        } else if (step === 1) {
            inner += `<div class="vreg-pane"><p class="muted">ClassNK / ISO taxonomy baseline — select ship type.</p>
                <div class="vreg-archetype-grid">${await archetypeCards()}</div></div>`;
        } else {
            const roles = await ensureMakerRoles();
            inner += `
                <div class="vreg-pane">
                    <p class="muted">Override template makers; spares accumulate via Work Reports &amp; Requisitions.</p>
                    <label>Main Engine maker<select id="vregMeMaker">${makerOptions('MAIN_ENGINE', draft.makers.MAIN_ENGINE, roles)}</select></label>
                    <label>Generator Engine maker<select id="vregGeMaker">${makerOptions('GEN_ENGINE', draft.makers.GEN_ENGINE, roles)}</select></label>
                    <p class="vreg-summary muted">Archetype: <b>${esc(draft.archetype_key)}</b> ·
                        ${TVC_TemplateService.countArchetypeComponents(draft.archetype_key)} components</p>
                </div>`;
        }
        host.innerHTML = inner;

        host.querySelectorAll('.vreg-archetype-card').forEach(btn => {
            btn.addEventListener('click', () => {
                draft.archetype_key = btn.dataset.arch;
                void renderBody();
            });
        });
    }

    function syncDraftFromDom() {
        if (step === 0) {
            draft.vessel_name = el('vregVesselName')?.value?.trim() || '';
            draft.imo_no = el('vregImo')?.value?.trim() || '';
        } else if (step === 2) {
            draft.makers.MAIN_ENGINE = el('vregMeMaker')?.value || draft.makers.MAIN_ENGINE;
            draft.makers.GEN_ENGINE = el('vregGeMaker')?.value || draft.makers.GEN_ENGINE;
        }
    }

    function validateStep() {
        syncDraftFromDom();
        if (step === 0) {
            if (!draft.vessel_name || draft.vessel_name.length < 2) {
                return 'Enter a vessel name (min 2 characters).';
            }
            if (draft.imo_no && !/^\d{7}$/.test(draft.imo_no)) {
                return 'IMO number must be 7 digits.';
            }
        }
        if (step === 1 && !draft.archetype_key) return 'Select a ship archetype.';
        return '';
    }

    function updateNav() {
        const back = el('vregBackBtn');
        const next = el('vregNextBtn');
        const init = el('vregInitBtn');
        if (back) back.classList.toggle('hidden', step === 0);
        if (next) next.classList.toggle('hidden', step === STEPS.length - 1);
        if (init) init.classList.toggle('hidden', step !== STEPS.length - 1);
    }

    async function goNext() {
        const err = validateStep();
        if (err) {
            await TVC_Dialog.alert(err);
            return;
        }
        if (step < STEPS.length - 1) {
            step += 1;
            await renderBody();
            updateNav();
        }
    }

    async function goBack() {
        syncDraftFromDom();
        if (step > 0) {
            step -= 1;
            await renderBody();
            updateNav();
        }
    }

    async function initializeFleet() {
        const err = validateStep();
        if (err) {
            await TVC_Dialog.alert(err);
            return;
        }
        const vesselId = draft.vessel_name;
        const btn = el('vregInitBtn');
        if (btn) btn.disabled = true;
        const t0 = performance.now();
        try {
            if (typeof TVC_Fleet !== 'undefined') {
                TVC_Fleet.upsert({
                    id: vesselId,
                    name: vesselId,
                    imo_no: draft.imo_no || '—',
                    delivery: new Date().toISOString().slice(0, 10),
                    company_id: typeof TVC_Fleet.licenseCompanyId === 'function'
                        ? TVC_Fleet.licenseCompanyId()
                        : 'TVC',
                });
                TVC_Fleet.select(vesselId);
            }
            const result = await TVC_TemplateService.applyVesselArchetype(
                vesselId,
                draft.archetype_key,
                { ...draft.makers },
            );
            const ms = Math.round(performance.now() - t0);
            close();
            if (typeof onComplete === 'function') {
                await onComplete({ ...draft, vessel_id: vesselId, result, elapsed_ms: ms });
            }
            const msg = result.skipped
                ? `Vessel already has machinery (${result.reason}). Fleet record updated.`
                : `Initialized ${result.components} components and ${result.jobs} PMS jobs in ${ms} ms.`;
            await TVC_Dialog.alert(msg);
        } catch (e) {
            await TVC_Dialog.alert(e.message || String(e));
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    function bindOnce() {
        const root = el(MODAL_ID);
        if (!root || root.dataset.bound === '1') return;
        root.dataset.bound = '1';
        el('vesselRegistryClose')?.addEventListener('click', () => close());
        el('vregCancelBtn')?.addEventListener('click', () => close());
        el('vregBackBtn')?.addEventListener('click', () => void goBack());
        el('vregNextBtn')?.addEventListener('click', () => void goNext());
        el('vregInitBtn')?.addEventListener('click', () => void initializeFleet());
        root.addEventListener('click', (e) => {
            if (e.target === root) close();
        });
    }

    async function open(opts = {}) {
        bindOnce();
        onComplete = opts.onComplete || null;
        step = 0;
        draft = {
            vessel_name: opts.vessel_name || '',
            imo_no: opts.imo_no || '',
            archetype_key: opts.archetype_key || 'BULK_CARRIER',
            makers: { MAIN_ENGINE: 'MAN B&W', GEN_ENGINE: 'Yanmar', ...(opts.makers || {}) },
        };
        await TVC_TemplateService.loadArchetypes();
        el(MODAL_ID)?.classList.remove('hidden');
        await renderBody();
        updateNav();
    }

    function close() {
        el(MODAL_ID)?.classList.add('hidden');
        onComplete = null;
    }

    return { open, close };
})();
if (typeof window !== 'undefined') window.TVC_VesselRegistryModal = TVC_VesselRegistryModal;
