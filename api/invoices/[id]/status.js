import { readUserData, writeUserData } from '../../_lib/storage.js'

// Policy (epic #13): sent can't be undone, cancelled is terminal — create a
// new invoice instead of reopening one.
const ALLOWED_FROM = {
  sent: ['draft'],
  cancelled: ['draft', 'sent'],
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { id } = req.query
  const { status } = req.body || {}
  if (!ALLOWED_FROM[status]) {
    return res.status(400).json({ error: `status must be one of: ${Object.keys(ALLOWED_FROM).join(', ')}` })
  }

  const invoices = await readUserData('invoices')
  const index = invoices.findIndex((inv) => inv.id === id)
  if (index === -1) return res.status(404).json({ error: 'Invoice not found' })

  const invoice = invoices[index]
  if (!ALLOWED_FROM[status].includes(invoice.status)) {
    return res.status(409).json({ error: `Cannot mark ${status} from ${invoice.status}` })
  }

  const now = new Date().toISOString()
  invoice.status = status
  invoice.updatedAt = now
  if (status === 'sent') invoice.sentAt = now
  if (status === 'cancelled') invoice.cancelledAt = now

  await writeUserData('invoices', invoices)
  return res.status(200).json(invoice)
}
