/* Universal machinery taxonomy — vessel profile × DECK/ENGINE group catalog (offline JSON). */
const TVC_MachineryTaxonomy = (function () {
    const TAXONOMY_URL = 'data/equipment-taxonomy.json';
    const META_PROFILE = 'vessel_machinery_profile';
    const META_CATALOG_SEED = 'machinery_catalog_seed_v1';

    let _cache = null;
    let _loadPromise = null;

    function padNo(n) {
        const d = parseInt(String(n).replace(/\D/g, ''), 10);
        return Number.isFinite(d) ? String(d).padStart(2, '0') : String(n || '').trim();
    }

    function groupLabel(no, name) {
        const nm = String(name || '').replace(/\s+/g, ' ').trim();
        const n = padNo(no);
        return n && nm ? `${n}. ${nm}` : nm;
    }

    function normDept(dept) {
        const d = String(dept || '').trim().toUpperCase();
        if (d.includes('DECK') || d === 'DEK') return 'DECK';
        if (d.includes('ENGINE') || d === 'ENG') return 'ENGINE';
        return d;
    }

    async function loadTaxonomy(force) {
        if (_cache && !force) return _cache;
        if (_loadPromise && !force) return _loadPromise;
        _loadPromise = (async () => {
            try {
                const res = await fetch(TAXONOMY_URL, { cache: 'no-cache' });
                if (res.ok) {
                    _cache = await res.json();
                    return _cache;
                }
            } catch (e) {
                console.warn('[TVC_MachineryTaxonomy] fetch failed', e);
            }
            _cache = _cache || _embeddedFallback();
            return _cache;
        })();
        return _loadPromise;
    }

    function _embeddedFallback() {
        return {
            version: 1,
            profiles: { bulker: { id: 'bulker', label: 'Bulker' } },
            deck_common: [],
            engine_common: [],
            extensions: {},
        };
    }

    function listProfiles(tax) {
        const t = tax || _cache;
        if (!t?.profiles) return [];
        return Object.values(t.profiles).map(p => ({
            id: p.id,
            label: p.label,
            demo_label: p.demo_label || p.label,
            vessel_types: p.vessel_types || [],
        }));
    }

    function getProfile(profileId, tax) {
        const t = tax || _cache;
        const id = String(profileId || 'bulker').trim();
        return t?.profiles?.[id] || t?.profiles?.bulker || null;
    }

    function groupsForDepartment(profileId, department, tax) {
        const t = tax || _cache;
        if (!t) return [];
        const dept = normDept(department);
        const base = dept === 'DECK' ? (t.deck_common || []) : (t.engine_common || []);
        const extRows = (t.extensions?.[profileId] || {})[dept.toLowerCase()] || [];
        const mapRow = (row, tier) => ({
            no: padNo(row.no),
            name: String(row.name || '').trim(),
            label: groupLabel(row.no, row.name),
            equipment: Array.isArray(row.equipment) ? row.equipment.slice() : [],
            department: dept,
            tier,
        });
        return [
            ...base.map(row => mapRow(row, 'common')),
            ...extRows.map(row => mapRow(row, 'extension')),
        ];
    }

    function equipmentForGroup(profileId, department, groupLabel, tax) {
        const groups = groupsForDepartment(profileId, department, tax);
        const lab = String(groupLabel || '').replace(/\s+/g, ' ').trim();
        const hit = groups.find(g => g.label === lab || lab.endsWith(g.name));
        return hit?.equipment || [];
    }

    async function getStoredProfileId(vesselId) {
        const vid = String(vesselId || '').trim();
        const key = `${META_PROFILE}_${vid.replace(/[^\w.-]+/g, '_').slice(0, 48)}`;
        try {
            const meta = await TVC_DB.getMeta(key);
            if (meta) return String(meta).trim();
        } catch (_) { /* ignore */ }
        try {
            const global = await TVC_DB.getMeta(TVC_META_KEYS.VESSEL_MACHINERY_PROFILE);
            if (global && !vid) return String(global).trim();
        } catch (_) { /* ignore */ }
        return '';
    }

    async function setStoredProfileId(vesselId, profileId) {
        const vid = String(vesselId || '').trim();
        const pid = String(profileId || '').trim();
        if (!pid) return;
        const key = `${META_PROFILE}_${vid.replace(/[^\w.-]+/g, '_').slice(0, 48)}`;
        await TVC_DB.setMeta(key, pid);
        if (vid && typeof TVC_Fleet !== 'undefined' && TVC_Fleet.getSelectedId() === vid) {
            await TVC_DB.setMeta(TVC_META_KEYS.VESSEL_MACHINERY_PROFILE, pid);
        }
    }

    function profileFromRegistryVessel(vessel) {
        if (!vessel) return '';
        return String(vessel.machinery_profile || vessel.machineryProfile || '').trim();
    }

    async function resolveActiveProfile(vesselId) {
        const vid = vesselId
            || (typeof TVC_Fleet !== 'undefined' ? TVC_Fleet.getSelectedId() : '')
            || (await TVC_DB.getMeta(TVC_META_KEYS.VESSEL_ID).catch(() => ''));
        let pid = await getStoredProfileId(vid);
        if (pid) return pid;
        try {
            if (typeof TVC_AdminRegistry !== 'undefined') {
                const reg = await TVC_AdminRegistry.load();
                for (const c of reg?.companies || []) {
                    const v = (c.vessels || []).find(x => String(x.vessel_id) === String(vid));
                    if (v) {
                        pid = profileFromRegistryVessel(v);
                        if (pid) break;
                    }
                }
            }
        } catch (_) { /* ignore */ }
        return pid || 'bulker';
    }

    async function ensureCatalogGroupDefs(opts = {}) {
        await loadTaxonomy();
        const vesselId = opts.vesselId
            || (typeof TVC_Fleet !== 'undefined' ? TVC_Fleet.getSelectedId() : null)
            || (await TVC_DB.getMeta(TVC_META_KEYS.VESSEL_ID).catch(() => null));
        const profileId = opts.profileId || (await resolveActiveProfile(vesselId));
        const seedKey = `${META_CATALOG_SEED}_${String(vesselId || 'SHIP')}_${profileId}`;
        const done = await TVC_DB.getMeta(seedKey).catch(() => null);
        if (done && !opts.force) return { skipped: true, profileId };

        const jobs = await TVC_DB.getAll('maintenance_jobs').catch(() => []);
        const hasJobs = jobs.some(j => !vesselId || !j.vessel_id || j.vessel_id === vesselId);
        if (hasJobs && !opts.force) {
            await TVC_DB.setMeta(seedKey, 'skipped-has-jobs');
            await setStoredProfileId(vesselId, profileId);
            return { skipped: true, reason: 'has_jobs', profileId };
        }

        const defs = await TVC_DB.getAll('maintenance_groups').catch(() => []);
        const ts = new Date().toISOString();
        let added = 0;
        for (const dept of ['DECK', 'ENGINE']) {
            const groups = groupsForDepartment(profileId, dept);
            for (const g of groups) {
                const key = `${dept}|${g.label}`;
                const exists = defs.some(d =>
                    (d.department === dept)
                    && String(d.label || '').replace(/\s+/g, ' ').trim() === g.label
                    && (!vesselId || !d.vessel_id || d.vessel_id === vesselId)
                );
                if (exists) continue;
                await TVC_DB.put('maintenance_groups', {
                    id: `tax-${profileId}-${dept}-${g.no}-${Date.now().toString(36)}`,
                    vessel_id: vesselId,
                    department: dept,
                    label: g.label,
                    sort_order: parseInt(g.no, 10) || 0,
                    taxonomy_profile: profileId,
                    taxonomy_tier: g.tier,
                    created_at: ts,
                    updated_at: ts,
                    sync_status: 'LOCAL',
                });
                added++;
            }
        }
        await TVC_DB.setMeta(seedKey, ts);
        await setStoredProfileId(vesselId, profileId);
        return { profileId, added };
    }

    function operationalParity(tax) {
        const t = tax || _cache;
        return t?.operational_parity || null;
    }

    return {
        TAXONOMY_URL,
        loadTaxonomy,
        listProfiles,
        getProfile,
        groupsForDepartment,
        equipmentForGroup,
        groupLabel,
        resolveActiveProfile,
        setStoredProfileId,
        ensureCatalogGroupDefs,
        operationalParity,
        profileFromRegistryVessel,
    };
})();
