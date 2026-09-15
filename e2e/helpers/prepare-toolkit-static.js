/**
 * Ensure /data/* JSON bundles exist for `serve` E2E (mirrors build copy from public/data).
 */
const { cpSync, existsSync, mkdirSync, readdirSync } = require('node:fs');
const { join } = require('node:path');

function prepareToolkitStaticData(root = join(__dirname, '..', '..')) {
    const publicData = join(root, 'public', 'data');
    const dataDir = join(root, 'data');
    if (!existsSync(publicData)) return;
    mkdirSync(dataDir, { recursive: true });
    for (const name of readdirSync(publicData)) {
        if (!name.endsWith('.json')) continue;
        const src = join(publicData, name);
        const dest = join(dataDir, name);
        try {
            cpSync(src, dest, { force: true });
        } catch {
            /* skip */
        }
    }
}

module.exports = { prepareToolkitStaticData };
