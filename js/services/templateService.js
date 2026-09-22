/* Vessel archetype template injection — offline bundled JSON → IndexedDB (components + jobs). */
const TVC_TemplateService = (function () {
    const ARCHETYPES_URL = 'data/templates/archetypes.json';
    const META_APPLIED = 'vessel_archetype_applied';

    let _cache = null;
    let _loadPromise = null;

    function uuid() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
        return 'arc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
    }

    function padGroupNo(n) {
        const d = parseInt(String(n).replace(/\D/g, ''), 10);
        return Number.isFinite(d) ? String(d).padStart(2, '0') : String(n || '').trim();
    }

    function groupLabel(no, name) {
        const nm = String(name || '').replace(/\s+/g, ' ').trim();
        const n = padGroupNo(no);
        return n && nm ? `${n}. ${nm}` : nm;
    }

    function normDept(cat) {
        const d = String(cat || '').trim().toUpperCase();
        return d === 'DECK' ? 'DECK' : 'ENGINE';
    }

    function addMonths(isoDate, months) {
        const d = isoDate ? new Date(isoDate) : new Date();
        if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
        d.setMonth(d.getMonth() + months);
        return d.toISOString().slice(0, 10);
    }

    async function loadArchetypes(force) {
        if (_cache && !force) return _cache;
        if (_loadPromise && !force) return _loadPromise;
        _loadPromise = (async () => {
            try {
                const res = await fetch(ARCHETYPES_URL, { cache: 'no-cache' });
                if (res.ok) {
                    _cache = await res.json();
                    return _cache;
                }
            } catch (e) {
                console.warn('[TVC_TemplateService] fetch failed', e);
            }
            _cache = _cache || { version: 1, archetypes: {} };
            return _cache;
        })();
        return _loadPromise;
    }

    function listArchetypes(tax) {
        const t = tax || _cache;
        if (!t?.archetypes) return [];
        return Object.values(t.archetypes).map(a => ({
            key: a.key,
            label: a.label,
            description: a.description || '',
            icon: a.icon || '',
            component_count: (a.components || []).length,
            machinery_profile: a.machinery_profile || '',
        }));
    }

    function getArchetype(key, tax) {
        const t = tax || _cache;
        const k = String(key || '').trim();
        return t?.archetypes?.[k] || null;
    }

    function makerOptions(tax) {
        const t = tax || _cache;
        return t?.maker_options || { MAIN_ENGINE: [], GEN_ENGINE: [] };
    }

    function resolveCompanyId(opts = {}) {
        const fromOpts = String(opts.companyId || '').trim();
        if (fromOpts) return fromOpts;
        if (typeof TVC_Fleet !== 'undefined' && typeof TVC_Fleet.licenseCompanyId === 'function') {
            return String(TVC_Fleet.licenseCompanyId() || '').trim();
        }
        return '';
    }

    async function vesselHasMachineryData(vesselId) {
        const vid = String(vesselId || '').trim();
        if (!vid) return false;
        const comps = await TVC_DB.getAll('ship_components').catch(() => []);
        const jobs = await TVC_DB.getAll('maintenance_jobs').catch(() => []);
        const hasComp = comps.some(c => String(c.vessel_id || '') === vid);
        const hasJob = jobs.some(j => String(j.vessel_id || '') === vid);
        return hasComp || hasJob;
    }

    function rebuildComponentTree(jobs, vesselId, companyId) {
        const components = {};
        let order = 0;
        function ensure(path, nodeType, label, parentId) {
            const key = path.join('|');
            if (components[key]) return components[key].id;
            const id = uuid();
            order++;
            components[key] = {
                id,
                vessel_id: vesselId || null,
                ...(companyId ? { company_id: companyId } : {}),
                parent_id: parentId || null,
                path: [...path],
                label,
                node_type: nodeType,
                sort_order: order,
                sync_status: 'LOCAL',
                updated_at: new Date().toISOString(),
            };
            return id;
        }
        for (const job of jobs) {
            const dept = job.department;
            const parts = [dept, job.group, job.sort, job.equipment, job.item_sort1, job.item_sort2]
                .map(p => String(p || '').replace(/\s+/g, ' ').trim())
                .filter(Boolean);
            let parent = null;
            const pathAcc = [];
            const types = ['DEPARTMENT', 'GROUP', 'SORT', 'EQUIPMENT', 'ITEM_L1', 'ITEM_L2'];
            for (let i = 0; i < parts.length; i++) {
                pathAcc.push(parts[i]);
                parent = ensure(pathAcc, types[Math.min(i, types.length - 1)], parts[i], parent);
            }
            job.ship_component_id = parent;
        }
        return Object.values(components);
    }

    function resolveMaker(comp, makerOverrides) {
        const key = comp.maker_override_key;
        if (key && makerOverrides && makerOverrides[key]) {
            return String(makerOverrides[key]).trim();
        }
        return String(comp.maker_default || '').trim();
    }

    /**
     * @param {string} vesselId
     * @param {string} archetypeKey BULK_CARRIER | OIL_TANKER | CONTAINER
     * @param {object} makerOverrides e.g. { MAIN_ENGINE: 'MAN', GEN_ENGINE: 'Yanmar' }
     * @param {{ force?: boolean, companyId?: string }} opts
     */
    async function applyVesselArchetype(vesselId, archetypeKey, makerOverrides = {}, opts = {}) {
        await TVC_DB.open();
        await loadArchetypes();
        const vid = String(vesselId || '').trim();
        if (!vid) throw new Error('vessel_id is required.');

        const archetype = getArchetype(archetypeKey);
        if (!archetype) throw new Error(`Unknown archetype: ${archetypeKey}`);

        if (!opts.force && await vesselHasMachineryData(vid)) {
            const err = new Error('Vessel already has machinery components or maintenance jobs. Archetype apply skipped to avoid data pollution.');
            err.code = 'VESSEL_NOT_EMPTY';
            throw err;
        }

        const ts = new Date().toISOString();
        const today = ts.slice(0, 10);
        const companyId = resolveCompanyId(opts);
        const jobs = [];
        let jobSeq = 0;

        for (const comp of archetype.components || []) {
            const dept = normDept(comp.category);
            const maker = resolveMaker(comp, makerOverrides);
            const grp = groupLabel(comp.group_no, comp.group_name);
            const item1 = String(comp.item_sort1 || comp.name || '').trim();
            const item2 = String(comp.item_sort2 || comp.name || '').trim();
            const equipment = String(comp.name || '').trim();

            for (const jt of comp.jobs || []) {
                jobSeq++;
                const period = Number(jt.period) || 1;
                const unit = String(jt.unit || 'M').toUpperCase();
                const deptPrefix = dept === 'DECK' ? 'DK' : 'EN';
                const jobCode = `ARC-${deptPrefix}-${String(jobSeq).padStart(4, '0')}`;
                let nextDate = today;
                let lastDone = today;
                if (unit === 'M') {
                    nextDate = addMonths(today, period);
                }

                jobs.push({
                    id: uuid(),
                    vessel_id: vid,
                    ...(companyId ? { company_id: companyId } : {}),
                    department: dept,
                    group: grp,
                    sort: 'A. ROUTINE MAINTENANCE',
                    equipment,
                    equipment_no: 0,
                    item_sort1: item1,
                    item_sort2: item2,
                    job_detail: String(jt.job_detail || 'INSPECTION').trim(),
                    period,
                    unit,
                    pic: String(jt.pic || (dept === 'DECK' ? 'BOSUN' : '3/E')).trim(),
                    job_code: jobCode,
                    next_date: nextDate,
                    original_next_date: nextDate,
                    last_done: lastDone,
                    is_overdue: false,
                    plan_status: 'PLANNED',
                    is_locked: false,
                    sync_status: 'LOCAL',
                    updated_at: ts,
                    maker,
                    archetype_key: archetypeKey,
                    archetype_component: comp.name,
                });
            }
        }

        const components = rebuildComponentTree(jobs, vid, companyId);
        for (const c of components) {
            if (c.node_type === 'ITEM_L2' || c.node_type === 'EQUIPMENT') {
                const matchJob = jobs.find(j => j.ship_component_id === c.id);
                if (matchJob?.maker) c.maker = matchJob.maker;
            }
        }

        const groupDefs = new Map();
        for (const j of jobs) {
            const gk = `${j.department}|${j.group}`;
            if (!groupDefs.has(gk)) {
                const no = parseInt(String(j.group || '').split('.')[0], 10) || 0;
                groupDefs.set(gk, {
                    id: `arc-grp-${uuid()}`,
                    vessel_id: vid,
                    ...(companyId ? { company_id: companyId } : {}),
                    department: j.department,
                    label: j.group,
                    sort_order: no,
                    taxonomy_profile: archetype.machinery_profile || '',
                    created_at: ts,
                    updated_at: ts,
                    sync_status: 'LOCAL',
                });
            }
        }

        await TVC_DB.bulkPut('maintenance_jobs', jobs);
        await TVC_DB.bulkPut('ship_components', components);
        if (groupDefs.size) {
            await TVC_DB.bulkPut('maintenance_groups', [...groupDefs.values()]);
        }

        const metaKey = `${META_APPLIED}_${vid.replace(/[^\w.-]+/g, '_').slice(0, 48)}`;
        await TVC_DB.setMeta(metaKey, { archetypeKey, at: ts, jobs: jobs.length, components: components.length });

        if (typeof TVC_MachineryTaxonomy !== 'undefined' && archetype.machinery_profile) {
            await TVC_MachineryTaxonomy.setStoredProfileId(vid, archetype.machinery_profile);
            await TVC_MachineryTaxonomy.ensureCatalogGroupDefs({ vesselId: vid, profileId: archetype.machinery_profile, force: false });
        }

        return {
            vessel_id: vid,
            archetype_key: archetypeKey,
            jobs: jobs.length,
            components: components.length,
            maintenance_groups: groupDefs.size,
            machinery_profile: archetype.machinery_profile || null,
        };
    }

    async function getAppliedMeta(vesselId) {
        const vid = String(vesselId || '').trim();
        if (!vid) return null;
        const metaKey = `${META_APPLIED}_${vid.replace(/[^\w.-]+/g, '_').slice(0, 48)}`;
        return TVC_DB.getMeta(metaKey).catch(() => null);
    }

    return {
        ARCHETYPES_URL,
        loadArchetypes,
        listArchetypes,
        getArchetype,
        makerOptions,
        applyVesselArchetype,
        vesselHasMachineryData,
        getAppliedMeta,
    };
})();

if (typeof window !== 'undefined') window.TVC_TemplateService = TVC_TemplateService;
