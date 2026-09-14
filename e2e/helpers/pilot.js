/** Pilot SOP — IndexedDB / sync helpers for Playwright */
const JSZip = require('jszip');

const DEMO_VESSEL_ID = 'ABC Voyager';

async function alignDemoVesselScope(page) {
  await page.evaluate(async (vesselId) => {
    if (typeof TVC_DB !== 'undefined' && TVC_META_KEYS?.VESSEL_ID) {
      await TVC_DB.setMeta(TVC_META_KEYS.VESSEL_ID, vesselId);
    }
    if (typeof TVC_Fleet !== 'undefined') {
      if (typeof TVC_Fleet.setSelectedId === 'function') TVC_Fleet.setSelectedId(vesselId);
      else try { localStorage.setItem('tvc_fleet_selected_vessel', vesselId); } catch (_) { /* noop */ }
    }
    if (typeof TVC_App !== 'undefined' && TVC_App.refreshAll) await TVC_App.refreshAll();
  }, DEMO_VESSEL_ID);
}

async function waitForAppBoot(page) {
  await page.waitForFunction(() => {
    const shell = document.querySelector('#appShell');
    return typeof TVC_DB !== 'undefined'
      && typeof TVC_Auth !== 'undefined'
      && shell && !shell.classList.contains('hidden');
  }, null, { timeout: 45_000 });
}

async function findReportByMarker(page, marker) {
  return page.evaluate(async (m) => {
    const reports = await TVC_DB.getAll('daily_work_reports');
    const hit = (reports || []).find((r) => {
      const outline = String(r.outline || r.report_form?.outline || r.outline_of_maintenance || '').trim();
      const comments = String(r.ship_comments || r.report_form?.shipComments || '').trim();
      return outline.includes(m) || comments.includes(m);
    });
    if (!hit) return null;
    return {
      id: hit.id,
      status: String(hit.status || '').toUpperCase(),
      stock_applied_at: hit.stock_applied_at || '',
      used_parts: hit.used_parts || [],
      is_locked: !!hit.is_locked,
      sync_status: hit.sync_status || '',
    };
  }, marker);
}

async function spareStock(page, spareId) {
  return page.evaluate(async (id) => {
    const sp = await TVC_DB.get('spare_parts', id);
    if (!sp) return null;
    const qty = typeof TVC_Inventory !== 'undefined' ? TVC_Inventory.currentStock(sp) : Number(sp.qty_on_hand);
    return { id, qty: Number(qty), part_no: sp.part_no || sp.maker_part_no };
  }, spareId);
}

async function confirmReport(page, reportId) {
  return page.evaluate(async (id) => {
    const user = TVC_Auth.getCurrentUser();
    try {
      await TVC_Transaction.confirmReport(user, id);
      if (typeof TVC_App !== 'undefined' && TVC_App.refreshAll) await TVC_App.refreshAll();
      const row = await TVC_DB.get('daily_work_reports', id);
      return { ok: true, status: String(row?.status || '').toUpperCase() };
    } catch (e) {
      return { ok: false, code: e.code || '', message: e.message || String(e) };
    }
  }, reportId);
}

async function tryConfirmReport(page, reportId) {
  return confirmReport(page, reportId);
}

async function approveReport(page, reportId, comment = 'Pilot SOP E2E — Approved') {
  return page.evaluate(async ({ id, cmt }) => {
    const user = TVC_Auth.getCurrentUser();
    try {
      await TVC_Transaction.approveReport(user, id, cmt);
      if (typeof TVC_App !== 'undefined' && TVC_App.refreshAll) await TVC_App.refreshAll();
      const row = await TVC_DB.get('daily_work_reports', id);
      return {
        ok: true,
        status: String(row?.status || '').toUpperCase(),
        is_locked: !!row?.is_locked,
      };
    } catch (e) {
      return { ok: false, code: e.code || '', message: e.message || String(e) };
    }
  }, { id: reportId, cmt: comment });
}

async function canEngineerEditReport(page, reportId) {
  return page.evaluate(async (id) => {
    const user = await TVC_DB.get('users', 'user-engineer').catch(() => null)
      || { username: 'engineer', role: 'SHIP_ENGINEER', department: 'ENGINE', account_type: 'SHIP' };
    const row = await TVC_DB.get('daily_work_reports', id);
    if (!row || typeof TVC_RBAC === 'undefined') return { can: false, reason: 'missing' };
    const can = typeof TVC_RBAC.canEditDailyReport === 'function'
      ? TVC_RBAC.canEditDailyReport(user, row)
      : !TVC_RBAC.isApprovedStatus(row.status, row.is_locked);
    return { can: !!can, status: String(row.status || '').toUpperCase(), is_locked: !!row.is_locked };
  }, reportId);
}

async function captainExportShipToSm(page, dept, reportId) {
  return page.evaluate(async ({ d, rid }) => {
    const user = TVC_Auth.getCurrentUser();
    const built = await TVC_Sync.buildExportZipBlob(user, 'SHIP_TO_SM', d, {
      monthlyExport: true,
      reportIds: [rid],
    });
    const ab = await built.blob.arrayBuffer();
    const bytes = Array.from(new Uint8Array(ab));
    return {
      bytes,
      filename: built.filename,
      payload: built.payload,
      record_count: built.record_count,
    };
  }, { d: dept, rid: reportId });
}

async function smImportZipBytes(page, dept, bytes, filename) {
  return page.evaluate(async ({ d, arr, name }) => {
    const user = TVC_Auth.getCurrentUser();
    const u8 = new Uint8Array(arr);
    const file = new File([u8], name || 'pilot-sop.zip', { type: 'application/zip' });
    const payload = await TVC_Sync.importZip(user, file, d, {});
    if (typeof TVC_App !== 'undefined' && TVC_App.refreshAll) await TVC_App.refreshAll();
    return {
      direction: payload?.export_meta?.direction,
      reportCount: (payload?.daily_work_reports || []).length,
    };
  }, { d: dept, arr: bytes, name: filename });
}

async function parseZipPayload(bytes) {
  const zip = await JSZip.loadAsync(Buffer.from(bytes));
  const raw = await zip.file('tvc_sync.json').async('string');
  return JSON.parse(raw);
}

/** UI-opened work report: set spare qty via TVC_SpareMenu API and save (bypasses virtualized Page 2 list). */
async function saveOpenWorkReportWithSpare(page, { marker, qty }) {
  return page.evaluate(async ({ marker, qty }) => {
    const spares = await TVC_DB.getAll('spare_parts');
    const spare = spares.find((s) => {
      const dept = String(s.department || 'ENGINE').toUpperCase();
      if (dept && dept !== 'ENGINE') return false;
      return TVC_Inventory.currentStock(s) >= qty;
    });
    if (!spare) throw new Error('No ENGINE spare with sufficient stock');

    const stockBefore = TVC_Inventory.currentStock(spare);
    const outlineEl = document.querySelector('#workReportModal [data-wf="outline"]');
    if (outlineEl) {
      outlineEl.value = marker;
      outlineEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (typeof TVC_App.captureWorkReportForm === 'function') TVC_App.captureWorkReportForm();
    TVC_SpareMenu.wrSpareSetQty(spare.id, qty);

    const prevConfirm = TVC_Dialog.confirm;
    const prevAlert = TVC_Dialog.alert;
    TVC_Dialog.confirm = async () => true;
    TVC_Dialog.alert = async () => {};
    try {
      await TVC_App.saveWorkReport();
    } finally {
      TVC_Dialog.confirm = prevConfirm;
      TVC_Dialog.alert = prevAlert;
    }
    if (typeof TVC_App.refreshAll === 'function') await TVC_App.refreshAll();

    const reports = await TVC_DB.getAll('daily_work_reports');
    const hit = (reports || []).find((r) => String(r.outline || r.description || '').includes(marker)
      || String(r.report_form?.outline || '').includes(marker));
    if (!hit) throw new Error('Report not found after save');

    return {
      reportId: hit.id,
      spareId: spare.id,
      stockBefore,
      stockAfter: TVC_Inventory.currentStock(await TVC_DB.get('spare_parts', spare.id)),
      status: String(hit.status || '').toUpperCase(),
      stock_applied_at: hit.stock_applied_at || '',
    };
  }, { marker, qty });
}

module.exports = {
  DEMO_VESSEL_ID,
  alignDemoVesselScope,
  waitForAppBoot,
  findReportByMarker,
  spareStock,
  confirmReport,
  tryConfirmReport,
  approveReport,
  canEngineerEditReport,
  captainExportShipToSm,
  smImportZipBytes,
  parseZipPayload,
  saveOpenWorkReportWithSpare,
};
