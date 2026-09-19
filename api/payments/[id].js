import { updateUserData, respondToStorageError, RouteError } from '../_lib/storage.js'

// Payments are embedded per-invoice (memory/decisions.md D7), so undoing one
// means finding which invoice holds it.
export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { id } = req.query

  try {
    const { invoice } = await updateUserData('invoices', (invoices) => {
      const index = invoices.findIndex((inv) => (inv.payments || []).some((p) => p.id === id))
      if (index === -1) throw new RouteError(404, 'Payment not found')

      const current = invoices[index]
      const payments = current.payments.filter((p) => p.id !== id)
      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
      const updated = {
        ...current,
        payments,
        status: current.status === 'paid' && totalPaid < current.total ? 'sent' : current.status,
        updatedAt: new Date().toISOString(),
      }

      const next = [...invoices]
      next[index] = updated
      return { data: next, invoice: updated }
    })
    return res.status(200).json(invoice)
  } catch (error) {
    if (respondToStorageError(error, res)) return
    throw error
  }
}
