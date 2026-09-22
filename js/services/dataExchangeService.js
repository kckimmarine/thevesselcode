/* IACS UR E26/E27 sync envelope v2 — SHA-256 + Ed25519 (offline-capable) */
const TVC_DataExchangeService = (function () {
    const ENVELOPE_VERSION = '2.0.0';
    const COMPLIANCE_STANDARD = 'IACS UR E26/E27 Cyber-Resilient';
    const LS_KEYPAIR = 'tvc_sync_ed25519_key_v1';
    const LS_TRUSTED_PUB = 'tvc_sync_trusted_public_keys_v1';

    const DEFAULT_PQC_EXTENSION = Object.freeze({
        ready: true,
        mode: 'HYBRID_READY',
        kem_algorithm: 'RESERVED_NIST_ML_KEM',
        dsa_algorithm: 'RESERVED_NIST_ML_DSA',
    });

    const ERR = Object.freeze({
        TAMPERED: 'ERR_TAMPERED_PACKAGE',
        INVALID_SIGNATURE: 'ERR_INVALID_SIGNATURE',
        TENANT_MISMATCH: 'ERR_TENANT_MISMATCH',
        MISSING_PUBLIC_KEY: 'ERR_MISSING_PUBLIC_KEY',
    });

    function stableStringify(value) {
        if (value === null || typeof value !== 'object') {
            return JSON.stringify(value);
        }
        if (Array.isArray(value)) {
            return `[${value.map(stableStringify).join(',')}]`;
        }
        const keys = Object.keys(value).sort();
        return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
    }

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

    function randomNonce(len = 4) {
        const arr = new Uint8Array(len);
        if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
            globalThis.crypto.getRandomValues(arr);
        } else {
            for (let i = 0; i < len; i++) arr[i] = Math.floor(Math.random() * 256);
        }
        return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function buildSyncId(vesselId, exportedAtIso) {
        const vid = String(vesselId || 'UNKNOWN').replace(/\s+/g, '_').slice(0, 48);
        const ts = String(exportedAtIso || new Date().toISOString()).replace(/[:.]/g, '-');
        return `SYNC-${vid}-${ts}-${randomNonce(4)}`;
    }

    function isEnvelopeV2(doc) {
        return doc && doc.envelope_version === ENVELOPE_VERSION && doc.payload && typeof doc.payload === 'object';
    }

    function readTrustedPublicKeys() {
        try {
            const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LS_TRUSTED_PUB) : null;
            return raw ? JSON.parse(raw) : {};
        } catch (_) {
            return {};
        }
    }

    function writeTrustedPublicKey(vesselId, spkiBase64) {
        if (typeof localStorage === 'undefined' || !vesselId || !spkiBase64) return;
        const map = readTrustedPublicKeys();
        map[String(vesselId)] = spkiBase64;
        localStorage.setItem(LS_TRUSTED_PUB, JSON.stringify(map));
    }

    async function readStoredKeyPair() {
        if (typeof localStorage === 'undefined') return null;
        try {
            const raw = localStorage.getItem(LS_KEYPAIR);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed?.privateKeyPkcs8Base64 || !parsed?.publicKeySpkiBase64) return null;
            return parsed;
        } catch (_) {
            return null;
        }
    }

    async function ensureSyncKeyPair() {
        const existing = await readStoredKeyPair();
        if (existing) return existing;
        if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.subtle) {
            return null;
        }
        const keyPair = await globalThis.crypto.subtle.generateKey(
            { name: 'Ed25519' },
            true,
            ['sign', 'verify'],
        );
        const priv = await globalThis.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
        const pub = await globalThis.crypto.subtle.exportKey('spki', keyPair.publicKey);
        const stored = {
            privateKeyPkcs8Base64: b64FromBuffer(priv),
            publicKeySpkiBase64: b64FromBuffer(pub),
        };
        localStorage.setItem(LS_KEYPAIR, JSON.stringify(stored));
        return stored;
    }

    function b64FromBuffer(buf) {
        const bytes = new Uint8Array(buf);
        let s = '';
        for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
        return btoa(s);
    }

    function bufferFromB64(b64) {
        const bin = atob(b64);
        const out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out.buffer;
    }

    function hexToBytes(hex) {
        const h = String(hex || '');
        const out = new Uint8Array(h.length / 2);
        for (let i = 0; i < out.length; i++) {
            out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
        }
        return out;
    }

    async function importPrivateKey(pkcs8Base64) {
        return globalThis.crypto.subtle.importKey(
            'pkcs8',
            bufferFromB64(pkcs8Base64),
            { name: 'Ed25519' },
            false,
            ['sign'],
        );
    }

    async function importPublicKey(spkiBase64) {
        return globalThis.crypto.subtle.importKey(
            'spki',
            bufferFromB64(spkiBase64),
            { name: 'Ed25519' },
            false,
            ['verify'],
        );
    }

    function buildMetadataFromPayload(payload, syncType, exportedAt) {
        const m = payload?.export_meta || {};
        return {
            company_id: String(m.company_id || '').trim(),
            vessel_id: String(m.vessel_id || '').trim(),
            imo_no: m.imo_no ? String(m.imo_no).trim() : null,
            department: m.department || null,
            exported_at: exportedAt,
            exported_by: m.exported_by || null,
            direction: m.direction || null,
            sync_type: syncType || 'DELTA_ONLY',
            station_id: m.station_id || null,
            schema_version: m.schema_version || null,
        };
    }

    function unwrapEnvelopeToLegacyShape(envelope) {
        if (!isEnvelopeV2(envelope)) return envelope;
        const payload = { ...envelope.payload };
        const meta = envelope.metadata || {};
        payload.export_meta = {
            ...(payload.export_meta || {}),
            vessel_id: meta.vessel_id || payload.export_meta?.vessel_id,
            company_id: meta.company_id || payload.export_meta?.company_id,
            department: meta.department || payload.export_meta?.department,
            exported_by: meta.exported_by || payload.export_meta?.exported_by,
            direction: meta.direction || payload.export_meta?.direction,
            export_date: String(meta.exported_at || payload.export_meta?.export_date || '').slice(0, 10),
            envelope_sync_id: envelope.sync_id,
            envelope_version: envelope.envelope_version,
        };
        return payload;
    }

    async function signPayloadHash(privateKeyPkcs8Base64, payloadHashHex) {
        const key = await importPrivateKey(privateKeyPkcs8Base64);
        const sig = await globalThis.crypto.subtle.sign(
            { name: 'Ed25519' },
            key,
            hexToBytes(payloadHashHex),
        );
        return b64FromBuffer(sig);
    }

    async function verifyPayloadHash(publicKeySpkiBase64, payloadHashHex, signatureB64) {
        const key = await importPublicKey(publicKeySpkiBase64);
        return globalThis.crypto.subtle.verify(
            { name: 'Ed25519' },
            key,
            bufferFromB64(signatureB64),
            hexToBytes(payloadHashHex),
        );
    }

    async function buildEnvelopeV2(innerPayload, opts = {}) {
        const syncType = resolveSyncType(opts);
        const exportedAt = new Date().toISOString();
        const metadata = buildMetadataFromPayload(innerPayload, syncType, exportedAt);
        const syncId = opts.syncId || buildSyncId(metadata.vessel_id, exportedAt);
        const payloadCanonical = stableStringify(innerPayload);
        const payloadHash = await sha256HexUtf8(payloadCanonical);

        let digitalSignature = null;
        let signerPublicKeySpkiBase64 = null;
        const keyMaterial = opts.keyPair || await ensureSyncKeyPair();
        if (keyMaterial) {
            digitalSignature = await signPayloadHash(keyMaterial.privateKeyPkcs8Base64, payloadHash);
            signerPublicKeySpkiBase64 = keyMaterial.publicKeySpkiBase64;
        }

        return {
            envelope_version: ENVELOPE_VERSION,
            sync_id: syncId,
            metadata,
            compliance: {
                standard: COMPLIANCE_STANDARD,
                integrity_algorithm: 'SHA-256',
                signature_algorithm: 'Ed25519',
                payload_hash: payloadHash,
                digital_signature: digitalSignature,
                signer_public_key_spki_base64: signerPublicKeySpkiBase64,
            },
            pqc_extension: { ...DEFAULT_PQC_EXTENSION, ...(opts.pqc_extension || {}) },
            payload: innerPayload,
        };
    }

    function resolveSyncType(opts = {}) {
        if (opts.monthlyExport) return 'MONTHLY_SNAPSHOT';
        if (opts.caseReview) return 'CASE_REVIEW';
        if (opts.packageType === 'COMPANY_REPORT') return 'COMPANY_REPORT';
        return 'DELTA_ONLY';
    }

    /** @deprecated v1 inline compliance — use envelope v2 */
    async function applyComplianceManifest(payload, syncType = 'DELTA_ONLY') {
        const body = payload && typeof payload === 'object' ? { ...payload } : {};
        delete body.compliance;
        const canonical = JSON.stringify(body);
        const packageHash = await sha256HexUtf8(canonical);
        body.compliance = {
            standard: COMPLIANCE_STANDARD,
            encryption_layer: 'PQC-Ready/AES-GCM',
            package_hash_sha256: packageHash,
            sync_type: syncType || 'DELTA_ONLY',
        };
        return body;
    }

    async function verifyEnvelopeForImport(envelope, options = {}) {
        if (!isEnvelopeV2(envelope)) {
            if (options.requireV2) {
                return { ok: false, code: 'ERR_NOT_ENVELOPE_V2', message: 'Envelope v2 required' };
            }
            const legacy = envelope?.compliance?.package_hash_sha256;
            if (legacy) {
                const body = { ...envelope };
                delete body.compliance;
                const recalc = await sha256HexUtf8(JSON.stringify(body));
                if (recalc !== legacy) {
                    return { ok: false, code: ERR.TAMPERED, message: 'legacy hash mismatch' };
                }
            }
            return { ok: true, legacy: true, payload: envelope };
        }

        const meta = envelope.metadata || {};
        if (options.expectedVesselId && meta.vessel_id && meta.vessel_id !== options.expectedVesselId) {
            return { ok: false, code: ERR.TENANT_MISMATCH, message: 'vessel_id mismatch' };
        }
        if (options.expectedCompanyId && meta.company_id && meta.company_id !== options.expectedCompanyId) {
            return { ok: false, code: ERR.TENANT_MISMATCH, message: 'company_id mismatch' };
        }

        const recalc = await sha256HexUtf8(stableStringify(envelope.payload));
        const declared = envelope.compliance?.payload_hash;
        if (!declared || recalc !== declared) {
            return { ok: false, code: ERR.TAMPERED, message: 'payload_hash mismatch' };
        }

        const trusted = readTrustedPublicKeys();
        let pubB64 = trusted[meta.vessel_id] || envelope.compliance?.signer_public_key_spki_base64;
        if (!pubB64) {
            return { ok: false, code: ERR.MISSING_PUBLIC_KEY, message: 'no public key' };
        }

        const sig = envelope.compliance?.digital_signature;
        if (!sig) {
            return { ok: false, code: ERR.INVALID_SIGNATURE, message: 'signature missing' };
        }

        const valid = await verifyPayloadHash(pubB64, declared, sig);
        if (!valid) {
            return { ok: false, code: ERR.INVALID_SIGNATURE, message: 'invalid signature' };
        }

        if (!trusted[meta.vessel_id] && envelope.compliance?.signer_public_key_spki_base64) {
            writeTrustedPublicKey(meta.vessel_id, envelope.compliance.signer_public_key_spki_base64);
        }

        return {
            ok: true,
            verification_status: 'VERIFIED',
            sync_id: envelope.sync_id,
            payload: unwrapEnvelopeToLegacyShape(envelope),
        };
    }

    /**
     * Build ZIP entries for export — writes envelope v2 tvc_sync.json (offline).
     */
    async function exportDataPackage(zip, payload, opts = {}) {
        const useV2 = opts.envelopeVersion !== '1' && typeof globalThis.crypto !== 'undefined';
        if (useV2) {
            const envelope = await buildEnvelopeV2(payload, opts);
            const jsonText = JSON.stringify(envelope, null, 2);
            zip.file('tvc_sync.json', jsonText);
            return {
                payload: envelope,
                innerPayload: payload,
                jsonText,
                package_hash_sha256: envelope.compliance?.payload_hash,
                sync_id: envelope.sync_id,
            };
        }
        const compliant = await applyComplianceManifest(payload, resolveSyncType(opts));
        const jsonText = JSON.stringify(compliant, null, 2);
        zip.file('tvc_sync.json', jsonText);
        return { payload: compliant, jsonText, package_hash_sha256: compliant.compliance?.package_hash_sha256 };
    }

    /**
     * Used by sync.js — same as exportDataPackage (alias for spec naming).
     */
    async function buildExportZipBlob(zip, payload, opts = {}) {
        return exportDataPackage(zip, payload, opts);
    }

    return {
        ENVELOPE_VERSION,
        ERR,
        stableStringify,
        sha256HexUtf8,
        buildSyncId,
        isEnvelopeV2,
        buildEnvelopeV2,
        unwrapEnvelopeToLegacyShape,
        applyComplianceManifest,
        resolveSyncType,
        exportDataPackage,
        buildExportZipBlob,
        verifyEnvelopeForImport,
        ensureSyncKeyPair,
    };
})();
if (typeof window !== 'undefined') window.TVC_DataExchangeService = TVC_DataExchangeService;
