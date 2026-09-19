import { updateInvoice } from '../../_lib/invoiceStorage.js'
import { respondToStorageError, RouteError } from '../../_lib/storage.js'

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
    const updated = await updateInvoice(id, (current) => {
      if (!ALLOWED_FROM[status].includes(current.status)) {
        throw new RouteError(409, `Cannot mark ${status} from ${current.status}`)
      }
      const now = new Date().toISOString()
      const next = { ...current, status, updatedAt: now }
      if (status === 'sent') next.sentAt = now
      if (status === 'cancelled') next.cancelledAt = now
      return next
    })
    return res.status(200).json(updated)
  } catch (error) {
    if (respondToStorageError(error, res)) return
    throw error
  }
}
