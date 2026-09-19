/* THE VESSEL CODE — Maritime Brain conversational modal (marketing home) */
(function () {
    const MODAL_ID = 'modal-tvc-brain';
    const API_PATH = '/api/ask-brain';
    const KAKAO_CHANNEL_URL = 'https://pf.kakao.com/_Txhxnxj';
    const A2HS_DISMISS_KEY = 'tvc-brain-a2hs-dismissed-v1';

    const PHOTO_PROMPT_KO = '[선박 부품/명판 사진 분석 요청]';
    const PHOTO_PROMPT_EN = '[Vessel part/nameplate photo analysis request]';

    const state = {
        lang: 'KO',
        lastQuery: '',
        loading: false,
        deferredPrompt: null,
        heroImageDataUrl: null,
        modalImageDataUrl: null,
        recognition: null,
        listeningScope: null,
    };

    function detectLang() {
        try {
            const stored = localStorage.getItem('tvc-mkt-lang');
            if (stored === 'en') return 'EN';
        } catch (_) { /* ignore */ }
        const docLang = (document.documentElement.lang || '').toLowerCase();
        return docLang.startsWith('en') ? 'EN' : 'KO';
    }

    function t(key) {
        const ko = {
            loading: 'TVC Maritime Intelligence가 분석 중입니다…',
            title: 'THE VESSEL CODE Brain',
            followUp: '추가 질문하기',
            followPlaceholder: '후속 질문을 입력하세요…',
            ask: '질문하기',
            kakao: '💬 카카오톡으로 상담',
            whatsapp: '🟢 WhatsApp Instant Chat',
            close: '닫기',
            error: '응답을 불러오지 못했습니다. 잠시 후 다시 시도하십시오.',
            a2hs: '📲 TVC 해운 브레인을 홈 화면에 앱으로 추가하여 1초 만에 실행하세요',
            install: '설치하기',
            dismiss: '닫기',
            voiceUnsupported: '이 브라우저는 음성 입력을 지원하지 않습니다.',
            voiceError: '음성 인식에 실패했습니다. 다시 시도하십시오.',
        };
        const en = {
            loading: 'TVC Maritime Intelligence is analyzing…',
            title: 'THE VESSEL CODE Brain',
            followUp: 'Ask a follow-up',
            followPlaceholder: 'Type your follow-up question…',
            ask: 'Ask',
            kakao: '💬 KakaoTalk counsel',
            whatsapp: '🟢 WhatsApp Instant Chat',
            close: 'Close',
            error: 'Could not load a response. Please try again shortly.',
            a2hs: '📲 Add TVC Maritime Brain to your home screen for 1-second launch',
            install: 'Install',
            dismiss: 'Dismiss',
            voiceUnsupported: 'Voice input is not supported in this browser.',
            voiceError: 'Speech recognition failed. Please try again.',
        };
        const pack = state.lang === 'EN' ? en : ko;
        return pack[key] || key;
    }

    function escapeHtml(raw) {
        return String(raw || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function renderMarkdown(md) {
        const lines = String(md || '').split('\n');
        const out = [];
        let inCode = false;
        let listOpen = false;

        function closeList() {
            if (listOpen) {
                out.push('</ul>');
                listOpen = false;
            }
        }

        for (let line of lines) {
            if (line.trim().startsWith('```')) {
                closeList();
                if (!inCode) {
                    inCode = true;
                    out.push('<pre class="tvc-brain-code"><code>');
                } else {
                    inCode = false;
                    out.push('</code></pre>');
                }
                continue;
            }
            if (inCode) {
                out.push(`${escapeHtml(line)}\n`);
                continue;
            }

            const h3 = line.match(/^###\s+(.+)/);
            const h2 = line.match(/^##\s+(.+)/);
            const h1 = line.match(/^#\s+(.+)/);
            const bullet = line.match(/^[-*]\s+(.+)/);

            if (h1) {
                closeList();
                out.push(`<h3 class="tvc-brain-h">${inlineMd(h1[1])}</h3>`);
                continue;
            }
            if (h2 || h3) {
                closeList();
                out.push(`<h4 class="tvc-brain-h">${inlineMd((h2 || h3)[1])}</h4>`);
                continue;
            }
            if (bullet) {
                if (!listOpen) {
                    out.push('<ul class="tvc-brain-ul">');
                    listOpen = true;
                }
                out.push(`<li>${inlineMd(bullet[1])}</li>`);
                continue;
            }

            closeList();
            if (!line.trim()) {
                out.push('<br />');
            } else {
                out.push(`<p class="tvc-brain-p">${inlineMd(line)}</p>`);
            }
        }
        closeList();
        if (inCode) out.push('</code></pre>');
        return out.join('');
    }

    function inlineMd(text) {
        let s = escapeHtml(text);
        s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        s = s.replace(/`([^`]+)`/g, '<code class="tvc-brain-inline-code">$1</code>');
        return s;
    }

    function ensureModal() {
        let modal = document.getElementById(MODAL_ID);
        if (modal) return modal;

        modal = document.createElement('div');
        modal.id = MODAL_ID;
        modal.className = 'tvc-brain-modal';
        modal.hidden = true;
        modal.innerHTML = `
            <div class="tvc-brain-backdrop" data-brain-close tabindex="-1" aria-hidden="true"></div>
            <div class="tvc-brain-card" role="dialog" aria-modal="true" aria-labelledby="tvcBrainTitle">
                <header class="tvc-brain-header">
                    <h2 id="tvcBrainTitle" class="tvc-brain-title">${escapeHtml(t('title'))}</h2>
                    <button type="button" class="tvc-brain-close" data-brain-close aria-label="Close">✕</button>
                </header>
                <div class="tvc-brain-body">
                    <div class="tvc-brain-loading" hidden>
                        <span class="tvc-brain-spinner" aria-hidden="true"></span>
                        <p class="tvc-brain-loading-text"></p>
                    </div>
                    <div class="tvc-brain-answer" aria-live="polite"></div>
                </div>
                <footer class="tvc-brain-footer">
                    <form class="tvc-brain-follow" id="tvcBrainFollowForm">
                        <label class="visually-hidden" for="tvcBrainFollowInput">${escapeHtml(t('followUp'))}</label>
                        <div class="tvc-brain-follow-field" id="tvcBrainFollowField">
                            <div class="home-hero-search-thumb" id="tvcBrainFollowThumb" hidden>
                                <img id="tvcBrainFollowThumbImg" alt="" width="44" height="44" />
                                <button type="button" class="home-hero-search-thumb-clear" id="tvcBrainFollowThumbClear" aria-label="Remove photo">×</button>
                            </div>
                            <input id="tvcBrainFollowInput" type="text" autocomplete="off" enterkeyhint="send" placeholder="" />
                            <div class="tvc-brain-follow-inline-actions" aria-label="Voice and camera input">
                                <button type="button" id="btn-voice-input-modal" class="home-hero-input-action" aria-label="Voice input" title="Voice input">🎙️</button>
                                <label for="btn-camera-input-modal" class="home-hero-input-action home-hero-input-action--camera" aria-label="Camera or photo" title="Camera">📷</label>
                                <input type="file" id="btn-camera-input-modal" class="visually-hidden" accept="image/*" capture="environment" tabindex="-1" />
                            </div>
                        </div>
                        <button type="submit" class="home-btn home-btn-primary tvc-brain-follow-btn">${escapeHtml(t('ask'))}</button>
                    </form>
                    <div class="tvc-brain-connectors">
                        <a class="tvc-brain-connector" id="tvcBrainKakao" href="#" target="_blank" rel="noopener noreferrer">${escapeHtml(t('kakao'))}</a>
                        <a class="tvc-brain-connector tvc-brain-connector--wa" id="tvcBrainWhatsApp" href="#" target="_blank" rel="noopener noreferrer">${escapeHtml(t('whatsapp'))}</a>
                    </div>
                </footer>
            </div>`;
        document.body.appendChild(modal);

        modal.querySelectorAll('[data-brain-close]').forEach((el) => {
            el.addEventListener('click', () => closeModal());
        });

        modal.querySelector('#tvcBrainFollowForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const input = modal.querySelector('#tvcBrainFollowInput');
            const q = composeQuery('modal', input);
            if (!q) return;
            input.value = '';
            clearCapture('modal');
            askBrain(q);
        });

        wireInputCapture('modal', {
            voiceBtn: modal.querySelector('#btn-voice-input-modal'),
            cameraInput: modal.querySelector('#btn-camera-input-modal'),
            textInput: modal.querySelector('#tvcBrainFollowInput'),
            thumbWrap: modal.querySelector('#tvcBrainFollowThumb'),
            thumbImg: modal.querySelector('#tvcBrainFollowThumbImg'),
            thumbClear: modal.querySelector('#tvcBrainFollowThumbClear'),
            onAutoSubmit: (query) => askBrain(query),
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !modal.hidden) closeModal();
        });

        return modal;
    }

    function photoPromptTag() {
        return state.lang === 'EN' ? PHOTO_PROMPT_EN : PHOTO_PROMPT_KO;
    }

    function appendPhotoPrompt(input) {
        if (!input) return;
        const tag = photoPromptTag();
        const current = String(input.value || '');
        if (current.includes(tag)) return;
        input.value = current.trim() ? `${current.trim()} ${tag}` : tag;
    }

    function composeQuery(scope, inputEl) {
        const base = String(inputEl?.value || '').trim();
        const tag = photoPromptTag();
        const hasImage = scope === 'hero' ? !!state.heroImageDataUrl : !!state.modalImageDataUrl;
        if (!base && !hasImage) return '';
        if (hasImage && !base.includes(tag)) {
            return base ? `${base} ${tag}` : tag;
        }
        return base;
    }

    function clearCapture(scope) {
        if (scope === 'hero') {
            state.heroImageDataUrl = null;
            const wrap = document.getElementById('homeHeroSearchThumb');
            const img = document.getElementById('homeHeroSearchThumbImg');
            const file = document.getElementById('btn-camera-input');
            if (wrap) wrap.hidden = true;
            if (img) img.removeAttribute('src');
            if (file) file.value = '';
        } else {
            state.modalImageDataUrl = null;
            const wrap = document.getElementById('tvcBrainFollowThumb');
            const img = document.getElementById('tvcBrainFollowThumbImg');
            const file = document.getElementById('btn-camera-input-modal');
            if (wrap) wrap.hidden = true;
            if (img) img.removeAttribute('src');
            if (file) file.value = '';
        }
    }

    function readImageFile(file, scope, inputEl, thumbWrap, thumbImg) {
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = String(reader.result || '');
            if (scope === 'hero') state.heroImageDataUrl = dataUrl;
            else state.modalImageDataUrl = dataUrl;
            if (thumbImg) {
                thumbImg.src = dataUrl;
                thumbImg.alt = state.lang === 'EN' ? 'Attached photo' : '첨부 사진';
            }
            if (thumbWrap) thumbWrap.hidden = false;
            appendPhotoPrompt(inputEl);
        };
        reader.readAsDataURL(file);
    }

    function getSpeechRecognition() {
        const Ctor = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
        if (!Ctor) return null;
        if (!state.recognition) {
            state.recognition = new Ctor();
            state.recognition.interimResults = false;
            state.recognition.maxAlternatives = 1;
        }
        return state.recognition;
    }

    function speechLangs() {
        return state.lang === 'EN' ? ['en-US', 'ko-KR'] : ['ko-KR', 'en-US'];
    }

    function setListeningUi(voiceBtn, on) {
        if (!voiceBtn) return;
        voiceBtn.classList.toggle('is-listening', on);
        voiceBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }

    function startVoiceCapture(scope, voiceBtn, textInput, onAutoSubmit) {
        const rec = getSpeechRecognition();
        if (!rec) {
            window.alert(t('voiceUnsupported'));
            return;
        }
        if (state.listeningScope) {
            try { rec.stop(); } catch (_) { /* ignore */ }
        }
        state.listeningScope = scope;
        rec.lang = speechLangs()[0];
        rec.onstart = () => setListeningUi(voiceBtn, true);
        rec.onend = () => {
            setListeningUi(voiceBtn, false);
            state.listeningScope = null;
        };
        rec.onerror = () => {
            setListeningUi(voiceBtn, false);
            state.listeningScope = null;
            window.alert(t('voiceError'));
        };
        rec.onresult = (event) => {
            const transcript = Array.from(event.results)
                .map((r) => r[0]?.transcript || '')
                .join(' ')
                .trim();
            if (!transcript) return;
            if (textInput) textInput.value = transcript;
            if (scope === 'hero') {
                openModal(composeQuery('hero', textInput) || transcript);
            } else if (typeof onAutoSubmit === 'function') {
                onAutoSubmit(composeQuery('modal', textInput) || transcript);
            }
        };
        try {
            rec.start();
        } catch (err) {
            setListeningUi(voiceBtn, false);
            state.listeningScope = null;
            console.warn('[TVC Brain] speech start failed', err);
            window.alert(t('voiceError'));
        }
    }

    function wireInputCapture(scope, opts) {
        const {
            voiceBtn,
            cameraInput,
            textInput,
            thumbWrap,
            thumbImg,
            thumbClear,
            onAutoSubmit,
        } = opts;
        if (!voiceBtn || !cameraInput || !textInput) return;

        voiceBtn.addEventListener('click', () => {
            startVoiceCapture(scope, voiceBtn, textInput, onAutoSubmit);
        });

        cameraInput.addEventListener('change', () => {
            const file = cameraInput.files && cameraInput.files[0];
            readImageFile(file, scope, textInput, thumbWrap, thumbImg);
        });

        if (thumbClear) {
            thumbClear.addEventListener('click', () => clearCapture(scope));
        }
    }

    function initHeroInputCapture() {
        wireInputCapture('hero', {
            voiceBtn: document.getElementById('btn-voice-input'),
            cameraInput: document.getElementById('btn-camera-input'),
            textInput: document.getElementById('homeHeroSearchInput'),
            thumbWrap: document.getElementById('homeHeroSearchThumb'),
            thumbImg: document.getElementById('homeHeroSearchThumbImg'),
            thumbClear: document.getElementById('homeHeroSearchThumbClear'),
            onAutoSubmit: null,
        });
    }

    function setConnectors(query) {
        const modal = ensureModal();
        const kakao = modal.querySelector('#tvcBrainKakao');
        const wa = modal.querySelector('#tvcBrainWhatsApp');
        if (kakao) kakao.href = KAKAO_CHANNEL_URL;
        if (wa) {
            const text = query
                ? `[TVC Brain] ${query}`
                : 'THE VESSEL CODE — Maritime engineering inquiry';
            wa.href = `https://wa.me/?text=${encodeURIComponent(text)}`;
        }
    }

    function openModal(query) {
        const modal = ensureModal();
        modal.hidden = false;
        document.body.classList.add('tvc-brain-open');
        setConnectors(query);
        const card = modal.querySelector('.tvc-brain-card');
        if (card) card.focus();
        askBrain(query);
    }

    function closeModal() {
        const modal = document.getElementById(MODAL_ID);
        if (!modal) return;
        modal.hidden = true;
        document.body.classList.remove('tvc-brain-open');
    }

    function setLoading(on) {
        state.loading = on;
        const modal = ensureModal();
        const loadingEl = modal.querySelector('.tvc-brain-loading');
        const answerEl = modal.querySelector('.tvc-brain-answer');
        const textEl = modal.querySelector('.tvc-brain-loading-text');
        if (loadingEl) loadingEl.hidden = !on;
        if (textEl) textEl.textContent = t('loading');
        if (answerEl && on) answerEl.innerHTML = '';
    }

    async function askBrain(query) {
        const q = String(query || '').trim();
        if (!q || state.loading) return;
        state.lastQuery = q;
        setConnectors(q);
        setLoading(true);

        try {
            const ctrl = new AbortController();
            const timeoutId = setTimeout(() => ctrl.abort(), 12000);
            const res = await fetch(API_PATH, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: q, lang: state.lang }),
                signal: ctrl.signal,
            }).finally(() => clearTimeout(timeoutId));
            const data = await res.json().catch(() => ({}));
            let answer = String(data.answer || '').trim();
            if (!answer && !res.ok) {
                answer = state.lang === 'EN'
                    ? '**Core conclusion:** The Brain API is unavailable on this host (local static preview).\n\n**Field steps:** Deploy with Vercel serverless `/api/ask-brain` or use the Toolkit for IMPA / calculator lookups.\n\n**Safety:** Verify all numbers against class and maker manuals before execution.'
                    : '**핵심 결론:** 이 호스트에서는 Brain API(`/api/ask-brain`)에 연결할 수 없습니다(로컬 정적 미리보기).\n\n**현장 조치:** Vercel 배포 환경에서 질문하거나, IMPA·계산기는 Toolkit에서 즉시 조회하십시오.\n\n**안전:** 수치·절차는 선급·메이커 매뉴얼과 반드시 교차 확인하십시오.';
            }
            if (!answer) answer = t('error');
            const modal = ensureModal();
            const answerEl = modal.querySelector('.tvc-brain-answer');
            if (answerEl) answerEl.innerHTML = renderMarkdown(answer);
        } catch (err) {
            console.warn('[TVC Brain]', err);
            const modal = ensureModal();
            const answerEl = modal.querySelector('.tvc-brain-answer');
            if (answerEl) answerEl.innerHTML = `<p class="tvc-brain-p">${escapeHtml(t('error'))}</p>`;
        } finally {
            setLoading(false);
        }
    }

    function bindHeroForm(form, input) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const q = composeQuery('hero', input);
            if (!q) return;
            openModal(q);
        });
    }

    function isStandalone() {
        return window.matchMedia('(display-mode: standalone)').matches
            || window.navigator.standalone === true;
    }

    function ensureA2hsBanner() {
        if (isStandalone()) return;
        if (!window.matchMedia('(max-width: 768px)').matches) return;
        try {
            if (localStorage.getItem(A2HS_DISMISS_KEY) === '1') return;
        } catch (_) { /* ignore */ }

        if (document.getElementById('tvcBrainA2hs')) return;

        const bar = document.createElement('div');
        bar.id = 'tvcBrainA2hs';
        bar.className = 'tvc-brain-a2hs';
        bar.innerHTML = `
            <p class="tvc-brain-a2hs-text"></p>
            <div class="tvc-brain-a2hs-actions">
                <button type="button" class="tvc-brain-a2hs-install home-btn home-btn-primary"></button>
                <button type="button" class="tvc-brain-a2hs-dismiss"></button>
            </div>`;
        document.body.appendChild(bar);

        bar.querySelector('.tvc-brain-a2hs-text').textContent = t('a2hs');
        bar.querySelector('.tvc-brain-a2hs-install').textContent = t('install');
        bar.querySelector('.tvc-brain-a2hs-dismiss').textContent = t('dismiss');

        bar.querySelector('.tvc-brain-a2hs-dismiss').addEventListener('click', () => {
            try { localStorage.setItem(A2HS_DISMISS_KEY, '1'); } catch (_) { /* ignore */ }
            bar.remove();
        });

        bar.querySelector('.tvc-brain-a2hs-install').addEventListener('click', async () => {
            if (state.deferredPrompt) {
                state.deferredPrompt.prompt();
                try { await state.deferredPrompt.userChoice; } catch (_) { /* ignore */ }
                state.deferredPrompt = null;
                bar.remove();
                return;
            }
            bar.querySelector('.tvc-brain-a2hs-text').textContent = state.lang === 'EN'
                ? 'Use browser menu → Add to Home Screen / Install app.'
                : '브라우저 메뉴 → 홈 화면에 추가 / 앱 설치를 선택하세요.';
        });
    }

    function registerServiceWorker() {
        if (!('serviceWorker' in navigator)) return;
        const okProto = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
        if (!okProto) return;
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => {
                console.warn('[TVC Brain] SW registration failed', err);
            });
        });
    }

    function init() {
        state.lang = detectLang();
        ensureModal();

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            state.deferredPrompt = e;
            ensureA2hsBanner();
        });

        ensureA2hsBanner();
        registerServiceWorker();
        initHeroInputCapture();
    }

    window.TVC_BrainChat = {
        bindHeroForm,
        openModal,
        closeModal,
        askBrain,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
