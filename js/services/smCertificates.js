/* SM Mode — vessel / company certificate records (offline IndexedDB) */
const TVC_SmCertificates = (function () {
    const META_DATE = 'sm_certificates_date_updated';

    function nowIso() {
        return new Date().toISOString();
    }

    function generateId() {
        return 'cert_' + Math.random().toString(36).substr(2, 9);
    }

    function parseRefDate(refDateStr) {
        if (!refDateStr) return new Date();
        const d = new Date(refDateStr);
        if (Number.isNaN(d.getTime())) return new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function getStatusInfo(expireStr, refDate) {
        const today = parseRefDate(refDate);
        let diffDays = 9999;
        let badgeClass = 'bg-success';
        let rawStatus = 'SAFE';
        const exp = String(expireStr || '').trim();
        if (exp && exp !== '-' && exp.toLowerCase() !== 'permanent') {
            const expDate = new Date(exp);
            if (!Number.isNaN(expDate.getTime())) {
                expDate.setHours(0, 0, 0, 0);
                diffDays = Math.ceil((expDate - today) / 86400000);
                if (diffDays <= 15) { rawStatus = 'DANGER'; badgeClass = 'bg-danger'; }
                else if (diffDays <= 30) { rawStatus = 'URGENT'; badgeClass = 'bg-urgent'; }
                else if (diffDays <= 60) { rawStatus = 'WARNING'; badgeClass = 'bg-warning'; }
                else { rawStatus = 'SAFE'; badgeClass = 'bg-success'; }
            }
        }
        return { diffDays, rawStatus, badgeClass };
    }

    function withComputedFields(row, refDate) {
        const s = getStatusInfo(row.expireDate, refDate);
        return {
            ...row,
            days: s.diffDays,
            rawStatus: s.rawStatus,
            badge: s.badgeClass,
        };
    }

    async function getReferenceDate() {
        const saved = await TVC_DB.getMeta(META_DATE).catch(() => null);
        if (saved) return String(saved).slice(0, 10);
        return new Date().toISOString().slice(0, 10);
    }

    async function setReferenceDate(ymd) {
        const v = String(ymd || '').slice(0, 10);
        await TVC_DB.setMeta(META_DATE, v);
        return v;
    }

    function resolveCompanyId(user, companyOverride) {
        const override = String(companyOverride || '').trim();
        if (override && override !== '__ALL__') return override;
        if (!user) return '';
        return String(user.company_id || '').trim();
    }

    async function listForUser(user, companyOverride) {
        const companyId = resolveCompanyId(user, companyOverride);
        const all = await TVC_DB.getAll('sm_certificates').catch(() => []);
        const refDate = await getReferenceDate();
        let rows = all;
        if (companyId) {
            rows = all.filter(r => String(r.company_id || '') === companyId);
        }
        return rows.map(r => withComputedFields(r, refDate));
    }

    async function saveRecord(user, data) {
        const companyId = String(data.company_id || resolveCompanyId(user) || TVC_SmCertificatesSeed.companyForVessel(data.vessel)).trim();
        const refDate = await getReferenceDate();
        const s = getStatusInfo(data.expireDate, refDate);
        const ts = nowIso();
        const id = data.id || generateId();
        const row = {
            id,
            company_id: companyId,
            vessel: String(data.vessel || '').trim(),
            name: String(data.name || '').trim(),
            certNo: data.certNo || '-',
            issuer: data.issuer || '-',
            issueDate: data.issueDate || '-',
            lastAnn: data.lastAnn || '-',
            lastInt: data.lastInt || '-',
            expireDate: data.expireDate || '-',
            dept: data.dept || '-',
            fileLink: String(data.fileLink || '').trim() || '-',
            remarks: data.remarks || '-',
            days: s.diffDays,
            rawStatus: s.rawStatus,
            badge: s.badgeClass,
            sync_status: 'local',
            updated_at: ts,
        };
        await TVC_DB.put('sm_certificates', row);
        return row;
    }

    async function deleteRecord(id) {
        await TVC_DB.del('sm_certificates', id);
    }

    async function deleteAllForCompany(companyId) {
        const cid = String(companyId || '').trim();
        const all = await TVC_DB.getAll('sm_certificates').catch(() => []);
        for (const r of all) {
            if (!cid || String(r.company_id || '') === cid) {
                await TVC_DB.del('sm_certificates', r.id);
            }
        }
    }

    function defaultTabForCompany(companyId) {
        const c = String(companyId || '').trim();
        if (c === 'GFSM') return 'GFSM 증서';
        return 'ALL';
    }

    function statusLabel(days, rawStatus) {
        if (days === 9999) return '정상';
        if (days < 0) return `만료됨 (D+${Math.abs(days)})`;
        if (rawStatus === 'DANGER') return `초긴급 (D-${days})`;
        if (rawStatus === 'URGENT') return `긴급 (D-${days})`;
        if (rawStatus === 'WARNING') return `주의 (D-${days})`;
        return `정상 (D-${days})`;
    }

    return {
        META_DATE,
        getStatusInfo,
        getReferenceDate,
        setReferenceDate,
        resolveCompanyId,
        listForUser,
        saveRecord,
        deleteRecord,
        deleteAllForCompany,
        defaultTabForCompany,
        statusLabel,
        generateId,
    };
})();
