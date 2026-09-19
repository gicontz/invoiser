import { readUserData, writeUserData } from './_lib/storage.js'
import { isOverdue } from './_lib/invoiceStatus.js'
import { computeTotals } from '../src/utils/calc.js'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const invoices = await readUserData('invoices')
    const { status } = req.query
    const withComputed = invoices.map((inv) => ({ ...inv, overdue: isOverdue(inv) }))
    const result = !status
      ? withComputed
      : status === 'overdue'
        ? withComputed.filter((inv) => inv.overdue)
        : withComputed.filter((inv) => inv.status === status)
    return res.status(200).json(result)
  }

  if (req.method === 'POST') {
    const invoices = await readUserData('invoices')
    const now = new Date().toISOString()
    const items = req.body?.items || []
    const totals = computeTotals(
      items,
      req.body?.taxPercent || 0,
      req.body?.discountAmount || 0,
      req.body?.capAmount || '',
    )
    const invoice = {
      id: crypto.randomUUID(),
      invoiceNumber: req.body?.invoiceNumber || '',
      clientId: req.body?.clientId || null,
      bankAccountId: req.body?.bankAccountId || null,
      status: 'draft',
      invoiceDate: req.body?.invoiceDate || now.slice(0, 10),
      dueDate: req.body?.dueDate || '',
      currency: req.body?.currency || 'PHP',
      items,
      taxPercent: req.body?.taxPercent || 0,
      discountAmount: req.body?.discountAmount || 0,
      capAmount: req.body?.capAmount || '',
      subtotal: totals.subtotal,
      tax: totals.tax,
      discount: totals.discount,
      total: totals.billed,
      notes: req.body?.notes || '',
      signatoryName: req.body?.signatoryName || '',
      sameAsBusiness: req.body?.sameAsBusiness ?? true,
      signature: req.body?.signature || null,
      selectedDesignId: req.body?.selectedDesignId || 'default',
      separateItems: req.body?.separateItems || false,
      payments: [],
      createdAt: now,
      updatedAt: now,
      sentAt: null,
      cancelledAt: null,
    }
    invoices.push(invoice)
    await writeUserData('invoices', invoices)
    return res.status(201).json(invoice)
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ error: 'Method not allowed' })
}
