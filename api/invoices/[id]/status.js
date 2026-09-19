import { updateUserData, respondToStorageError, RouteError } from '../../_lib/storage.js'

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

  try {
    const { invoice } = await updateUserData('invoices', (invoices) => {
      const index = invoices.findIndex((inv) => inv.id === id)
      if (index === -1) throw new RouteError(404, 'Invoice not found')

      const current = invoices[index]
      if (!ALLOWED_FROM[status].includes(current.status)) {
        throw new RouteError(409, `Cannot mark ${status} from ${current.status}`)
      }

      const now = new Date().toISOString()
      const updated = { ...current, status, updatedAt: now }
      if (status === 'sent') updated.sentAt = now
      if (status === 'cancelled') updated.cancelledAt = now

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
