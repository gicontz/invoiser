import { readUserData, writeUserData } from '../_lib/storage.js'

// Payments are embedded per-invoice (memory/decisions.md D7), so undoing one
// means finding which invoice holds it.
export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { id } = req.query
  const invoices = await readUserData('invoices')
  const invoiceIndex = invoices.findIndex((inv) => (inv.payments || []).some((p) => p.id === id))
  if (invoiceIndex === -1) return res.status(404).json({ error: 'Payment not found' })

  const invoice = invoices[invoiceIndex]
  invoice.payments = invoice.payments.filter((p) => p.id !== id)

  const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0)
  if (invoice.status === 'paid' && totalPaid < invoice.total) {
    invoice.status = 'sent'
  }
  invoice.updatedAt = new Date().toISOString()

  await writeUserData('invoices', invoices)
  return res.status(200).json(invoice)
}
