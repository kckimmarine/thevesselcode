/* THE VESSEL CODE — About & Contact form handler */
(function () {
    const CONTACT_RECIPIENTS = [
        'ktechship@gmail.com',
        ['kckim', 'marine', 'gmail', 'com'].join('.').replace('.marine.', '.marine@'),
    ];
    const CONTACT_DISPLAY = CONTACT_RECIPIENTS[0];

    function qs(sel) {
        return document.querySelector(sel);
    }

    function t(key) {
        const i18n = globalThis.TVC_MarketingI18n;
        if (!i18n?.t) return null;
        return i18n.t(key, i18n.getLang());
    }

    function inquiryLabel(value) {
        const key = {
            demo: 'contact.inquiry.demo',
            rfq: 'contact.inquiry.rfq',
            partnership: 'contact.inquiry.partnership',
            support: 'contact.inquiry.support',
            general: 'contact.inquiry.general',
            engineering: 'contact.inquiry.engineering',
        }[value];
        if (key) {
            const label = t(key);
            if (label) return label;
        }
        return t('contact.inquiry.general') || value || 'General';
    }

    function isValidEmail(value) {
        const email = String(value || '').trim();
        if (!email || email.length > 254) return false;
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email);
    }

    function setStatus(el, type, message) {
        if (!el) return;
        el.className = `ac-status visible ${type}`;
        el.textContent = message;
    }

    function buildMailtoUrl(data) {
        const subject = encodeURIComponent(`[TVC Contact] ${data.inquiryType}`);
        const body = encodeURIComponent(
            [
                `Inquiry Type: ${data.inquiryType}`,
                `Company: ${data.companyName}`,
                `Your Name: ${data.yourName}`,
                `Work Email: ${data.email}`,
                '',
                'Message:',
                data.message,
            ].join('\n')
        );
        const to = CONTACT_RECIPIENTS.map(encodeURIComponent).join(',');
        return `mailto:${to}?subject=${subject}&body=${body}`;
    }

    function applyEmbedMode() {
        try {
            const embed = new URLSearchParams(window.location.search).get('embed') === '1';
            if (embed) document.body.classList.add('ac-embed');
        } catch { /* ignore */ }
    }

    function ensureRfqDraftWrap() {
        let wrap = qs('#acRfqDraftWrap');
        if (wrap) return wrap;
        const status = qs('#acFormStatus');
        if (!status?.parentNode) return null;
        wrap = document.createElement('p');
        wrap.id = 'acRfqDraftWrap';
        wrap.className = 'ac-rfq-draft';
        wrap.hidden = true;
        status.parentNode.insertBefore(wrap, status.nextSibling);
        return wrap;
    }

    function showRfqDraftActions(payload) {
        const wrap = ensureRfqDraftWrap();
        const url = String(payload?.rfqDraftUrl || '').trim();
        if (!wrap || !url) return;
        const label = t('contact.rfqDraft.link') || 'Open draft quotation (print / PDF)';
        wrap.innerHTML = `<a class="ac-rfq-draft-link" href="${url.replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer">${label}</a>`;
        wrap.hidden = false;
    }

    async function submitInquiry(form, data, status, submitBtn, rawType) {
        if (submitBtn) submitBtn.disabled = true;
        setStatus(status, 'success', t('contact.status.sending') || 'Sending…');
        const draftWrap = qs('#acRfqDraftWrap');
        if (draftWrap) {
            draftWrap.hidden = true;
            draftWrap.textContent = '';
        }

        try {
            const res = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    companyName: data.companyName,
                    yourName: data.yourName,
                    email: data.email,
                    inquiryType: data.inquiryType,
                    message: data.message,
                    source: 'about-contact',
                    ...collectAttributionForSubmit(),
                }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload.message || payload.error || 'Send failed');
            }

            let okMsg = t('contact.status.ok') || 'Thank you.';
            if (payload.delivery?.method === 'email') {
                okMsg = t('contact.status.okEmail') || okMsg;
            }
            if (rawType === 'rfq') {
                okMsg = t('contact.status.okRfq') || `${okMsg} Our team will send pricing within 12 hours.`;
            }
            setStatus(status, 'success', okMsg);
            globalThis.TVC_MarketingAnalytics?.trackLeadFormSubmit({
                inquiry_type: rawType || data.inquiryType,
                delivery: payload.delivery?.method || 'email',
            });
            if (rawType === 'rfq' && payload.rfqDraftUrl) {
                showRfqDraftActions(payload);
            }
            form.reset();
        } catch (err) {
            console.warn('[about-contact] API send failed, falling back to mailto', err);
            setStatus(status, 'success', t('contact.status.mailto') || 'Opening email…');
            window.location.href = buildMailtoUrl(data);
            window.setTimeout(() => {
                setStatus(
                    status,
                    'success',
                    t('contact.status.mailtoFallback') || 'Use the email link if needed.'
                );
            }, 1200);
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    }

    function buildRfqPrefill(code, name, port) {
        const portPart = String(port || '').trim();
        if (portPart) {
            const portTemplate =
                t('contact.campaign.rfqPort') ||
                'Inquiring about supply/quote and logistics at [port] operational hub…';
            return portTemplate.replace('[port]', portPart);
        }
        const codePart = String(code || '').trim();
        const namePart = String(name || '').trim();
        const template =
            t('contact.campaign.rfq') ||
            'Inquiring about supply/quote for IMPA [code][name]…';
        return template
            .replace('[code]', codePart || '—')
            .replace('[name]', namePart ? ` (${namePart})` : '');
    }

    function buildFleetTrialPrefill(fleetSize) {
        const size = String(fleetSize || '').trim();
        const template =
            t('contact.campaign.fleetTrialPilot') ||
            t('contact.campaign.fleetTrial') ||
            'Requesting 30-day pilot for [fleet size] vessels…';
        return template.replace('[fleet size]', size || 'our');
    }

    function readStoredAttribution() {
        try {
            const raw = sessionStorage.getItem('tvc_inbound');
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    function buildPocPrefill(refPath) {
        const template =
            t('contact.campaign.poc') ||
            '14-day free PoC (1 ship). Fleet size, department (Deck/Engine), and main pain point: ';
        const ref = String(refPath || '').trim();
        return ref ? `${template}\n\nLanding: ${ref}` : template;
    }

    function buildSalesPrefill() {
        return (
            t('contact.campaign.sales') ||
            'Enterprise / multi-vessel pricing. Fleet size, current PMS, and timeline: '
        );
    }

    function applyInboundCampaignParams() {
        const params = new URLSearchParams(window.location.search);
        const inquiry = String(params.get('inquiry') || '').trim().toLowerCase();
        const impaCode = String(params.get('code') || '').trim();
        const itemName = String(params.get('name') || '').trim();
        const portName = String(params.get('port') || '').trim();
        const rfqQty = String(params.get('qty') || '').trim();
        const rfqContact = String(params.get('contact') || '').trim();
        const fleetSize = String(params.get('fleet') || params.get('vessels') || '').trim();
        const refParam = String(params.get('ref') || '').trim();
        const stored = readStoredAttribution();
        const landingRef = refParam || stored?.landing || '';
        const typeSelect = qs('#acInquiryType');
        const message = qs('#acMessage');

        if (inquiry === 'rfq') {
            if (typeSelect) typeSelect.value = 'rfq';
            if (message && !String(message.value || '').trim()) {
                let body = buildRfqPrefill(impaCode, itemName, portName);
                if (rfqQty) body += `\nQty: ${rfqQty}`;
                if (rfqContact) body += `\nContact: ${rfqContact}`;
                if (landingRef) body += `\n\nPage: ${landingRef}`;
                message.value = body;
            }
            return;
        }
        if (
            inquiry === 'tvc-sm-demo'
            || inquiry === 'fleet-trial'
            || inquiry === 'poc'
        ) {
            if (typeSelect) typeSelect.value = 'demo';
            if (message && !String(message.value || '').trim()) {
                if (inquiry === 'fleet-trial') {
                    message.value = buildFleetTrialPrefill(fleetSize);
                } else if (inquiry === 'poc') {
                    message.value = buildPocPrefill(landingRef);
                } else {
                    message.value = t('contact.campaign.demo') || buildPocPrefill(landingRef);
                }
            }
            return;
        }
        if (inquiry === 'sales' || inquiry === 'enterprise') {
            if (typeSelect) typeSelect.value = 'demo';
            if (message && !String(message.value || '').trim()) {
                message.value = buildSalesPrefill();
            }
            return;
        }
        if (inquiry === 'engineering' || inquiry === 'services') {
            if (typeSelect) typeSelect.value = 'engineering';
            if (message && !String(message.value || '').trim()) {
                message.value =
                    t('contact.campaign.engineering') ||
                    'Field engineering / superintendent support. Vessel, port, and scope: ';
            }
            return;
        }
        if (inquiry === 'toolkit-pro') {
            if (typeSelect) typeSelect.value = 'partnership';
            if (message && !String(message.value || '').trim()) {
                message.value = t('contact.campaign.toolkitPro') || '';
            }
        }
    }

    function collectAttributionForSubmit() {
        const params = new URLSearchParams(window.location.search);
        const stored = readStoredAttribution();
        const mkt = globalThis.TVC_Attribution?.get?.() || {};
        return {
            landingPage: String(params.get('ref') || stored?.landing || mkt.landing || window.location.pathname || '').trim(),
            referrer: String(stored?.referrer || mkt.referrer || document.referrer || '').trim(),
            campaign: String(params.get('inquiry') || params.get('utm_campaign') || mkt.utmCampaign || '').trim(),
            impaCode: String(params.get('code') || '').trim(),
            itemName: String(params.get('name') || '').trim(),
            port: String(params.get('port') || '').trim(),
            utmSource: String(params.get('utm_source') || mkt.utmSource || stored?.utmSource || '').trim(),
            utmMedium: String(params.get('utm_medium') || mkt.utmMedium || stored?.utmMedium || '').trim(),
            utmCampaign: String(params.get('utm_campaign') || mkt.utmCampaign || stored?.utmCampaign || '').trim(),
            utmContent: String(params.get('utm_content') || mkt.utmContent || stored?.utmContent || '').trim(),
            utmTerm: String(params.get('utm_term') || mkt.utmTerm || stored?.utmTerm || '').trim(),
        };
    }

    function init() {
        applyEmbedMode();
        applyInboundCampaignParams();

        const emailLink = qs('#acContactEmail');
        if (emailLink) {
            emailLink.textContent = CONTACT_DISPLAY;
            emailLink.href = `mailto:${CONTACT_RECIPIENTS.join(',')}`;
        }

        const form = qs('#acContactForm');
        const status = qs('#acFormStatus');
        const submitBtn = qs('#acSubmitBtn');
        if (!form) return;

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const fd = new FormData(form);
            const rawType = String(fd.get('inquiryType') || '');
            const data = {
                companyName: String(fd.get('companyName') || '').trim(),
                yourName: String(fd.get('yourName') || '').trim(),
                email: String(fd.get('email') || '').trim(),
                emailConfirm: String(fd.get('emailConfirm') || '').trim(),
                inquiryType: inquiryLabel(rawType),
                message: String(fd.get('message') || '').trim(),
            };

            if (!data.companyName || !data.yourName || !data.email || !data.emailConfirm || !data.message || !rawType) {
                setStatus(status, 'error', t('contact.err.required') || 'Required fields missing.');
                return;
            }

            if (!isValidEmail(data.email)) {
                setStatus(status, 'error', t('contact.err.email') || 'Invalid email.');
                return;
            }

            if (data.email.toLowerCase() !== data.emailConfirm.toLowerCase()) {
                setStatus(status, 'error', t('contact.err.mismatch') || 'Emails do not match.');
                return;
            }

            submitInquiry(form, data, status, submitBtn, rawType);
        });

        globalThis.addEventListener('tvc-mkt-lang', () => {
            applyInboundCampaignParams();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
