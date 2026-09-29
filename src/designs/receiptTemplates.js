import { computeTotals, formatMoney } from '../utils/calc.js'
import { escapeHtml, formatDate, renderSignatureBlock } from './templates.js'

// Acknowledgement Receipt (issue #52) — a short, customer-facing courtesy
// document confirming a paid invoice's payment was received. Not a new
// financial record: every number here is derived from the invoice and its
// embedded payments ledger (memory/decisions.md D7).
//
// Same rules as templates.js (D1): plain string templates, no React, every
// user-provided string through escapeHtml(). The output shares the invoice
// designs' [data-design] CSS (document.css/themes.css) so a receipt looks
// like it came from the same letterhead as the invoice it acknowledges.
// Pure module (no Vite `?raw` imports) so both the browser and the Node
// PDF function can import it.

export const RECEIPT_TITLE = 'Acknowledgement Receipt'

// Plain YYYY-MM-DD, taken from local time (not toISOString(), which is
// UTC and reads as "yesterday" for a UTC+8 user before 8am).
export function todayIso(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function paymentsOf(invoice) {
  return (invoice.payments || [])
    .map((p) => ({ receivedAt: p.receivedAt || '', amount: Number(p.amount) || 0 }))
    .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))
}

// Everything the receipt document and its default wording need, derived
// from a stored invoice record + the biller from settings. `options` carry
// the send-time choices: design (defaults to the invoice's own), the
// edited wording (defaults to defaultReceiptMessage), and the issue date.
export function buildReceiptData(invoice, biller = {}, options = {}) {
  const payments = paymentsOf(invoice)
  const totals = computeTotals(
    invoice.items || [], invoice.taxPercent, invoice.discountAmount, invoice.capAmount,
  )
  const invoiceTotal = Number.isFinite(invoice.total) ? invoice.total : totals.billed
  const paymentsSum = payments.reduce((sum, p) => sum + p.amount, 0)
  // A 'paid' invoice always got there via recorded payments (D7), but
  // don't render a zero receipt if the ledger is somehow empty.
  const amountReceived = paymentsSum > 0 ? paymentsSum : invoiceTotal
  const datedPayments = payments.filter((p) => p.receivedAt)

  const data = {
    designId: options.designId || invoice.selectedDesignId || 'default',
    biller: {
      name: biller.name || '', address: biller.address || '', email: biller.email || '', phone: biller.phone || '',
    },
    client: {
      name: invoice.client?.name || '', address: invoice.client?.address || '', email: invoice.client?.email || '',
    },
    meta: {
      invoiceNumber: invoice.invoiceNumber || '',
      invoiceDate: invoice.invoiceDate || '',
      currency: invoice.currency || '',
      issuedDate: options.issuedDate || todayIso(),
    },
    payments,
    paymentDates: [...new Set(datedPayments.map((p) => p.receivedAt))],
    // The date the invoice became fully paid = its latest payment.
    paidDate: datedPayments.length ? datedPayments[datedPayments.length - 1].receivedAt : '',
    amountReceived,
    invoiceTotal,
    signature: invoice.signature || null,
    signatoryName: invoice.sameAsBusiness === false ? (invoice.signatoryName || '') : (biller.name || ''),
  }
  data.message = typeof options.message === 'string' && options.message.trim()
    ? options.message
    : defaultReceiptMessage(data)
  return data
}

// "Sep 01, 2026", "Sep 01, 2026 and Sep 20, 2026", "A, B and C".
export function formatDateList(isoDates) {
  const formatted = isoDates.map(formatDate).filter(Boolean)
  if (formatted.length <= 1) return formatted[0] || ''
  return `${formatted.slice(0, -1).join(', ')} and ${formatted[formatted.length - 1]}`
}

// Real interpolated wording (not {{tokens}}) — the user edits the rendered
// text, same precedent as the invoice email's defaultBody.
export function defaultReceiptMessage(receipt) {
  const who = receipt.biller.name ? `${receipt.biller.name} has received` : 'we have received'
  const amount = formatMoney(receipt.amountReceived, receipt.meta.currency)
  const from = receipt.client.name ? ` from ${receipt.client.name}` : ''
  const dates = formatDateList(receipt.paymentDates)
  const when = !dates ? '' : receipt.paymentDates.length === 1 ? ` on ${dates}` : ` in payments received on ${dates}`
  const invoiceRef = receipt.meta.invoiceNumber ? `Invoice ${receipt.meta.invoiceNumber}` : 'the invoice'
  return `This acknowledges that ${who} ${amount}${from}${when}, in full payment of ${invoiceRef}.\n\nThank you for your business.`
}

export function defaultReceiptEmailSubject(receipt) {
  const num = receipt.meta.invoiceNumber ? ` for Invoice ${receipt.meta.invoiceNumber}` : ''
  return `${RECEIPT_TITLE}${num}${receipt.biller.name ? ` from ${receipt.biller.name}` : ''}`
}

export function defaultReceiptEmailBody(receipt) {
  const amount = formatMoney(receipt.amountReceived, receipt.meta.currency)
  const num = receipt.meta.invoiceNumber ? ` for invoice ${receipt.meta.invoiceNumber}` : ''
  return `Hi ${receipt.client.name || 'there'},\n\n` +
    `Thank you for your payment of ${amount}${num}. Please find your acknowledgement receipt attached.\n\n` +
    `Thanks,\n${receipt.biller.name || ''}`
}

function renderPaymentsTable(payments, currency) {
  if (payments.length === 0) return ''
  const rows = payments
    .map((p) => `
      <tr>
        <td>${escapeHtml(formatDate(p.receivedAt)) || '—'}</td>
        <td>${escapeHtml(formatMoney(p.amount, currency))}</td>
      </tr>`)
    .join('')
  return `<table class="preview-items receipt-payments">
    <thead><tr><th>Payment received</th><th>Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`
}

// One .doc-page, reusing the invoice's structural classes (doc-head,
// preview-parties, preview-totals, doc-footer) so every design's theme CSS
// applies without per-design receipt rules beyond the few receipt-* bits.
export function renderReceiptBody(receipt) {
  const { designId, biller, client, meta, payments, amountReceived, invoiceTotal } = receipt
  const currency = meta.currency

  return `<div class="preview-sheet" data-design="${escapeHtml(designId)}">
  <div class="doc-page doc-receipt">
    <header class="doc-head">
      <div class="doc-biller">
        <p class="doc-biller-name">${escapeHtml(biller.name) || 'Your name'}</p>
        ${biller.address ? `<p class="doc-biller-sub">${escapeHtml(biller.address)}</p>` : ''}
        ${biller.email ? `<p class="doc-biller-sub">${escapeHtml(biller.email)}</p>` : ''}
        ${biller.phone ? `<p class="doc-biller-sub">${escapeHtml(biller.phone)}</p>` : ''}
      </div>
      <div class="doc-meta">
        <span class="doc-meta-label">Receipt for invoice</span>
        <span class="doc-meta-num">${escapeHtml(meta.invoiceNumber) || '—'}</span>
        <span class="doc-meta-date">Issued ${escapeHtml(formatDate(meta.issuedDate)) || '—'}</span>
      </div>
    </header>

    <h1 class="receipt-title">${RECEIPT_TITLE}</h1>

    <div class="preview-parties">
      <div class="preview-party">
        <h2>Received from</h2>
        <p>${escapeHtml(client.name) || '—'}</p>
        ${client.address ? `<p class="preview-muted">${escapeHtml(client.address)}</p>` : ''}
        ${client.email ? `<p class="preview-muted">${escapeHtml(client.email)}</p>` : ''}
      </div>
      <div class="preview-party">
        <h2>Invoice</h2>
        <p>${escapeHtml(meta.invoiceNumber) || '—'}</p>
        ${meta.invoiceDate ? `<p class="preview-muted">Dated ${escapeHtml(formatDate(meta.invoiceDate))}</p>` : ''}
      </div>
    </div>

    <p class="receipt-message">${escapeHtml(receipt.message)}</p>

    ${renderPaymentsTable(payments, currency)}

    <div class="preview-totals">
      <div><span>Invoice total</span><span>${escapeHtml(formatMoney(invoiceTotal, currency))}</span></div>
      <div class="preview-grand-total">
        <span>Amount Received</span>
        <span>${escapeHtml(formatMoney(amountReceived, currency))}</span>
      </div>
    </div>

    <div class="doc-footer">
      <div class="doc-footer-bank"></div>
      <div class="doc-footer-signature">${renderSignatureBlock(receipt.signature, receipt.signatoryName)}</div>
    </div>
  </div>
</div>`
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const DESIGN_ID = /^[a-z0-9-]{1,40}$/
export const MAX_RECEIPT_MESSAGE_LENGTH = 5000

// Sanitizes the send-time choices arriving over HTTP (query string or JSON
// body) before they reach buildReceiptData. Anything invalid is dropped so
// the invoice's own default applies rather than erroring.
export function normalizeReceiptOptions(input = {}) {
  const options = {}
  if (typeof input.designId === 'string' && DESIGN_ID.test(input.designId)) options.designId = input.designId
  if (typeof input.issuedDate === 'string' && ISO_DATE.test(input.issuedDate)) options.issuedDate = input.issuedDate
  if (typeof input.message === 'string' && input.message.trim()) {
    options.message = input.message.slice(0, MAX_RECEIPT_MESSAGE_LENGTH)
  }
  return options
}
