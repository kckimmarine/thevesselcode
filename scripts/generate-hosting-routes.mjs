#!/usr/bin/env node
/**
 * Emit _redirects and _headers into dist/ for Cloudflare Pages & Netlify
 * (mirrors vercel.json routing for static assets).
 */
import { writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const outDir = join(root, 'dist');
if (!existsSync(outDir)) {
    console.error('generate-hosting-routes: dist/ missing — run static build first');
    process.exit(1);
}

const redirects = [
    '# THE VESSEL CODE — hosting redirects (Vercel parity)',
    '/home / 301',
    '/home/ / 301',
    '/about-contact /contact-us 301',
    '/about-contact/ /contact-us 301',
    '/contact /contact-us 301',
    '/contact/ /contact-us 301',
    '/store /toolkit 302',
    '/store/ /toolkit 302',
    '/store-public.html /toolkit 301',
    '/store-public /toolkit 301',
    '/maritime-toolkit /toolkit 301',
    '/maritime-toolkit/ /toolkit 301',
    '/impa /toolkit 301',
    '/impa/ /toolkit 301',
    '/maritime-pms /sm 301',
    '/maritime-pms/ /sm 301',
    '/ship-repair-korea /services#ship-repair-korea 301',
    '/ship-repair-korea/ /services#ship-repair-korea 301',
    '',
    '# Host: marketing apex + www',
    '/ /home/index.html 200 Host=thevesselcode.com',
    '/ /home/index.html 200 Host=www.thevesselcode.com',
    '',
    '# Host: PMS app subdomain',
    '/ /app.html 200 Host=app.thevesselcode.com',
    '',
    '# Clean URLs',
    '/services /services/index.html 200',
    '/services/korea-ports-hub /services/korea-ports-hub/index.html 200',
    '/ship-repair-chandler-korea /ship-repair-chandler-korea/index.html 200',
    '/ship-chandler-korea /ship-repair-chandler-korea/index.html 200',
    '/korea-ship-services /ship-repair-chandler-korea/index.html 200',
    '/sm /sm/index.html 200',
    '/contact-us /contact-us/index.html 200',
    '/forum /forum/index.html 200',
    '/insights /insights/index.html 200',
    '/toolkit /toolkit.html 200',
    '/mro/valves /mro/valves/index.html 200',
    '/mro/pipes-fittings /mro/pipes-fittings/index.html 200',
    '/mro/bearings /mro/bearings/index.html 200',
    '/mro/tools /mro/tools/index.html 200',
].join('\n');

/** Cloudflare Pages: no Host= in file — use functions/_middleware.js for `/`. */
const cfRedirects = redirects
    .split('\n')
    .filter((line) => !line.includes('Host='))
    .join('\n');

const headers = [
    '/*',
    '  Content-Security-Policy: frame-ancestors \'self\' https://thevesselcode.com https://www.thevesselcode.com https://*.thevesselcode.com',
    '',
    '/service-worker.js',
    '  Cache-Control: no-cache',
    '',
    '/sw.js',
    '  Cache-Control: no-cache',
    '',
    '/index.html',
    '  Cache-Control: no-cache',
    '',
    '/app.html',
    '  Cache-Control: no-cache',
    '',
    '/toolkit.html',
    '  Cache-Control: no-cache',
    '',
    '/services/index.html',
    '  Cache-Control: no-cache',
    '',
    '/ship-repair-korea/index.html',
    '  Cache-Control: no-cache',
    '',
    '/ship-repair-chandler-korea/index.html',
    '  Cache-Control: no-cache',
].join('\n');

const useCf = process.env.CF_PAGES === '1' || String(process.env.CF_PAGES || '').toLowerCase() === 'true';
const primaryRedirects = useCf ? cfRedirects : redirects;
writeFileSync(join(outDir, '_redirects'), `${primaryRedirects}\n`, 'utf8');
writeFileSync(join(outDir, '_headers'), `${headers}\n`, 'utf8');
writeFileSync(join(outDir, '_redirects.cloudflare'), `${cfRedirects}\n`, 'utf8');
console.log(`OK dist/_redirects (${useCf ? 'cloudflare' : 'netlify-style'}) dist/_headers`);
