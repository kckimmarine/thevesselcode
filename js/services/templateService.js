/* Vessel archetype template engine — offline machinery + PMS job seeding */
const TVC_TemplateService = (function () {
    const DATA_URL = 'data/templates/archetypes.json';
    const META_PREFIX = 'vessel_archetype_applied_';

    let _cache = null;
    let _loadPromise = null;

    function newId() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
        return `arc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    }

    function metaKey(vesselId) {
        return `${META_PREFIX}${String(vesselId || '').trim().replace(/[^\w.-]+/g, '_').slice(0, 48)}`;
    }

    function jobCodePrefix(archetypeKey) {
        const map = { BULK_CARRIER: 'BC', OIL_TANKER: 'OT', CONTAINER: 'CS' };
        return map[archetypeKey] || 'AR';
    }

    function addMonths(date, months) {
        const d = new Date(date);
        d.setMonth(d.getMonth() + months);
        return d.toISOString().slice(0, 10);
    }

    function nextDateForJob(job) {
        const today = new Date();
        const unit = String(job.unit || 'M').toUpperCase();
        const period = Number(job.period) || 1;
        if (unit === 'H') {
            const d = new Date(today);
            d.setDate(d.getDate() + 30);
            return d.toISOString().slice(0, 10);
        }
        return addMonths(today, period);
    }

    function resolveMaker(comp, makerOverrides) {
        const role = comp.maker_role;
        if (role && makerOverrides[role]) return String(makerOverrides[role]).trim();
        if (role && _cache?.maker_roles?.[role]?.default) return _cache.maker_roles[role].default;
        return comp.maker_default || 'OEM';
    }

    async function loadArchetypes(force) {
        if (_cache && !force) return _cache;
        if (_loadPromise && !force) return _loadPromise;
        _loadPromise = (async () => {
            try {
                const res = await fetch(DATA_URL, { cache: 'no-cache' });
                if (res.ok) {
                    _cache = await res.json();
                    return _cache;
                }
            } catch (e) {
                console.warn('[TVC_TemplateService] fetch failed', e);
            }
            _cache = _cache || _embeddedFallback();
            return _cache;
        })();
        return _loadPromise;
    }

    function _embeddedFallback() {
        return { version: 1, maker_roles: {}, archetypes: {} };
    }

    function listArchetypes(data) {
        const d = data || _cache;
        if (!d?.archetypes) return [];
        return Object.entries(d.archetypes).map(([key, row]) => ({
            key,
            label: row.label,
            component_count: (row.components || []).length,
            taxonomy_profile: row.taxonomy_profile,
        }));
    }

    function getArchetype(key, data) {
        const d = data || _cache;
        return d?.archetypes?.[String(key || '').trim()] || null;
    }

    function countArchetypeComponents(key, data) {
        const arch = getArchetype(key, data);
        return (arch?.components || []).length;
    }

    async function vesselHasMachinerySeed(vesselId) {
        const vid = String(vesselId || '').trim();
        if (!vid) return false;
        try {
            const applied = await TVC_DB.getMeta(metaKey(vid));
            if (applied) return true;
        } catch (_) {}
        const comps = await TVC_DB.getAll('ship_components').catch(() => []);
        return comps.some(c => c.vessel_id === vid && c.archetype_seed);
    }

    /**
     * Clone archetype components + maintenance jobs into IndexedDB for vessel_id.
     * Idempotent — skips when machinery seed already exists.
     */
    async function applyVesselArchetype(vesselId, archetypeKey, makerOverrides = {}) {
        const vid = String(vesselId || '').trim();
        const key = String(archetypeKey || '').trim();
        if (!vid) throw new Error('Vessel ID is required.');
        if (!key) throw new Error('Select a vessel archetype.');

        if (await vesselHasMachinerySeed(vid)) {
            return { skipped: true, reason: 'already_initialized', vessel_id: vid };
        }

        const data = await loadArchetypes();
        const arch = getArchetype(key, data);
        if (!arch) throw new Error(`Unknown archetype: ${key}`);

        const components = arch.components || [];
        if (!components.length) throw new Error('Archetype has no components.');

        const ts = new Date().toISOString();
        const prefix = jobCodePrefix(key);
        let jobSeq = 0;
        const compRows = [];
        const jobRows = [];

        for (let i = 0; i < components.length; i++) {
            const comp = components[i];
            const dept = String(comp.category || 'ENGINE').trim().toUpperCase();
            const group = String(comp.group || dept).trim();
            const name = String(comp.name || comp.key).trim();
            const maker = resolveMaker(comp, makerOverrides);
            const compId = newId();
            compRows.push({
                id: compId,
                parent_id: null,
                path: [dept, group, name],
                label: name,
                node_type: 'EQUIPMENT',
                sort_order: i + 1,
                vessel_id: vid,
                maker,
                maker_role: comp.maker_role || null,
                standard_spec: comp.standard_spec || '',
                archetype_seed: true,
                archetype_key: key,
                template_component_key: comp.key,
                sync_status: 'LOCAL',
                updated_at: ts,
            });
            for (const job of comp.jobs || []) {
                jobSeq += 1;
                jobRows.push({
                    id: newId(),
                    vessel_id: vid,
                    department: dept,
                    job_code: `${prefix}-${String(jobSeq).padStart(3, '0')}`,
                    group,
                    item_sort1: name,
                    item_sort2: String(job.job_detail || '').trim(),
                    job_detail: String(job.job_detail || '').trim(),
                    period: Number(job.period) || 1,
                    unit: String(job.unit || 'M').toUpperCase(),
                    pic: job.pic || '1/E',
                    regulatory: job.regulatory || null,
                    ship_component_id: compId,
                    is_overdue: false,
                    next_date: nextDateForJob(job),
                    last_done: null,
                    archetype_seed: true,
                    archetype_key: key,
                    sync_status: 'LOCAL',
                    updated_at: ts,
                });
            }
        }

        if (TVC_DB.bulkPut) {
            await TVC_DB.bulkPut('ship_components', compRows);
            await TVC_DB.bulkPut('maintenance_jobs', jobRows);
        } else {
            for (const r of compRows) await TVC_DB.put('ship_components', r);
            for (const r of jobRows) await TVC_DB.put('maintenance_jobs', r);
        }

        await TVC_DB.setMeta(metaKey(vid), JSON.stringify({
            archetype_key: key,
            applied_at: ts,
            component_count: compRows.length,
            job_count: jobRows.length,
            maker_overrides: makerOverrides,
        }));

        if (typeof TVC_MachineryTaxonomy !== 'undefined' && arch.taxonomy_profile) {
            await TVC_MachineryTaxonomy.setStoredProfileId(vid, arch.taxonomy_profile);
            await TVC_MachineryTaxonomy.ensureCatalogGroupDefs({
                vesselId: vid,
                profileId: arch.taxonomy_profile,
            });
        }

        return {
            vessel_id: vid,
            archetype_key: key,
            components: compRows.length,
            jobs: jobRows.length,
            skipped: false,
        };
    }

    return {
        loadArchetypes,
        listArchetypes,
        getArchetype,
        countArchetypeComponents,
        vesselHasMachinerySeed,
        applyVesselArchetype,
        metaKey,
    };
})();
if (typeof window !== 'undefined') window.TVC_TemplateService = TVC_TemplateService;
