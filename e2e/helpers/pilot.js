/** Pilot SOP — IndexedDB / sync helpers for Playwright */
const JSZip = require('jszip');
const { expect } = require('@playwright/test');
const { dismissAllDialogs, closeTopModal } = require('./app');

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
      const desc = String(r.description || '').trim();
      return outline.includes(m) || comments.includes(m) || desc.includes(m);
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

async function importSyncZipBytes(page, dept, bytes, filename) {
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

async function smExportFeedbackToShip(page, dept, reportId) {
  return page.evaluate(async ({ d, rid }) => {
    const user = TVC_Auth.getCurrentUser();
    const built = await TVC_Sync.buildExportZipBlob(user, 'SM_TO_SHIP', d, {
      monthlyExport: true,
      reportIds: [rid],
    });
    const ab = await built.blob.arrayBuffer();
    return {
      bytes: Array.from(new Uint8Array(ab)),
      filename: built.filename,
      direction: built.payload?.export_meta?.direction,
      record_count: built.record_count,
    };
  }, { d: dept, rid: reportId });
}

async function openWorkReportHistoryView(page, reportId) {
  await page.evaluate(async (rid) => {
    const rep = await TVC_DB.get('daily_work_reports', rid);
    if (!rep) throw new Error('report missing');
    const jobId = rep.maintenance_job_id
      || rep.job_items?.[0]?.maintenance_job_id
      || null;
    const jobCode = rep.job_code || rep.job_items?.[0]?.job_code;
    let jid = jobId;
    if (!jid && jobCode) {
      const jobs = await TVC_DB.getAll('maintenance_jobs');
      const job = jobs.find((j) => j.job_code === jobCode);
      jid = job?.id;
    }
    if (!jid) throw new Error('job id missing for history open');
    await TVC_App.openWorkReportFromHistory(rid, jid, { fromHistory: true, view: true });
  }, reportId);
}

async function assertVesselWorkReportUiLocked(page) {
  const modal = page.locator('#workReportModal:not(.hidden)');
  await modal.waitFor({ state: 'visible', timeout: 15_000 });
  const modify = modal.locator('button', { hasText: 'Modify' }).first();
  if (await modify.count()) {
    await modify.waitFor({ state: 'visible', timeout: 5_000 });
    expect(await modify.isDisabled()).toBeTruthy();
  }
  const save = modal.locator('button.btn-green', { hasText: 'Save' });
  if (await save.count()) expect(await save.isHidden().catch(() => true) || await save.isDisabled()).toBeTruthy();

  const page2 = modal.locator('.wr-pagetab', { hasText: 'Page 2' });
  if (await page2.isVisible().catch(() => false)) {
    await page2.click();
    await page.waitForTimeout(350);
    const qtyInputs = modal.locator('.spare-consume-qty-input');
    const n = await qtyInputs.count();
    for (let i = 0; i < n; i++) {
      const input = qtyInputs.nth(i);
      if (await input.isVisible().catch(() => false)) {
        expect(await input.isDisabled()).toBeTruthy();
      }
    }
    const checks = modal.locator('#wrSpareListScroll .spare-row-chk');
    const c = await checks.count();
    for (let i = 0; i < Math.min(c, 5); i++) {
      const chk = checks.nth(i);
      if (await chk.isVisible().catch(() => false)) {
        expect(await chk.isDisabled()).toBeTruthy();
      }
    }
  }
}

async function parseZipPayload(bytes) {
  const zip = await JSZip.loadAsync(Buffer.from(bytes));
  const raw = await zip.file('tvc_sync.json').async('string');
  return JSON.parse(raw);
}

async function ensureWrSparePartsVisible(page, modal) {
  const countEl = modal.locator('#wrSpareCount');
  const countText = ((await countEl.textContent().catch(() => '')) || '').trim();
  const showAllBtn = modal.locator('#wrSpareSelectedBtn');
  if (await showAllBtn.isVisible().catch(() => false)) {
    const pressed = await showAllBtn.getAttribute('aria-pressed');
    if (pressed === 'true') await showAllBtn.click();
    await page.waitForTimeout(250);
  }

  const needsAllGroups = countText.startsWith('0 /') || countText === '0';
  if (needsAllGroups) {
    const treeToggle = modal.locator('button[onclick*="wrSpareToggleGroupTree"]');
    if (await treeToggle.isVisible().catch(() => false)) {
      await treeToggle.click();
      await page.waitForTimeout(200);
      const allGroups = modal.locator('.tree-node', { hasText: 'All Groups' });
      if (await allGroups.first().isVisible().catch(() => false)) {
        await allGroups.first().click();
        await page.waitForTimeout(400);
      }
    }
  }

  await page.waitForFunction(() => {
    const root = document.querySelector('#workReportModal #wrSpareListScroll');
    if (!root || root.querySelector('.spare-empty-list')) return false;
    const label = document.querySelector('#workReportModal #wrSpareCount')?.textContent || '';
    if (/^\s*0\s*\/\s*/.test(label)) return false;
    return root.querySelectorAll('.spare-row-chk').length > 0
      || root.querySelectorAll('[data-spare-id]').length > 0;
  }, null, { timeout: 60_000 });
}

/**
 * Human flow: scroll virtual list → check spare row → qty input appears.
 */
async function pickWrSpareQtyInput(page, modal) {
  const scroll = modal.locator('#wrSpareListScroll');
  await scroll.waitFor({ state: 'attached', timeout: 20_000 });
  await ensureWrSparePartsVisible(page, modal);

  const hscroll = modal.locator('.spare-req-table-hscroll').filter({ has: scroll });

  for (let pass = 0; pass < 100; pass++) {
    const checks = modal.locator('#wrSpareListScroll .spare-row-chk:not([disabled])');
    const n = await checks.count();
    for (let i = 0; i < n; i++) {
      const chk = checks.nth(i);
      if (!(await chk.isVisible())) continue;
      if (!(await chk.isChecked())) {
        await chk.check({ force: true });
        await page.waitForTimeout(180);
      }
      const row = chk.locator('xpath=ancestor::*[@data-spare-id][1]');
      const input = row.locator('.spare-consume-qty-input:not([disabled])');
      if (await input.count() && await input.first().isVisible()) return input.first();
    }
    await scroll.evaluate((el) => { el.scrollTop += Math.max(120, Math.floor(el.clientHeight * 0.85)); });
    if (await hscroll.count()) {
      await hscroll.first().evaluate((el) => { el.scrollLeft += 100; }).catch(() => {});
    }
    await page.waitForTimeout(120);
  }
  throw new Error('Work Report Page 2: no visible spare qty input after scrolling virtual list');
}

/** Human-like: Page 2 spare qty + Save (no TVC_SpareMenu.wrSpareSetQty bypass). */
async function saveOpenWorkReportWithSpare(page, { marker, qty }) {
  const modal = page.locator('#workReportModal:not(.hidden)');
  await modal.waitFor({ state: 'visible', timeout: 15_000 });

  const outline = modal.locator('[data-wf="outline"]');
  if (await outline.isVisible().catch(() => false)) {
    await outline.fill(marker);
  }

  const page2 = modal.locator('.wr-pagetab', { hasText: 'Page 2' });
  await page2.waitFor({ state: 'visible', timeout: 10_000 });
  await page2.click();
  await page.waitForTimeout(400);

  const qtyInput = await pickWrSpareQtyInput(page, modal);
  const spareRow = qtyInput.locator('xpath=ancestor::*[@data-spare-id][1]');
  const spareId = await spareRow.getAttribute('data-spare-id');
  if (!spareId) throw new Error('Could not resolve data-spare-id from selected row');

  const before = await spareStock(page, spareId);
  if (!before || before.qty < qty) {
    throw new Error(`Insufficient stock for spare ${spareId}: have ${before?.qty}, need ${qty}`);
  }

  await qtyInput.click();
  await qtyInput.fill(String(qty));
  await qtyInput.dispatchEvent('change');
  await page.waitForTimeout(200);

  const page1 = modal.locator('.wr-pagetab', { hasText: 'Page 1' });
  if (await page1.isVisible().catch(() => false)) await page1.click();

  const save = modal.locator('button.btn-green', { hasText: 'Save' }).first();
  await save.click();
  await page.waitForTimeout(500);
  await dismissAllDialogs(page, true);
  await page.waitForTimeout(300);
  await dismissAllDialogs(page, true);
  if (await modal.isVisible().catch(() => false)) await closeTopModal(page);

  const saved = await findReportByMarker(page, marker);
  if (!saved) throw new Error('Report not found after UI save');

  const stockAfter = await spareStock(page, spareId);
  return {
    reportId: saved.id,
    spareId,
    stockBefore: before.qty,
    stockAfter: stockAfter?.qty,
    status: saved.status,
    stock_applied_at: saved.stock_applied_at,
  };
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
  importSyncZipBytes,
  smExportFeedbackToShip,
  openWorkReportHistoryView,
  assertVesselWorkReportUiLocked,
  parseZipPayload,
  saveOpenWorkReportWithSpare,
  pickWrSpareQtyInput,
};
