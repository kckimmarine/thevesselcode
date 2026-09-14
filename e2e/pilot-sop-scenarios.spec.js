const { test, expect } = require('@playwright/test');
const {
  attachErrorHooks,
  login,
  logout,
  switchTab,
  dismissAllDialogs,
  waitForJobs,
} = require('./helpers/app');
const {
  alignDemoVesselScope,
  waitForAppBoot,
  findReportByMarker,
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
  getReportDimensionalMeasurements,
} = require('./helpers/pilot');

test.describe.configure({ mode: 'serial' });

const QTY = 2;
const DEPT = 'ENGINE';

test('Pilot SOP A–E: closed-loop work report, sync, SM approve, vessel inward', async ({ page }) => {
  test.setTimeout(300_000);
  attachErrorHooks(page, 'pilot-sop');

  const marker = `PILOT-SOP-${Date.now()}`;
  let spareId = '';
  let stockBefore = 0;
  let reportId = '';

  // —— Step A: Engine officer — work report + spare qty 2 ——
  await login(page, 'engine');
  await waitForAppBoot(page);
  await alignDemoVesselScope(page);

  await switchTab(page, 'actual', 'engine');
  expect(await waitForJobs(page, 60_000)).toBeTruthy();

  await page.locator('#actScroll .vl-cells[data-job-id]').first().click();
  await page.waitForTimeout(200);
  await page.locator('#planReportBtn').click();
  await expect(page.locator('#workReportModal:not(.hidden)')).toBeVisible({ timeout: 15_000 });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);

  const btnSave = page.locator('#btn-save');
  await expect(btnSave).toBeVisible();
  const saveBox = await btnSave.boundingBox();
  expect(saveBox?.height ?? 0, '#btn-save touch target height').toBeGreaterThanOrEqual(44);
  const primarySubmit = page.locator('#workReportModal button.btn-primary').first();
  await expect(primarySubmit).toBeVisible();
  const primaryBox = await primarySubmit.boundingBox();
  expect(primaryBox?.height ?? 0, 'primary submit touch target height').toBeGreaterThanOrEqual(44);

  const modal = page.locator('#workReportModal:not(.hidden)');
  const measToggle = modal.locator('.wr-meas-toggle');
  if (await measToggle.isVisible().catch(() => false)) {
    await measToggle.click();
    await expect(modal.locator('#wrMeasBody:not(.hidden)')).toBeVisible({ timeout: 5_000 });
    const firstRow = modal.locator('#wrMeasTbody tr.wr-meas-row').first();
    await firstRow.locator('[data-meas="item_name"]').fill('Liner Wear');
    await firstRow.locator('[data-meas="design_val"]').fill('10');
    await firstRow.locator('[data-meas="tolerance_limit"]').fill('1');
    await firstRow.locator('[data-meas="measured_val"]').fill('1.5');
    await firstRow.locator('[data-meas="unit"]').fill('mm');
    await expect(firstRow.locator('.wr-meas-exceeded')).toHaveText('EXCEEDED');
    const measuredInp = firstRow.locator('[data-meas="measured_val"]');
    await expect(measuredInp).toHaveAttribute('inputmode', 'numeric');
  } else {
    throw new Error('ClassNK measurements section missing from Work Report modal');
  }

  const saved = await saveOpenWorkReportWithSpare(page, { marker, qty: QTY });
  reportId = saved.reportId;
  spareId = saved.spareId;
  stockBefore = saved.stockBefore;
  expect(saved.status).toBe('REPORTED');
  expect(saved.stock_applied_at, 'stock_applied_at after save').toBeTruthy();
  expect(saved.stockAfter).toBe(stockBefore - QTY);

  const idbMeas = await getReportDimensionalMeasurements(page, saved.reportId);
  const linerRow = idbMeas.find((m) => String(m.item_name || '').includes('Liner Wear'));
  expect(linerRow, 'dimensional_measurements persisted on report_form').toBeTruthy();
  expect(Number(linerRow.measured_val)).toBe(1.5);
  expect(Number(linerRow.tolerance_limit)).toBe(1);
  expect(Number(linerRow.measured_val)).toBeGreaterThan(Number(linerRow.tolerance_limit));

  await logout(page);

  // —— Step B: CE confirm + Captain RBAC ——
  await login(page, 'ce');
  await waitForAppBoot(page);
  await alignDemoVesselScope(page);

  const ceConfirm = await confirmReport(page, reportId);
  expect(ceConfirm.ok, ceConfirm.message || ceConfirm.code).toBeTruthy();
  expect(ceConfirm.status).toBe('CONFIRMED');

  const afterCe = await findReportByMarker(page, marker);
  expect(afterCe.status).toBe('CONFIRMED');

  await logout(page);
  await login(page, 'captain');
  await waitForAppBoot(page);
  await alignDemoVesselScope(page);

  const captainTry = await tryConfirmReport(page, reportId);
  expect(captainTry.ok, 'Captain must not confirm Engine dept reports').toBeFalsy();

  await logout(page);

  // —— Step C: Captain export ZIP integrity ——
  await login(page, 'captain');
  await waitForAppBoot(page);
  await alignDemoVesselScope(page);

  const exported = await captainExportShipToSm(page, DEPT, reportId);
  expect(exported.record_count).toBeGreaterThan(0);
  const payload = await parseZipPayload(exported.bytes);
  expect(payload.export_meta?.direction).toBe('SHIP_TO_SM');
  const zipReport = (payload.daily_work_reports || []).find((r) => r.id === reportId);
  expect(zipReport, 'ZIP contains confirmed report').toBeTruthy();
  expect(String(zipReport.status || '').toUpperCase()).toBe('CONFIRMED');
  const zipMeas = zipReport.report_form?.dimensional_measurements || [];
  const zipLiner = zipMeas.find((m) => String(m.item_name || '').includes('Liner Wear'));
  expect(zipLiner, 'ZIP carries ClassNK dimensional_measurements').toBeTruthy();
  expect(Number(zipLiner.measured_val)).toBeGreaterThan(Number(zipLiner.tolerance_limit));

  const zipSpare = (payload.spare_parts || []).find((s) => s.id === spareId);
  if (zipSpare) {
    const zipQty = typeof zipSpare.qty_on_hand !== 'undefined' ? Number(zipSpare.qty_on_hand) : null;
    if (zipQty != null) expect(zipQty).toBe(stockBefore - QTY);
  }
  const zipUsed = (zipReport.used_parts || []).find((p) => String(p.spare_part_id) === String(spareId));
  if (zipUsed) expect(Number(zipUsed.qty_used)).toBe(QTY);

  await logout(page);

  // —— Step D: SM import + Approve + vessel edit lock ——
  await login(page, 'sm');
  await waitForAppBoot(page);
  await alignDemoVesselScope(page);

  await importSyncZipBytes(page, DEPT, exported.bytes, exported.filename);

  const smApprove = await approveReport(page, reportId);
  expect(smApprove.ok, smApprove.message || smApprove.code).toBeTruthy();
  expect(smApprove.status).toBe('APPROVED');
  expect(smApprove.is_locked).toBeTruthy();

  const lockedSm = await canEngineerEditReport(page, reportId);
  expect(lockedSm.status).toBe('APPROVED');
  expect(lockedSm.is_locked).toBeTruthy();
  expect(lockedSm.can).toBeFalsy();

  const smFeedback = await smExportFeedbackToShip(page, DEPT, reportId);
  expect(smFeedback.record_count).toBeGreaterThan(0);
  expect(smFeedback.direction).toBe('SM_TO_SHIP');
  const feedbackPayload = await parseZipPayload(smFeedback.bytes);
  expect(feedbackPayload.export_meta?.direction).toBe('SM_TO_SHIP');
  const fbReport = (feedbackPayload.daily_work_reports || []).find((r) => r.id === reportId);
  expect(fbReport, 'SM feedback ZIP contains approved report').toBeTruthy();
  expect(String(fbReport.status || '').toUpperCase()).toBe('APPROVED');

  await logout(page);

  // —— Step E: Vessel inward sync (SM_TO_SHIP) — Captain ingest, Engineer UI lock ——
  await login(page, 'captain');
  await waitForAppBoot(page);
  await alignDemoVesselScope(page);

  await importSyncZipBytes(page, DEPT, smFeedback.bytes, smFeedback.filename);

  const onShip = await findReportByMarker(page, marker);
  expect(onShip.status).toBe('APPROVED');
  expect(onShip.is_locked).toBeTruthy();
  expect(onShip.stock_applied_at).toBeTruthy();

  await logout(page);
  await login(page, 'engine');
  await waitForAppBoot(page);
  await alignDemoVesselScope(page);

  const lockedShip = await canEngineerEditReport(page, reportId);
  expect(lockedShip.status).toBe('APPROVED');
  expect(lockedShip.is_locked).toBeTruthy();
  expect(lockedShip.can).toBeFalsy();

  await switchTab(page, 'history', 'engine');
  await page.waitForTimeout(400);
  await openWorkReportHistoryView(page, reportId);
  await assertVesselWorkReportUiLocked(page);
});
