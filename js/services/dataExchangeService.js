/* IACS UR E26/E27 sync package compliance + payload integrity (SHA-256) */
const TVC_DataExchangeService = (function () {
    const COMPLIANCE_STANDARD = 'IACS UR E26/E27 Cyber-Resilient';
    const ENCRYPTION_LAYER = 'PQC-Ready/AES-GCM';

    async function sha256HexUtf8(text) {
        const payload = String(text ?? '');
        if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
            const buf = new TextEncoder().encode(payload);
            const hash = await globalThis.crypto.subtle.digest('SHA-256', buf);
            return Array.from(new Uint8Array(hash))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
        }
        try {
            const { createHash } = await import('node:crypto');
            return createHash('sha256').update(payload, 'utf8').digest('hex');
        } catch (_) {
            return '';
        }
    }

    /**
     * Attach compliance manifest to tvc_sync.json payload.
     * Hash covers canonical JSON of payload body excluding compliance.package_hash_sha256.
     */
    async function applyComplianceManifest(payload, syncType = 'DELTA_ONLY') {
        const body = payload && typeof payload === 'object' ? { ...payload } : {};
        delete body.compliance;
        const canonical = JSON.stringify(body);
        const packageHash = await sha256HexUtf8(canonical);
        body.compliance = {
            standard: COMPLIANCE_STANDARD,
            encryption_layer: ENCRYPTION_LAYER,
            package_hash_sha256: packageHash,
            sync_type: syncType || 'DELTA_ONLY',
        };
        return body;
    }

    function resolveSyncType(opts = {}) {
        if (opts.monthlyExport) return 'MONTHLY_SNAPSHOT';
        if (opts.caseReview) return 'CASE_REVIEW';
        if (opts.packageType === 'COMPANY_REPORT') return 'COMPANY_REPORT';
        return 'DELTA_ONLY';
    }

    /**
     * Build ZIP entries for export — injects compliant tvc_sync.json before compression.
     */
    async function exportDataPackage(zip, payload, opts = {}) {
        const syncType = resolveSyncType(opts);
        const compliant = await applyComplianceManifest(payload, syncType);
        const jsonText = JSON.stringify(compliant, null, 2);
        zip.file('tvc_sync.json', jsonText);
        return { payload: compliant, jsonText, package_hash_sha256: compliant.compliance?.package_hash_sha256 };
    }

    return {
        sha256HexUtf8,
        applyComplianceManifest,
        resolveSyncType,
        exportDataPackage,
    };
})();
if (typeof window !== 'undefined') window.TVC_DataExchangeService = TVC_DataExchangeService;
