/* GFSM / SWT certificate dashboard — IndexedDB seed + fleet rows */
const TVC_SmCertificatesSeed = (function () {
    const META_SEED = 'sm_certificates_seed_v2';
    const SEED_URL = 'data/sm-certificates-gfsm.json';

    const FLEET_BY_COMPANY = {
        GFSM: [
            { id: 'MT BANGKOK CHEMI', name: 'MT BANGKOK CHEMI', code: '1', imo_no: '—', delivery: '—', company_id: 'GFSM' },
            { id: 'MT ONSAN CHEMI', name: 'MT ONSAN CHEMI', code: '2', imo_no: '—', delivery: '—', company_id: 'GFSM' },
            { id: 'MT THAI CHEMI', name: 'MT THAI CHEMI', code: '3', imo_no: '—', delivery: '—', company_id: 'GFSM' },
        ],
        SWT: [],
    };

    function companyForVessel() {
        return 'GFSM';
    }

    function nowIso() {
        return new Date().toISOString();
    }

    function upsertFleetForCompany(companyId) {
        if (typeof TVC_Fleet === 'undefined' || !TVC_Fleet.upsert) return;
        const rows = FLEET_BY_COMPANY[companyId] || [];
        for (const v of rows) TVC_Fleet.upsert(v);
    }

    async function loadSeedPayload() {
        try {
            const res = await fetch(SEED_URL);
            if (res.ok) return res.json();
        } catch (_) { /* offline / PWA — use embedded bundle */ }
        if (typeof TVC_GFSM_CERTS_SEED !== 'undefined' && TVC_GFSM_CERTS_SEED?.records?.length) {
            return TVC_GFSM_CERTS_SEED;
        }
        return null;
    }

    async function migrateSwtCompanyIds() {
        const all = await TVC_DB.getAll('sm_certificates').catch(() => []);
        const ts = nowIso();
        for (const r of all) {
            if (String(r.company_id || '') === 'SWT') {
                await TVC_DB.put('sm_certificates', { ...r, company_id: 'GFSM', updated_at: ts });
            }
        }
    }

    async function ensureSeed() {
        const done = await TVC_DB.getMeta(META_SEED).catch(() => null);
        if (done) {
            await migrateSwtCompanyIds();
            return { skipped: true };
        }

        const existing = await TVC_DB.getAll('sm_certificates').catch(() => []);
        if (existing.length) {
            try { await TVC_DB.setMeta(META_SEED, nowIso()); } catch (_) {}
            return { skipped: true, hadData: true };
        }

        const payload = await loadSeedPayload();
        if (!payload || !Array.isArray(payload.records) || !payload.records.length) {
            return { needFile: true };
        }

        const ts = nowIso();
        const rows = payload.records.map(r => ({
            ...r,
            company_id: r.company_id || companyForVessel(r.vessel),
            sync_status: 'local',
            updated_at: ts,
        }));
        await TVC_DB.bulkPut('sm_certificates', rows);
        upsertFleetForCompany('GFSM');
        await migrateSwtCompanyIds();
        try { await TVC_DB.setMeta(META_SEED, ts); } catch (_) {}
        return { inserted: rows.length };
    }

    async function reseedCompany(companyId) {
        const cid = String(companyId || '').trim();
        if (!cid) return { skipped: true };
        const payload = await loadSeedPayload();
        if (!payload?.records?.length) return { needFile: true };
        await TVC_SmCertificates.deleteAllForCompany(cid);
        const ts = nowIso();
        const rows = payload.records
            .filter(r => (r.company_id || companyForVessel(r.vessel)) === cid)
            .map(r => ({
                ...r,
                company_id: r.company_id || companyForVessel(r.vessel),
                sync_status: 'local',
                updated_at: ts,
            }));
        if (rows.length) await TVC_DB.bulkPut('sm_certificates', rows);
        upsertFleetForCompany(cid);
        return { inserted: rows.length };
    }

    return {
        META_SEED,
        companyForVessel,
        ensureSeed,
        reseedCompany,
        upsertFleetForCompany,
    };
})();
