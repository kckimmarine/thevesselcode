/* THE VESSEL CODE — IMPA detail share, toast, standalone plate lightbox */
const TVC_ImpaDetailShared = (function () {
    const SHARE_ORIGIN = 'https://thevesselcode.com';
    const WA_NUMBER = '821038894291';
    const RFQ_PORTS = ['Busan', 'Ulsan', 'Yeosu', 'Singapore', 'Rotterdam', 'Incheon', 'Other'];
    const TOP_REQUISITION_CHAPTERS = new Set(['23', '59', '61', '81']);
    const RFQ_NOTIFY_EMAIL = 'rfq@thevesselcode.com';
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

    function landCompatName(item) {
        return String(item?.land_compat_name || '').trim();
    }

    function formatRfqItemLabel(item) {
        const code = String(item?.impa_code || item?.code || '').trim();
        const land = landCompatName(item);
        const name = String(item?.name || item?.cleanTitle || '').trim();
        const label = land || name;
        return code ? `[IMPA ${code}] ${label}` : label;
    }

    function buildLandMarineCopyText(item) {
        const code = String(item?.impa_code || item?.code || '').trim();
        const lines = [
            formatRfqItemLabel(item),
            item?.name ? `IMPA description: ${item.name}` : '',
            landCompatName(item) ? `Land/plant cross-ref: ${landCompatName(item)}` : '',
            Array.isArray(item?.industrial_tags) && item.industrial_tags.length
                ? `Industrial tags: ${item.industrial_tags.join(', ')}`
                : '',
            item?.unit ? `Unit: ${item.unit}` : '',
            item?.category ? `Category: ${item.category}` : '',
            code ? `Catalog: ${storeShareUrl(code)}` : '',
        ].filter(Boolean);
        return lines.join('\n');
    }

    async function copyLandMarineSpecs(item) {
        const text = buildLandMarineCopyText(item);
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.setAttribute('readonly', '');
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                ta.remove();
            }
            showToast('Land & marine specs copied');
            return true;
        } catch (err) {
            console.warn('[impa-detail] spec copy failed', err);
            showToast('Could not copy specs');
            return false;
        }
    }

    function buildWhatsAppRfqUrl(code, name, qty, port, landCompat) {
        const q = Math.max(1, parseInt(String(qty || '1'), 10) || 1);
        const portPart = port ? ` · Port: ${port}` : '';
        const landPart = landCompat ? ` · Land spec: ${landCompat}` : '';
        const text = `Fast RFQ — IMPA ${code}${name ? ` (${name})` : ''}${landPart}. Qty: ${q}${portPart}. Contact:`;
        return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;
    }

    function buildMailtoRfqUrl({ code, name, qty, port, contact, landCompat }) {
        const subject = encodeURIComponent(`RFQ IMPA ${code}${landCompat ? ` — ${landCompat}` : ''}`);
        const body = encodeURIComponent(
            `IMPA: ${code}\nItem: ${name}\nLand/plant: ${landCompat || '—'}\nQty: ${qty}\nPort: ${port}\nContact: ${contact}\n`,
        );
        return `mailto:${RFQ_NOTIFY_EMAIL}?subject=${subject}&body=${body}`;
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
                    <input id="impaFastRfqCode" name="code" type="hidden">
                    <input id="impaFastRfqName" name="name" type="hidden">
                    <input id="impaFastRfqLandCompat" name="land_compat_name" type="hidden">
                    <div class="impa-fast-rfq-field">
                        <label for="impaFastRfqItem">Item</label>
                        <input id="impaFastRfqItem" name="item" type="text" readonly autocomplete="off">
                    </div>
                    <div class="impa-fast-rfq-row">
                        <div class="impa-fast-rfq-field impa-fast-rfq-qty-stepper">
                            <label for="impaFastRfqQty">Quantity</label>
                            <div class="impa-qty-stepper">
                                <button type="button" class="impa-qty-step" data-qty-step="-1" aria-label="Decrease quantity">−</button>
                                <input id="impaFastRfqQty" name="qty" type="number" min="1" step="1" value="1" inputmode="numeric" required>
                                <button type="button" class="impa-qty-step" data-qty-step="1" aria-label="Increase quantity">+</button>
                            </div>
                        </div>
                        <div class="impa-fast-rfq-field">
                            <label for="impaFastRfqPort">Target delivery port</label>
                            <select id="impaFastRfqPort" name="port" required>${portOptions}</select>
                        </div>
                    </div>
                    <div class="impa-fast-rfq-field hidden" id="impaFastRfqPortOtherWrap">
                        <label for="impaFastRfqPortOther">Other port</label>
                        <input id="impaFastRfqPortOther" name="port_other" type="text" autocomplete="off" placeholder="Port / terminal name">
                    </div>
                    <div class="impa-fast-rfq-field">
                        <label for="impaFastRfqContact">Contact (Email or WhatsApp)</label>
                        <input id="impaFastRfqContact" name="contact" type="text" inputmode="email" autocomplete="email" placeholder="you@company.com or +82 10-0000-0000" required>
                    </div>
                    <button type="submit" class="impa-fast-rfq-submit">Submit Fast RFQ</button>
                    <p class="impa-fast-rfq-hint">Sent to our Busan supply desk — typical response within 12h.</p>
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
            modal.querySelector('#impaFastRfqPort')?.addEventListener('change', (e) => {
                const wrap = modal.querySelector('#impaFastRfqPortOtherWrap');
                const isOther = e.target.value === 'Other';
                wrap?.classList.toggle('hidden', !isOther);
            });
            modal.querySelectorAll('[data-qty-step]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const input = modal.querySelector('#impaFastRfqQty');
                    if (!input) return;
                    const delta = Number(btn.getAttribute('data-qty-step')) || 0;
                    const next = Math.max(1, (parseInt(input.value, 10) || 1) + delta);
                    input.value = String(next);
                });
            });
            modal.querySelector('#impaFastRfqForm')?.addEventListener('submit', async (e) => {
                e.preventDefault();
                const form = e.target;
                const code = form.code?.value?.trim() || '';
                const name = form.name?.value?.trim() || '';
                const landCompat = form.land_compat_name?.value?.trim() || '';
                const qty = form.qty?.value || '1';
                let port = form.port?.value || '';
                if (port === 'Other') {
                    port = form.port_other?.value?.trim() || 'Other';
                }
                const contact = form.contact?.value?.trim() || '';
                const ref = form.dataset.ref || '';
                const payload = {
                    code,
                    name,
                    qty,
                    port,
                    contact,
                    ref,
                    land_compat_name: landCompat,
                    source: 'impa_fast_rfq',
                };
                try {
                    const res = await fetch('/api/rfq-submit', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    });
                    if (res.ok) {
                        showToast('RFQ submitted — supply desk notified');
                        closeFastRfqModal();
                        return;
                    }
                } catch (err) {
                    console.warn('[impa-detail] rfq-submit', err);
                }
                if (contact.includes('@')) {
                    window.location.href = buildMailtoRfqUrl({
                        code, name, qty, port, contact, landCompat,
                    });
                    return;
                }
                window.location.href = buildWhatsAppRfqUrl(code, name, qty, port, landCompat);
            });
        }
        return modal;
    }

    function stockSlaHtml() {
        return `
            <div class="impa-stock-sla-col impa-stock-col">
                <p class="impa-stock-sla-main">🟢 In-Stock: Busan Logistics Hub &amp; Singapore Transit Ready</p>
                <p class="impa-stock-sla-sub">Immediate dispatch available</p>
            </div>
            <div class="impa-stock-sla-col impa-sla-col">
                <p class="impa-stock-sla-main">⚡ 24~48h Direct Port Delivery &amp; Bonded Transit (Gangway Delivery)</p>
                <p class="impa-stock-sla-sub">Launch boat / gangway hand-off at berth</p>
            </div>`;
    }

    function escLandText(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function trustHeaderHtml(item) {
        const topHidden = isTopRequisitionedItem(item) ? '' : ' hidden';
        const land = landCompatName(item);
        const landSpan = land
            ? `<span class="impa-trust-badge impa-trust-badge-land" id="impaDetailLandCompat" data-impa-land-badge>🏭 Land/Plant Compatible: ${escLandText(land)}</span>`
            : '<span class="impa-trust-badge impa-trust-badge-land hidden" id="impaDetailLandCompat" data-impa-land-badge></span>';
        return `
            <span class="impa-trust-badge impa-trust-badge-hot${topHidden}" id="impaDetailBadgeTop" data-impa-top-badge>🔥 Top Requisitioned Fleet Standard</span>
            <span class="impa-trust-badge impa-trust-badge-verified">✓ 1st Class Superintendent Verified (Zero-Mismatch Guarantee)</span>
            ${landSpan}`;
    }

    function paintTrustAndStock(root, item) {
        if (!root) return;
        const trust = root.querySelector('#impaDetailTrustHeader, [data-impa-trust-header]');
        if (trust) trust.innerHTML = trustHeaderHtml(item);
        const stock = root.querySelector('#impaDetailStockSla, [data-impa-stock-sla]');
        if (stock) stock.innerHTML = stockSlaHtml();
    }

    function openFastRfqModal({ code, name, qty, port, ref, land_compat_name, item } = {}) {
        const modal = ensureFastRfqModal();
        const form = modal.querySelector('#impaFastRfqForm');
        const codeEl = modal.querySelector('#impaFastRfqCode');
        const nameEl = modal.querySelector('#impaFastRfqName');
        const landEl = modal.querySelector('#impaFastRfqLandCompat');
        const itemEl = modal.querySelector('#impaFastRfqItem');
        const qtyEl = modal.querySelector('#impaFastRfqQty');
        const portEl = modal.querySelector('#impaFastRfqPort');
        const contactEl = modal.querySelector('#impaFastRfqContact');
        const ctx = item || { impa_code: code, code, name, land_compat_name };
        if (codeEl) codeEl.value = code || '';
        if (nameEl) nameEl.value = name || '';
        if (landEl) landEl.value = land_compat_name || landCompatName(ctx) || '';
        if (itemEl) itemEl.value = formatRfqItemLabel(ctx);
        if (qtyEl) qtyEl.value = String(Math.max(1, parseInt(String(qty || '1'), 10) || 1));
        if (portEl) {
            if (port && RFQ_PORTS.includes(port)) portEl.value = port;
            else portEl.value = 'Busan';
        }
        modal.querySelector('#impaFastRfqPortOtherWrap')?.classList.add('hidden');
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
        paintTrustAndStock(root, item);
        const code = String(item.impa_code || item.code || '').trim();
        const name = String(item.name || item.cleanTitle || '').trim();
        const rfqBtn = root.querySelector('#btn-modal-rfq') || root.querySelector('[data-impa-fast-rfq]');
        const waBtn = root.querySelector('#btn-modal-wa') || root.querySelector('[data-impa-wa-rfq]');
        const copyBtn = root.querySelector('#btn-copy-land-specs') || root.querySelector('[data-impa-copy-specs]');
        const qtyInput = root.querySelector('#impaDetailQty, [data-impa-rfq-qty]');
        const ref = code ? `/store/${code}` : '';
        const syncWa = () => {
            if (!waBtn) return;
            const qty = qtyInput?.value || '1';
            waBtn.href = buildWhatsAppRfqUrl(code, name, qty, 'Busan', landCompatName(item));
        };
        syncWa();
        qtyInput?.addEventListener('input', syncWa);
        if (rfqBtn) {
            rfqBtn.onclick = (e) => {
                e.preventDefault();
                const qty = qtyInput?.value || '1';
                openFastRfqModal({ code, name, qty, ref, item });
            };
        }
        if (copyBtn) {
            copyBtn.onclick = (e) => {
                e.preventDefault();
                copyLandMarineSpecs(item);
            };
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
        const host = document.querySelector('[data-impa-item-code]');
        const code = host?.getAttribute('data-impa-item-code') || '';
        const name = host?.getAttribute('data-impa-item-name') || '';
        const land = host?.getAttribute('data-impa-land-compat') || '';
        const tagsRaw = host?.getAttribute('data-impa-industrial-tags') || '';
        let industrial_tags = [];
        try {
            industrial_tags = tagsRaw ? JSON.parse(tagsRaw) : [];
        } catch { /* ignore */ }
        const item = {
            impa_code: code,
            code,
            name,
            land_compat_name: land,
            industrial_tags,
        };
        paintTrustAndStock(document, item);
        bindCommerceActions(document.body, item);
    }

    return {
        storeShareUrl,
        showToast,
        copyShareLink,
        copyLandMarineSpecs,
        formatRfqItemLabel,
        isTopRequisitionedItem,
        buildWhatsAppRfqUrl,
        buildContactRfqUrl,
        paintTrustAndStock,
        stockSlaHtml,
        openFastRfqModal,
        closeFastRfqModal,
        bindCommerceActions,
        initStandalonePage,
        openStandaloneLightbox,
        closeStandaloneLightbox,
    };
})();
