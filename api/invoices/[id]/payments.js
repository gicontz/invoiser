import { updateInvoice } from '../../_lib/invoiceStorage.js'
import { respondToStorageError } from '../../_lib/storage.js'

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
    const updated = await updateInvoice(id, (current) => {
      const payment = {
        id: crypto.randomUUID(),
        amount: parsedAmount,
        receivedAt,
        note: note || '',
        createdAt: new Date().toISOString(),
      }
      const payments = [...(current.payments || []), payment]
      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
      return {
        ...current,
        payments,
        status: totalPaid >= current.total && current.status === 'sent' ? 'paid' : current.status,
        updatedAt: new Date().toISOString(),
      }
    })
    return res.status(201).json(updated)
  } catch (error) {
    if (respondToStorageError(error, res)) return
    throw error
  }
}
