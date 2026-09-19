#!/usr/bin/env node
/** Smoke: TVC Brain modal + PWA wiring on marketing home */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const results = [];

function check(name, ok, detail = '') {
    results.push({ name, ok, detail });
    console.log(ok ? 'OK' : 'FAIL', name, detail ? `— ${detail}` : '');
}

const home = readFileSync(join(ROOT, 'home/index.html'), 'utf8');
check('brain-knowledge-grounding on home', home.includes('brain-knowledge-grounding.js'));
check('brain-chat script on home', home.includes('brain-chat.js'));
check('manifest link', home.includes('href="/manifest.json"'));
check('theme-color brain', home.includes('content="#0A1128"'));
check('apple web app meta', home.includes('apple-mobile-web-app-capable'));
check('ask-brain api exists', existsSync(join(ROOT, 'api/ask-brain.js')));
check('sw.js exists', existsSync(join(ROOT, 'sw.js')));
check('brain modal css', readFileSync(join(ROOT, 'css/home.css'), 'utf8').includes('.tvc-brain-modal'));
check('manifest brain name', readFileSync(join(ROOT, 'manifest.json'), 'utf8').includes('TVC Brain'));
check('pms manifest preserved', existsSync(join(ROOT, 'manifest-sm.json')));
check('hero voice button', home.includes('id="btn-voice-input"'));
check('hero camera file input', home.includes('id="btn-camera-input"') && home.includes('capture="environment"'));
check('hero input action css', readFileSync(join(ROOT, 'css/home.css'), 'utf8').includes('.home-hero-input-action'));

const failed = results.filter((r) => !r.ok);
if (failed.length) {
    console.error('\nBrain home tests FAILED');
    process.exit(1);
}
console.log('\nBrain home tests passed.');
