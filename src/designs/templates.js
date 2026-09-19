import { formatMoney, lineSubtotal } from '../utils/calc.js'

// Plain string templates — no React. The result is set as an iframe's
// srcdoc for preview/print, and rendered server-side via Playwright for
// PDF/email, so it has to be a value, not a live component tree: see
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

// Classic official-receipt convention (required on PH BIR invoices, and a
// sensible anti-tampering habit generally): close off the itemized list so
// nothing can be added below the last printed line.
const NOTHING_FOLLOWS = '**** Nothing Follows ****'

function pageNumberHtml(pageNumber, totalPages) {
  if (totalPages < 2) return ''
  return `<div class="doc-page-number">Page ${pageNumber} of ${totalPages}</div>`
}

function hoursOf(items) {
  return items
    .filter((item) => item.unit === 'per hour')
    .reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0)
}

function formatHours(value) {
  if (!Number.isFinite(value) || value === 0) return '0'
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// meta.invoiceDate/dueDate are plain YYYY-MM-DD strings from <input
// type="date">. Parsed manually (not via `new Date(iso)`) to sidestep the
// classic UTC-parse/local-format timezone shift that can display the
// wrong day.
export function formatDate(iso) {
  if (!iso) return ''
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return iso
  return `${MONTHS[month - 1]} ${String(day).padStart(2, '0')}, ${year}`
}

// Groups items by their `group` field (falling back to the item's own
// description, then a generic label, so nothing is silently dropped when a
// user hasn't assigned a group). Each group's total is the sum of its
// items' line subtotals ("subtotal" is reserved for a single line item —
// see the per-item breakdown on the Order Details page); `hours` sums qty
// for its per-hour items, since a group can mix billing units.
function groupItems(items) {
  const map = new Map()
  for (const item of items) {
    const key = (item.group || '').trim() || item.description?.trim() || 'Item'
    if (!map.has(key)) map.set(key, { name: key, items: [] })
    map.get(key).items.push(item)
  }
  return [...map.values()].map((group) => ({
    ...group,
    total: group.items.reduce((sum, item) => sum + lineSubtotal(item), 0),
    hours: hoursOf(group.items),
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
  // This table is only ever rendered on page 1, and Separate Items being
  // off means there's never a second page — so it's always the last
  // (only) itemized page.
  return `<table class="preview-items">
    <thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Subtotal</th></tr></thead>
    <tbody>
      ${rows}
      <tr class="nothing-follows-row"><td colspan="4">${NOTHING_FOLLOWS}</td></tr>
    </tbody>
  </table>`
}

function renderGroupSummaryTable(groups, currency) {
  const rows = groups
    .map(
      (group) => `
      <tr>
        <td>${escapeHtml(group.name)}</td>
        <td>${escapeHtml(formatHours(group.hours))}</td>
        <td>${escapeHtml(formatMoney(group.total, currency))}</td>
      </tr>`,
    )
    .join('')
  return `<table class="preview-items preview-items-grouped">
    <thead><tr><th>Group</th><th>Hours</th><th>Total</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`
}

function renderOrderDetailsPage(groups, currency, meta, totalPages) {
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

  // Whenever this page exists, it's always the last (and only other)
  // itemized page — page 1's summary table is an aggregate index, not
  // itself the itemized list.
  return `<div class="doc-page order-details">
    <div class="order-details-header">
      <span>Invoice ${escapeHtml(meta.invoiceNumber) || '—'}</span>
      <span>Order Details</span>
    </div>
    ${groupBlocks}
    <p class="nothing-follows">${NOTHING_FOLLOWS}</p>
    ${pageNumberHtml(2, totalPages)}
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
// Output is one or two `.doc-page` blocks — page 1 is always the invoice
// itself; a second "Order Details" page only exists when Separate Items is
// on and produces any groups. Native print paginates them via @media
// print's break-before rule (document.css); PDF export (renderInvoicePdf.js)
// renders the same stylesheet through Playwright, so it paginates the same
// way.
export function renderInvoiceBody({
  designId, biller, client, meta, items, notes, totals, bank, signature, signatoryName, separateItems,
}) {
  const currency = meta.currency
  const hasBankDetails = bank.holder || bank.bankName || bank.bankAddress || bank.accountNumber || bank.swift
  const groups = separateItems ? groupItems(items) : null
  const hasPage2 = Boolean(separateItems && groups && groups.length > 0)
  const totalPages = hasPage2 ? 2 : 1
  const invoiceTotalHours = hoursOf(items)

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
        <span class="doc-meta-date">${escapeHtml(formatDate(meta.invoiceDate)) || '—'}</span>
        ${meta.dueDate ? `<span class="doc-meta-date">Due ${escapeHtml(formatDate(meta.dueDate))}</span>` : ''}
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
      ${invoiceTotalHours > 0 ? `<div><span>Total Hours</span><span>${escapeHtml(formatHours(invoiceTotalHours))}</span></div>` : ''}
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
    ${pageNumberHtml(1, totalPages)}
  </div>`

  const page2 = hasPage2 ? renderOrderDetailsPage(groups, currency, meta, totalPages) : ''

  return `<div class="preview-sheet" data-design="${escapeHtml(designId)}">${page1}${page2}</div>`
}
