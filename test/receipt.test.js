import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildReceiptData,
  defaultReceiptMessage,
  defaultReceiptEmailSubject,
  defaultReceiptEmailBody,
  formatDateList,
  normalizeReceiptOptions,
  renderReceiptBody,
  todayIso,
} from '../src/designs/receiptTemplates.js'
import { formatMoney } from '../src/utils/calc.js'

const biller = { name: 'Gawa Studio', address: '1 Main St', email: 'hi@gawa.test', phone: '' }

function paidInvoice(overrides = {}) {
  return {
    id: 'inv-1',
    invoiceNumber: 'EMB-0001',
    invoiceDate: '2026-09-01',
    currency: 'PHP',
    status: 'paid',
    selectedDesignId: 'elegant',
    client: { name: 'Acme Corp', address: 'Makati', email: 'ap@acme.test' },
    items: [{ qty: 10, rate: 1500 }],
    taxPercent: 0,
    discountAmount: 0,
    capAmount: '',
    total: 15000,
    sameAsBusiness: true,
    signature: null,
    payments: [
      { id: 'p2', amount: 5000, receivedAt: '2026-09-20', note: 'internal note' },
      { id: 'p1', amount: 10000, receivedAt: '2026-09-05', note: '' },
    ],
    ...overrides,
  }
}

test('buildReceiptData sums payments, sorts them, and picks the last date as paidDate', () => {
  const r = buildReceiptData(paidInvoice(), biller, { issuedDate: '2026-09-30' })
  assert.equal(r.amountReceived, 15000)
  assert.equal(r.invoiceTotal, 15000)
  assert.deepEqual(r.payments.map((p) => p.receivedAt), ['2026-09-05', '2026-09-20'])
  assert.deepEqual(r.paymentDates, ['2026-09-05', '2026-09-20'])
  assert.equal(r.paidDate, '2026-09-20')
  assert.equal(r.meta.issuedDate, '2026-09-30')
  assert.equal(r.signatoryName, 'Gawa Studio')
})

test('buildReceiptData defaults the design to the invoice’s own, and honors an override', () => {
  assert.equal(buildReceiptData(paidInvoice(), biller).designId, 'elegant')
  assert.equal(buildReceiptData(paidInvoice(), biller, { designId: 'flat' }).designId, 'flat')
  assert.equal(buildReceiptData(paidInvoice({ selectedDesignId: undefined }), biller).designId, 'default')
})

test('buildReceiptData falls back to the invoice total when the ledger is empty', () => {
  const r = buildReceiptData(paidInvoice({ payments: [] }), biller)
  assert.equal(r.amountReceived, 15000)
  assert.equal(r.paidDate, '')
})

test('buildReceiptData uses the edited message when given, the default otherwise', () => {
  assert.equal(buildReceiptData(paidInvoice(), biller, { message: 'Custom text' }).message, 'Custom text')
  const r = buildReceiptData(paidInvoice(), biller, { message: '   ' })
  assert.equal(r.message, defaultReceiptMessage(r))
})

test('default wording interpolates biller, amount, client, dates and invoice number', () => {
  const r = buildReceiptData(paidInvoice(), biller)
  const msg = defaultReceiptMessage(r)
  assert.match(msg, /^This acknowledges that Gawa Studio has received /)
  assert.ok(msg.includes(formatMoney(15000, 'PHP')))
  assert.ok(msg.includes('from Acme Corp'))
  assert.ok(msg.includes('in payments received on Sep 05, 2026 and Sep 20, 2026'))
  assert.ok(msg.includes('in full payment of Invoice EMB-0001.'))
  assert.ok(!msg.includes('{'), 'no raw tokens')
})

test('default wording for a single payment says "on <date>"', () => {
  const r = buildReceiptData(paidInvoice({ payments: [{ amount: 15000, receivedAt: '2026-09-20' }] }), biller)
  assert.ok(defaultReceiptMessage(r).includes('from Acme Corp on Sep 20, 2026, in full payment'))
})

test('default wording degrades gracefully with no biller/client name', () => {
  const r = buildReceiptData(paidInvoice({ client: null }), {})
  const msg = defaultReceiptMessage(r)
  assert.match(msg, /^This acknowledges that we have received /)
  assert.ok(!msg.includes('from  '))
  assert.ok(!msg.includes('undefined'))
})

test('default email subject/body', () => {
  const r = buildReceiptData(paidInvoice(), biller)
  assert.equal(defaultReceiptEmailSubject(r), 'Acknowledgement Receipt for Invoice EMB-0001 from Gawa Studio')
  const body = defaultReceiptEmailBody(r)
  assert.match(body, /^Hi Acme Corp,/)
  assert.ok(body.includes('for invoice EMB-0001'))
  assert.ok(body.trim().endsWith('Gawa Studio'))
})

test('formatDateList joins with commas and "and"', () => {
  assert.equal(formatDateList([]), '')
  assert.equal(formatDateList(['2026-01-02']), 'Jan 02, 2026')
  assert.equal(formatDateList(['2026-01-02', '2026-02-03', '2026-03-04']), 'Jan 02, 2026, Feb 03, 2026 and Mar 04, 2026')
})

test('renderReceiptBody shows amounts, design and title', () => {
  const r = buildReceiptData(paidInvoice(), biller, { issuedDate: '2026-09-30' })
  const html = renderReceiptBody(r)
  assert.ok(html.includes('data-design="elegant"'))
  assert.ok(html.includes('Acknowledgement Receipt'))
  assert.ok(html.includes('EMB-0001'))
  assert.ok(html.includes('Issued Sep 30, 2026'))
  assert.ok(html.includes(formatMoney(15000, 'PHP')))
  assert.ok(html.includes(formatMoney(5000, 'PHP')))
  assert.ok(html.includes(formatMoney(10000, 'PHP')))
  assert.ok(!html.includes('internal note'), 'payment notes are internal and never printed')
})

test('renderReceiptBody escapes every user-provided string', () => {
  const evil = '<script>alert(1)</script>&"\''
  const r = buildReceiptData(paidInvoice({
    invoiceNumber: evil,
    client: { name: evil, address: evil, email: evil },
    signature: 'x" onerror="alert(1)',
  }), { name: evil, address: evil, email: evil, phone: evil }, { message: evil, designId: 'a"b' })
  const html = renderReceiptBody(r)
  assert.ok(!html.includes('<script>'))
  assert.ok(!html.includes('onerror="'))
  assert.ok(!html.includes('data-design="a"b"'))
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;&amp;&quot;&#39;'))
})

test('normalizeReceiptOptions keeps valid options and drops invalid ones', () => {
  assert.deepEqual(
    normalizeReceiptOptions({ designId: 'pastel', issuedDate: '2026-09-30', message: 'Hi' }),
    { designId: 'pastel', issuedDate: '2026-09-30', message: 'Hi' },
  )
  assert.deepEqual(normalizeReceiptOptions({ designId: '"><x', issuedDate: 'yesterday', message: '  ' }), {})
  assert.deepEqual(normalizeReceiptOptions(), {})
  assert.equal(normalizeReceiptOptions({ message: 'x'.repeat(9000) }).message.length, 5000)
})

test('todayIso uses local date parts', () => {
  assert.equal(todayIso(new Date(2026, 0, 5, 23, 30)), '2026-01-05')
})
