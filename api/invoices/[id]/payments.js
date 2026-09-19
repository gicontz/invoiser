import { updateUserData, respondToStorageError, RouteError } from '../../_lib/storage.js'

// Manual ledger entry, not a payment gateway (memory/decisions.md D7).
// Auto-flips to 'paid' once payments cover the total.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { id } = req.query
  const { amount, receivedAt, note } = req.body || {}
  const parsedAmount = parseFloat(amount)
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number' })
  }
  if (!receivedAt) {
    return res.status(400).json({ error: 'receivedAt is required' })
  }

  try {
    const { invoice } = await updateUserData('invoices', (invoices) => {
      const index = invoices.findIndex((inv) => inv.id === id)
      if (index === -1) throw new RouteError(404, 'Invoice not found')

      const current = invoices[index]
      const payment = {
        id: crypto.randomUUID(),
        amount: parsedAmount,
        receivedAt,
        note: note || '',
        createdAt: new Date().toISOString(),
      }
      const payments = [...(current.payments || []), payment]
      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
      const updated = {
        ...current,
        payments,
        status: totalPaid >= current.total && current.status === 'sent' ? 'paid' : current.status,
        updatedAt: new Date().toISOString(),
      }

      const next = [...invoices]
      next[index] = updated
      return { data: next, invoice: updated }
    })
    return res.status(201).json(invoice)
  } catch (error) {
    if (respondToStorageError(error, res)) return
    throw error
  }
}
