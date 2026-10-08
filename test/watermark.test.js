import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderInvoiceBody, WATERMARK_TEXT } from '../src/designs/templates.js'
import { buildReceiptData, renderReceiptBody } from '../src/designs/receiptTemplates.js'

const count = (html, needle) => html.split(needle).length - 1

function invoiceArgs(overrides = {}) {
  return {
    designId: 'default',
    biller: { name: 'Gawa Studio' },
    client: { name: 'Acme Corp' },
    meta: { invoiceNumber: 'EMB-0001', invoiceDate: '2026-09-01', currency: 'PHP' },
    items: [
      { description: 'Design', group: 'Design', qty: 10, unit: 'per hour', rate: 1500 },
      { description: 'Build', group: 'Build', qty: 1, unit: 'fixed', rate: 20000 },
    ],
    notes: '',
    totals: { subtotal: 35000, tax: 0, discount: 0, grandTotal: 35000, billed: 35000, capped: false },
    bank: {},
    signature: null,
    signatoryName: '',
    separateItems: false,
    ...overrides,
  }
}

test('one-page invoice carries exactly one watermark', () => {
  const html = renderInvoiceBody(invoiceArgs())
  assert.equal(count(html, 'class="doc-page"') + count(html, 'class="doc-page '), 1)
  assert.equal(count(html, 'class="doc-watermark"'), 1)
  assert.ok(html.includes(WATERMARK_TEXT))
})

test('two-page invoice (Order Details) carries one watermark per page', () => {
  const html = renderInvoiceBody(invoiceArgs({ separateItems: true }))
  assert.equal(count(html, 'class="doc-page"') + count(html, 'class="doc-page '), 2)
  assert.equal(count(html, 'class="doc-watermark"'), 2)
})

test('Acknowledgement Receipt carries the watermark', () => {
  const receipt = buildReceiptData({
    invoiceNumber: 'EMB-0001',
    invoiceDate: '2026-09-01',
    currency: 'PHP',
    status: 'paid',
    client: { name: 'Acme Corp' },
    items: [{ qty: 1, rate: 1000 }],
    total: 1000,
    payments: [{ id: 'p1', amount: 1000, receivedAt: '2026-09-05' }],
  }, { name: 'Gawa Studio' })
  const html = renderReceiptBody(receipt)
  assert.equal(count(html, 'class="doc-watermark"'), 1)
  assert.ok(html.includes(WATERMARK_TEXT))
})

test('watermark is hidden from assistive tech', () => {
  assert.match(renderInvoiceBody(invoiceArgs()), /class="doc-watermark" aria-hidden="true"/)
})
