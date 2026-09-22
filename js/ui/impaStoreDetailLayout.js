/* THE VESSEL CODE — Shared /store/:code + Toolkit IMPA detail card layout */
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    root.TVC_ImpaStoreDetailLayout = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const TOP_REQUISITION_CHAPTERS = new Set(['31', '33', '55', '59', '61', '75', '79', '87']);
    const PRIORITY_SPEC_KEYS = ['Rating', 'Material', 'Standard Unit', 'Standard'];
    const WA_NUMBER = '821038894291';

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function normalizeCode(value) {
        return String(value || '').trim().replace(/\D/g, '').padStart(6, '0').slice(-6);
    }

    function cleanProductTitle(item) {
        let name = String(item?.name || 'Marine Store Item');
        name = name.replace(/\s+\d+(?:\.\d+)?\s*(?:mm|cm|m|mtr|inch|in|")\s*(?:x\s*.+)?$/i, '');
        name = name.replace(/\s+\d+\s*(?:rolls?|rols|pcs|pieces?|boxes?|sets?)(?:\s*per\s*box)?.*$/i, '');
        return name.trim() || String(item?.name || 'Marine Store Item');
    }

    function isTopRequisitionedItem(item) {
        const code = normalizeCode(item?.impa_code || item?.code || '');
        if (code.length < 2) return false;
        return TOP_REQUISITION_CHAPTERS.has(code.slice(0, 2));
    }

    function buildContactInquiryUrl(base, params) {
        const merged = { ...(params || {}) };
        const code = String(merged.code || '').trim();
        if (!merged.utm_source) merged.utm_source = 'store_seo';
        if (!merged.utm_medium) merged.utm_medium = 'organic';
        if (!merged.utm_campaign) merged.utm_campaign = 'impa_rfq';
        if (code && !merged.utm_content) merged.utm_content = code;
        const q = new URLSearchParams();
        Object.entries(merged).forEach(([key, val]) => {
            const s = String(val ?? '').trim();
            if (s) q.set(key, s);
        });
        const qs = q.toString();
        return `${String(base || '').replace(/\/$/, '')}/contact-us${qs ? `?${qs}` : ''}`;
    }

    function specRows(item) {
        const specs = item.specs && typeof item.specs === 'object' ? item.specs : {};
        const used = new Set();
        const rows = [
            ['IMPA Code', item.impa_code],
            ['Product Name', item.name],
            ['Category', item.category || '—'],
            ['Packaging / Unit', item.unit || 'PCS'],
        ];
        used.add('Category');
        used.add('Standard Unit');

        PRIORITY_SPEC_KEYS.forEach((key) => {
            const value = specs[key];
            if (value != null && String(value).trim()) {
                rows.push([key, String(value)]);
                used.add(key);
            }
        });

        if (item.plate_id) rows.push(['Plate Reference', item.plate_id]);

        Object.entries(specs).forEach(([key, value]) => {
            if (used.has(key)) return;
            if (value != null && String(value).trim()) rows.push([key, String(value)]);
        });

        return rows.filter(([, value]) => String(value || '').trim());
    }

    function buildSpecTableRowsHtml(item) {
        return specRows(item).map(([label, value]) => (
            `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`
        )).join('');
    }

    function buildImpaCommerceTrustHtml(item) {
        const topHidden = isTopRequisitionedItem(item) ? '' : ' hidden';
        return `
        <div class="impa-detail-trust-header" aria-label="Trust and verification">
          <span class="impa-trust-badge impa-trust-badge-hot${topHidden}" data-impa-top-badge id="impaDetailBadgeTop">🔥 Top Requisitioned Item</span>
          <span class="impa-trust-badge impa-trust-badge-verified">✓ Verified by 1st Class Marine Engineer</span>
        </div>`;
    }

    function buildImpaStockSlaHtml() {
        return `
        <div class="impa-stock-sla-card" aria-label="Stock and delivery">
          <div class="impa-stock-sla-col impa-stock-col">🟢 In Stock (Busan Hub / Singapore Transit Ready)</div>
          <div class="impa-stock-sla-col impa-sla-col">⚡ 24~48h Port-side Delivery &amp; Bonded Transit</div>
        </div>`;
    }

    function buildImpaCommerceActionsHtml(item) {
        const code = escapeHtml(item.impa_code || item.code || '');
        const name = escapeHtml(cleanProductTitle(item));
        return `
        <div class="impa-detail-commerce-actions impa-store-commerce-actions">
          <button type="button" class="btn-action-rfq" id="btn-modal-rfq" data-impa-fast-rfq data-impa-item-code="${code}" data-impa-item-name="${name}">📋 1-Click Fast RFQ</button>
          <a class="btn-action-wa" id="btn-modal-wa" data-impa-wa-rfq data-impa-item-code="${code}" data-impa-item-name="${name}" href="https://wa.me/${WA_NUMBER}" target="_blank" rel="noopener noreferrer">💬 Instant Quote via WhatsApp</a>
        </div>`;
    }

    function buildRfqLeadBlockHtml(item, base, { includeSticky = true } = {}) {
        const code = item.impa_code || item.code || '';
        const name = cleanProductTitle(item);
        const rfqBase = {
            inquiry: 'rfq',
            code,
            name,
            ref: `/store/${code}`,
        };
        const busanUrl = buildContactInquiryUrl(base, { ...rfqBase, port: 'Busan' });
        const singaporeUrl = buildContactInquiryUrl(base, { ...rfqBase, port: 'Singapore' });
        const shanghaiUrl = buildContactInquiryUrl(base, { ...rfqBase, port: 'Shanghai' });
        const rfqUrl = buildContactInquiryUrl(base, rfqBase);
        const pocUrl = buildContactInquiryUrl(base, { inquiry: 'poc', ref: `/store/${code}` });
        const waText = encodeURIComponent(
            `RFQ — IMPA ${code} (${name}). Qty / delivery port / vessel name: `,
        );
        const waUrl = `https://wa.me/${WA_NUMBER}?text=${waText}`;
        const sticky = includeSticky
            ? `<aside class="store-sticky-lead" aria-label="Quick quote">
          <a class="store-sticky-lead-btn" href="${escapeHtml(rfqUrl)}">Quote IMPA ${escapeHtml(code)}</a>
        </aside>`
            : '';
        return `
      <section class="store-rfq-lead" aria-label="Request quotation for this IMPA item">
        <p class="store-rfq-eyebrow">B2B supply · Busan HQ · 12h response</p>
        <h2 class="store-rfq-title">Request a quote for IMPA ${escapeHtml(code)}</h2>
        <p class="store-rfq-desc">${escapeHtml(name)} — delivery, MOQ, and maker alternatives from K-TECH / THE VESSEL CODE.</p>
        <div class="store-rfq-port-row">
          <a class="btn btn-rfq-primary" href="${escapeHtml(rfqUrl)}">Get quote (any port)</a>
          <a class="btn btn-rfq-port" href="${escapeHtml(busanUrl)}">Busan</a>
          <a class="btn btn-rfq-port" href="${escapeHtml(singaporeUrl)}">Singapore</a>
          <a class="btn btn-rfq-port" href="${escapeHtml(shanghaiUrl)}">Shanghai</a>
        </div>
        <p class="store-rfq-alt">
          <a href="${escapeHtml(waUrl)}" rel="noopener noreferrer" target="_blank">WhatsApp RFQ</a>
          · <a href="${escapeHtml(pocUrl)}">14-day fleet PoC</a>
          · <a href="tel:+821038894291">+82 10-3889-4291</a>
        </p>
      </section>
      ${sticky}`;
    }

    function resolvePublicBaseUrl() {
        if (typeof window !== 'undefined' && window.location?.origin) {
            return window.location.origin.replace(/\/$/, '');
        }
        return 'https://www.thevesselcode.com';
    }

    function buildToolkitDetailHostMarkup() {
        return `
                <div id="impaStoreDetailHost" class="impa-store-detail impa-shipserv-layout" aria-label="IMPA product details">
                    <header class="impa-store-detail-head">
                        <div class="impa-store-detail-head-main">
                            <span class="impa-detail-unified-badge" id="impaDetailBadge">IMPA</span>
                            <h1 class="impa-detail-unified-title" id="impaDetailProductTitle">—</h1>
                            <div id="impaDetailTrustHeader" aria-label="Trust and verification"></div>
                        </div>
                    </header>
                    <div id="impaDetailStoreBody" class="impa-store-detail-body">
                        <div id="impaDetailRfqLeadHost"></div>
                        <div class="impa-shipserv-photo impa-plate-preview" id="impaDetailProductPhoto">
                            <img id="impaDetailProductImg" class="impa-shipserv-photo-img impa-store-plate-img" alt="" hidden>
                            <div id="impaDetailProductFallback" class="impa-shipserv-photo-fallback" hidden></div>
                            <span class="impa-plate-zoom-hint" id="impaDetailPlateZoomHint" hidden>🔍 Click / Tap to enlarge reference photo</span>
                        </div>
                        <div id="impaDetailProductAttribution" class="impa-product-photo-attribution-host" hidden aria-live="polite"></div>
                        <div id="impaDetailStockSlaHost"></div>
                        <section aria-label="Specifications">
                            <div class="impa-shipserv-spec-wrap">
                                <table class="impa-shipserv-spec-table spec-table">
                                    <tbody id="impaDetailShipservSpec"></tbody>
                                </table>
                            </div>
                        </section>
                        <div id="impaDetailTotalServiceBar" class="impa-detail-total-service-host" aria-label="Total marine care suite"></div>
                        <div id="impaDetailStoreBridgeCta" class="impa-detail-store-bridge-host"></div>
                        <div id="impaDetailInstallFunnel" class="impa-detail-install-funnel-host" aria-label="Turnkey installation funnel"></div>
                        <div id="impaDetailTurnkeyHub" class="impa-detail-turnkey-host" aria-label="Turnkey port services"></div>
                        <div id="impaDetailConversionAction" class="impa-detail-commerce-block" aria-label="Pricing and supply inquiry"></div>
                        <div class="impa-detail-actions">
                            <button type="button" class="impa-detail-share-btn btn-share-spec" id="impaDetailShareBtn">📋 Share Spec Link</button>
                        </div>
                    </div>
                </div>`;
    }

    function mountToolkitExtensionBlocks(root, item) {
        if (!root || !item) return;
        const code = item.impa_code || item.code || '';
        const displayTitle = cleanProductTitle(item);
        const funnelCtx = { impaCode: code, itemName: displayTitle };
        const totalServiceHost = root.querySelector('#impaDetailTotalServiceBar');
        if (totalServiceHost && typeof globalThis.TVC_TotalServiceBar !== 'undefined') {
            totalServiceHost.innerHTML = globalThis.TVC_TotalServiceBar.buildTotalServiceBarHtml({
                ...funnelCtx,
                activePillar: 'impa',
            });
        } else if (totalServiceHost) {
            totalServiceHost.innerHTML = '';
        }
        const bridgeHost = root.querySelector('#impaDetailStoreBridgeCta');
        if (bridgeHost && typeof globalThis.TVC_TotalServiceBar !== 'undefined') {
            bridgeHost.innerHTML = globalThis.TVC_TotalServiceBar.buildStoreRepairBridgeCtaHtml(funnelCtx);
        } else if (bridgeHost) {
            bridgeHost.innerHTML = '';
        }
        const installHost = root.querySelector('#impaDetailInstallFunnel');
        if (installHost && typeof globalThis.TVC_TurnkeyPortHub !== 'undefined') {
            globalThis.TVC_TurnkeyPortHub.mountInstallFunnelHost(installHost, funnelCtx);
        } else if (installHost) {
            installHost.innerHTML = '';
        }
        const turnkeyHost = root.querySelector('#impaDetailTurnkeyHub');
        if (turnkeyHost && typeof globalThis.TVC_TurnkeyPortHub !== 'undefined') {
            globalThis.TVC_TurnkeyPortHub.mountTurnkeyHost(turnkeyHost, funnelCtx);
        } else if (turnkeyHost) {
            turnkeyHost.innerHTML = '';
        }
    }

    function populateStoreDetailCard(root, item, options = {}) {
        if (!root || !item) return;
        const base = options.base || resolvePublicBaseUrl();
        const code = item.impa_code || item.code || '';
        const displayTitle = cleanProductTitle(item);
        const body = root.querySelector('#impaDetailStoreBody') || root;
        body.dataset.impaItemCode = code;
        body.dataset.impaItemName = displayTitle;

        const badge = root.querySelector('#impaDetailBadge, .impa-detail-unified-badge');
        if (badge) badge.textContent = `IMPA ${code}`;

        const titleEl = root.querySelector('#impaDetailProductTitle, .impa-detail-unified-title');
        if (titleEl) titleEl.textContent = displayTitle;

        const trustHost = root.querySelector('#impaDetailTrustHeader');
        if (trustHost) trustHost.innerHTML = buildImpaCommerceTrustHtml(item);

        const rfqHost = root.querySelector('#impaDetailRfqLeadHost');
        if (rfqHost) {
            rfqHost.innerHTML = buildRfqLeadBlockHtml(item, base, {
                includeSticky: options.includeStickyLead !== false,
            });
        }

        const slaHost = root.querySelector('#impaDetailStockSlaHost');
        if (slaHost) slaHost.innerHTML = buildImpaStockSlaHtml();

        const specBody = root.querySelector('#impaDetailShipservSpec');
        if (specBody) specBody.innerHTML = buildSpecTableRowsHtml(item);

        const commerceHost = root.querySelector('#impaDetailConversionAction');
        if (commerceHost) commerceHost.innerHTML = buildImpaCommerceActionsHtml(item);

        if (options.mountExtensions !== false) {
            mountToolkitExtensionBlocks(root, item);
        }
    }

    return {
        escapeHtml,
        normalizeCode,
        cleanProductTitle,
        isTopRequisitionedItem,
        specRows,
        buildSpecTableRowsHtml,
        buildImpaCommerceTrustHtml,
        buildImpaStockSlaHtml,
        buildImpaCommerceActionsHtml,
        buildRfqLeadBlockHtml,
        buildContactInquiryUrl,
        buildToolkitDetailHostMarkup,
        mountToolkitExtensionBlocks,
        populateStoreDetailCard,
        resolvePublicBaseUrl,
    };
});
