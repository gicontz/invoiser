import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderInvoiceBody, siteHost, WATERMARK_TEXT } from '../src/designs/templates.js'
import { requestOrigin } from '../api/_lib/requestOrigin.js'
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

test('watermark shows the host of siteUrl on every page', () => {
  const html = renderInvoiceBody(invoiceArgs({ separateItems: true, siteUrl: 'https://invoiser.app' }))
  assert.equal(count(html, '<small>invoiser.app</small>'), 2)
})

test('watermark keeps a non-default port and drops the protocol/path', () => {
  assert.equal(siteHost('http://localhost:5173/invoices/1'), 'localhost:5173')
  assert.equal(siteHost('https://invoiser.app/'), 'invoiser.app')
})

test('missing or non-http siteUrl falls back to the plain brand line', () => {
  for (const siteUrl of [undefined, '', 'not a url', 'javascript:alert(1)', 'file:///etc/passwd']) {
    const html = renderInvoiceBody(invoiceArgs({ siteUrl }))
    assert.ok(html.includes(WATERMARK_TEXT))
    assert.ok(!html.includes('<small>'), String(siteUrl))
  }
})

test('receipt watermark shows the host of receipt.siteUrl', () => {
  const receipt = buildReceiptData({
    invoiceNumber: 'EMB-0001', invoiceDate: '2026-09-01', currency: 'PHP', status: 'paid',
    client: { name: 'Acme Corp' }, items: [{ qty: 1, rate: 1000 }], total: 1000,
    payments: [{ id: 'p1', amount: 1000, receivedAt: '2026-09-05' }],
  }, { name: 'Gawa Studio' })
  assert.match(renderReceiptBody({ ...receipt, siteUrl: 'https://invoiser.app' }), /<small>invoiser\.app<\/small>/)
})

test('requestOrigin prefers x-forwarded-host/proto (Vercel edge)', () => {
  assert.equal(requestOrigin({ headers: { 'x-forwarded-host': 'invoiser.app', 'x-forwarded-proto': 'https', host: 'internal' } }), 'https://invoiser.app')
  assert.equal(requestOrigin({ headers: { 'x-forwarded-host': 'Invoiser.App, proxy.local', 'x-forwarded-proto': 'https,http' } }), 'https://invoiser.app')
})

test('requestOrigin falls back to Host, http for localhost', () => {
  assert.equal(requestOrigin({ headers: { host: 'localhost:3000' } }), 'http://localhost:3000')
  assert.equal(requestOrigin({ headers: { host: 'invoiser-abc.vercel.app' } }), 'https://invoiser-abc.vercel.app')
})

test('requestOrigin rejects junk hosts and protos', () => {
  assert.equal(requestOrigin({ headers: { host: 'evil.com/<script>' } }), '')
  assert.equal(requestOrigin({ headers: {} }), '')
  assert.equal(requestOrigin({ headers: { host: 'invoiser.app', 'x-forwarded-proto': 'javascript' } }), 'https://invoiser.app')
})

test('watermark is all lowercase: brand and bare domain, no protocol', () => {
  const html = renderInvoiceBody(invoiceArgs({ siteUrl: 'HTTPS://Invoiser.App/Some/Path' }))
  assert.equal(WATERMARK_TEXT, WATERMARK_TEXT.toLowerCase())
  assert.match(html, /<span>created with invoiser<small>invoiser\.app<\/small><\/span>/)
  assert.ok(!/https?:\/\//.test(html.match(/<div class="doc-watermark"[^]*?<\/div>/)[0]))
})
