/**
 * Cloudflare Workers (Git Builds) — serve dist/ with host-based `/` routing.
 * API routes need legacy Pages + functions/ or a separate backend.
 */
export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (url.pathname === '/' || url.pathname === '') {
            const host = (request.headers.get('host') || '').toLowerCase().replace(/:\d+$/, '');
            if (host === 'app.thevesselcode.com') {
                return env.ASSETS.fetch(new Request(new URL('/app.html', url), request));
            }
            if (host === 'thevesselcode.com' || host === 'www.thevesselcode.com' || host.endsWith('.pages.dev')) {
                return env.ASSETS.fetch(new Request(new URL('/home/index.html', url), request));
            }
        }
        return env.ASSETS.fetch(request);
    },
};
