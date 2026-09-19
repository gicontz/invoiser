import { findInvoice, updateInvoice, deleteInvoice } from '../_lib/invoiceStorage.js'
import { respondToStorageError, RouteError } from '../_lib/storage.js'
import { computeTotals } from '../../src/utils/calc.js'
import { isOverdue } from '../_lib/invoiceStatus.js'

export default async function handler(req, res) {
  const { id } = req.query

  if (req.method === 'GET') {
    const found = await findInvoice(id)
    if (!found) return res.status(404).json({ error: 'Invoice not found' })
    return res.status(200).json({ ...found.invoice, overdue: isOverdue(found.invoice) })
  }

  if (req.method === 'PATCH') {
    try {
      const updated = await updateInvoice(id, (current) => {
        // status/payments have their own dedicated endpoints — never
        // overwritten by a plain content edit.
        const { status: _status, payments: _payments, ...editable } = req.body || {}
        const next = { ...current, ...editable, id, updatedAt: new Date().toISOString() }
        const totals = computeTotals(next.items, next.taxPercent, next.discountAmount, next.capAmount)
        next.subtotal = totals.subtotal
        next.tax = totals.tax
        next.discount = totals.discount
        next.total = totals.billed
        return next
      })
      return res.status(200).json({ ...updated, overdue: isOverdue(updated) })
    } catch (error) {
      if (respondToStorageError(error, res)) return
      throw error
    }
  }

  if (req.method === 'DELETE') {
    try {
      await deleteInvoice(id)
      return res.status(204).end()
    } catch (error) {
      if (error instanceof RouteError) return res.status(error.status).json({ error: error.message })
      throw error
    }
  }

  res.setHeader('Allow', 'GET, PATCH, DELETE')
  return res.status(405).json({ error: 'Method not allowed' })
}
