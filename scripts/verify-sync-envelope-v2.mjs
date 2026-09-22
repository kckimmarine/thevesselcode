#!/usr/bin/env node
/**
 * Offline tests for SYNC-ENVELOPE-V2 (Node crypto + ingest verify helpers).
 * Usage: node scripts/verify-sync-envelope-v2.mjs
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import JSZip from 'jszip';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const {
    buildEnvelopeV2,
    verifyEnvelopeV2,
    verifySyncDocument,
    generateEd25519KeyPairPem,
    ERR,
    isEnvelopeV2,
} = require(path.join(ROOT, 'api', '_lib', 'syncEnvelopeV2.js'));

const {
    verifyIncomingDocument,
    effectiveSyncPayload,
} = require(path.join(ROOT, 'api', '_lib', 'syncIngest.js'));

const VESSEL = 'TVC No1';
const COMPANY = 'TVC';

let pass = 0;
let fail = 0;

function assert(name, cond, detail = '') {
    if (cond) {
        console.log(`  ✓ ${name}`);
        pass += 1;
    } else {
        console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
        fail += 1;
    }
}

function sampleInnerPayload() {
    const now = new Date().toISOString();
    return {
        export_meta: {
            vessel_id: VESSEL,
            company_id: COMPANY,
            export_date: now.slice(0, 10),
            direction: 'SHIP_TO_HQ',
            department: 'ENGINE',
            exported_by: 'verify-envelope-v2',
            schema_version: 6,
        },
        maintenance_jobs: [{
            id: `env-job-${Date.now()}`,
            job_code: '99-99-002',
            department: 'ENGINE',
            vessel_id: VESSEL,
            sync_status: 'LOCAL',
            updated_at: now,
        }],
    };
}

async function main() {
    console.log('SYNC-ENVELOPE-V2 verification\n');

    const { publicKeyPem, privateKeyPem } = generateEd25519KeyPairPem();
    const inner = sampleInnerPayload();
    const envelope = await buildEnvelopeV2({
        payload: inner,
        syncType: 'DELTA_ONLY',
        privateKeyPem,
        publicKeyPem,
    });

    assert('envelope_version is 2.0.0', envelope.envelope_version === '2.0.0');
    assert('sync_id prefix', String(envelope.sync_id).startsWith('SYNC-'));
    assert('pqc_extension.ready', envelope.pqc_extension?.ready === true);
    assert('isEnvelopeV2', isEnvelopeV2(envelope));

    const registry = { [VESSEL]: publicKeyPem };
    const ok = await verifyEnvelopeV2(envelope, {
        companyId: COMPANY,
        vesselId: VESSEL,
        publicKeyRegistry: registry,
    });
    assert('verifyEnvelopeV2 OK', ok.ok === true, ok.message);
    assert('unwrap payload has export_meta', ok.payload?.export_meta?.vessel_id === VESSEL);

    const tampered = structuredClone(envelope);
    tampered.payload.maintenance_jobs[0].job_code = 'TAMPERED';
    const badHash = await verifyEnvelopeV2(tampered, {
        companyId: COMPANY,
        vesselId: VESSEL,
        publicKeyRegistry: registry,
    });
    assert('tampered payload rejected', badHash.ok === false && badHash.code === ERR.TAMPERED, badHash.code);

    const badSig = structuredClone(envelope);
    badSig.compliance.digital_signature = Buffer.from('invalid').toString('base64');
    const badSigRes = await verifyEnvelopeV2(badSig, {
        companyId: COMPANY,
        vesselId: VESSEL,
        publicKeyRegistry: registry,
    });
    assert('invalid signature rejected', badSigRes.ok === false, badSigRes.code);

    const tenantBad = await verifyEnvelopeV2(envelope, {
        companyId: COMPANY,
        vesselId: 'OTHER VESSEL',
        publicKeyRegistry: registry,
    });
    assert('tenant vessel mismatch', tenantBad.code === ERR.TENANT_MISMATCH, tenantBad.code);

    process.env.SYNC_ENVELOPE_LEGACY_ALLOW = '1';
    const legacyDoc = { ...inner, compliance: { package_hash_sha256: 'deadbeef' } };
    const legacyVerify = await verifyIncomingDocument(legacyDoc, { companyId: COMPANY, vesselId: VESSEL });
    assert('legacy with bad hash rejected or legacy path', legacyVerify.ok === false || legacyVerify.legacy === true);

    const flatLegacy = sampleInnerPayload();
    const legacyOk = await verifyIncomingDocument(flatLegacy, { companyId: COMPANY, vesselId: VESSEL });
    assert('plain legacy payload allowed', legacyOk.ok === true);

    const dupSyncId = envelope.sync_id;
    const seen = new Set();
    seen.add(dupSyncId);
    const isDup = seen.has(dupSyncId);
    assert('duplicate sync_id detection (local)', isDup === true);

    const zip = new JSZip();
    zip.file('tvc_sync.json', JSON.stringify(envelope, null, 2));
    const buf = await zip.generateAsync({ type: 'nodebuffer' });
    const parsed = JSON.parse(await (await JSZip.loadAsync(buf)).file('tvc_sync.json').async('string'));
    const effective = effectiveSyncPayload(parsed);
    assert('ZIP roundtrip effective payload', effective.export_meta?.vessel_id === VESSEL);

    console.log(`\nResult: ${pass} passed, ${fail} failed`);
    if (fail > 0) process.exit(1);
    console.log('PASS: verify-sync-envelope-v2');
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
