/* THE VESSEL CODE — Marketing / Toolkit lightweight SW (stale-while-revalidate) */
const CACHE_VERSION = 'tvc-brain-sw-v2';
const STATIC_CACHE = `${CACHE_VERSION}-static`;

const PRECACHE = [
    '/',
    '/manifest.json',
    '/home/index.html',
    '/toolkit.html',
    '/css/marketing-shell.css',
    '/css/marketing-theme.css',
    '/css/home.css',
    '/css/marketing.css',
    '/css/marketing-readability.css',
    '/js/marketing-shell.js',
    '/js/marketing-i18n.js',
    '/js/brain-knowledge-grounding.js',
    '/js/brain-chat.js',
    '/data/tvc-knowledge-base.json',
    '/js/home-hero-search.js',
    '/icons/icon.svg',
    '/icons/icon-maskable.svg',
    '/assets/icons/icon-192.png',
    '/assets/icons/icon-512.png',
];

function isCacheableGet(request) {
    if (request.method !== 'GET') return false;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return false;
    const path = url.pathname;
    if (path.startsWith('/api/')) return false;
    if (/\.(?:css|js|json|svg|png|webp|woff2?)$/i.test(path)) return true;
    if (path === '/' || path === '/toolkit.html' || path.startsWith('/home/')) return true;
    if (path.startsWith('/css/') || path.startsWith('/js/') || path.startsWith('/data/') || path.startsWith('/public/')) {
        return true;
    }
    return false;
}

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE).catch(() => undefined)).then(() => self.skipWaiting()),
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k.startsWith('tvc-brain-sw-') && k !== STATIC_CACHE).map((k) => caches.delete(k))),
        ).then(() => self.clients.claim()),
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (!isCacheableGet(request)) return;

    event.respondWith(
        caches.open(STATIC_CACHE).then(async (cache) => {
            const cached = await cache.match(request);
            const fetchPromise = fetch(request)
                .then((response) => {
                    if (response && response.ok) {
                        cache.put(request, response.clone());
                    }
                    return response;
                })
                .catch(() => cached);

            return cached || fetchPromise;
        }),
    );
});
