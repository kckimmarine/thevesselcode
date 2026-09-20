#!/usr/bin/env node
/**
 * Local revenue snapshot (requires Google + GitHub env — see docs/REVENUE-PIPELINE.md).
 *
 *   npm run revenue:report
 *   npm run revenue:report -- --days 14 --json
 */
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { buildRevenueSnapshot } = require('../api/_lib/revenuePipeline.js');

function parseArgs(argv) {
    let days = 7;
    let jsonOnly = false;
    let out = '';
    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] === '--days' && argv[i + 1]) days = Number.parseInt(argv[++i], 10) || 7;
        else if (argv[i] === '--json') jsonOnly = true;
        else if (argv[i] === '--out' && argv[i + 1]) out = argv[++i];
    }
    return { days, jsonOnly, out };
}

const { days, jsonOnly, out } = parseArgs(process.argv.slice(2));

const snapshot = await buildRevenueSnapshot({ days });
if (out) {
    mkdirSync(join(process.cwd(), '.data'), { recursive: true });
    const path = out.startsWith('/') ? out : join(process.cwd(), out);
    writeFileSync(path, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
    console.log('Wrote', path);
}
if (jsonOnly) {
    console.log(JSON.stringify(snapshot, null, 2));
} else {
    console.log(snapshot.digestText);
    if (snapshot.errors?.length) {
        console.error('\nErrors:', snapshot.errors);
        process.exitCode = 1;
    }
}
