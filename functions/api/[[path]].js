import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { dispatchHostingApi } = require('../../api/_lib/hostingApiRouter.cjs');

export async function onRequest(context) {
    return dispatchHostingApi(context.request);
}
