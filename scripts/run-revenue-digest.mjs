#!/usr/bin/env node
/**
 * Weekly revenue digest runner for GitHub Actions (no production HTTP call).
 * Mirrors GET /api/revenue-pipeline?digest=1
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildRevenueSnapshot } = require('../api/_lib/revenuePipeline.js');
const { notifyRevenueDigest } = require('../api/_lib/revenueNotify.js');

function hasGoogleCredentials() {
    return Boolean(
        String(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim()
            || String(process.env.GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON || '').trim(),
    );
}

async function main() {
    if (!hasGoogleCredentials()) {
        console.error(
            'Missing GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON in workflow secrets.',
        );
        process.exit(1);
    }

    const snapshot = await buildRevenueSnapshot({ days: 7 });
    const notify = await notifyRevenueDigest(snapshot);

    const summary = {
        ok: true,
        generatedAt: snapshot.generatedAt,
        actionCount: snapshot.actions?.length || 0,
        notify,
        preview: String(snapshot.digestText || '').slice(0, 2000),
    };
    console.log(JSON.stringify(summary, null, 2));

    if (snapshot.errors?.length) {
        console.error('Snapshot errors:', snapshot.errors);
        process.exit(1);
    }
}

main().catch((err) => {
    console.error('[run-revenue-digest]', err);
    process.exit(1);
});
