import { readUserData, writeUserData } from '../../_lib/storage.js'

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

  const invoices = await readUserData('invoices')
  const index = invoices.findIndex((inv) => inv.id === id)
  if (index === -1) return res.status(404).json({ error: 'Invoice not found' })

  const invoice = invoices[index]
  const payment = {
    id: crypto.randomUUID(),
    amount: parsedAmount,
    receivedAt,
    note: note || '',
    createdAt: new Date().toISOString(),
  }
  invoice.payments = [...(invoice.payments || []), payment]

  const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0)
  if (totalPaid >= invoice.total && invoice.status === 'sent') {
    invoice.status = 'paid'
  }
  invoice.updatedAt = new Date().toISOString()

  await writeUserData('invoices', invoices)
  return res.status(201).json(invoice)
}
