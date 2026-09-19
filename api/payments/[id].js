import { readAllInvoices, updateInvoice } from '../_lib/invoiceStorage.js'
import { respondToStorageError } from '../_lib/storage.js'

// Payments are embedded per-invoice (memory/decisions.md D7), so undoing
// one means finding which invoice holds it. Payment ids aren't indexed
// (only invoice ids are — see invoiceStorage.js), so this fans out across
// every year to find it: a rare, low-frequency operation (undoing a single
// payment), unlike the hot paths #37 was written to bound.
export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { id } = req.query
  const invoices = await readAllInvoices()
  const owner = invoices.find((inv) => (inv.payments || []).some((p) => p.id === id))
  if (!owner) return res.status(404).json({ error: 'Payment not found' })

  try {
    const updated = await updateInvoice(owner.id, (current) => {
      const payments = current.payments.filter((p) => p.id !== id)
      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
      return {
        ...current,
        payments,
        status: current.status === 'paid' && totalPaid < current.total ? 'sent' : current.status,
        updatedAt: new Date().toISOString(),
      }
    })
    return res.status(200).json(updated)
  } catch (error) {
    if (respondToStorageError(error, res)) return
    throw error
  }
}
