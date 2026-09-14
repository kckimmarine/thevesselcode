/* THE VESSEL CODE — IMPA detail share, toast, standalone plate lightbox */
const TVC_ImpaDetailShared = (function () {
    const SHARE_ORIGIN = 'https://thevesselcode.com';
    let _toastTimer = null;
    let _fsZoom = null;

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
    }

    return {
        storeShareUrl,
        showToast,
        copyShareLink,
        initStandalonePage,
        openStandaloneLightbox,
        closeStandaloneLightbox,
    };
})();
