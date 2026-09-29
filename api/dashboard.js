import { readUserData } from './_lib/storage.js'
import { isOverdue } from './_lib/invoiceStatus.js'
import { getSessionUsername } from './_lib/session.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const username = await getSessionUsername(req)
  if (!username) return res.status(401).json({ error: 'Not authenticated' })

  const invoices = await readUserData('invoices', username)
  const active = invoices.filter((inv) => inv.status !== 'cancelled')

  const totalInvoiced = active.reduce((sum, inv) => sum + (inv.total || 0), 0)
  const totalReceived = active.reduce(
    (sum, inv) => sum + (inv.payments || []).reduce((s, p) => s + p.amount, 0),
    0,
  )
  const totalOutstanding = totalInvoiced - totalReceived

  const counts = { draft: 0, sent: 0, paid: 0, overdue: 0, cancelled: 0 }
  for (const inv of invoices) {
    if (inv.status === 'cancelled') counts.cancelled += 1
    else if (inv.status === 'paid') counts.paid += 1
    else if (isOverdue(inv)) counts.overdue += 1
    else if (inv.status === 'sent') counts.sent += 1
    else counts.draft += 1
  }

  const recent = [...invoices]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5)
    .map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      clientId: inv.clientId,
      clientName: inv.client?.name || null,
      status: isOverdue(inv) ? 'overdue' : inv.status,
      total: inv.total,
    }))

  return res.status(200).json({ totalInvoiced, totalReceived, totalOutstanding, counts, recent })
}
