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
            poc: 'contact.inquiry.poc',
            sales: 'contact.inquiry.sales',
            enterprise: 'contact.inquiry.enterprise',
            partnership: 'contact.inquiry.partnership',
            support: 'contact.inquiry.support',
            general: 'contact.inquiry.general',
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

    async function submitInquiry(form, data, status, submitBtn) {
        if (submitBtn) submitBtn.disabled = true;
        setStatus(status, 'success', t('contact.status.sending') || 'Sending…');

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
                }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload.message || payload.error || 'Send failed');
            }

            if (payload.delivery?.method === 'email') {
                setStatus(status, 'success', t('contact.status.okEmail') || 'Thank you.');
            } else {
                setStatus(status, 'success', t('contact.status.ok') || 'Thank you.');
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

    function setInquiryTypeFromQuery(inquiryRaw) {
        const inquiry = String(inquiryRaw || '').trim().toLowerCase();
        if (!inquiry) return;
        const typeSelect = qs('#acInquiryType');
        const message = qs('#acMessage');
        if (!typeSelect) return;

        const prefilledMessage = (i18nKey) => {
            if (message && !String(message.value || '').trim()) {
                message.value = t(i18nKey) || '';
            }
        };

        const saasKeys = ['poc', 'sales', 'enterprise'];
        if (saasKeys.includes(inquiry) && typeSelect.querySelector(`option[value="${inquiry}"]`)) {
            typeSelect.value = inquiry;
            prefilledMessage(`contact.campaign.${inquiry}`);
            return;
        }

        if (inquiry === 'tvc-sm-demo' || inquiry === 'fleet-trial') {
            typeSelect.value = 'demo';
            prefilledMessage(inquiry === 'fleet-trial' ? 'contact.campaign.fleetTrial' : 'contact.campaign.demo');
            return;
        }
        if (inquiry === 'toolkit-pro') {
            typeSelect.value = 'partnership';
            prefilledMessage('contact.campaign.toolkitPro');
        }
    }

    function applyInboundCampaignParams() {
        try {
            const params = new URLSearchParams(window.location.search);
            setInquiryTypeFromQuery(params.get('inquiry'));
        } catch { /* ignore */ }
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

            submitInquiry(form, data, status, submitBtn);
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
