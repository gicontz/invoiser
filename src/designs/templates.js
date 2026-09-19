import { formatMoney, lineSubtotal } from '../utils/calc.js'

// Plain string templates — no React. The result is set as an iframe's
// srcdoc (preview/print) and used as html2canvas's capture source (PDF/
// email), so it has to be a value, not a live component tree: see
// PreviewPane.jsx and designs/index.js#renderInvoiceHtml.
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ))
}

function optionalP(value, className) {
  if (!value) return ''
  return `<p class="${className}">${escapeHtml(value)}</p>`
}

// Shared structure across all four designs (default/pastel/elegant/flat) —
// each design's look comes from the CSS layered on top via [data-design],
// not from a separate DOM shape. See design/styles/*.md for the intent
// behind each direction.
export function renderInvoiceBody({ designId, biller, client, meta, items, notes, totals, bank, signature }) {
  const currency = meta.currency
  const hasBankDetails = bank.holder || bank.bankName || bank.bankAddress || bank.accountNumber || bank.swift

  const itemsRows = items
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.description) || '—'}</td>
        <td>${item.qty || 0}</td>
        <td>${escapeHtml(formatMoney(parseFloat(item.rate) || 0, currency))}</td>
        <td>${escapeHtml(formatMoney(lineSubtotal(item), currency))}</td>
      </tr>`,
    )
    .join('')

  const cappedRow = totals.capped
    ? `<div><span>Logged total (uncapped)</span><span>${escapeHtml(formatMoney(totals.grandTotal, currency))}</span></div>`
    : ''

  const bankBlock = hasBankDetails
    ? `<div class="preview-bank">
        <h2>Bank Details</h2>
        ${optionalP(bank.holder, 'bank-line')}
        ${optionalP(bank.bankName, 'bank-line')}
        ${optionalP(bank.bankAddress, 'bank-line')}
        ${optionalP(bank.accountNumber, 'bank-line')}
        ${optionalP(bank.swift, 'bank-line')}
      </div>`
    : ''

  const signatureBlock = signature
    ? `<div class="preview-signature"><img src="${signature}" alt="Signature" /></div>`
    : ''

  return `<div class="preview-sheet" data-design="${escapeHtml(designId)}">
    <header class="doc-head">
      <div class="doc-biller">
        <p class="doc-biller-name">${escapeHtml(biller.name) || 'Your name'}</p>
        ${optionalP(biller.address, 'doc-biller-sub')}
        ${optionalP(biller.email, 'doc-biller-sub')}
        ${optionalP(biller.phone, 'doc-biller-sub')}
      </div>
      <div class="doc-meta">
        <span class="doc-meta-label">Invoice</span>
        <span class="doc-meta-num">${escapeHtml(meta.invoiceNumber) || '—'}</span>
        <span class="doc-meta-date">${escapeHtml(meta.invoiceDate) || '—'}</span>
        ${meta.dueDate ? `<span class="doc-meta-date">Due ${escapeHtml(meta.dueDate)}</span>` : ''}
      </div>
    </header>

    <div class="preview-parties">
      <div class="preview-party">
        <h2>Bill to</h2>
        <p>${escapeHtml(client.name) || '—'}</p>
        ${optionalP(client.address, 'preview-muted')}
        ${optionalP(client.email, 'preview-muted')}
        ${optionalP(client.phone, 'preview-muted')}
      </div>
      <div class="preview-party">
        <h2>Currency</h2>
        <p>${escapeHtml(currency) || '—'}</p>
      </div>
    </div>

    <table class="preview-items">
      <thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Subtotal</th></tr></thead>
      <tbody>${itemsRows}</tbody>
    </table>

    ${notes ? `<p class="preview-notes">${escapeHtml(notes)}</p>` : ''}

    <div class="preview-totals">
      <div><span>Subtotal</span><span>${escapeHtml(formatMoney(totals.subtotal, currency))}</span></div>
      <div><span>Tax</span><span>${escapeHtml(formatMoney(totals.tax, currency))}</span></div>
      <div><span>Discount</span><span>${escapeHtml(formatMoney(totals.discount, currency))}</span></div>
      ${cappedRow}
      <div class="preview-grand-total">
        <span>Total Due${totals.capped ? ' (capped)' : ''}</span>
        <span>${escapeHtml(formatMoney(totals.billed, currency))}</span>
      </div>
    </div>

    ${bankBlock}
    ${signatureBlock}
  </div>`
}
