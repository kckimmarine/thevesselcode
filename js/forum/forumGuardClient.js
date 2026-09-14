/**
 * Client-side forum guard — keep in sync with api/_lib/forumGuard.js
 */
(function (global) {
    'use strict';

    const MAX_TITLE = 200;
    const MAX_BODY = 8000;
    const MAX_NAME = 64;
    const MAX_COMMENT = 4000;
    const RATE_LIMIT_MS = 30_000;

    const ALLOWED_ROLES = [
        'Cadet',
        'Deck Officer',
        'Engineer',
        'Superintendent',
        'Plant Tech',
        'Supplier',
        'Other',
    ];

    const CATEGORIES = [
        { id: 'technical', i18n: 'forum.cat.technical' },
        { id: 'spare', i18n: 'forum.cat.spare' },
        { id: 'ops', i18n: 'forum.cat.ops' },
        { id: 'regulations', i18n: 'forum.cat.regulations' },
    ];

    const PROFANITY_RE = /\b(f+u+c+k|sh+i+t|b+i+t+c+h|a+s+s+h+o+l+e|c+u+n+t|d+i+c+k|w+h+o+r+e)\b/i;
    const SPAM_RE = /\b(casino|gambling|payday\s*loan|crypto\s*airdrop|viagra|cialis|forex\s*signal|bet365|1xbet)\b/i;
    const PHISHING_RE = /\b(verify\s+your\s+account|password\s+reset\s+required|click\s+here\s+to\s+claim)\b/i;
    const MALICIOUS_EXT_RE = /\.(?:exe|bat|scr|cmd|pif|vbs)(?:\?|#|$|\s)/i;
    const URL_RE = /https?:\/\/[^\s<>"']+/gi;

    function escapeHtml(raw) {
        return String(raw ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function stripHtml(raw) {
        return String(raw ?? '').replace(/<[^>]*>/g, '');
    }

    function normalizePlainText(raw) {
        return stripHtml(String(raw ?? '')).replace(/\r\n/g, '\n').trim();
    }

    function scanAbuse(text) {
        const s = normalizePlainText(text);
        if (!s) return { ok: false, code: 'EMPTY', message: 'Content is required.' };
        if (PROFANITY_RE.test(s)) {
            return { ok: false, code: 'PROFANITY', message: 'Language violates community guidelines.' };
        }
        if (SPAM_RE.test(s)) {
            return { ok: false, code: 'SPAM', message: 'Promotional or gambling content is not allowed.' };
        }
        if (PHISHING_RE.test(s)) {
            return { ok: false, code: 'PHISHING', message: 'Suspicious messaging patterns are blocked.' };
        }
        const urls = s.match(URL_RE) || [];
        for (const url of urls) {
            if (MALICIOUS_EXT_RE.test(url)) {
                return { ok: false, code: 'MALICIOUS_LINK', message: 'Executable or unsafe file links are blocked.' };
            }
        }
        return { ok: true };
    }

    function validatePostPayload(fields) {
        const honeypot = String(fields.website_url_check || '').trim();
        if (honeypot) return { ok: false, code: 'HONEYPOT', message: 'Rejected.', silent: true };

        const displayName = normalizePlainText(fields.displayName);
        const title = normalizePlainText(fields.title);
        const body = normalizePlainText(fields.body);
        const role = String(fields.role || '').trim();
        const category = String(fields.category || '').trim();

        if (!displayName || displayName.length > MAX_NAME) {
            return { ok: false, code: 'NAME', message: 'Enter a display name (max 64 characters).' };
        }
        if (!ALLOWED_ROLES.includes(role)) {
            return { ok: false, code: 'ROLE', message: 'Select a valid role.' };
        }
        if (!CATEGORIES.some((c) => c.id === category)) {
            return { ok: false, code: 'CATEGORY', message: 'Select a valid channel.' };
        }
        if (!title || title.length > MAX_TITLE) {
            return { ok: false, code: 'TITLE', message: 'Enter a title (max 200 characters).' };
        }
        if (!body || body.length > MAX_BODY) {
            return { ok: false, code: 'BODY', message: 'Enter a question or tip (max 8000 characters).' };
        }
        for (const chunk of [displayName, title, body]) {
            const scan = scanAbuse(chunk);
            if (!scan.ok) return scan;
        }
        return { ok: true };
    }

    function validateCommentPayload(fields) {
        const honeypot = String(fields.website_url_check || '').trim();
        if (honeypot) return { ok: false, code: 'HONEYPOT', message: 'Rejected.', silent: true };

        const displayName = normalizePlainText(fields.displayName);
        const body = normalizePlainText(fields.body);
        const role = String(fields.role || '').trim();

        if (!displayName || displayName.length > MAX_NAME) {
            return { ok: false, code: 'NAME', message: 'Enter a display name (max 64 characters).' };
        }
        if (!ALLOWED_ROLES.includes(role)) {
            return { ok: false, code: 'ROLE', message: 'Select a valid role.' };
        }
        if (!body || body.length > MAX_COMMENT) {
            return { ok: false, code: 'BODY', message: 'Enter a comment (max 4000 characters).' };
        }
        for (const chunk of [displayName, body]) {
            const scan = scanAbuse(chunk);
            if (!scan.ok) return scan;
        }
        return { ok: true };
    }

    function safeHref(url) {
        const u = String(url || '').trim();
        if (!/^https?:\/\//i.test(u)) return null;
        if (MALICIOUS_EXT_RE.test(u)) return null;
        return u;
    }

    function linkifyEscaped(plain) {
        const text = normalizePlainText(plain);
        if (!text) return '';
        let html = '';
        let last = 0;
        const re = new RegExp(URL_RE.source, 'gi');
        let m;
        while ((m = re.exec(text)) !== null) {
            html += escapeHtml(text.slice(last, m.index));
            const href = safeHref(m[0]);
            if (href) {
                html += `<a href="${escapeHtml(href)}" rel="nofollow noopener noreferrer" target="_blank">${escapeHtml(m[0])}</a>`;
            } else {
                html += escapeHtml(m[0]);
            }
            last = m.index + m[0].length;
        }
        html += escapeHtml(text.slice(last));
        return html.replace(/\n/g, '<br>');
    }

    global.TVC_ForumGuard = {
        ALLOWED_ROLES,
        CATEGORIES,
        RATE_LIMIT_MS,
        escapeHtml,
        normalizePlainText,
        scanAbuse,
        validatePostPayload,
        validateCommentPayload,
        linkifyEscaped,
    };
})(typeof window !== 'undefined' ? window : globalThis);
