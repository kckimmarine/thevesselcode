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
            a2hs: '📲 TVC Brain을 홈 화면 앱으로 추가하면 바로 실행할 수 있습니다.',
            a2hsIosLead: 'iPhone/iPad Safari는 자동 설치 버튼을 지원하지 않습니다. 아래 순서대로 진행하세요.',
            a2hsAndroidLead: 'Chrome에서 「설치하기」가 안 되면 메뉴(⋮) → 앱 설치 / 홈 화면에 추가를 사용하세요.',
            a2hsInsecure: '주소창 경고(🔴)가 보이면 https://thevesselcode.com 으로 다시 접속하세요. HTTP에서는 앱 설치가 차단됩니다.',
            install: '설치하기',
            installShowSteps: '설치 방법 보기',
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
            a2hs: '📲 Add TVC Brain to your home screen for one-tap launch.',
            a2hsIosLead: 'iPhone/iPad Safari does not support one-tap web install. Follow the steps below.',
            a2hsAndroidLead: 'If Install does nothing, use Chrome menu (⋮) → Install app / Add to Home screen.',
            a2hsInsecure: 'If you see a warning in the address bar, open https://thevesselcode.com (HTTPS required).',
            install: 'Install',
            installShowSteps: 'How to install',
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
                const composed = composeQuery('hero', textInput) || transcript;
                if (globalThis.TVC_SearchPortal?.executePortalSearch) {
                    globalThis.TVC_SearchPortal.executePortalSearch(composed);
                } else {
                    openModal(composed, { briefing: true });
                }
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

    function openModal(query, options) {
        const modal = ensureModal();
        modal.hidden = false;
        document.body.classList.add('tvc-brain-open');
        setConnectors(query);
        const card = modal.querySelector('.tvc-brain-card');
        if (card) card.focus();
        askBrain(query, options);
    }

    function openBrainModal(query, options) {
        openModal(query, options);
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

    async function tryStaticArchiveGrounding(query) {
        const lib = window.TVC_BrainKnowledge;
        if (!lib || typeof lib.matchFromStaticArchive !== 'function') return '';
        try {
            const { answer } = await lib.matchFromStaticArchive(query, state.lang);
            return String(answer || '').trim();
        } catch (_) {
            return '';
        }
    }

    function isLlmProviderErrorAnswer(text) {
        const s = String(text || '');
        return (
            s.includes('연결하지 못했습니다')
            || s.includes('could not reach the configured AI model')
            || s.includes('GEMINI_API_KEY')
        );
    }

    function composeAnswer(data, apiFailed) {
        let answer = String(data.answer || '').trim();
        const grounding = String(data.grounding || '').trim();

        if (!answer && grounding) answer = grounding;
        else if (answer && grounding && !answer.includes(grounding.slice(0, 40))) {
            answer = `${answer}\n\n---\n\n${grounding}`;
        }

        if (!answer && apiFailed) return '';
        return answer;
    }

    async function askBrain(query, options) {
        const q = String(query || '').trim();
        if (!q || state.loading) return;
        state.lastQuery = q;
        setConnectors(q);
        setLoading(true);

        const briefing = options?.briefing === true
            || globalThis.TVC_SearchResolver?.classifyQuery?.(q)?.briefing === true;

        try {
            const ctrl = new AbortController();
            const timeoutId = setTimeout(() => ctrl.abort(), 12000);
            let res;
            let apiFailed = false;
            try {
                res = await fetch(API_PATH, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: q, lang: state.lang, briefing }),
                    signal: ctrl.signal,
                });
            } catch (_) {
                apiFailed = true;
            } finally {
                clearTimeout(timeoutId);
            }

            const data = res ? await res.json().catch(() => ({})) : {};
            if (!res || !res.ok) apiFailed = true;

            let answer = composeAnswer(data, apiFailed);

            if (isLlmProviderErrorAnswer(answer) || (!answer && apiFailed)) {
                const archive = await tryStaticArchiveGrounding(q);
                if (archive) {
                    const aiNote = state.lang === 'EN'
                        ? '\n\n_(Archive records above are from TVC ingested history. Generative AI is temporarily unavailable — check Vercel GEMINI_API_KEY / GEMINI_MODEL.)_'
                        : '\n\n_(위 실적은 TVC ingest 아카이브입니다. 생성형 AI는 일시적으로 연결되지 않았습니다 — Vercel `GEMINI_API_KEY`·`GEMINI_MODEL` 점검.)_';
                    answer = archive + aiNote;
                }
            } else if (!answer && apiFailed) {
                answer = await tryStaticArchiveGrounding(q);
            }

            if (!answer && apiFailed) {
                answer = state.lang === 'EN'
                    ? '**Core conclusion:** The Brain API is unavailable on this host (local static preview).\n\n**Field steps:** Run `npm start` (includes `/api/ask-brain`), deploy to Vercel, or place archives in `data/raw_archives/` and run `node scripts/ingest-domain-archives.mjs`.\n\n**Safety:** Verify all numbers against class and maker manuals before execution.'
                    : '**핵심 결론:** 이 호스트에서 Brain API(`/api/ask-brain`)에 연결할 수 없습니다.\n\n**현장 조치:** `npm start`로 로컬 API 포함 서버를 실행하거나, Vercel 배포 환경에서 질문하십시오. 아카이브는 `data/raw_archives/` → `node scripts/ingest-domain-archives.mjs` 후 `/data/tvc-knowledge-base.json`으로 조회됩니다.\n\n**안전:** 수치·절차는 선급·메이커 매뉴얼과 반드시 교차 확인하십시오.';
            }
            if (!answer) answer = t('error');
            const modal = ensureModal();
            const answerEl = modal.querySelector('.tvc-brain-answer');
            if (answerEl) answerEl.innerHTML = renderMarkdown(answer);
        } catch (err) {
            console.warn('[TVC Brain]', err);
            const fallback = await tryStaticArchiveGrounding(q);
            const modal = ensureModal();
            const answerEl = modal.querySelector('.tvc-brain-answer');
            if (answerEl) {
                answerEl.innerHTML = fallback
                    ? renderMarkdown(fallback)
                    : `<p class="tvc-brain-p">${escapeHtml(t('error'))}</p>`;
            }
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

    function isIosDevice() {
        const ua = navigator.userAgent || '';
        if (/iPad|iPhone|iPod/.test(ua)) return true;
        return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    }

    function isInAppBrowser() {
        return /KAKAOTALK|Instagram|FBAN|FBAV|Line\//i.test(navigator.userAgent || '');
    }

    function a2hsStepsHtml() {
        if (isIosDevice()) {
            return state.lang === 'EN'
                ? `<ol class="tvc-brain-a2hs-steps">
<li>Tap <strong>Share</strong> (square with ↑) at the bottom of Safari.</li>
<li>Scroll the sheet and tap <strong>Add to Home Screen</strong>.</li>
<li>Tap <strong>Add</strong> — TVC Brain appears on your home screen.</li>
</ol>`
                : `<ol class="tvc-brain-a2hs-steps">
<li>Safari <strong>하단 중앙 공유(□↑)</strong> 버튼을 탭합니다.</li>
<li>아래로 스크롤 → <strong>「홈 화면에 추가」</strong> 를 선택합니다.</li>
<li><strong>추가</strong> 를 누르면 홈 화면에 TVC Brain 아이콘이 생깁니다.</li>
</ol>`;
        }
        return state.lang === 'EN'
            ? `<ol class="tvc-brain-a2hs-steps">
<li>Open this site in <strong>Chrome</strong> (not an in-app browser).</li>
<li>Tap menu <strong>⋮</strong> → <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
<li>Confirm — launch TVC Brain from your home screen.</li>
</ol>`
            : `<ol class="tvc-brain-a2hs-steps">
<li><strong>Chrome</strong> 브라우저에서 열어 주세요(카톡/인앱 브라우저 X).</li>
<li>우측 상단 <strong>⋮</strong> → <strong>앱 설치</strong> 또는 <strong>홈 화면에 추가</strong>.</li>
<li>확인 후 홈 화면의 TVC Brain 아이콘으로 실행합니다.</li>
</ol>`;
    }

    function a2hsLeadMessage() {
        const parts = [t('a2hs')];
        if (!window.isSecureContext) parts.push(t('a2hsInsecure'));
        if (isInAppBrowser()) {
            parts.push(state.lang === 'EN'
                ? 'Open thevesselcode.com in Safari or Chrome (in-app browsers block install).'
                : 'Safari 또는 Chrome에서 thevesselcode.com 을 직접 여세요(인앱 브라우저는 설치 불가).');
        } else if (isIosDevice()) {
            parts.push(t('a2hsIosLead'));
        } else if (!state.deferredPrompt) {
            parts.push(t('a2hsAndroidLead'));
        }
        return parts.join(' ');
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
            <div class="tvc-brain-a2hs-body">
                <p class="tvc-brain-a2hs-text"></p>
                <div class="tvc-brain-a2hs-steps-wrap" hidden></div>
            </div>
            <div class="tvc-brain-a2hs-actions">
                <button type="button" class="tvc-brain-a2hs-install home-btn home-btn-primary"></button>
                <button type="button" class="tvc-brain-a2hs-dismiss"></button>
            </div>`;
        document.body.appendChild(bar);

        const textEl = bar.querySelector('.tvc-brain-a2hs-text');
        const stepsWrap = bar.querySelector('.tvc-brain-a2hs-steps-wrap');
        const installBtn = bar.querySelector('.tvc-brain-a2hs-install');

        textEl.textContent = a2hsLeadMessage();
        const ios = isIosDevice();
        installBtn.textContent = state.deferredPrompt && !ios ? t('install') : t('installShowSteps');
        bar.querySelector('.tvc-brain-a2hs-dismiss').textContent = t('dismiss');

        if (ios || !state.deferredPrompt) {
            stepsWrap.innerHTML = a2hsStepsHtml();
        }

        if (ios) {
            installBtn.remove();
            stepsWrap.hidden = false;
        }

        bar.querySelector('.tvc-brain-a2hs-dismiss').addEventListener('click', () => {
            try { localStorage.setItem(A2HS_DISMISS_KEY, '1'); } catch (_) { /* ignore */ }
            bar.remove();
        });

        if (!ios) {
            installBtn.addEventListener('click', async () => {
                if (state.deferredPrompt) {
                    state.deferredPrompt.prompt();
                    try { await state.deferredPrompt.userChoice; } catch (_) { /* ignore */ }
                    state.deferredPrompt = null;
                    bar.remove();
                    return;
                }
                const showing = !stepsWrap.hidden;
                stepsWrap.hidden = showing;
                installBtn.textContent = showing
                    ? (state.deferredPrompt ? t('install') : t('installShowSteps'))
                    : (state.lang === 'EN' ? 'Hide steps' : '접기');
                if (!showing) {
                    stepsWrap.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                }
            });
        }
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
        openBrainModal,
        closeModal,
        askBrain,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
