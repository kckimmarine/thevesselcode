#!/usr/bin/env node
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { dispatchHostingApi } = require('../api/_lib/hostingApiRouter.cjs');

async function main() {
    const res = await dispatchHostingApi(
        new Request('http://127.0.0.1/api/search?q=impa'),
    );
    if (res.status !== 200) {
        console.error('FAIL /api/search status', res.status);
        process.exit(1);
    }
    const json = await res.json();
    if (!json || typeof json !== 'object') {
        console.error('FAIL /api/search body');
        process.exit(1);
    }
    console.log('OK /api/search', Object.keys(json).join(','));

    const store = await dispatchHostingApi(
        new Request('http://127.0.0.1/store/999999', { method: 'GET' }),
    );
    if (store.status !== 404 && store.status !== 400) {
        console.error('FAIL /store/999999 expected 404/400 got', store.status);
        process.exit(1);
    }
    console.log('OK /store/999999', store.status);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
