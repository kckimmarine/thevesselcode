import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

export function runNodeScript(scriptRel, { args = [], env = {}, label = scriptRel } = {}) {
    const started = Date.now();
    const res = spawnSync('node', [scriptRel, ...args], {
        cwd: ROOT,
        stdio: 'inherit',
        env: { ...process.env, ...env },
    });
    const durationMs = Date.now() - started;
    const ok = res.status === 0;
    if (!ok) {
        console.warn(`[pipeline] WARN step failed: ${label} (exit ${res.status ?? 1})`);
    } else {
        console.log(`[pipeline] OK ${label} (${durationMs}ms)`);
    }
    return { ok, exitCode: res.status ?? 1, durationMs, label };
}

export { ROOT as PIPELINE_ROOT };
