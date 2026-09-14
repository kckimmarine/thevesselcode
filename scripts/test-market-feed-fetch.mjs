#!/usr/bin/env node
/** Validate fetch-market-feed output schema and build-safe runner. */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public/data/market-feed.json');
const HUBS = ['Singapore', 'Rotterdam', 'Busan', 'Houston'];
const GRADES = ['VLSFO', 'LSMGO', 'HSFO380'];

function assertFeedShape(feed) {
    assert.ok(feed.meta?.benchmarkAsOf, 'meta.benchmarkAsOf');
    assert.ok(feed.meta?.updatedLabelEn?.includes('Market benchmark as of'), 'meta.updatedLabelEn');
    assert.equal(feed.bunker?.hubs?.length, 4, 'bunker hubs');
    assert.equal(feed.bunker?.quotes?.length, 12, 'bunker quotes');
    for (const q of feed.bunker.quotes) {
        assert.ok(HUBS.includes(q.port), `port ${q.port}`);
        assert.ok(GRADES.includes(q.gradeKey), `grade ${q.gradeKey}`);
        assert.ok(Number.isFinite(q.priceUsdMt), 'priceUsdMt');
    }
    for (const key of ['bdi', 'bdti', 'bcti']) {
        assert.ok(feed.indices?.[key]?.value != null, `indices.${key}.value`);
    }
    assert.ok(Array.isArray(feed.news), 'news array');
}

const offline = spawnSync('node', ['scripts/fetch-market-feed.mjs', '--offline'], {
    cwd: ROOT,
    stdio: 'inherit',
});
assert.equal(offline.status, 0, 'fetch --offline exit 0');
assert.ok(existsSync(OUT), 'public/data/market-feed.json exists');

const feed = JSON.parse(readFileSync(OUT, 'utf8'));
assertFeedShape(feed);

const buildSafe = spawnSync('node', ['scripts/fetch-market-feed.mjs', '--build', '--offline'], {
    cwd: ROOT,
    stdio: 'inherit',
});
assert.equal(buildSafe.status, 0, 'fetch --build --offline exit 0');

console.log('OK market-feed-fetch schema');
