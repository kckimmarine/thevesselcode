/* IMPA product photo attribution — shared Toolkit modal rendering */
const TVC_ImpaProductPhotoUi = (function () {
    const DEFAULT_DISCLAIMER =
        'Reference photo for industrial/commercial specification. Actual maritime supply brand/finish may vary.';

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function normalizeMeta(raw) {
        if (!raw || typeof raw !== 'object') return null;
        const license = String(raw.license || '').trim();
        const sourceName = String(raw.source_name || raw.credit || '').trim();
        const sourceUrl = String(raw.source_url || raw.source_page || '').trim();
        const disclaimer = String(raw.disclaimer || DEFAULT_DISCLAIMER).trim();
        if (!license && !sourceName && !sourceUrl) return null;
        return { license, sourceName, sourceUrl, disclaimer };
    }

    function buildAttributionHtml(meta) {
        const norm = normalizeMeta(meta);
        if (!norm) return '';

        const parts = [];
        if (norm.sourceName) parts.push(escapeHtml(norm.sourceName));
        let creditLine = parts.join(' · ');
        if (norm.sourceUrl) {
            const href = escapeHtml(norm.sourceUrl);
            creditLine = creditLine
                ? `${creditLine} · <a href="${href}" rel="noopener noreferrer" target="_blank">Source</a>`
                : `<a href="${href}" rel="noopener noreferrer" target="_blank">Image source</a>`;
        }

        const licenseBadge = norm.license
            ? `<span class="impa-photo-license-badge">${escapeHtml(norm.license)}</span>`
            : '';

        return `
            <div class="impa-product-photo-attribution" role="note">
                ${licenseBadge}
                ${creditLine ? `<p class="impa-product-photo-credit">${creditLine}</p>` : ''}
                <p class="impa-product-photo-disclaimer">${escapeHtml(norm.disclaimer)}</p>
            </div>`;
    }

    return {
        DEFAULT_DISCLAIMER,
        normalizeMeta,
        buildAttributionHtml,
    };
})();
