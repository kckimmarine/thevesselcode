/**
 * Cloudflare Pages — host-based home (Vercel vercel.json parity).
 */
export async function onRequest(context) {
    const url = new URL(context.request.url);
    if (url.pathname !== '/' && url.pathname !== '') {
        return context.next();
    }
    const host = (context.request.headers.get('host') || '').toLowerCase().replace(/:\d+$/, '');
    if (host === 'app.thevesselcode.com') {
        return context.rewrite(`${url.origin}/app.html`);
    }
    if (host === 'thevesselcode.com' || host === 'www.thevesselcode.com') {
        return context.rewrite(`${url.origin}/home/index.html`);
    }
    return context.next();
}
