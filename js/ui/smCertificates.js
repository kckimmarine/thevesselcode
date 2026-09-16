/* SM Mode — Certificates dashboard (GFSM / SWT) */
const TVC_SmCertificatesUi = (function () {
    const HOST_ID = 'smCertsHost';
    let allCerts = [];
    let currentTab = 'ALL';
    let filterStatus = 'ALL';
    let currentFiltered = [];
    let sortColumn = 'days';
    let sortDesc = false;
    let bound = false;

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

    function mountShell() {
        const host = el(HOST_ID);
        if (!host || host.dataset.mounted === '1') return;
        host.dataset.mounted = '1';
        host.innerHTML = `
<div class="sm-certs-root" id="smCertsRoot">
  <div class="sm-certs-header">
    <div>
      <h2 class="sm-certs-title">📋 증서관리 <span class="sm-certs-sub">육/해상 증서 통합</span></h2>
      <div class="sm-certs-date-box">
        <span>📅 Date updated:</span>
        <input type="date" id="smCertsDateInput" aria-label="Reference date">
      </div>
    </div>
    <div class="sm-certs-actions">
      <button type="button" class="btn btn-sm" id="smCertsAddBtn">➕ 직접 추가</button>
      <label class="btn btn-sm btn-primary sm-certs-upload-btn">
        📂 엑셀 로드
        <input type="file" id="smCertsExcelInput" accept=".xlsx,.xls" hidden>
      </label>
      <button type="button" class="btn btn-sm btn-green" id="smCertsExcelBtn">📥 엑셀 다운로드</button>
    </div>
  </div>
  <div class="sm-certs-stats">
    <div class="sm-certs-stat total" data-status="ALL"><div class="sm-certs-stat-label">전체 관리 증서</div><div class="sm-certs-stat-val" id="smCertsCntTotal">0</div></div>
    <div class="sm-certs-stat danger" data-status="DANGER"><div class="sm-certs-stat-label">🚨 초긴급 (15일)</div><div class="sm-certs-stat-val" id="smCertsCntDanger">0</div></div>
    <div class="sm-certs-stat urgent" data-status="URGENT"><div class="sm-certs-stat-label">🟠 긴급 (30일)</div><div class="sm-certs-stat-val" id="smCertsCntUrgent">0</div></div>
    <div class="sm-certs-stat warning" data-status="WARNING"><div class="sm-certs-stat-label">🟡 주의 (60일)</div><div class="sm-certs-stat-val" id="smCertsCntWarning">0</div></div>
  </div>
  <div class="sm-certs-tabs" id="smCertsTabs"></div>
  <div class="sm-certs-controls">
    <input type="search" class="search-input sm-certs-search" id="smCertsSearch" placeholder="증서명, 번호, 기관 검색…">
    <span class="muted" id="smCertsDisplayCount"></span>
  </div>
  <div class="sm-certs-table-wrap">
    <table class="sm-certs-table">
      <thead>
        <tr>
          <th>No</th>
          <th class="sortable" data-col="vessel">선박/조직</th>
          <th class="sortable" data-col="name">증서명</th>
          <th class="sortable" data-col="certNo">증서번호</th>
          <th class="sortable" data-col="issuer">발급처</th>
          <th class="sortable" data-col="issueDate">발급일</th>
          <th class="sortable" data-col="lastAnn">Last Annual</th>
          <th class="sortable" data-col="lastInt">Last Inter.</th>
          <th class="sortable" data-col="expireDate">유효·만료일</th>
          <th class="sortable" data-col="days">D-Day</th>
          <th class="sortable" data-col="rawStatus">상태</th>
          <th class="sortable" data-col="dept">담당부서</th>
          <th class="sortable" data-col="remarks">비고</th>
          <th>관리</th>
        </tr>
      </thead>
      <tbody id="smCertsTableBody"></tbody>
    </table>
  </div>
</div>
<div class="modal-overlay sm-certs-modal hidden" id="smCertsEditModal" role="dialog" aria-modal="true">
  <div class="modal-content sm-certs-modal-content">
    <h3 id="smCertsModalTitle">📝 증서 정보</h3>
    <input type="hidden" id="smCertsEditId">
    <div class="form-row">
      <div class="form-group"><label>선박 / 조직명 *</label><input type="text" id="smCertsEditVessel"></div>
      <div class="form-group"><label>담당부서</label><input type="text" id="smCertsEditDept"></div>
    </div>
    <div class="form-group"><label>증서명 *</label><input type="text" id="smCertsEditName"></div>
    <div class="form-row">
      <div class="form-group"><label>증서번호</label><input type="text" id="smCertsEditCertNo"></div>
      <div class="form-group"><label>발급처</label><input type="text" id="smCertsEditIssuer"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>발급일</label><input type="text" id="smCertsEditIssueDate" placeholder="YYYY-MM-DD"></div>
      <div class="form-group"><label>유효·만료일</label><input type="text" id="smCertsEditExpireDate" placeholder="YYYY-MM-DD or Permanent"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Last Annual</label><input type="text" id="smCertsEditLastAnn"></div>
      <div class="form-group"><label>Last Inter.</label><input type="text" id="smCertsEditLastInt"></div>
    </div>
    <div class="form-group"><label>비고</label><input type="text" id="smCertsEditRemarks"></div>
    <div class="modal-actions">
      <button type="button" class="btn" id="smCertsModalCancel">취소</button>
      <button type="button" class="btn btn-green" id="smCertsModalSave">저장</button>
    </div>
    </div>
</div>`;
        const modal = el('smCertsEditModal');
        if (modal && modal.parentElement !== document.body) {
            document.body.appendChild(modal);
        }
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
        document.querySelectorAll('.sm-certs-stat').forEach(card => {
            card.addEventListener('click', () => {
                filterStatus = card.dataset.status || 'ALL';
                paintTable();
            });
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

    function renderTabs() {
        const tabsEl = el('smCertsTabs');
        if (!tabsEl) return;
        const names = uniqueTabs(allCerts);
        tabsEl.innerHTML = names.map(name => {
            const label = name === 'ALL' ? '전체 보기' : name;
            const active = name === currentTab ? ' active' : '';
            return `<button type="button" class="sm-certs-tab${active}" data-tab="${esc(name)}">${esc(label)}</button>`;
        }).join('');
        tabsEl.querySelectorAll('.sm-certs-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                currentTab = btn.dataset.tab || 'ALL';
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
        const setCnt = (id, n) => { const e = el(id); if (e) e.textContent = `${n}건`; };
        setCnt('smCertsCntTotal', tabScoped.length);
        setCnt('smCertsCntDanger', tabScoped.filter(i => i.rawStatus === 'DANGER').length);
        setCnt('smCertsCntUrgent', tabScoped.filter(i => i.rawStatus === 'URGENT').length);
        setCnt('smCertsCntWarning', tabScoped.filter(i => i.rawStatus === 'WARNING').length);
        const dc = el('smCertsDisplayCount');
        if (dc) dc.textContent = `표시 중: ${filtered.length}건`;

        if (!filtered.length) {
            tbody.innerHTML = '<tr><td colspan="14" class="sm-certs-empty">조건에 맞는 증서가 없습니다.</td></tr>';
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
              <td><span class="sm-certs-badge ${esc(item.badge)}">${esc(TVC_SmCertificates.statusLabel(item.days, item.rawStatus))}</span></td>
              <td>${esc(item.dept)}</td>
              <td class="muted">${esc(item.remarks)}</td>
              <td class="sm-certs-manage">
                <button type="button" class="btn-icon" data-edit="${esc(item.id)}" title="Edit">✏️</button>
                <button type="button" class="btn-icon" data-del="${esc(item.id)}" title="Delete">🗑️</button>
              </td>
            </tr>`;
        }).join('');

        tbody.querySelectorAll('[data-edit]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-edit');
                const row = allCerts.find(c => c.id === id);
                openModal(row);
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
        el('smCertsModalTitle').textContent = row ? '📝 증서 정보 수정' : '➕ 새 증서 추가';
        el('smCertsEditId').value = row?.id || '';
        el('smCertsEditVessel').value = row?.vessel || '';
        el('smCertsEditName').value = row?.name || '';
        el('smCertsEditCertNo').value = row?.certNo || '';
        el('smCertsEditIssuer').value = row?.issuer || '';
        el('smCertsEditIssueDate').value = row?.issueDate || '';
        el('smCertsEditLastAnn').value = row?.lastAnn || '';
        el('smCertsEditLastInt').value = row?.lastInt || '';
        el('smCertsEditExpireDate').value = row?.expireDate || '';
        el('smCertsEditDept').value = row?.dept || '';
        el('smCertsEditRemarks').value = row?.remarks || '';
        el('smCertsEditModal')?.classList.remove('hidden');
        el('smCertsEditModal').style.display = 'flex';
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
        if (!vessel || !name) {
            await TVC_Dialog.alert('선박명과 증서명은 필수입니다.');
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
            expireDate: el('smCertsEditExpireDate').value,
            dept: el('smCertsEditDept').value,
            remarks: el('smCertsEditRemarks').value,
        });
        closeModal();
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
                const refDate = await TVC_SmCertificates.getReferenceDate();
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
                await refreshData();
                await TVC_Dialog.alert('엑셀 데이터를 불러왔습니다.');
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
        const dateInput = el('smCertsDateInput');
        if (dateInput) {
            dateInput.value = await TVC_SmCertificates.getReferenceDate();
        }
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

    return { render, refreshData };
})();
