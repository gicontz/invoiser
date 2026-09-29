import { readUserData, writeUserData } from '../_lib/storage.js'
import { computeTotals } from '../../src/utils/calc.js'
import { isOverdue } from '../_lib/invoiceStatus.js'
import { getSessionUsername } from '../_lib/session.js'

export default async function handler(req, res) {
  const username = await getSessionUsername(req)
  if (!username) return res.status(401).json({ error: 'Not authenticated' })

  const { id } = req.query
  const invoices = await readUserData('invoices', username)
  const index = invoices.findIndex((inv) => inv.id === id)

  if (req.method === 'GET') {
    if (index === -1) return res.status(404).json({ error: 'Invoice not found' })
    return res.status(200).json({ ...invoices[index], overdue: isOverdue(invoices[index]) })
  }

  if (req.method === 'PATCH') {
    if (index === -1) return res.status(404).json({ error: 'Invoice not found' })
    // status/payments have their own dedicated endpoints — never overwritten
    // by a plain content edit.
    const { status: _status, payments: _payments, ...editable } = req.body || {}
    const updated = { ...invoices[index], ...editable, id, updatedAt: new Date().toISOString() }
    const totals = computeTotals(updated.items, updated.taxPercent, updated.discountAmount, updated.capAmount)
    updated.subtotal = totals.subtotal
    updated.tax = totals.tax
    updated.discount = totals.discount
    updated.total = totals.billed
    invoices[index] = updated
    await writeUserData('invoices', invoices, username)
    return res.status(200).json({ ...updated, overdue: isOverdue(updated) })
  }

  if (req.method === 'DELETE') {
    if (index === -1) return res.status(404).json({ error: 'Invoice not found' })
    if (invoices[index].status !== 'draft') {
      return res.status(409).json({ error: 'Only draft invoices can be deleted — cancel instead' })
    }
    invoices.splice(index, 1)
    await writeUserData('invoices', invoices, username)
    return res.status(204).end()
  }

  res.setHeader('Allow', 'GET, PATCH, DELETE')
  return res.status(405).json({ error: 'Method not allowed' })
}
