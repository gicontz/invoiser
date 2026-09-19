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

// Groups items by their `group` field (falling back to the item's own
// description, then a generic label, so nothing is silently dropped when a
// user hasn't assigned a group). Each group's subtotal is the sum of its
// items' line subtotals — this is what the summary table shows; the
// per-item breakdown moves to the Order Details page.
function groupItems(items) {
  const map = new Map()
  for (const item of items) {
    const key = (item.group || '').trim() || item.description?.trim() || 'Item'
    if (!map.has(key)) map.set(key, { name: key, items: [] })
    map.get(key).items.push(item)
  }
  return [...map.values()].map((group) => ({
    ...group,
    subtotal: group.items.reduce((sum, item) => sum + lineSubtotal(item), 0),
  }))
}

function renderFlatItemsTable(items, currency) {
  const rows = items
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
  return `<table class="preview-items">
    <thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Subtotal</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`
}

function renderGroupSummaryTable(groups, currency) {
  const rows = groups
    .map(
      (group) => `
      <tr>
        <td>${escapeHtml(group.name)}</td>
        <td>${escapeHtml(formatMoney(group.subtotal, currency))}</td>
      </tr>`,
    )
    .join('')
  return `<table class="preview-items preview-items-grouped">
    <thead><tr><th>Group</th><th>Subtotal</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`
}

function renderOrderDetailsPage(groups, currency, meta) {
  const groupBlocks = groups
    .map((group) => {
      const rows = group.items
        .map(
          (item) => `
          <div class="order-detail-row">
            <span class="order-detail-desc">${escapeHtml(item.description) || '—'}</span>
            <span class="order-detail-meta">${item.qty || 0} ${escapeHtml(item.unit || '')} &times;
              ${escapeHtml(formatMoney(parseFloat(item.rate) || 0, currency))} =
              ${escapeHtml(formatMoney(lineSubtotal(item), currency))}</span>
          </div>`,
        )
        .join('')
      return `<div class="order-detail-group">
        <h4 class="order-detail-name">${escapeHtml(group.name)}</h4>
        ${rows}
      </div>`
    })
    .join('')

  return `<div class="doc-page order-details">
    <div class="order-details-header">
      <span>Invoice ${escapeHtml(meta.invoiceNumber) || '—'}</span>
      <span>Order Details</span>
    </div>
    ${groupBlocks}
  </div>`
}

function renderSignatureBlock(signature, signatoryName) {
  if (!signature && !signatoryName) return ''
  return `<div class="doc-signature">
    ${signature ? `<img src="${signature}" alt="Signature" class="doc-signature-img" />` : '<div class="doc-signature-blank"></div>'}
    <div class="doc-signature-line"></div>
    ${signatoryName ? `<p class="doc-signatory-name">${escapeHtml(signatoryName)}</p>` : ''}
    <p class="doc-signatory-label">Authorized Signatory</p>
  </div>`
}

// Shared structure across all four designs (default/pastel/elegant/flat) —
// each design's look comes from the CSS layered on top via [data-design],
// not from a separate DOM shape. See design/styles/*.md for the intent
// behind each direction.
//
// Output is one or two `.doc-page` blocks (see utils/pdf.js and
// PreviewPane.jsx#getCapturePages, which capture each as its own A4 page):
// page 1 is always the invoice itself; a second "Order Details" page only
// exists when Separate Items is on and produces any groups.
export function renderInvoiceBody({
  designId, biller, client, meta, items, notes, totals, bank, signature, signatoryName, separateItems,
}) {
  const currency = meta.currency
  const hasBankDetails = bank.holder || bank.bankName || bank.bankAddress || bank.accountNumber || bank.swift
  const groups = separateItems ? groupItems(items) : null

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

  const page1 = `<div class="doc-page">
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

    ${separateItems ? renderGroupSummaryTable(groups, currency) : renderFlatItemsTable(items, currency)}

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

    <div class="doc-footer">
      <div class="doc-footer-bank">${bankBlock}</div>
      <div class="doc-footer-signature">${renderSignatureBlock(signature, signatoryName)}</div>
    </div>
  </div>`

  const page2 = separateItems && groups.length > 0 ? renderOrderDetailsPage(groups, currency, meta) : ''

  return `<div class="preview-sheet" data-design="${escapeHtml(designId)}">${page1}${page2}</div>`
}
