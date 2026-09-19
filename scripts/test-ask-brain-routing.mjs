#!/usr/bin/env node
/** Unit smoke for Gemini model normalization and Brain fallback copy */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { _testing } = require('../api/ask-brain.js');

const { normalizeGeminiModel, buildGeminiModelList, offlineFallbackAnswer, providerFailureAnswer } = _testing;

function assert(cond, msg) {
    if (!cond) {
        console.error('FAIL', msg);
        process.exit(1);
    }
    console.log('OK', msg);
}

assert(normalizeGeminiModel('models/gemini-2.0-flash') === 'gemini-2.0-flash', 'strip models/ prefix');
assert(normalizeGeminiModel('  gemini-1.5-flash ') === 'gemini-1.5-flash', 'trim model id');

const prev = process.env.GEMINI_MODEL;
process.env.GEMINI_MODEL = 'models/gemini-2.0-flash';
const list = buildGeminiModelList();
assert(list[0] === 'gemini-2.0-flash', 'preferred model first in list');
assert(list.includes('gemini-2.5-flash'), 'fallback models included');
if (prev === undefined) delete process.env.GEMINI_MODEL;
else process.env.GEMINI_MODEL = prev;

const offlineKo = offlineFallbackAnswer('KO').answer;
assert(offlineKo.includes('설정되어 있지 않습니다'), 'offline KO mentions missing keys');
const failEn = providerFailureAnswer('EN', 'Gemini 404: model not found').answer;
assert(failEn.includes('could not reach'), 'provider failure EN does not claim missing keys');
assert(!failEn.includes('not configured on this deployment (no GEMINI'), 'provider failure distinct from offline');

console.log('\nask-brain routing tests passed.');
