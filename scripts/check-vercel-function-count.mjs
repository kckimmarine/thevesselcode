#!/usr/bin/env node
/**
 * Vercel Hobby allows 12 serverless functions per deployment.
 * Count route entrypoints under api/ (Vercel ignores _-prefixed segments).
 */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const HOBBY_LIMIT = 12;
const root = join(process.cwd(), 'api');

function listRouteFiles(dir, rel = '') {
    const out = [];
    for (const name of readdirSync(dir)) {
        if (name.startsWith('_')) continue;
        const abs = join(dir, name);
        const relPath = rel ? `${rel}/${name}` : name;
        if (statSync(abs).isDirectory()) {
            out.push(...listRouteFiles(abs, relPath));
            continue;
        }
        if (name.endsWith('.js')) out.push(relPath);
    }
    return out;
}

const routes = listRouteFiles(root).sort();
console.log(`Vercel serverless routes (${routes.length}):`);
for (const r of routes) console.log(`  api/${r}`);

if (routes.length > HOBBY_LIMIT) {
    console.error(`\nFAIL: ${routes.length} routes exceeds Hobby limit of ${HOBBY_LIMIT}.`);
    process.exit(1);
}
console.log(`\nOK: ${routes.length} routes (limit ${HOBBY_LIMIT}).`);
