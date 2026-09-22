'use strict';

/**
 * SYNC-ENVELOPE-V2 — shared canonical hashing, Ed25519 sign/verify (Node + tests).
 * Browser parity: js/services/dataExchangeService.js
 */
const crypto = require('crypto');

const ENVELOPE_VERSION = '2.0.0';
const COMPLIANCE_STANDARD = 'IACS UR E26/E27 Cyber-Resilient';
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
    UNKNOWN_VESSEL: 'ERR_UNKNOWN_VESSEL',
    MISSING_PUBLIC_KEY: 'ERR_MISSING_PUBLIC_KEY',
    DUPLICATE_SYNC_ID: 'ERR_DUPLICATE_SYNC_ID',
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
    return crypto.createHash('sha256').update(String(text ?? ''), 'utf8').digest('hex');
}

function randomNonce(len = 8) {
    return crypto.randomBytes(len).toString('hex');
}

function buildSyncId(vesselId, exportedAtIso) {
    const vid = String(vesselId || 'UNKNOWN').replace(/\s+/g, '_').slice(0, 48);
    const ts = String(exportedAtIso || new Date().toISOString()).replace(/[:.]/g, '-');
    return `SYNC-${vid}-${ts}-${randomNonce(4)}`;
}

function isEnvelopeV2(doc) {
    return doc && doc.envelope_version === ENVELOPE_VERSION && doc.payload && typeof doc.payload === 'object';
}

function isLegacyV1Compliance(doc) {
    return doc && doc.compliance && doc.compliance.package_hash_sha256 && !isEnvelopeV2(doc);
}

function buildMetadataFromExportMeta(exportMeta, extras = {}) {
    const m = exportMeta && typeof exportMeta === 'object' ? exportMeta : {};
    return {
        company_id: String(m.company_id || extras.company_id || '').trim(),
        vessel_id: String(m.vessel_id || extras.vessel_id || '').trim(),
        imo_no: String(m.imo_no || extras.imo_no || '').trim() || null,
        department: m.department || extras.department || null,
        exported_at: m.exported_at || extras.exported_at || m.export_date || new Date().toISOString(),
        exported_by: m.exported_by || extras.exported_by || null,
        direction: m.direction || extras.direction || null,
        sync_type: extras.sync_type || null,
        station_id: m.station_id || extras.station_id || null,
        schema_version: m.schema_version || extras.schema_version || null,
    };
}

/**
 * @param {object} opts
 * @param {object} opts.payload — inner sync body (export_meta + stores)
 * @param {string} opts.syncType
 * @param {string} [opts.syncId]
 * @param {string} opts.privateKeyPem — Ed25519 PKCS8 PEM
 * @param {string} opts.publicKeyPem — Ed25519 SPKI PEM
 */
async function buildEnvelopeV2(opts = {}) {
    const payload = opts.payload && typeof opts.payload === 'object' ? opts.payload : {};
    const exportedAt = new Date().toISOString();
    const metadata = buildMetadataFromExportMeta(payload.export_meta, {
        ...opts,
        exported_at: exportedAt,
        sync_type: opts.syncType || 'DELTA_ONLY',
    });
    const syncId = opts.syncId || buildSyncId(metadata.vessel_id, exportedAt);
    const payloadCanonical = stableStringify(payload);
    const payloadHash = await sha256HexUtf8(payloadCanonical);

    const privateKey = crypto.createPrivateKey(opts.privateKeyPem);
    const signature = crypto.sign(null, Buffer.from(payloadHash, 'hex'), privateKey);
    const publicKey = crypto.createPublicKey(opts.publicKeyPem);
    const publicKeyDer = publicKey.export({ type: 'spki', format: 'der' });

    const envelope = {
        envelope_version: ENVELOPE_VERSION,
        sync_id: syncId,
        metadata,
        compliance: {
            standard: COMPLIANCE_STANDARD,
            integrity_algorithm: 'SHA-256',
            signature_algorithm: 'Ed25519',
            payload_hash: payloadHash,
            digital_signature: signature.toString('base64'),
            signer_public_key_spki_base64: Buffer.from(publicKeyDer).toString('base64'),
        },
        pqc_extension: { ...DEFAULT_PQC_EXTENSION, ...(opts.pqc_extension || {}) },
        payload,
    };
    return envelope;
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

function resolvePublicKeyPem(envelope, publicKeyRegistry = {}) {
    const vid = String(envelope?.metadata?.vessel_id || '').trim();
    const fromRegistry = vid && publicKeyRegistry[vid];
    if (fromRegistry) {
        if (String(fromRegistry).includes('BEGIN PUBLIC KEY')) return fromRegistry;
        return `-----BEGIN PUBLIC KEY-----\n${fromRegistry}\n-----END PUBLIC KEY-----`;
    }
    const b64 = envelope?.compliance?.signer_public_key_spki_base64;
    if (b64) {
        const der = Buffer.from(b64, 'base64');
        const keyObj = crypto.createPublicKey({ key: der, format: 'der', type: 'spki' });
        return keyObj.export({ type: 'spki', format: 'pem' });
    }
    return null;
}

/**
 * Verify envelope v2 integrity + signature + tenant headers.
 * @returns {{ ok: boolean, code?: string, message?: string, envelope?: object, payload?: object }}
 */
async function verifyEnvelopeV2(envelope, options = {}) {
    if (!isEnvelopeV2(envelope)) {
        return { ok: false, code: 'ERR_NOT_ENVELOPE_V2', message: 'Not an envelope v2 document' };
    }

    const expectedCompany = String(options.companyId || '').trim();
    const expectedVessel = String(options.vesselId || '').trim();
    const meta = envelope.metadata || {};

    if (expectedVessel && meta.vessel_id && meta.vessel_id !== expectedVessel) {
        return { ok: false, code: ERR.TENANT_MISMATCH, message: 'vessel_id tenant mismatch' };
    }
    if (expectedCompany && meta.company_id && meta.company_id !== expectedCompany) {
        return { ok: false, code: ERR.TENANT_MISMATCH, message: 'company_id tenant mismatch' };
    }
    if (!meta.vessel_id) {
        return { ok: false, code: ERR.UNKNOWN_VESSEL, message: 'metadata.vessel_id missing' };
    }

    const payloadCanonical = stableStringify(envelope.payload);
    const recalc = await sha256HexUtf8(payloadCanonical);
    const declared = String(envelope.compliance?.payload_hash || '');
    if (!declared || recalc !== declared) {
        return { ok: false, code: ERR.TAMPERED, message: 'payload_hash mismatch' };
    }

    const pubPem = resolvePublicKeyPem(envelope, options.publicKeyRegistry || {});
    if (!pubPem) {
        return { ok: false, code: ERR.MISSING_PUBLIC_KEY, message: 'No trusted public key for vessel' };
    }

    const sigB64 = envelope.compliance?.digital_signature;
    if (!sigB64) {
        return { ok: false, code: ERR.INVALID_SIGNATURE, message: 'digital_signature missing' };
    }

    const publicKey = crypto.createPublicKey(pubPem);
    const okSig = crypto.verify(
        null,
        Buffer.from(declared, 'hex'),
        publicKey,
        Buffer.from(sigB64, 'base64'),
    );
    if (!okSig) {
        return { ok: false, code: ERR.INVALID_SIGNATURE, message: 'Ed25519 signature invalid' };
    }

    return {
        ok: true,
        code: 'VERIFIED',
        envelope,
        payload: unwrapEnvelopeToLegacyShape(envelope),
        sync_id: envelope.sync_id,
    };
}

/** Legacy v1: hash body without compliance block */
async function verifyLegacyCompliance(doc) {
    if (!isLegacyV1Compliance(doc)) return { ok: true, legacy: true, payload: doc };
    const body = { ...doc };
    delete body.compliance;
    const canonical = JSON.stringify(body);
    const recalc = await sha256HexUtf8(canonical);
    const declared = doc.compliance?.package_hash_sha256;
    if (declared && recalc !== declared) {
        return { ok: false, code: ERR.TAMPERED, message: 'legacy package_hash_sha256 mismatch' };
    }
    return { ok: true, legacy: true, payload: doc };
}

async function verifySyncDocument(doc, options = {}) {
    if (isEnvelopeV2(doc)) {
        return verifyEnvelopeV2(doc, options);
    }
    if (options.requireEnvelopeV2) {
        return { ok: false, code: 'ERR_LEGACY_PACKAGE', message: 'Envelope v2 required' };
    }
    return verifyLegacyCompliance(doc);
}

function generateEd25519KeyPairPem() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    return {
        publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }),
        privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    };
}

function loadPublicKeyRegistryFromEnv() {
    const raw = process.env.SYNC_VESSEL_PUBLIC_KEYS_JSON || '';
    if (!raw.trim()) return {};
    try {
        return JSON.parse(raw);
    } catch (_) {
        return {};
    }
}

function envelopeLegacyAllowed() {
    const v = String(process.env.SYNC_ENVELOPE_LEGACY_ALLOW ?? '1').trim();
    return v === '1' || v.toLowerCase() === 'true' || v.toLowerCase() === 'yes';
}

function envelopeSignatureRequired() {
    const v = String(process.env.SYNC_ENVELOPE_REQUIRE_SIGNATURE ?? '0').trim();
    return v === '1' || v.toLowerCase() === 'true' || v.toLowerCase() === 'yes';
}

module.exports = {
    ENVELOPE_VERSION,
    COMPLIANCE_STANDARD,
    DEFAULT_PQC_EXTENSION,
    ERR,
    stableStringify,
    sha256HexUtf8,
    buildSyncId,
    isEnvelopeV2,
    isLegacyV1Compliance,
    buildEnvelopeV2,
    unwrapEnvelopeToLegacyShape,
    verifyEnvelopeV2,
    verifyLegacyCompliance,
    verifySyncDocument,
    generateEd25519KeyPairPem,
    loadPublicKeyRegistryFromEnv,
    envelopeLegacyAllowed,
    envelopeSignatureRequired,
};
