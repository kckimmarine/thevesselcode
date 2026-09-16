/* GFSM / SWT certificate dashboard — IndexedDB seed + fleet rows */
const TVC_SmCertificatesSeed = (function () {
    const META_SEED = 'sm_certificates_seed_v1';
    const SEED_URL = 'data/sm-certificates-gfsm.json';

    const FLEET_BY_COMPANY = {
        GFSM: [
            { id: 'MT BANGKOK CHEMI', name: 'MT BANGKOK CHEMI', code: '1', imo_no: '—', delivery: '—', company_id: 'GFSM' },
            { id: 'MT ONSAN CHEMI', name: 'MT ONSAN CHEMI', code: '2', imo_no: '—', delivery: '—', company_id: 'GFSM' },
            { id: 'MT THAI CHEMI', name: 'MT THAI CHEMI', code: '3', imo_no: '—', delivery: '—', company_id: 'GFSM' },
        ],
        SWT: [],
    };

    function companyForVessel(vessel) {
        const v = String(vessel || '');
        if (v.includes('SWT')) return 'SWT';
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

    async function ensureSeed() {
        const done = await TVC_DB.getMeta(META_SEED).catch(() => null);
        if (done) return { skipped: true };

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
        const companies = new Set(rows.map(r => r.company_id));
        for (const cid of companies) upsertFleetForCompany(cid);
        try { await TVC_DB.setMeta(META_SEED, ts); } catch (_) {}
        return { inserted: rows.length };
    }

    return {
        META_SEED,
        companyForVessel,
        ensureSeed,
        upsertFleetForCompany,
    };
})();
