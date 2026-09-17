/* SM Mode — Certificates dashboard (GFSM) — gfsm-certs parity */
const TVC_SmCertificatesUi = (function () {
    const HOST_ID = 'smCertsHost';
    let currentLang = 'ko';
    let isDarkMode = false;
    const CERT_I18N = {
        ko: {
            mainTitle: '육/해상 증서 관리 대시보드',
            dateUpdated: '📅 Date updated:',
            btnAdd: '➕ 직접 추가', btnUpload: '📂 엑셀 파일 로드', btnClear: '초기화',
            btnLang: '🌐 EN/KR', btnLight: '☀️ Light', btnDark: '🌙 Dark',
            loadedData: '💾 저장된 데이터 로드됨',
            statTotal: '전체 관리 증서 (필터 초기화)', statDanger: '🚨 초긴급 (15일 이내)',
            statUrgent: '🟠 긴급 (30일 이내)', statWarning: '🟡 주의 (60일 이내)',
            chartRatio: '📊 증서 갱신 현황 비율', chartVessel: '🚢 선박/조직별 리스크 현황',
            chartMonth: '📅 향후 6개월 만료 예정 추이',
            tabAll: '전체 보기', searchPlaceholder: '증서명, 번호 또는 기관 검색…',
            displayPrefix: '표시 중: ', unit: '건',
            btnShare: '💾 공유용 HTML 저장', btnMail: '📧 갱신알림 메일',
            btnExcel: '📥 엑셀 다운로드', btnPdf: '📄 PDF 보고서',
            statusDanger: '초긴급', statusUrgent: '긴급', statusWarning: '주의', statusSafe: '정상', statusExpired: '만료됨',
            modalAdd: '➕ 새로운 증서 추가', modalEdit: '📝 증서 정보 수정',
            btnCancel: '취소', btnSave: '저장하기',
            msgSave: '데이터가 성공적으로 저장되었습니다.', msgReset: '데이터가 초기화되었습니다.',
            emptySearch: '조건에 맞는 증서가 없습니다.',
            chartMonthCount: '예정 건수',
        },
        en: {
            mainTitle: 'Fleet Certificate Dashboard',
            dateUpdated: '📅 Date updated:',
            btnAdd: '➕ Add Manual', btnUpload: '📂 Load Excel', btnClear: 'Clear',
            btnLang: '🌐 KR/EN', btnLight: '☀️ Light', btnDark: '🌙 Dark',
            loadedData: '💾 Local data loaded',
            statTotal: 'Total Certificates (Reset filter)', statDanger: '🚨 Critical (≤ 15 days)',
            statUrgent: '🟠 Urgent (≤ 30 days)', statWarning: '🟡 Warning (≤ 60 days)',
            chartRatio: '📊 Renewal Status Ratio', chartVessel: '🚢 Risk Status by Vessel',
            chartMonth: '📅 Next 6 Months Expiry Trend',
            tabAll: 'View All', searchPlaceholder: 'Search cert name, no, issuer…',
            displayPrefix: 'Showing: ', unit: '',
            btnShare: '💾 Save Shared HTML', btnMail: '📧 Alert Draft E-mail',
            btnExcel: '📥 Download Excel', btnPdf: '📄 PDF Report',
            statusDanger: 'Critical', statusUrgent: 'Urgent', statusWarning: 'Warning', statusSafe: 'Safe', statusExpired: 'Expired',
            modalAdd: '➕ Add Certificate', modalEdit: '📝 Edit Certificate',
            btnCancel: 'Cancel', btnSave: 'Save',
            msgSave: 'Data saved successfully.', msgReset: 'Data has been reset.',
            emptySearch: 'No certificates found.',
            chartMonthCount: 'Due count',
        },
    };

    let allCerts = [];
    let currentTab = 'ALL';
    let filterStatus = 'ALL';
    let currentFiltered = [];
    let sortColumn = 'days';
    let sortDesc = false;
    let bound = false;
    let statusChartInstance = null;
    let vesselChartInstance = null;
    let monthChartInstance = null;

    function el(id) { return document.getElementById(id); }

    function esc(s) {
        return String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function companyOverride() {
        try {
            return window.TVC_App?.getSmCertificatesCompanyFilter?.() || '';
        } catch (_) {
            return '';
        }
    }

    function companyBrand(user) {
        const cid = TVC_SmCertificates.resolveCompanyId(user, companyOverride());
        return cid || 'GFSM';
    }

    function uniqueTabs(rows) {
        const tabs = new Set();
        rows.forEach(r => { if (r.vessel) tabs.add(r.vessel); });
        return ['ALL', ...Array.from(tabs).sort((a, b) => a.localeCompare(b, 'ko'))];
    }

    function defaultTab(user, rows) {
        const cid = TVC_SmCertificates.resolveCompanyId(user, companyOverride());
        const preset = TVC_SmCertificates.defaultTabForCompany(cid);
        if (preset !== 'ALL' && rows.some(r => r.vessel === preset || r.vessel.includes(preset))) return preset;
        return 'ALL';
    }

    function toggleExportActions(show) {
        const row = el('smCertsActionButtons');
        const clearBtn = el('smCertsClearBtn');
        if (row) row.classList.toggle('hidden', !show);
        if (clearBtn) clearBtn.classList.toggle('hidden', !show);
    }

    function toast(msg) {
        const t = el('smCertsToast');
        if (!t) return;
        t.textContent = msg;
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 2800);
    }

    function readLang() {
        if (typeof TVC_I18n !== 'undefined') return TVC_I18n.getLang();
        try {
            const v = localStorage.getItem('tvc_lang') || localStorage.getItem('tvc-mkt-lang');
            return v === 'en' ? 'en' : 'ko';
        } catch (_) {
            return 'ko';
        }
    }

    function t(key) {
        return CERT_I18N[currentLang]?.[key] || CERT_I18N.ko[key] || key;
    }

    function statusText(days, rawStatus) {
        if (days === 9999) return t('statusSafe');
        if (days < 0) return `${t('statusExpired')} (D+${Math.abs(days)})`;
        if (rawStatus === 'DANGER') return `${t('statusDanger')} (D-${days})`;
        if (rawStatus === 'URGENT') return `${t('statusUrgent')} (D-${days})`;
        if (rawStatus === 'WARNING') return `${t('statusWarning')} (D-${days})`;
        return `${t('statusSafe')} (D-${days})`;
    }

    function applyLang() {
        currentLang = readLang();
        const root = el('smCertsRoot');
        if (!root) return;
        const titleSuffix = el('smCertsTitleSuffix');
        if (titleSuffix) titleSuffix.textContent = t('mainTitle');
        const map = {
            smCertsDateLabel: 'dateUpdated',
            smCertsAddBtn: 'btnAdd',
            smCertsClearBtn: 'btnClear',
            smCertsLangBtn: 'btnLang',
            smCertsDarkBtn: 'btnLight',
            smCertsHtmlBtn: 'btnShare',
            smCertsMailBtn: 'btnMail',
            smCertsExcelBtn: 'btnExcel',
            smCertsPdfBtn: 'btnPdf',
            smCertsModalCancel: 'btnCancel',
            smCertsModalSave: 'btnSave',
        };
        Object.entries(map).forEach(([id, key]) => {
            const node = el(id);
            if (node) node.textContent = t(key);
        });
        const uploadLbl = root.querySelector('.sm-certs-btn-upload');
        if (uploadLbl) uploadLbl.firstChild.textContent = t('btnUpload') + ' ';
        root.querySelectorAll('[data-i18n-cert]').forEach(node => {
            const key = node.getAttribute('data-i18n-cert');
            if (key) node.textContent = t(key);
        });
        const search = el('smCertsSearch');
        if (search) search.placeholder = t('searchPlaceholder');
        const darkBtn = el('smCertsDarkBtn');
        if (darkBtn) darkBtn.textContent = isDarkMode ? t('btnLight') : t('btnDark');
        paintTable();
    }

    function toggleDark() {
        isDarkMode = !isDarkMode;
        el('smCertsRoot')?.classList.toggle('sm-certs-dark', isDarkMode);
        try { localStorage.setItem('sm_certs_darkmode', isDarkMode ? 'true' : 'false'); } catch (_) {}
        applyLang();
    }

    function mountShell() {
        const host = el(HOST_ID);
        if (!host || host.dataset.mounted === '1') return;
        host.dataset.mounted = '1';
        host.innerHTML = `
<div class="sm-certs-root" id="smCertsRoot">
  <div class="sm-certs-header">
    <div>
      <h2 class="sm-certs-title"><span class="sm-certs-brand" id="smCertsBrand">GFSM</span> <span id="smCertsTitleSuffix">육/해상 증서 관리 대시보드</span></h2>
      <div class="sm-certs-date-box">
        <span id="smCertsDateLabel">📅 Date updated:</span>
        <input type="date" id="smCertsDateInput" aria-label="Reference date">
      </div>
      <span class="sm-certs-file-status muted" id="smCertsFileStatus"></span>
    </div>
    <div class="sm-certs-actions no-print">
      <button type="button" class="btn btn-sm btn-outline" id="smCertsDarkBtn">☀️ Light</button>
      <button type="button" class="btn btn-sm btn-outline" id="smCertsLangBtn">🌐 EN/KR</button>
      <button type="button" class="btn btn-sm btn-primary" id="smCertsAddBtn">➕ 직접 추가</button>
      <label class="btn btn-sm sm-certs-btn-upload">📂 엑셀 파일 로드
        <input type="file" id="smCertsExcelInput" accept=".xlsx,.xls" hidden>
      </label>
      <button type="button" class="btn btn-sm btn-outline hidden" id="smCertsClearBtn">초기화</button>
    </div>
  </div>
  <div class="sm-certs-stats">
    <div class="sm-certs-stat total" data-status="ALL"><div class="sm-certs-stat-label" data-i18n-cert="statTotal">전체 관리 증서 (필터 초기화)</div><div class="sm-certs-stat-val" id="smCertsCntTotal">0건</div></div>
    <div class="sm-certs-stat danger" data-status="DANGER"><div class="sm-certs-stat-label" data-i18n-cert="statDanger">🚨 초긴급 (15일 이내)</div><div class="sm-certs-stat-val" id="smCertsCntDanger">0건</div></div>
    <div class="sm-certs-stat urgent" data-status="URGENT"><div class="sm-certs-stat-label" data-i18n-cert="statUrgent">🟠 긴급 (30일 이내)</div><div class="sm-certs-stat-val" id="smCertsCntUrgent">0건</div></div>
    <div class="sm-certs-stat warning" data-status="WARNING"><div class="sm-certs-stat-label" data-i18n-cert="statWarning">🟡 주의 (60일 이내)</div><div class="sm-certs-stat-val" id="smCertsCntWarning">0건</div></div>
  </div>
  <div class="sm-certs-charts no-print">
    <div class="sm-certs-chart-card"><div class="sm-certs-chart-title" data-i18n-cert="chartRatio">📊 증서 갱신 현황 비율</div><div class="sm-certs-canvas-wrap"><canvas id="smCertsStatusChart"></canvas></div></div>
    <div class="sm-certs-chart-card sm-certs-chart-wide"><div class="sm-certs-chart-title" data-i18n-cert="chartVessel">🚢 선박/조직별 리스크 현황</div><div class="sm-certs-canvas-wrap"><canvas id="smCertsVesselChart"></canvas></div></div>
    <div class="sm-certs-chart-card sm-certs-chart-wide"><div class="sm-certs-chart-title" data-i18n-cert="chartMonth">📅 향후 6개월 만료 예정 추이</div><div class="sm-certs-canvas-wrap"><canvas id="smCertsMonthChart"></canvas></div></div>
  </div>
  <div class="sm-certs-tabs no-print" id="smCertsTabs"></div>
  <div class="sm-certs-controls no-print">
    <div class="sm-certs-controls-left">
      <input type="search" class="search-input sm-certs-search" id="smCertsSearch" placeholder="증서명, 번호 또는 기관 검색…">
      <span class="muted" id="smCertsDisplayCount"></span>
    </div>
    <div class="sm-certs-controls-right hidden" id="smCertsActionButtons">
      <button type="button" class="btn btn-sm sm-certs-btn-share" id="smCertsHtmlBtn">💾 공유용 HTML 저장</button>
      <button type="button" class="btn btn-sm sm-certs-btn-mail" id="smCertsMailBtn">📧 갱신알림 메일</button>
      <button type="button" class="btn btn-sm btn-green" id="smCertsExcelBtn">📥 엑셀 다운로드</button>
      <button type="button" class="btn btn-sm sm-certs-btn-pdf" id="smCertsPdfBtn">📄 PDF 보고서</button>
    </div>
  </div>
  <div class="sm-certs-table-wrap">
    <table class="sm-certs-table">
      <thead>
        <tr>
          <th>연번</th>
          <th class="sortable" data-col="vessel">선박/조직명</th>
          <th class="sortable" data-col="name">증서명</th>
          <th class="sortable" data-col="certNo">증서번호</th>
          <th class="sortable" data-col="issuer">발급처</th>
          <th class="sortable" data-col="issueDate">발급일</th>
          <th class="sortable" data-col="lastAnn">Last Annual</th>
          <th class="sortable" data-col="lastInt">Last Inter.</th>
          <th class="sortable" data-col="expireDate">유효&만료일</th>
          <th class="sortable" data-col="days">남은기간</th>
          <th class="sortable" data-col="rawStatus">상태</th>
          <th class="sortable" data-col="dept">담당부서</th>
          <th class="sortable" data-col="remarks">비고</th>
          <th class="no-print">관리</th>
        </tr>
      </thead>
      <tbody id="smCertsTableBody"></tbody>
    </table>
  </div>
</div>
<div id="smCertsToast" class="sm-certs-toast" role="status"></div>`;

        const modalHtml = `
<div class="modal-overlay sm-certs-modal hidden" id="smCertsEditModal" role="dialog" aria-modal="true">
  <div class="modal-content sm-certs-modal-content">
    <h3 id="smCertsModalTitle">📝 증서 정보 수정</h3>
    <input type="hidden" id="smCertsEditId">
    <div class="form-row sm-certs-form-row">
      <div class="form-group"><label>선박 / 조직명 <span class="sm-certs-req">*</span></label><input type="text" id="smCertsEditVessel"></div>
      <div class="form-group"><label>담당부서</label><input type="text" id="smCertsEditDept"></div>
    </div>
    <div class="form-group"><label>증서명 <span class="sm-certs-req">*</span></label><input type="text" id="smCertsEditName"></div>
    <div class="form-row sm-certs-form-row">
      <div class="form-group"><label>증서번호</label><input type="text" id="smCertsEditCertNo"></div>
      <div class="form-group"><label>발급처</label><input type="text" id="smCertsEditIssuer"></div>
    </div>
    <div class="form-row sm-certs-form-row">
      <div class="form-group"><label>발급일</label><input type="text" id="smCertsEditIssueDate" placeholder="YYYY-MM-DD"></div>
      <div class="form-group"><label>유효&만료일 <span class="sm-certs-req">*</span></label><input type="text" id="smCertsEditExpireDate" placeholder="YYYY-MM-DD 또는 Permanent"></div>
    </div>
    <div class="form-row sm-certs-form-row">
      <div class="form-group"><label>Last Annual</label><input type="text" id="smCertsEditLastAnn" placeholder="YYYY-MM-DD"></div>
      <div class="form-group"><label>Last Inter.</label><input type="text" id="smCertsEditLastInt" placeholder="YYYY-MM-DD"></div>
    </div>
    <div class="form-group"><label>비고</label><textarea id="smCertsEditRemarks" rows="3"></textarea></div>
    <div class="modal-actions">
      <button type="button" class="btn" id="smCertsModalCancel">취소</button>
      <button type="button" class="btn btn-primary" id="smCertsModalSave">저장하기</button>
    </div>
  </div>
</div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    function bindOnce() {
        if (bound) return;
        bound = true;
        el('smCertsDateInput')?.addEventListener('change', async (e) => {
            await TVC_SmCertificates.setReferenceDate(e.target.value);
            await refreshData();
        });
        el('smCertsAddBtn')?.addEventListener('click', () => openModal(null));
        el('smCertsModalCancel')?.addEventListener('click', closeModal);
        el('smCertsModalSave')?.addEventListener('click', () => void saveModal());
        el('smCertsSearch')?.addEventListener('input', () => paintTable());
        el('smCertsExcelBtn')?.addEventListener('click', exportExcel);
        el('smCertsExcelInput')?.addEventListener('change', (e) => void importExcel(e));
        el('smCertsHtmlBtn')?.addEventListener('click', () => void exportHtml());
        el('smCertsMailBtn')?.addEventListener('click', draftEmail);
        el('smCertsPdfBtn')?.addEventListener('click', () => void exportPdf());
        el('smCertsClearBtn')?.addEventListener('click', () => void clearAllData());
        el('smCertsLangBtn')?.addEventListener('click', () => window.TVC_App?.toggleUiLang?.());
        el('smCertsDarkBtn')?.addEventListener('click', toggleDark);
        window.addEventListener('tvc-mkt-lang', () => applyLang());
        window.addEventListener('tvc-lang-change', () => applyLang());
        el('smCertsRoot')?.addEventListener('click', (ev) => {
            const card = ev.target.closest('.sm-certs-stat');
            if (!card) return;
            filterStatus = card.dataset.status || 'ALL';
            paintTable();
        });
        el('smCertsRoot')?.querySelector('.sm-certs-table thead')?.addEventListener('click', (ev) => {
            const th = ev.target.closest('th.sortable');
            if (!th) return;
            const col = th.dataset.col;
            if (sortColumn === col) sortDesc = !sortDesc;
            else { sortColumn = col; sortDesc = false; }
            updateSortUi();
            paintTable();
        });
        el('smCertsEditModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'smCertsEditModal') closeModal();
        });
    }

    function updateSortUi() {
        document.querySelectorAll('.sm-certs-table th.sortable').forEach(th => {
            th.classList.remove('sort-asc', 'sort-desc');
            if (th.dataset.col === sortColumn) th.classList.add(sortDesc ? 'sort-desc' : 'sort-asc');
        });
    }

    function updateCharts(dataScoped) {
        if (typeof Chart === 'undefined') return;
        const textColor = '#64748B';
        const fontOpts = { size: 10 };

        let cDanger = dataScoped.filter(i => i.rawStatus === 'DANGER').length;
        let cUrgent = dataScoped.filter(i => i.rawStatus === 'URGENT').length;
        let cWarning = dataScoped.filter(i => i.rawStatus === 'WARNING').length;
        let cSafe = dataScoped.filter(i => i.rawStatus === 'SAFE').length;
        const total = cDanger + cUrgent + cWarning + cSafe;

        if (statusChartInstance) statusChartInstance.destroy();
        if (total > 0 && el('smCertsStatusChart')) {
            statusChartInstance = new Chart(el('smCertsStatusChart').getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: [t('statusDanger'), t('statusUrgent'), t('statusWarning'), t('statusSafe')],
                    datasets: [{ data: [cDanger, cUrgent, cWarning, cSafe], backgroundColor: ['#DC2626', '#EA580C', '#D97706', '#16A34A'], borderWidth: 0 }],
                },
                options: {
                    responsive: true, maintainAspectRatio: false, cutout: '65%',
                    plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: fontOpts, color: textColor } } },
                },
            });
        }

        const vesselData = {};
        dataScoped.forEach(d => {
            if (!vesselData[d.vessel]) vesselData[d.vessel] = { DANGER: 0, URGENT: 0, WARNING: 0 };
            if (['DANGER', 'URGENT', 'WARNING'].includes(d.rawStatus)) vesselData[d.vessel][d.rawStatus]++;
        });
        const vLabels = Object.keys(vesselData);
        if (vesselChartInstance) vesselChartInstance.destroy();
        if (el('smCertsVesselChart')) {
            vesselChartInstance = new Chart(el('smCertsVesselChart').getContext('2d'), {
                type: 'bar',
                data: {
                    labels: vLabels,
                    datasets: [
                        { label: t('statusDanger'), data: vLabels.map(v => vesselData[v].DANGER), backgroundColor: '#DC2626' },
                        { label: t('statusUrgent'), data: vLabels.map(v => vesselData[v].URGENT), backgroundColor: '#EA580C' },
                        { label: t('statusWarning'), data: vLabels.map(v => vesselData[v].WARNING), backgroundColor: '#D97706' },
                    ],
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    scales: { x: { stacked: true, ticks: { color: textColor, font: fontOpts } }, y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1, color: textColor } } },
                    plugins: { legend: { position: 'top', labels: { boxWidth: 8, font: fontOpts, color: textColor } } },
                },
            });
        }

        const monthData = {};
        const now = new Date();
        for (let i = 0; i < 6; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
            monthData[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`] = 0;
        }
        dataScoped.forEach(d => {
            if (d.expireDate && d.expireDate !== '-' && d.days !== 9999 && d.days > 0) {
                const exp = new Date(d.expireDate);
                const key = `${exp.getFullYear()}-${String(exp.getMonth() + 1).padStart(2, '0')}`;
                if (monthData[key] !== undefined) monthData[key]++;
            }
        });
        const mLabels = Object.keys(monthData).sort();
        if (monthChartInstance) monthChartInstance.destroy();
        if (el('smCertsMonthChart')) {
            monthChartInstance = new Chart(el('smCertsMonthChart').getContext('2d'), {
                type: 'bar',
                data: { labels: mLabels, datasets: [{ label: t('chartMonthCount'), data: mLabels.map(k => monthData[k]), backgroundColor: '#3B82F6', borderRadius: 4 }] },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    scales: { x: { ticks: { color: textColor, font: fontOpts } }, y: { beginAtZero: true, ticks: { stepSize: 1, color: textColor } } },
                    plugins: { legend: { display: false } },
                },
            });
        }
    }

    function renderTabs() {
        const tabsEl = el('smCertsTabs');
        if (!tabsEl) return;
        const names = uniqueTabs(allCerts);
        tabsEl.innerHTML = names.map(name => {
            const label = name === 'ALL' ? t('tabAll') : name;
            const active = name === currentTab ? ' active' : '';
            const tabKey = esc(name).replace(/"/g, '&quot;');
            return `<button type="button" class="sm-certs-tab${active}" data-tab="${tabKey}">${esc(label)}</button>`;
        }).join('');
        tabsEl.querySelectorAll('.sm-certs-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                currentTab = btn.getAttribute('data-tab') || 'ALL';
                filterStatus = 'ALL';
                renderTabs();
                paintTable();
            });
        });
    }

    function paintTable() {
        const query = String(el('smCertsSearch')?.value || '').toLowerCase();
        const tbody = el('smCertsTableBody');
        if (!tbody) return;

        let filtered = allCerts.filter(item => {
            const matchTab = currentTab === 'ALL' || item.vessel === currentTab || item.vessel.includes(currentTab);
            const matchStatus = filterStatus === 'ALL' || item.rawStatus === filterStatus;
            const matchSearch = !query
                || item.name.toLowerCase().includes(query)
                || String(item.certNo).toLowerCase().includes(query)
                || String(item.issuer).toLowerCase().includes(query)
                || String(item.vessel).toLowerCase().includes(query);
            return matchTab && matchStatus && matchSearch;
        });

        filtered.sort((a, b) => {
            let valA = a[sortColumn];
            let valB = b[sortColumn];
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();
            if (valA < valB) return sortDesc ? 1 : -1;
            if (valA > valB) return sortDesc ? -1 : 1;
            return 0;
        });
        currentFiltered = filtered;

        const tabScoped = currentTab === 'ALL'
            ? allCerts
            : allCerts.filter(i => i.vessel === currentTab || i.vessel.includes(currentTab));
        const unit = currentLang === 'ko' ? '건' : '';
        const setCnt = (id, n) => { const e = el(id); if (e) e.textContent = `${n}${unit}`; };
        setCnt('smCertsCntTotal', tabScoped.length);
        setCnt('smCertsCntDanger', tabScoped.filter(i => i.rawStatus === 'DANGER').length);
        setCnt('smCertsCntUrgent', tabScoped.filter(i => i.rawStatus === 'URGENT').length);
        setCnt('smCertsCntWarning', tabScoped.filter(i => i.rawStatus === 'WARNING').length);
        const dc = el('smCertsDisplayCount');
        if (dc) dc.textContent = `${t('displayPrefix')}${filtered.length}${unit}`;

        toggleExportActions(allCerts.length > 0);
        updateCharts(tabScoped);

        if (!filtered.length) {
            tbody.innerHTML = `<tr><td colspan="14" class="sm-certs-empty">${esc(t('emptySearch'))}</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map((item, idx) => {
            const daysColor = item.rawStatus === 'DANGER' ? '#DC2626'
                : item.rawStatus === 'URGENT' ? '#EA580C'
                    : item.rawStatus === 'WARNING' ? '#D97706' : '#16A34A';
            const dday = item.days === 9999 ? '-'
                : (item.days < 0 ? `D+${Math.abs(item.days)}` : `D-${item.days}`);
            return `<tr>
              <td>${idx + 1}</td>
              <td><span class="sm-certs-vessel-pill">${esc(item.vessel)}</span></td>
              <td class="sm-certs-name">${esc(item.name)}</td>
              <td>${esc(item.certNo)}</td>
              <td>${esc(item.issuer)}</td>
              <td>${esc(item.issueDate)}</td>
              <td>${esc(item.lastAnn)}</td>
              <td>${esc(item.lastInt)}</td>
              <td>${esc(item.expireDate)}</td>
              <td style="font-weight:700;color:${daysColor}">${dday}</td>
              <td><span class="sm-certs-badge ${esc(item.badge)}">${esc(statusText(item.days, item.rawStatus))}</span></td>
              <td>${esc(item.dept)}</td>
              <td class="muted">${esc(item.remarks)}</td>
              <td class="sm-certs-manage no-print">
                <button type="button" class="btn-icon" data-edit="${esc(item.id)}" title="Edit">✏️</button>
                <button type="button" class="btn-icon" data-del="${esc(item.id)}" title="Delete">🗑️</button>
              </td>
            </tr>`;
        }).join('');

        tbody.querySelectorAll('[data-edit]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-edit');
                openModal(allCerts.find(c => c.id === id));
            });
        });
        tbody.querySelectorAll('[data-del]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-del');
                if (!await TVC_Dialog.confirm('정말 삭제하시겠습니까?')) return;
                await TVC_SmCertificates.deleteRecord(id);
                await refreshData();
            });
        });
    }

    function openModal(row) {
        el('smCertsModalTitle').textContent = row ? t('modalEdit') : t('modalAdd');
        el('smCertsEditId').value = row?.id || '';
        el('smCertsEditVessel').value = row?.vessel || '';
        el('smCertsEditName').value = row?.name || '';
        el('smCertsEditCertNo').value = row?.certNo || '';
        el('smCertsEditIssuer').value = row?.issuer || '';
        el('smCertsEditIssueDate').value = row?.issueDate && row.issueDate !== '-' ? row.issueDate : '';
        el('smCertsEditLastAnn').value = row?.lastAnn && row.lastAnn !== '-' ? row.lastAnn : '';
        el('smCertsEditLastInt').value = row?.lastInt && row.lastInt !== '-' ? row.lastInt : '';
        el('smCertsEditExpireDate').value = row?.expireDate && row.expireDate !== '-' ? row.expireDate : '';
        el('smCertsEditDept').value = row?.dept && row.dept !== '-' ? row.dept : '';
        el('smCertsEditRemarks').value = row?.remarks && row.remarks !== '-' ? row.remarks : '';
        const m = el('smCertsEditModal');
        m?.classList.remove('hidden');
        if (m) m.style.display = 'flex';
        el('smCertsEditVessel')?.focus();
    }

    function closeModal() {
        const m = el('smCertsEditModal');
        if (!m) return;
        m.classList.add('hidden');
        m.style.display = 'none';
    }

    async function saveModal() {
        const user = TVC_Auth.getCurrentUser();
        const vessel = el('smCertsEditVessel').value.trim();
        const name = el('smCertsEditName').value.trim();
        const expireDate = el('smCertsEditExpireDate').value.trim();
        if (!vessel || !name) {
            await TVC_Dialog.alert('선박명과 증서명은 필수입니다.');
            return;
        }
        if (!expireDate) {
            await TVC_Dialog.alert('유효·만료일은 필수입니다. (Permanent 또는 YYYY-MM-DD)');
            return;
        }
        await TVC_SmCertificates.saveRecord(user, {
            id: el('smCertsEditId').value || undefined,
            company_id: TVC_SmCertificates.resolveCompanyId(user, companyOverride()),
            vessel,
            name,
            certNo: el('smCertsEditCertNo').value,
            issuer: el('smCertsEditIssuer').value,
            issueDate: el('smCertsEditIssueDate').value,
            lastAnn: el('smCertsEditLastAnn').value,
            lastInt: el('smCertsEditLastInt').value,
            expireDate,
            dept: el('smCertsEditDept').value,
            remarks: el('smCertsEditRemarks').value,
        });
        closeModal();
        toast(t('msgSave'));
        await refreshData();
    }

    function exportExcel() {
        if (!currentFiltered.length) {
            void TVC_Dialog.alert('보낼 데이터가 없습니다.');
            return;
        }
        if (typeof XLSX === 'undefined') {
            void TVC_Dialog.alert('Excel library is not loaded.');
            return;
        }
        const updatedDate = (el('smCertsDateInput')?.value || '').replace(/-/g, '');
        const exportData = currentFiltered.map((item, idx) => ({
            연번: idx + 1,
            '선박/조직명': item.vessel,
            증서명: item.name,
            증서번호: item.certNo,
            발급처: item.issuer,
            발급일: item.issueDate,
            'Last Annual': item.lastAnn,
            'Last Intermediate': item.lastInt,
            '유효&만료일': item.expireDate,
            '남은기간(D-Day)': item.days === 9999 ? '-' : (item.days < 0 ? `만료(D+${Math.abs(item.days)})` : `D-${item.days}`),
            상태: TVC_SmCertificates.statusLabel(item.days, item.rawStatus),
            담당부서: item.dept,
            비고: item.remarks,
        }));
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '증서목록');
        const tabName = currentTab === 'ALL' ? '전체' : currentTab;
        XLSX.writeFile(wb, `[${tabName}]_주요증서_${updatedDate || 'export'}.xlsx`);
    }

    async function exportHtml() {
        if (!allCerts.length) return;
        const stamp = Date.now().toString();
        const payload = JSON.stringify(allCerts);
        const dateVal = el('smCertsDateInput')?.value || '';
        const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>GFSM Certificates Export</title></head><body>
<script id="embedded_data" type="application/json" data-timestamp="${stamp}">${payload}<\/script>
<p>공유용 증서 데이터 (${allCerts.length}건) · 기준일 ${esc(dateVal)}</p>
</body></html>`;
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `[공유용]_증서_${dateVal.replace(/-/g, '') || 'export'}.html`;
        a.click();
        URL.revokeObjectURL(url);
        toast('공유용 HTML 파일이 저장되었습니다.');
    }

    function draftEmail() {
        const certs15 = allCerts.filter(i => i.rawStatus === 'DANGER');
        const certs30 = allCerts.filter(i => i.rawStatus === 'URGENT');
        const certs60 = allCerts.filter(i => i.rawStatus === 'WARNING');
        if (!certs15.length && !certs30.length && !certs60.length) {
            void TVC_Dialog.alert('만료 60일 이내 증서가 없습니다.');
            return;
        }
        const updatedDate = el('smCertsDateInput')?.value || '';
        const brand = el('smCertsBrand')?.textContent || 'GFSM';
        let subject = `[${brand}] 선박 및 사내 주요 증서 갱신 요망 알림 (기준일: ${updatedDate})`;
        let body = `담당자님,\n\n아래 선박 및 사내 주요 증서의 갱신/심사 일정을 확인해 주시기 바랍니다.\n(기준일: ${updatedDate})\n\n`;
        const appendBlock = (title, list) => {
            if (!list.length) return;
            body += `=========================================\n${title} (${list.length}건)\n=========================================\n`;
            list.forEach((item, idx) => {
                const dDayStr = item.days < 0 ? `만료 D+${Math.abs(item.days)}` : `D-${item.days}`;
                body += `${idx + 1}. ${item.vessel} - ${item.name} (No. ${item.certNo})\n   👉 만료일자: ${item.expireDate} (${dDayStr}) / 담당: ${item.dept}\n\n`;
            });
        };
        appendBlock('🔴 [초긴급] 만료 및 15일 이내', certs15.sort((a, b) => a.days - b.days));
        appendBlock('🟠 [긴급] 16일 ~ 30일 이내', certs30.sort((a, b) => a.days - b.days));
        appendBlock('🟡 [주의] 31일 ~ 60일 이내', certs60.sort((a, b) => a.days - b.days));
        body += '=========================================\n';
        window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    }

    async function exportPdf() {
        if (typeof html2pdf === 'undefined') {
            await TVC_Dialog.alert('PDF library is not loaded.');
            return;
        }
        const root = el('smCertsRoot');
        if (!root) return;
        toast('PDF 문서를 생성하는 중입니다…');
        document.querySelectorAll('.no-print').forEach(n => n.classList.add('sm-certs-pdf-hide'));
        root.classList.add('sm-certs-pdf-mode');
        const todayStr = (el('smCertsDateInput')?.value || '').replace(/-/g, '');
        const tabName = currentTab === 'ALL' ? '전체' : currentTab;
        try {
            await html2pdf().set({
                margin: 10,
                filename: `[${tabName}]_증서_Report_${todayStr}.pdf`,
                image: { type: 'jpeg', quality: 1 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
            }).from(root).save();
        } finally {
            document.querySelectorAll('.sm-certs-pdf-hide').forEach(n => n.classList.remove('sm-certs-pdf-hide'));
            root.classList.remove('sm-certs-pdf-mode');
        }
    }

    async function clearAllData() {
        if (!await TVC_Dialog.confirm('회사 증서 데이터를 초기화하고 시드 데이터를 다시 불러올까요?')) return;
        const user = TVC_Auth.getCurrentUser();
        const cid = TVC_SmCertificates.resolveCompanyId(user, companyOverride());
        if (typeof TVC_SmCertificatesSeed.reseedCompany === 'function') {
            await TVC_SmCertificatesSeed.reseedCompany(cid);
        } else {
            await TVC_SmCertificates.deleteAllForCompany(cid);
        }
        const fs = el('smCertsFileStatus');
        if (fs) fs.textContent = '데이터가 초기화되었습니다.';
        await refreshData();
        toast('초기화되었습니다.');
    }

    async function importExcel(ev) {
        const file = ev.target?.files?.[0];
        if (!file || typeof XLSX === 'undefined') return;
        const user = TVC_Auth.getCurrentUser();
        const companyId = TVC_SmCertificates.resolveCompanyId(user, companyOverride());
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true, dateNF: 'yyyy-mm-dd' });
                for (const sheetName of workbook.SheetNames) {
                    const sheet = workbook.Sheets[sheetName];
                    const rows = XLSX.utils.sheet_to_json(sheet, { raw: false, range: 2 });
                    for (const r of rows) {
                        const certTitle = r['증서명'] || r['증서명 / 계약명'];
                        if (!certTitle) continue;
                        const vessel = (r['구분/선박명'] || sheetName).trim();
                        const expireStr = r['유효&만료일'] || r['만료일자'] || '-';
                        await TVC_SmCertificates.saveRecord(user, {
                            company_id: companyId || TVC_SmCertificatesSeed.companyForVessel(vessel),
                            vessel,
                            name: certTitle,
                            certNo: r['증서번호'] || '-',
                            issuer: r['발급처'] || r['발급/선급기관'] || '-',
                            issueDate: r['발급일'] || '-',
                            lastAnn: r['Last Annual'] || '-',
                            lastInt: r['Last Intermediate'] || '-',
                            expireDate: expireStr,
                            dept: r['담당부서'] || r['담당자'] || '-',
                            remarks: r['비고'] || '-',
                        });
                    }
                }
                const fs = el('smCertsFileStatus');
                if (fs) { fs.textContent = `✅ ${file.name}`; fs.style.color = '#16A34A'; }
                await refreshData();
                toast('엑셀 데이터를 불러왔습니다.');
            } catch (e) {
                await TVC_Dialog.alert('엑셀 로드 실패: ' + (e.message || e));
            }
            ev.target.value = '';
        };
        reader.readAsArrayBuffer(file);
    }

    async function refreshData() {
        const user = TVC_Auth.getCurrentUser();
        allCerts = await TVC_SmCertificates.listForUser(user, companyOverride());
        renderTabs();
        paintTable();
    }

    async function render(user) {
        if (!user || !TVC_RBAC.isSmAccount(user)) return;
        mountShell();
        bindOnce();
        const brand = el('smCertsBrand');
        if (brand) brand.textContent = companyBrand(user);
        const dateInput = el('smCertsDateInput');
        if (dateInput) dateInput.value = await TVC_SmCertificates.getReferenceDate();
        const fs = el('smCertsFileStatus');
        if (fs && allCerts.length) fs.textContent = t('loadedData');
        try {
            isDarkMode = localStorage.getItem('sm_certs_darkmode') === 'true';
            el('smCertsRoot')?.classList.toggle('sm-certs-dark', isDarkMode);
        } catch (_) {}
        currentLang = readLang();
        applyLang();
        allCerts = await TVC_SmCertificates.listForUser(user, companyOverride());
        if (currentTab === 'ALL' || !allCerts.some(r => r.vessel === currentTab)) {
            currentTab = defaultTab(user, allCerts);
        }
        sortColumn = 'days';
        sortDesc = false;
        updateSortUi();
        renderTabs();
        paintTable();
    }

    return { render, refreshData, applyLang };
})();
