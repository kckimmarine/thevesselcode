#!/usr/bin/env node
/**
 * Synthetic fleet stress: 50 vessels × 200 delta logs — stock idempotency + Envelope v2 crypto.
 * Usage: npm run test:fleet-stress
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const {
    buildEnvelopeV2,
    verifyEnvelopeV2,
    generateEd25519KeyPairPem,
} = require(path.join(ROOT, 'api', '_lib', 'syncEnvelopeV2.js'));

const VESSEL_COUNT = 50;
const TOTAL_LOGS = 200;
const LOGS_PER_VESSEL = TOTAL_LOGS / VESSEL_COUNT;
const COMPANY = 'TVC_STRESS_CO';
const MAX_HEAP_DELTA_MB = 256;
const MAX_WALL_MS = 120_000;

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

/**
 * Mirrors confirm-time spare deduction guard: only first apply when stock_applied_at empty.
 */
function tryApplyStock(report, stockMap, partId, qty) {
    if (report.stock_applied_at) {
        return { applied: false, duplicate: true };
    }
    const key = `${report.vessel_id}::${partId}`;
    const onHand = stockMap.get(key) ?? 1000;
    if (onHand < qty) return { applied: false, duplicate: false };
    stockMap.set(key, onHand - qty);
    report.stock_applied_at = new Date().toISOString();
    return { applied: true, duplicate: false };
}

async function simulateStockIdempotency() {
    const stockMap = new Map();
    const reports = [];
    for (let v = 0; v < VESSEL_COUNT; v += 1) {
        const vesselId = `STRESS-V${String(v + 1).padStart(3, '0')}`;
        for (let l = 0; l < LOGS_PER_VESSEL; l += 1) {
            reports.push({
                id: `rep-${v}-${l}`,
                vessel_id: vesselId,
                part_id: `PART-${l % 17}`,
                qty: 1 + (l % 3),
                stock_applied_at: '',
            });
        }
    }
    assert(reports.length === TOTAL_LOGS, `expected ${TOTAL_LOGS} reports, got ${reports.length}`);

    let successfulDeductions = 0;
    let blockedDuplicates = 0;

    await Promise.all(reports.map(async (report) => {
        const attempts = [
            tryApplyStock(report, stockMap, report.part_id, report.qty),
            tryApplyStock(report, stockMap, report.part_id, report.qty),
        ];
        if (attempts[0].applied) successfulDeductions += 1;
        if (attempts[1].duplicate && !attempts[1].applied) blockedDuplicates += 1;
    }));

    assert(successfulDeductions === TOTAL_LOGS, `deduction count ${successfulDeductions} !== ${TOTAL_LOGS}`);
    assert(blockedDuplicates === TOTAL_LOGS, `duplicate blocks ${blockedDuplicates} !== ${TOTAL_LOGS}`);

    const dedupRate = blockedDuplicates / TOTAL_LOGS;
    return { successfulDeductions, blockedDuplicates, dedupRate };
}

async function simulateEnvelopeRoundtrip() {
    const { publicKeyPem, privateKeyPem } = generateEd25519KeyPairPem();
    const registry = {};
    const syncIds = new Set();

    const tasks = [];
    for (let v = 0; v < VESSEL_COUNT; v += 1) {
        const vesselId = `STRESS-V${String(v + 1).padStart(3, '0')}`;
        registry[vesselId] = publicKeyPem;
        for (let l = 0; l < LOGS_PER_VESSEL; l += 1) {
            tasks.push(async () => {
                const now = new Date().toISOString();
                const inner = {
                    export_meta: {
                        vessel_id: vesselId,
                        company_id: COMPANY,
                        export_date: now.slice(0, 10),
                        direction: 'SHIP_TO_HQ',
                        department: 'ENGINE',
                        exported_by: 'stress-fleet-sync',
                        schema_version: 6,
                        exported_at: now,
                    },
                    daily_work_reports: [{
                        id: `dwr-${v}-${l}`,
                        vessel_id: vesselId,
                        status: 'CONFIRMED',
                        updated_at: now,
                    }],
                };
                const envelope = await buildEnvelopeV2({
                    payload: inner,
                    syncType: 'DELTA_ONLY',
                    privateKeyPem,
                    publicKeyPem,
                });
                assert(!syncIds.has(envelope.sync_id), `duplicate sync_id ${envelope.sync_id}`);
                syncIds.add(envelope.sync_id);
                const verified = await verifyEnvelopeV2(envelope, {
                    companyId: COMPANY,
                    vesselId,
                    publicKeyRegistry: registry,
                });
                assert(verified.ok === true, verified.message || verified.code);
                return envelope.sync_id;
            });
        }
    }

    const results = await Promise.all(tasks.map((fn) => fn()));
    assert(results.length === TOTAL_LOGS, `envelope count ${results.length}`);
    assert(syncIds.size === TOTAL_LOGS, `unique sync_id ${syncIds.size}`);
    return { envelopesVerified: results.length };
}

function runGuardScript(label, scriptRel) {
    const script = path.join(ROOT, scriptRel);
    const res = spawnSync(process.execPath, [script], { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' });
    if (res.status !== 0) {
        console.error(res.stdout);
        console.error(res.stderr);
        throw new Error(`${label} failed (exit ${res.status})`);
    }
    return res.stdout;
}

async function main() {
    const t0 = performance.now();
    const mem0 = process.memoryUsage().heapUsed;

    console.log(`Synthetic fleet stress — ${VESSEL_COUNT} vessels, ${TOTAL_LOGS} delta logs\n`);

    const stock = await simulateStockIdempotency();
    console.log(`  ✓ stock_applied_at idempotency: ${stock.successfulDeductions} deductions, ${stock.blockedDuplicates} duplicate blocks`);
    console.log(`    duplicate confirm attempts blocked: ${((stock.blockedDuplicates / TOTAL_LOGS) * 100).toFixed(1)}%`);

    const env = await simulateEnvelopeRoundtrip();
    console.log(`  ✓ Envelope v2 roundtrip: ${env.envelopesVerified}/${TOTAL_LOGS} verified (Ed25519 + sync_id unique)`);

    const rbacOut = runGuardScript('verify-rbac', 'scripts/verify-rbac.mjs');
    const rbacPass = (rbacOut.match(/(\d+) passed/) || [])[1];
    assert(rbacPass === '31', `RBAC regression expected 31 passed, got ${rbacPass}`);
    console.log('  ✓ RBAC guard: 31/31');

    const envOut = runGuardScript('verify-sync-envelope-v2', 'scripts/verify-sync-envelope-v2.mjs');
    assert(/PASS: verify-sync-envelope-v2/.test(envOut), 'Envelope v2 guard script failed');
    const envPass = (envOut.match(/(\d+) passed/) || [])[1];
    console.log(`  ✓ Envelope guard: ${envPass} passed (existing roundtrip suite)`);

    const elapsed = performance.now() - t0;
    const heapDeltaMb = (process.memoryUsage().heapUsed - mem0) / (1024 * 1024);
    assert(elapsed < MAX_WALL_MS, `wall time ${elapsed.toFixed(0)}ms exceeds ${MAX_WALL_MS}ms`);
    assert(heapDeltaMb < MAX_HEAP_DELTA_MB, `heap delta ${heapDeltaMb.toFixed(1)}MB exceeds ${MAX_HEAP_DELTA_MB}MB`);

    console.log('\nSummary');
    console.log(`  processing_time_ms: ${Math.round(elapsed)}`);
    console.log(`  heap_delta_mb: ${heapDeltaMb.toFixed(2)}`);
    console.log(`  stock_dedup_rate: 100% (${stock.blockedDuplicates}/${TOTAL_LOGS} duplicate attempts blocked)`);
    console.log(`  envelope_integrity: 100% (${env.envelopesVerified}/${TOTAL_LOGS})`);
    console.log('\nPASS: fleet-stress');
}

main().catch((err) => {
    console.error('\nFAIL: fleet-stress —', err.message);
    process.exit(1);
});
