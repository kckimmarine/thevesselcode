#!/usr/bin/env node
/**
 * TVC Global Maritime Ingestion Pipeline — modular orchestrator.
 *
 * Usage:
 *   node scripts/pipelines/index.mjs --market
 *   node scripts/pipelines/index.mjs --fleet
 *   node scripts/pipelines/index.mjs --impa
 *   node scripts/pipelines/index.mjs --all
 */
import { writeFileSync, mkdirSync, copyFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runNodeScript, PIPELINE_ROOT } from './lib/run-step.mjs';
import { runFleetPipeline } from './lib/fleet-step.mjs';
import { normalizeMarketFeed } from './lib/normalizer.mjs';

const args = new Set(process.argv.slice(2));
const runMarket = args.has('--market') || args.has('--all');
const runFleet = args.has('--fleet') || args.has('--all');
const runImpa = args.has('--impa') || args.has('--all');

if (!runMarket && !runFleet && !runImpa) {
    console.error('Specify at least one flag: --market, --fleet, --impa, or --all');
    process.exit(1);
}

function log(msg) {
    console.log(`[pipeline] ${new Date().toISOString()} ${msg}`);
}

function writePipelineStatus(report) {
    const outDir = join(PIPELINE_ROOT, 'public', 'data');
    mkdirSync(outDir, { recursive: true });
    const path = join(outDir, 'pipeline-status.json');
    writeFileSync(path, JSON.stringify(report, null, 2));
    log(`wrote ${path}`);
}

async function stepMarket(report) {
    log('START market feed');
    const step = runNodeScript('scripts/fetch-market-feed.mjs', {
        args: ['--build'],
        label: 'market:fetch',
    });
    report.steps.market = step;

    const feedPath = join(PIPELINE_ROOT, 'public', 'data', 'market-feed.json');
    if (existsSync(feedPath)) {
        try {
            const raw = JSON.parse(readFileSync(feedPath, 'utf8'));
            const normalized = normalizeMarketFeed(raw);
            writeFileSync(feedPath, JSON.stringify(normalized, null, 2));
            const dataMirror = join(PIPELINE_ROOT, 'data', 'market-feed.json');
            mkdirSync(join(PIPELINE_ROOT, 'data'), { recursive: true });
            copyFileSync(feedPath, dataMirror);
            report.steps.market.normalize = { ok: true, news: normalized.news?.length ?? 0 };
        } catch (e) {
            report.warnings.push(`market normalize skipped: ${e.message}`);
        }
    } else if (!step.ok) {
        report.warnings.push('market feed missing and fetch failed — prior cache expected in repo');
    }
}

function stepFleet(report) {
    log('START fleet particulars');
    const offline = args.has('--offline');
    const fleetReport = runFleetPipeline({ offline });
    report.steps.fleet = fleetReport;
    if (fleetReport.warnings?.length) report.warnings.push(...fleetReport.warnings);
}

function stepImpa(report) {
    log('START IMPA delta merge');
    const merge = runNodeScript('scripts/merge-impa-chapters.mjs', { label: 'impa:merge' });
    const seo = runNodeScript('scripts/generate-impa-seo-index.mjs', { label: 'impa:seo-index' });
    report.steps.impa = { merge, seo };
    if (!merge.ok) report.warnings.push('IMPA merge failed — keeping prior impa-full.json');
    if (!seo.ok) report.warnings.push('IMPA SEO index failed — keeping prior seo index');
}

async function main() {
    const report = {
        v: 1,
        startedAt: new Date().toISOString(),
        flags: { market: runMarket, fleet: runFleet, impa: runImpa },
        steps: {},
        warnings: [],
        ok: true,
    };

    if (runMarket) await stepMarket(report);
    if (runFleet) stepFleet(report);
    if (runImpa) stepImpa(report);

    report.completedAt = new Date().toISOString();
    report.ok = !Object.values(report.steps).some((s) => s?.ok === false);

    writePipelineStatus(report);
    log(`DONE ok=${report.ok} warnings=${report.warnings.length}`);
    process.exit(0);
}

main().catch((err) => {
    console.error('[pipeline] FATAL', err);
    process.exit(0);
});
