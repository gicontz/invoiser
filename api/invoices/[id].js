import { readUserData, updateUserData, respondToStorageError, RouteError } from '../_lib/storage.js'
import { computeTotals } from '../../src/utils/calc.js'
import { isOverdue } from '../_lib/invoiceStatus.js'

export default async function handler(req, res) {
  const { id } = req.query

  if (req.method === 'GET') {
    const { data: invoices } = await readUserData('invoices')
    const invoice = invoices.find((inv) => inv.id === id)
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
    return res.status(200).json({ ...invoice, overdue: isOverdue(invoice) })
  }

  if (req.method === 'PATCH') {
    try {
      const { invoice } = await updateUserData('invoices', (invoices) => {
        const index = invoices.findIndex((inv) => inv.id === id)
        if (index === -1) throw new RouteError(404, 'Invoice not found')
        // status/payments have their own dedicated endpoints — never
        // overwritten by a plain content edit.
        const { status: _status, payments: _payments, ...editable } = req.body || {}
        const updated = { ...invoices[index], ...editable, id, updatedAt: new Date().toISOString() }
        const totals = computeTotals(updated.items, updated.taxPercent, updated.discountAmount, updated.capAmount)
        updated.subtotal = totals.subtotal
        updated.tax = totals.tax
        updated.discount = totals.discount
        updated.total = totals.billed
        const next = [...invoices]
        next[index] = updated
        return { data: next, invoice: updated }
      })
      return res.status(200).json({ ...invoice, overdue: isOverdue(invoice) })
    } catch (error) {
      if (respondToStorageError(error, res)) return
      throw error
    }
  }

  if (req.method === 'DELETE') {
    try {
      await updateUserData('invoices', (invoices) => {
        const index = invoices.findIndex((inv) => inv.id === id)
        if (index === -1) throw new RouteError(404, 'Invoice not found')
        if (invoices[index].status !== 'draft') {
          throw new RouteError(409, 'Only draft invoices can be deleted — cancel instead')
        }
        return { data: invoices.filter((inv) => inv.id !== id) }
      })
      return res.status(204).end()
    } catch (error) {
      if (error instanceof RouteError) return res.status(error.status).json({ error: error.message })
      throw error
    }
  }

  res.setHeader('Allow', 'GET, PATCH, DELETE')
  return res.status(405).json({ error: 'Method not allowed' })
}
