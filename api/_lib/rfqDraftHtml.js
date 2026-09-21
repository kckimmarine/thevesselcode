'use strict';

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function quoteRef(code) {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `RFQ-${y}${m}${day}-${String(code || '000000').slice(-6)}`;
}

/**
 * Printable RFQ acknowledgment / draft quotation (prices TBD — fill before send).
 */
function buildRfqDraftHtml({
    impaCode,
    itemName,
    companyName,
    yourName,
    email,
    message,
    port,
} = {}) {
    const code = String(impaCode || '').trim() || '—';
    const name = String(itemName || '').trim() || 'Marine store item';
    const ref = quoteRef(code);
    const date = new Date().toISOString().slice(0, 10);
    const client = String(companyName || '').trim() || '—';
    const contact = String(yourName || '').trim() || '—';
    const mail = String(email || '').trim() || '—';
    const portLine = String(port || '').trim();
    const notes = String(message || '').trim();

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(ref)} — Draft Quotation</title>
<style>
@page { size: A4 portrait; margin: 14mm; }
body { font-family: "Segoe UI", system-ui, sans-serif; color: #1a202c; margin: 0; font-size: 11pt; }
.sheet { max-width: 210mm; margin: 0 auto; padding: 10mm 0; }
.head { border-bottom: 3px solid #0f766e; padding-bottom: 12px; margin-bottom: 16px; }
.head h1 { margin: 0; color: #0f766e; font-size: 1.35rem; }
.sub { color: #4a5568; font-size: 0.9rem; margin-top: 6px; }
.meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin: 16px 0; font-size: 0.92rem; }
.meta dt { font-weight: 700; color: #2d3748; }
.meta dd { margin: 0 0 8px; }
table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 0.88rem; }
th, td { border: 1px solid #cbd5e0; padding: 8px; vertical-align: top; }
th { background: #ecfdf5; text-align: left; }
.draft-badge { display: inline-block; background: #fef3c7; color: #92400e; font-weight: 800; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; margin-bottom: 8px; }
.notes { white-space: pre-wrap; background: #f7fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; font-size: 0.88rem; }
.foot { margin-top: 20px; font-size: 0.82rem; color: #718096; border-top: 1px solid #e2e8f0; padding-top: 12px; }
.no-print { text-align: center; margin-top: 20px; }
.no-print button { padding: 10px 22px; font-size: 1rem; cursor: pointer; border-radius: 8px; border: none; background: #0f766e; color: #fff; font-weight: 700; }
@media print { .no-print { display: none !important; } }
</style>
</head>
<body>
<div class="sheet">
  <span class="draft-badge">DRAFT — internal / fill unit price before sending</span>
  <header class="head">
    <h1>THE VESSEL CODE (K-TECH)</h1>
    <p class="sub">Pro-forma quotation · Maritime stores &amp; engineering · Busan HQ</p>
  </header>
  <dl class="meta">
    <div><dt>Quotation ref.</dt><dd>${escapeHtml(ref)}</dd></div>
    <div><dt>Date</dt><dd>${escapeHtml(date)}</dd></div>
    <div><dt>Client</dt><dd>${escapeHtml(client)}</dd></div>
    <div><dt>Contact</dt><dd>${escapeHtml(contact)} · ${escapeHtml(mail)}</dd></div>
    ${portLine ? `<div><dt>Delivery hub</dt><dd>${escapeHtml(portLine)}</dd></div>` : ''}
    <div><dt>Valid</dt><dd>14 days from date (unless agreed)</dd></div>
  </dl>
  <table>
    <thead><tr>
      <th>IMPA</th><th>Description</th><th>Qty</th><th>Unit</th><th>Unit price (USD)</th><th>Lead time</th>
    </tr></thead>
    <tbody><tr>
      <td>${escapeHtml(code)}</td>
      <td>${escapeHtml(name)}</td>
      <td>TBD</td>
      <td>PCS</td>
      <td>TBD</td>
      <td>TBD</td>
    </tr></tbody>
  </table>
  ${notes ? `<h2 style="font-size:1rem;margin:16px 0 8px;">Inquiry notes</h2><div class="notes">${escapeHtml(notes)}</div>` : ''}
  <footer class="foot">
    THE VESSEL CODE (K-TECH) · 100, Dongmyeong-ro 105beon-gil, Nam-gu, Busan · Office +82-51-628-8889 · Hotline +82-10-3889-4291 · thevesselcode.com
  </footer>
  <p class="no-print"><button type="button" onclick="window.print()">Print / Save as PDF</button></p>
</div>
</body>
</html>`;
}

module.exports = {
    buildRfqDraftHtml,
    quoteRef,
};
