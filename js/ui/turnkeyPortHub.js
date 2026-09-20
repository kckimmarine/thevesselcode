/**
 * One-Stop Turnkey Port Care & Repair — Action Hub (Store + Toolkit + SEO pages).
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }
    if (root && typeof root === 'object') {
        root.TVC_TurnkeyPortHub = api;
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function turnkeyPortHubFactory() {
    'use strict';

    const WA_NUMBER = '821038894291';
    let _modalBound = false;
    let _pageQueryContext = null;

    function esc(text) {
        return String(text ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function defaultWhatsAppText() {
        return 'Hello TVC, vessel [Name] needs turnkey port assistance at [Port] around [ETA].';
    }

    function buildTurnkeyWhatsAppUrl({ vesselName, port, eta } = {}) {
        const vessel = String(vesselName || '').trim() || '[Name]';
        const portName = String(port || '').trim() || '[Port]';
        const etaText = String(eta || '').trim() || '[ETA]';
        const text = `Hello TVC, vessel ${vessel} needs turnkey port assistance at ${portName} around ${etaText}.`;
        return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;
    }

    function buildShipRepairKoreaUrl({ impaCode, itemName } = {}) {
        const code = String(impaCode || '').trim();
        const name = String(itemName || '').trim();
        if (!code && !name) return '/ship-repair-korea';
        const q = new URLSearchParams();
        if (code) q.set('impa', code);
        if (name) q.set('item', name);
        return `/ship-repair-korea?${q.toString()}`;
    }

    function buildDefaultRepairScope({ impaCode, itemName } = {}) {
        const code = String(impaCode || '').trim();
        const name = String(itemName || '').trim();
        if (!code && !name) return '';
        const label = [code ? `IMPA ${code}` : '', name].filter(Boolean).join(' — ');
        return `Installation / overhaul scope for ${label}. Afloat fit-up, alignment, and class-ready completion at Korea, Singapore, or China port call.`;
    }

    function parseTurnkeyUrlParams(search) {
        const params = new URLSearchParams(typeof search === 'string' ? search : (root.location?.search || ''));
        return {
            impaCode: String(params.get('impa') || params.get('code') || '').trim(),
            itemName: String(params.get('item') || params.get('name') || '').trim(),
        };
    }

    function getTurnkeyPageContext() {
        if (_pageQueryContext) return _pageQueryContext;
        _pageQueryContext = parseTurnkeyUrlParams();
        return _pageQueryContext;
    }

    function buildTurnkeyInstallFunnelHtml(ctx) {
        const impaCode = esc(ctx?.impaCode || '');
        const itemName = esc(ctx?.itemName || '');
        const href = esc(buildShipRepairKoreaUrl({
            impaCode: ctx?.impaCode,
            itemName: ctx?.itemName,
        }));
        const itemHint = impaCode
            ? `<p class="turnkey-install-item">Linked item: <strong>IMPA ${impaCode}</strong>${itemName ? ` — ${itemName}` : ''}</p>`
            : '';
        return `
<section class="turnkey-install-funnel" aria-label="Turnkey port installation and overhaul"${impaCode ? ` data-impa-code="${impaCode}" data-impa-name="${itemName}"` : ''}>
  <p class="turnkey-install-eyebrow">Parts → Repair → Husbandry</p>
  <h2 class="turnkey-install-title">Turnkey Port Installation &amp; Overhaul</h2>
  <p class="turnkey-install-lead">Planning to install or overhaul this part at Korea, Singapore, or China?</p>
  ${itemHint}
  <p class="turnkey-install-copy">Bridge to superintendent-led afloat work: berth husbandry, launch-boat access, IMPA stores delivery, and certified fit-up — one desk from spec to sail.</p>
  <a class="btn-turnkey-install-bridge" href="${href}">🛠️ Plan install / overhaul at this port call →</a>
</section>`;
    }

    function buildTvcSmRetentionBannerHtml() {
        return `
<section class="tvc-sm-retention-banner" aria-label="TVC-SM fleet platform">
  <p class="tvc-sm-retention-eyebrow">Closed-loop fleet operations</p>
  <h2 class="tvc-sm-retention-title">Manage maintenance records, parts ROB, and turnkey port calls on one screen.</h2>
  <a class="btn-tvc-sm-retention" href="/sm#pricing">🚢 Explore TVC-SM Fleet Platform (Starter $99/mo)</a>
</section>`;
    }

    function buildTurnkeyPortHubHtml(ctx) {
        const impaCode = esc(ctx?.impaCode || '');
        const itemName = esc(ctx?.itemName || '');
        const waUrl = esc(buildTurnkeyWhatsAppUrl({}));
        const dataImpa = impaCode ? ` data-impa-code="${impaCode}" data-impa-name="${itemName}"` : '';
        return `
<section class="turnkey-port-hub" aria-label="Turnkey port care and repair"${dataImpa}>
  <p class="turnkey-port-badge">⚓ Korea · China · Singapore Port Calls</p>
  <h2 class="turnkey-port-title">⚓ Calling Korea, China, or Singapore? Turnkey Port Solution</h2>
  <p class="turnkey-port-subtitle">Agency Clearance + IMPA Stores Sourcing + Afloat Technical Repair — Handled by 1-Class Engineers.</p>
  <ul class="turnkey-port-pillars" aria-label="Turnkey service pillars">
    <li><span class="turnkey-check" aria-hidden="true">✓</span> Port Clearance &amp; Husbandry (Customs, Launch Boat, Berth Coordination)</li>
    <li><span class="turnkey-check" aria-hidden="true">✓</span> Parts &amp; Stores Delivery (Direct Port-side &amp; Anchorage delivery)</li>
    <li><span class="turnkey-check" aria-hidden="true">✓</span> Certified Afloat Overhaul (Valve, Pump, Piping &amp; Class/PSC endorsement)</li>
  </ul>
  <div class="turnkey-port-actions">
    <button type="button" class="btn-turnkey-inquiry" data-turnkey-inquiry-open>🛠️ 1-Click Turnkey Port Inquiry</button>
    <a class="btn-turnkey-wa" data-turnkey-wa href="${waUrl}" target="_blank" rel="noopener noreferrer">🟢 WhatsApp 24/7 Duty Superintendent</a>
  </div>
  <p class="turnkey-port-footnote">Backed by 15+ years Chief Engineer &amp; Technical Superintendent Expertise. Zero Demurrage / On-time Departure Commitment.</p>
</section>`;
    }

    function buildContactTurnkeyUrl({
        vessel, portEta, needs, impaCode, itemName, ref,
        includeHusbandry, includeImpaSourcing, includeSuperintendent,
    }) {
        const params = new URLSearchParams();
        params.set('inquiry', 'engineering');
        if (impaCode) params.set('code', impaCode);
        if (itemName) params.set('name', itemName);
        if (ref) params.set('ref', ref);
        const lines = [
            'Turnkey Port Care & Repair inquiry',
            vessel ? `Vessel / IMO: ${vessel}` : '',
            portEta ? `Port & ETA: ${portEta}` : '',
            `Port husbandry / launch boat: ${includeHusbandry ? 'YES' : 'no'}`,
            `IMPA stores / parts sourcing: ${includeImpaSourcing ? 'YES' : 'no'}`,
            `Technical superintendent attendance: ${includeSuperintendent ? 'YES' : 'no'}`,
            needs ? `Repair & sourcing scope: ${needs}` : '',
            impaCode ? `Context IMPA: ${impaCode}` : '',
        ].filter(Boolean);
        params.set('message', lines.join('\n'));
        return `/contact-us?${params.toString()}`;
    }

    function ensureTurnkeyInquiryModal() {
        let modal = document.getElementById('turnkeyPortInquiryModal');
        if (modal && !modal.querySelector('#turnkeyOptSuperintendent')) {
            modal.remove();
            _modalBound = false;
            modal = null;
        }
        if (modal) return modal;
        modal = document.createElement('div');
        modal.id = 'turnkeyPortInquiryModal';
        modal.className = 'turnkey-inquiry-modal hidden';
        modal.setAttribute('aria-hidden', 'true');
        modal.innerHTML = `
            <div class="turnkey-inquiry-backdrop" data-turnkey-inquiry-close></div>
            <div class="turnkey-inquiry-panel" role="dialog" aria-modal="true" aria-labelledby="turnkeyInquiryTitle">
                <header class="turnkey-inquiry-head">
                    <h3 id="turnkeyInquiryTitle">🛠️ Turnkey Port Inquiry</h3>
                    <button type="button" class="turnkey-inquiry-close" data-turnkey-inquiry-close aria-label="Close">✕</button>
                </header>
                <form id="turnkeyInquiryForm" class="turnkey-inquiry-form">
                    <div class="turnkey-inquiry-field">
                        <label for="turnkeyVessel">Vessel Name / IMO</label>
                        <input id="turnkeyVessel" name="vessel" type="text" autocomplete="organization" placeholder="MV Example / IMO 9123456" required>
                    </div>
                    <div class="turnkey-inquiry-field">
                        <label for="turnkeyPortEta">Port &amp; ETA</label>
                        <input id="turnkeyPortEta" name="portEta" type="text" placeholder="Busan · 24 Apr 2026 · AM berth" required>
                    </div>
                    <fieldset class="turnkey-inquiry-options">
                        <legend class="turnkey-inquiry-options-legend">Include in turnkey scope</legend>
                        <label class="turnkey-inquiry-check">
                            <input type="checkbox" id="turnkeyOptHusbandry" name="includeHusbandry" value="1" checked>
                            Include Port Husbandry / Launch Boat
                        </label>
                        <label class="turnkey-inquiry-check">
                            <input type="checkbox" id="turnkeyOptImpaSourcing" name="includeImpaSourcing" value="1" checked>
                            Include IMPA Stores / Parts Sourcing
                        </label>
                        <label class="turnkey-inquiry-check">
                            <input type="checkbox" id="turnkeyOptSuperintendent" name="includeSuperintendent" value="1" checked>
                            Technical Superintendent Attendance
                        </label>
                    </fieldset>
                    <div class="turnkey-inquiry-field">
                        <label for="turnkeyNeeds">Repair &amp; Sourcing Needs</label>
                        <textarea id="turnkeyNeeds" name="needs" rows="4" placeholder="IMPA stores, valve overhaul, customs husbandry, launch boat…" required></textarea>
                    </div>
                    <button type="submit" class="turnkey-inquiry-submit">Continue to engineering desk →</button>
                    <p class="turnkey-inquiry-hint">24/7 superintendent routing — Korea, China, and Singapore port calls.</p>
                </form>
            </div>`;
        document.body.appendChild(modal);
        if (!_modalBound) {
            _modalBound = true;
            modal.addEventListener('click', (e) => {
                if (e.target.closest('[data-turnkey-inquiry-close]')) closeTurnkeyInquiryModal();
            });
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
                    closeTurnkeyInquiryModal();
                }
            });
            modal.querySelector('#turnkeyInquiryForm')?.addEventListener('submit', (e) => {
                e.preventDefault();
                const form = e.target;
                const vessel = form.vessel?.value?.trim() || '';
                const portEta = form.portEta?.value?.trim() || '';
                const needs = form.needs?.value?.trim() || '';
                const includeHusbandry = !!form.querySelector('#turnkeyOptHusbandry')?.checked;
                const includeImpaSourcing = !!form.querySelector('#turnkeyOptImpaSourcing')?.checked;
                const includeSuperintendent = !!form.querySelector('#turnkeyOptSuperintendent')?.checked;
                const url = buildContactTurnkeyUrl({
                    vessel,
                    portEta,
                    needs,
                    impaCode: form.dataset.impaCode || '',
                    itemName: form.dataset.impaName || '',
                    ref: form.dataset.ref || '',
                    includeHusbandry,
                    includeImpaSourcing,
                    includeSuperintendent,
                });
                window.location.href = url;
            });
        }
        return modal;
    }

    function mergeTurnkeyContext(ctx) {
        const fromUrl = getTurnkeyPageContext();
        return {
            impaCode: ctx?.impaCode || fromUrl.impaCode || '',
            itemName: ctx?.itemName || fromUrl.itemName || '',
            ref: ctx?.ref || `${window.location.pathname}${window.location.search}`,
        };
    }

    function openTurnkeyInquiryModal(ctx) {
        const modal = ensureTurnkeyInquiryModal();
        const form = modal.querySelector('#turnkeyInquiryForm');
        const merged = mergeTurnkeyContext(ctx || {});
        if (form) {
            form.dataset.impaCode = merged.impaCode;
            form.dataset.impaName = merged.itemName;
            form.dataset.ref = merged.ref;
        }
        const needsEl = modal.querySelector('#turnkeyNeeds');
        const husbandryEl = modal.querySelector('#turnkeyOptHusbandry');
        const sourcingEl = modal.querySelector('#turnkeyOptImpaSourcing');
        const superintendentEl = modal.querySelector('#turnkeyOptSuperintendent');
        if (husbandryEl) husbandryEl.checked = true;
        if (sourcingEl) sourcingEl.checked = true;
        if (superintendentEl) superintendentEl.checked = true;
        if (needsEl) {
            const preset = ctx?.prefillNeeds || buildDefaultRepairScope(merged);
            if (preset && (!needsEl.value.trim() || ctx?.forcePrefillNeeds)) {
                needsEl.value = preset;
            }
        }
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        modal.querySelector('#turnkeyVessel')?.focus();
    }

    function closeTurnkeyInquiryModal() {
        const modal = document.getElementById('turnkeyPortInquiryModal');
        if (!modal) return;
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
        const detailOpen = document.getElementById('impaDetailModal')
            && !document.getElementById('impaDetailModal').classList.contains('hidden');
        const plateOpen = document.getElementById('impaPlateFullscreen')
            && !document.getElementById('impaPlateFullscreen').classList.contains('hidden');
        if (!detailOpen && !plateOpen) document.body.style.overflow = '';
    }

    function syncWhatsAppFromForm(root, ctx) {
        const wa = root?.querySelector('[data-turnkey-wa]');
        if (!wa) return;
        const vessel = root.querySelector('#turnkeyVessel')?.value
            || document.getElementById('turnkeyVessel')?.value;
        const portEta = root.querySelector('#turnkeyPortEta')?.value
            || document.getElementById('turnkeyPortEta')?.value;
        let port = '';
        let eta = '';
        if (portEta) {
            const parts = String(portEta).split(/[·|/,-]/).map((s) => s.trim()).filter(Boolean);
            port = parts[0] || portEta;
            eta = parts.slice(1).join(' ') || '[ETA]';
        }
        wa.href = buildTurnkeyWhatsAppUrl({
            vesselName: vessel || ctx?.vesselName,
            port,
            eta,
        });
    }

    function bindTurnkeyPortHub(root, ctx) {
        if (!root) return;
        const section = root.classList?.contains('turnkey-port-hub')
            ? root
            : root.querySelector('.turnkey-port-hub');
        if (!section) return;
        const impaCode = ctx?.impaCode
            || section.getAttribute('data-impa-code')
            || '';
        const itemName = ctx?.itemName
            || section.getAttribute('data-impa-name')
            || '';
        const ref = ctx?.ref || (impaCode ? `/store/${impaCode}` : '');
        const openCtx = { impaCode, itemName, ref };

        section.querySelector('[data-turnkey-inquiry-open]')?.addEventListener('click', (e) => {
            e.preventDefault();
            openTurnkeyInquiryModal(openCtx);
        });
        const wa = section.querySelector('[data-turnkey-wa]');
        if (wa && !wa.dataset.turnkeyWaBound) {
            wa.dataset.turnkeyWaBound = '1';
            wa.addEventListener('click', () => {
                syncWhatsAppFromForm(section, openCtx);
            });
        }
    }

    function mountTurnkeyHost(hostEl, ctx) {
        if (!hostEl) return;
        hostEl.innerHTML = buildTurnkeyPortHubHtml(ctx);
        bindTurnkeyPortHub(hostEl, ctx);
    }

    function mountInstallFunnelHost(hostEl, ctx) {
        if (!hostEl) return;
        hostEl.innerHTML = buildTurnkeyInstallFunnelHtml(ctx);
    }

    function initShipRepairPage() {
        _pageQueryContext = parseTurnkeyUrlParams();
        const merged = mergeTurnkeyContext({});
        document.querySelectorAll('[data-turnkey-inquiry-open], #srkRepairInquiryBtn').forEach((btn) => {
            if (btn.dataset.turnkeySrkBound === '1') return;
            btn.dataset.turnkeySrkBound = '1';
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                openTurnkeyInquiryModal({
                    ...merged,
                    forcePrefillNeeds: true,
                });
            });
        });
    }

    function initDocument(root) {
        const scope = root || document;
        scope.querySelectorAll('.turnkey-port-hub').forEach((section) => {
            bindTurnkeyPortHub(section, {
                impaCode: section.getAttribute('data-impa-code') || '',
                itemName: section.getAttribute('data-impa-name') || '',
            });
        });
    }

    return {
        WA_NUMBER,
        buildTurnkeyPortHubHtml,
        buildTurnkeyInstallFunnelHtml,
        buildTvcSmRetentionBannerHtml,
        buildShipRepairKoreaUrl,
        buildDefaultRepairScope,
        parseTurnkeyUrlParams,
        buildTurnkeyWhatsAppUrl,
        buildContactTurnkeyUrl,
        bindTurnkeyPortHub,
        mountTurnkeyHost,
        mountInstallFunnelHost,
        openTurnkeyInquiryModal,
        closeTurnkeyInquiryModal,
        initDocument,
        initShipRepairPage,
    };
}));
