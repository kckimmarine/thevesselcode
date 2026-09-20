/* THE VESSEL CODE — IMPA detail share, toast, standalone plate lightbox */
const TVC_ImpaDetailShared = (function () {
    const SHARE_ORIGIN = 'https://thevesselcode.com';
    const WA_NUMBER = '821038894291';
    const RFQ_PORTS = ['Busan', 'Singapore', 'Rotterdam', 'Incheon', 'Ulsan'];
    const TOP_REQUISITION_CHAPTERS = new Set([
        '31', '33', '55', '59', '61', '75', '79', '87',
    ]);
    let _toastTimer = null;
    let _fsZoom = null;
    let _fastRfqBound = false;

    function storeShareUrl(code) {
        const normalized = String(code || '').trim().replace(/\D/g, '').padStart(6, '0').slice(-6);
        return `${SHARE_ORIGIN}/store/${normalized}`;
    }

    function showToast(message) {
        let el = document.getElementById('impaDetailToast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'impaDetailToast';
            el.className = 'impa-detail-toast';
            el.setAttribute('role', 'status');
            el.setAttribute('aria-live', 'polite');
            document.body.appendChild(el);
        }
        el.textContent = message || 'Link copied to clipboard!';
        el.classList.add('is-visible');
        if (_toastTimer) clearTimeout(_toastTimer);
        _toastTimer = setTimeout(() => {
            el.classList.remove('is-visible');
        }, 2400);
    }

    async function copyShareLink(code) {
        const url = storeShareUrl(code);
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(url);
            } else {
                const ta = document.createElement('textarea');
                ta.value = url;
                ta.setAttribute('readonly', '');
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                ta.remove();
            }
            showToast('Link copied to clipboard!');
            return true;
        } catch (err) {
            console.warn('[impa-detail] share copy failed', err);
            showToast('Could not copy link');
            return false;
        }
    }

    function touchDistance(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.hypot(dx, dy);
    }

    function createZoomController(viewport, stage, { minScale = 1, maxScale = 6 } = {}) {
        let scale = 1;
        let tx = 0;
        let ty = 0;
        let pinching = false;
        let panning = false;
        let lastDist = 0;
        let lastX = 0;
        let lastY = 0;

        function apply() {
            stage.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
            viewport.classList.toggle('is-zoomed', scale > 1.02);
        }

        function reset() {
            scale = 1;
            tx = 0;
            ty = 0;
            pinching = false;
            panning = false;
            apply();
        }

        function clampScale(next) {
            return Math.min(maxScale, Math.max(minScale, next));
        }

        viewport.addEventListener('wheel', (e) => {
            if (!stage.querySelector('img')) return;
            e.preventDefault();
            const factor = e.deltaY > 0 ? 0.92 : 1.08;
            const next = clampScale(scale * factor);
            if (next <= 1) {
                reset();
                return;
            }
            scale = next;
            apply();
        }, { passive: false });

        viewport.addEventListener('pointerdown', (e) => {
            if (!stage.querySelector('img')) return;
            if (e.pointerType === 'touch') return;
            if (scale <= 1) return;
            panning = true;
            lastX = e.clientX;
            lastY = e.clientY;
            viewport.setPointerCapture?.(e.pointerId);
        });

        viewport.addEventListener('pointermove', (e) => {
            if (!panning) return;
            tx += e.clientX - lastX;
            ty += e.clientY - lastY;
            lastX = e.clientX;
            lastY = e.clientY;
            apply();
        });

        viewport.addEventListener('pointerup', () => { panning = false; });
        viewport.addEventListener('pointercancel', () => { panning = false; });

        viewport.addEventListener('touchstart', (e) => {
            if (!stage.querySelector('img')) return;
            if (e.touches.length === 2) {
                pinching = true;
                lastDist = touchDistance(e.touches);
            } else if (e.touches.length === 1 && scale > 1) {
                panning = true;
                lastX = e.touches[0].clientX;
                lastY = e.touches[0].clientY;
            }
        }, { passive: true });

        viewport.addEventListener('touchmove', (e) => {
            if (pinching && e.touches.length === 2) {
                e.preventDefault();
                const dist = touchDistance(e.touches);
                if (lastDist > 0) {
                    scale = clampScale(scale * (dist / lastDist));
                    if (scale <= 1) reset();
                    else apply();
                }
                lastDist = dist;
            } else if (panning && e.touches.length === 1) {
                tx += e.touches[0].clientX - lastX;
                ty += e.touches[0].clientY - lastY;
                lastX = e.touches[0].clientX;
                lastY = e.touches[0].clientY;
                apply();
            }
        }, { passive: false });

        viewport.addEventListener('touchend', () => {
            pinching = false;
            panning = false;
            lastDist = 0;
        }, { passive: true });

        return { reset };
    }

    function ensureStandaloneLightbox() {
        let fs = document.getElementById('impaPlateFullscreen');
        if (fs) return fs;
        fs = document.createElement('div');
        fs.id = 'impaPlateFullscreen';
        fs.className = 'impa-plate-fullscreen impa-plate-lightbox-unified hidden';
        fs.setAttribute('aria-hidden', 'true');
        fs.innerHTML = `
            <div class="impa-plate-fullscreen-backdrop"></div>
            <div class="impa-plate-fullscreen-panel" role="dialog" aria-label="Enlarged catalog plate">
                <header class="impa-plate-fullscreen-head">
                    <span id="impaPlateFullscreenTitle">Catalog plate</span>
                    <button type="button" class="impa-plate-fullscreen-close" aria-label="Close enlarged view">✕</button>
                </header>
                <div class="impa-plate-fullscreen-viewport" id="impaPlateFullscreenViewport">
                    <div class="impa-plate-fullscreen-stage" id="impaPlateFullscreenStage">
                        <img id="impaPlateFullscreenImg" class="impa-plate-fullscreen-img" alt="">
                    </div>
                </div>
            </div>`;
        document.body.appendChild(fs);
        const close = () => closeStandaloneLightbox();
        fs.querySelector('.impa-plate-fullscreen-backdrop')?.addEventListener('click', close);
        fs.querySelector('.impa-plate-fullscreen-close')?.addEventListener('click', close);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !fs.classList.contains('hidden')) close();
        });
        const vp = fs.querySelector('#impaPlateFullscreenViewport');
        const st = fs.querySelector('#impaPlateFullscreenStage');
        if (vp && st) _fsZoom = createZoomController(vp, st);
        return fs;
    }

    function openStandaloneLightbox(src, title, alt) {
        if (!src) return;
        const fs = ensureStandaloneLightbox();
        const img = fs.querySelector('#impaPlateFullscreenImg');
        const titleEl = fs.querySelector('#impaPlateFullscreenTitle');
        if (titleEl) titleEl.textContent = title || 'Catalog plate';
        if (img) {
            img.src = src;
            img.alt = alt || title || 'IMPA catalog plate';
        }
        fs.classList.remove('hidden');
        fs.setAttribute('aria-hidden', 'false');
        _fsZoom?.reset();
    }

    function closeStandaloneLightbox() {
        const fs = document.getElementById('impaPlateFullscreen');
        if (!fs) return;
        fs.classList.add('hidden');
        fs.setAttribute('aria-hidden', 'true');
        _fsZoom?.reset();
    }

    function chapterFromCode(code) {
        const digits = String(code || '').replace(/\D/g, '');
        if (digits.length < 2) return '';
        return digits.slice(0, 2);
    }

    function isTopRequisitionedItem(itemOrCode) {
        const code = typeof itemOrCode === 'object'
            ? (itemOrCode?.impa_code || itemOrCode?.code || '')
            : itemOrCode;
        return TOP_REQUISITION_CHAPTERS.has(chapterFromCode(code));
    }

    function buildWhatsAppRfqUrl(code, name, qty, port) {
        const q = Math.max(1, parseInt(String(qty || '1'), 10) || 1);
        const portPart = port ? ` · Port: ${port}` : '';
        const text = `Fast RFQ — IMPA ${code}${name ? ` (${name})` : ''}. Qty: ${q}${portPart}. Contact:`;
        return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;
    }

    function buildContactRfqUrl({ code, name, qty, port, contact, ref }) {
        const params = new URLSearchParams();
        params.set('inquiry', 'rfq');
        if (code) params.set('code', code);
        if (name) params.set('name', name);
        if (port) params.set('port', port);
        if (ref) params.set('ref', ref);
        const q = Math.max(1, parseInt(String(qty || '1'), 10) || 1);
        params.set('qty', String(q));
        const contactLine = String(contact || '').trim();
        if (contactLine) params.set('contact', contactLine);
        return `/contact-us?${params.toString()}`;
    }

    function ensureFastRfqModal() {
        let modal = document.getElementById('impaFastRfqModal');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.id = 'impaFastRfqModal';
        modal.className = 'impa-fast-rfq-modal hidden';
        modal.setAttribute('aria-hidden', 'true');
        const portOptions = RFQ_PORTS.map(
            (p) => `<option value="${p}">${p}</option>`
        ).join('');
        modal.innerHTML = `
            <div class="impa-fast-rfq-backdrop" data-fast-rfq-close></div>
            <div class="impa-fast-rfq-panel" role="dialog" aria-modal="true" aria-labelledby="impaFastRfqTitle">
                <header class="impa-fast-rfq-head">
                    <h3 id="impaFastRfqTitle">📋 1-Click Fast RFQ</h3>
                    <button type="button" class="impa-fast-rfq-close" data-fast-rfq-close aria-label="Close">✕</button>
                </header>
                <form id="impaFastRfqForm" class="impa-fast-rfq-form">
                    <div class="impa-fast-rfq-field">
                        <label for="impaFastRfqCode">IMPA Code</label>
                        <input id="impaFastRfqCode" name="code" type="text" readonly autocomplete="off">
                    </div>
                    <div class="impa-fast-rfq-field">
                        <label for="impaFastRfqName">Item</label>
                        <input id="impaFastRfqName" name="name" type="text" readonly autocomplete="off">
                    </div>
                    <div class="impa-fast-rfq-row">
                        <div class="impa-fast-rfq-field">
                            <label for="impaFastRfqQty">Qty</label>
                            <input id="impaFastRfqQty" name="qty" type="number" min="1" step="1" value="1" inputmode="numeric" required>
                        </div>
                        <div class="impa-fast-rfq-field">
                            <label for="impaFastRfqPort">Delivery port</label>
                            <select id="impaFastRfqPort" name="port" required>${portOptions}</select>
                        </div>
                    </div>
                    <div class="impa-fast-rfq-field">
                        <label for="impaFastRfqContact">Contact (Email or WhatsApp)</label>
                        <input id="impaFastRfqContact" name="contact" type="text" inputmode="email" autocomplete="email" placeholder="you@company.com or +82 10-0000-0000" required>
                    </div>
                    <button type="submit" class="impa-fast-rfq-submit">Continue to RFQ form →</button>
                    <p class="impa-fast-rfq-hint">Pre-fills our contact form with this IMPA line — no account required.</p>
                </form>
            </div>`;
        document.body.appendChild(modal);
        if (!_fastRfqBound) {
            _fastRfqBound = true;
            modal.addEventListener('click', (e) => {
                if (e.target.closest('[data-fast-rfq-close]')) closeFastRfqModal();
            });
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
                    closeFastRfqModal();
                }
            });
            modal.querySelector('#impaFastRfqForm')?.addEventListener('submit', (e) => {
                e.preventDefault();
                const form = e.target;
                const code = form.code?.value?.trim() || '';
                const name = form.name?.value?.trim() || '';
                const qty = form.qty?.value || '1';
                const port = form.port?.value || '';
                const contact = form.contact?.value?.trim() || '';
                const ref = form.dataset.ref || '';
                const url = buildContactRfqUrl({ code, name, qty, port, contact, ref });
                window.location.href = url;
            });
        }
        return modal;
    }

    function openFastRfqModal({ code, name, qty, port, ref } = {}) {
        const modal = ensureFastRfqModal();
        const form = modal.querySelector('#impaFastRfqForm');
        const codeEl = modal.querySelector('#impaFastRfqCode');
        const nameEl = modal.querySelector('#impaFastRfqName');
        const qtyEl = modal.querySelector('#impaFastRfqQty');
        const portEl = modal.querySelector('#impaFastRfqPort');
        const contactEl = modal.querySelector('#impaFastRfqContact');
        if (codeEl) codeEl.value = code || '';
        if (nameEl) nameEl.value = name || '';
        if (qtyEl) qtyEl.value = String(Math.max(1, parseInt(String(qty || '1'), 10) || 1));
        if (portEl && port && RFQ_PORTS.includes(port)) portEl.value = port;
        if (contactEl) contactEl.value = '';
        if (form) form.dataset.ref = ref || `${window.location.pathname}${window.location.search}`;
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        qtyEl?.focus();
    }

    function closeFastRfqModal() {
        const modal = document.getElementById('impaFastRfqModal');
        if (!modal) return;
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
        const detailOpen = document.getElementById('impaDetailModal') && !document.getElementById('impaDetailModal').classList.contains('hidden');
        if (!detailOpen) document.body.style.overflow = '';
    }

    function bindCommerceActions(root, item) {
        if (!root || !item) return;
        const code = String(item.impa_code || item.code || '').trim();
        const name = String(item.name || item.cleanTitle || '').trim();
        const topBadge = root.querySelector('#impaDetailBadgeTop, [data-impa-top-badge]');
        if (topBadge) topBadge.classList.toggle('hidden', !isTopRequisitionedItem(code));
        const rfqBtn = root.querySelector('#btn-modal-rfq') || document.querySelector('[data-impa-fast-rfq]');
        const waBtn = root.querySelector('#btn-modal-wa') || document.querySelector('[data-impa-wa-rfq]');
        const qtyInput = root.querySelector('#impaDetailQty, [data-impa-rfq-qty]');
        const ref = code ? `/store/${code}` : '';
        if (rfqBtn) {
            rfqBtn.onclick = (e) => {
                e.preventDefault();
                const qty = qtyInput?.value || '1';
                openFastRfqModal({ code, name, qty, ref });
            };
        }
        if (waBtn) {
            const qty = qtyInput?.value || '1';
            waBtn.href = buildWhatsAppRfqUrl(code, name, qty, 'Busan');
        }
    }

    function initStandalonePage() {
        const shareBtn = document.querySelector('[data-impa-share-code]');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => {
                copyShareLink(shareBtn.getAttribute('data-impa-share-code'));
            });
        }
        const plateImg = document.querySelector('.impa-store-plate-img[data-plate-hires]');
        if (plateImg) {
            plateImg.addEventListener('click', () => {
                const src = plateImg.getAttribute('data-plate-hires') || plateImg.getAttribute('src');
                const title = plateImg.getAttribute('data-plate-title') || plateImg.alt;
                openStandaloneLightbox(src, title, plateImg.alt);
            });
        }
        const code = document.querySelector('[data-impa-item-code]')?.getAttribute('data-impa-item-code') || '';
        const name = document.querySelector('[data-impa-item-name]')?.getAttribute('data-impa-item-name') || '';
        const topBadge = document.querySelector('[data-impa-top-badge]');
        if (topBadge) topBadge.classList.toggle('hidden', !isTopRequisitionedItem(code));
        bindCommerceActions(document.body, { impa_code: code, name });
    }

    return {
        storeShareUrl,
        showToast,
        copyShareLink,
        isTopRequisitionedItem,
        buildWhatsAppRfqUrl,
        buildContactRfqUrl,
        openFastRfqModal,
        closeFastRfqModal,
        bindCommerceActions,
        initStandalonePage,
        openStandaloneLightbox,
        closeStandaloneLightbox,
    };
})();
