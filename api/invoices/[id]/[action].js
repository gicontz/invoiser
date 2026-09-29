import { readUserData, writeUserData } from '../../_lib/storage.js'
import { getSessionUsername } from '../../_lib/session.js'

// Merges what used to be two separate function files (status.js,
// payments.js) into one dynamic route (still serving the exact same URLs,
// /api/invoices/:id/status and /api/invoices/:id/payments — nothing about
// the frontend's calls changes). Vercel's Hobby plan caps a deployment at
// 12 Serverless Functions; adding pdf.js earlier brought this project to
// 13 and silently failed every deployment since (readyState: ERROR,
// errorCode: exceeded_serverless_functions_per_deployment) — production
// has been stuck 3 days behind as a result. This merge brings the count
// back to 12.

// Policy (epic #13): sent can't be undone, cancelled is terminal — create a
// new invoice instead of reopening one.
const ALLOWED_FROM = {
  sent: ['draft'],
  cancelled: ['draft', 'sent'],
}

async function handleStatus(req, res, id, username) {
  const { status } = req.body || {}
  if (!ALLOWED_FROM[status]) {
    return res.status(400).json({ error: `status must be one of: ${Object.keys(ALLOWED_FROM).join(', ')}` })
  }

  const invoices = await readUserData('invoices', username)
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

  await writeUserData('invoices', invoices, username)
  return res.status(200).json(invoice)
}

// Manual ledger entry, not a payment gateway (memory/decisions.md D7).
// Auto-flips to 'paid' once payments cover the total.
async function handlePayments(req, res, id, username) {
  const { amount, receivedAt, note } = req.body || {}
  const parsedAmount = parseFloat(amount)
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number' })
  }
  if (!receivedAt) {
    return res.status(400).json({ error: 'receivedAt is required' })
  }

  const invoices = await readUserData('invoices', username)
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

  await writeUserData('invoices', invoices, username)
  return res.status(201).json(invoice)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const username = await getSessionUsername(req)
  if (!username) return res.status(401).json({ error: 'Not authenticated' })

  const { id, action } = req.query
  if (action === 'status') return handleStatus(req, res, id, username)
  if (action === 'payments') return handlePayments(req, res, id, username)
  return res.status(404).json({ error: 'Not found' })
}
