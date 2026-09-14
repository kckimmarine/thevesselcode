#!/usr/bin/env node
/**
 * Automated marketing video assets for YouTube (modoo Q5 + ongoing TVC marketing).
 *
 * - Narration script (KO) + SRT subtitles
 * - Playwright: desktop (1920x1080) + mobile (390x844) WebM clips of /, /sm, /toolkit
 * - scene manifest JSON for CapCut / ffmpeg assembly
 *
 * Usage:
 *   npm start   # in another terminal, or set BASE_URL
 *   node scripts/generate-marketing-video-assets.mjs
 *   BASE_URL=https://www.thevesselcode.com node scripts/generate-marketing-video-assets.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const ROOT = process.cwd();
const OUT = process.env.MARKETING_VIDEO_OUT || join(ROOT, 'artifacts', 'marketing-video');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:3000';

const SCENES = [
    { id: 'intro', duration: 12, ko: '중소 선단은 여전히 엑셀과 수기로 부품을 맞춥니다. 재고 불일치는 Off-hire와 중복 발주로 이어집니다.' },
    { id: 'home', path: '/', duration: 15, ko: '더베슬코드 — 선주·공무·조선·부품사를 하나의 플랫폼으로 연결합니다.' },
    { id: 'sm', path: '/sm', duration: 18, ko: 'TVC-SM. 선박은 오프라인 완결, Captain Hub와 육상 HQ는 온라인과 ZIP으로, Deck과 Engine은 원양에서도 끊김 없이.' },
    { id: 'toolkit', path: '/toolkit', duration: 12, ko: 'Maritime Toolkit — 15,000건 이상 IMPA와 실무 계산기. 무료로 시작하고 TVC-SM으로 확장합니다.' },
    { id: 'cta', duration: 8, ko: '1급 기관사의 노하우를 코드로. THE VESSEL CODE — thevesselcode.com' },
];

function srtTime(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

function buildSrt() {
    let t = 0;
    const blocks = [];
    let i = 1;
    for (const scene of SCENES) {
        const start = t;
        t += scene.duration;
        blocks.push(`${i}\n${srtTime(start)} --> ${srtTime(t)}\n${scene.ko}\n`);
        i += 1;
    }
    return blocks.join('\n');
}

async function waitForServer(url, ms = 60000) {
    const start = Date.now();
    while (Date.now() - start < ms) {
        try {
            const res = await fetch(url, { method: 'HEAD' });
            if (res.ok || res.status === 308) return true;
        } catch (_) { /* retry */ }
        await new Promise((r) => setTimeout(r, 1500));
    }
    return false;
}

async function recordPage(browser, { name, path, viewport, lang }) {
    const dir = join(OUT, 'clips');
    await mkdir(dir, { recursive: true });
    const context = await browser.newContext({
        viewport,
        recordVideo: { dir, size: viewport },
        locale: lang === 'ko' ? 'ko-KR' : 'en-US',
    });
    await context.addInitScript((l) => {
        localStorage.setItem('tvc-mkt-lang', l);
    }, lang);
    const page = await context.newPage();
    const url = `${BASE.replace(/\/$/, '')}${path}`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForTimeout(2500);
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight * 0.35, behavior: 'smooth' }));
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await page.waitForTimeout(1500);
    await context.close();
    return { name, viewport, url };
}

async function main() {
    await mkdir(OUT, { recursive: true });

    const narration = SCENES.map((s) => `[${s.id}] ${s.ko}`).join('\n\n');
    await writeFile(join(OUT, 'narration-ko.txt'), narration, 'utf8');
    await writeFile(join(OUT, 'subtitles-ko.srt'), buildSrt(), 'utf8');
    await writeFile(join(OUT, 'scenes.json'), JSON.stringify({ baseUrl: BASE, scenes: SCENES }, null, 2), 'utf8');

    if (!process.env.SKIP_RECORD) {
        const up = await waitForServer(BASE);
        if (!up) {
            console.error('Server not reachable at', BASE, '— start npm start or set BASE_URL. Wrote narration/SRT only.');
            process.exit(0);
        }

        const browser = await chromium.launch();
        const paths = [
            { name: 'home-desktop', path: '/', viewport: { width: 1920, height: 1080 } },
            { name: 'home-mobile', path: '/', viewport: { width: 390, height: 844 } },
            { name: 'sm-desktop', path: '/sm', viewport: { width: 1920, height: 1080 } },
            { name: 'sm-mobile', path: '/sm', viewport: { width: 390, height: 844 } },
            { name: 'toolkit-mobile', path: '/toolkit', viewport: { width: 390, height: 844 } },
        ];
        const recorded = [];
        for (const p of paths) {
            console.log('Recording', p.name, '…');
            recorded.push(await recordPage(browser, { ...p, lang: 'ko' }));
        }
        await browser.close();
        await writeFile(join(OUT, 'record-log.json'), JSON.stringify(recorded, null, 2), 'utf8');
        console.log('WebM clips in', join(OUT, 'clips'), '(rename latest per run in CapCut)');
    }

    console.log('Done →', OUT);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
