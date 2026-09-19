import { readUserData, updateUserData, respondToStorageError, RouteError } from '../_lib/storage.js'
import { readAllInvoices } from '../_lib/invoiceStorage.js'

// Delete policy (epic #14): block rather than orphan clientId references on
// existing invoices.
export default async function handler(req, res) {
  const { id } = req.query

  if (req.method === 'GET') {
    const { data: clients } = await readUserData('clients')
    const client = clients.find((c) => c.id === id)
    if (!client) return res.status(404).json({ error: 'Client not found' })
    return res.status(200).json(client)
  }

  if (req.method === 'PATCH') {
    try {
      const { client } = await updateUserData('clients', (clients) => {
        const index = clients.findIndex((c) => c.id === id)
        if (index === -1) throw new RouteError(404, 'Client not found')
        const updated = { ...clients[index], ...req.body, id, updatedAt: new Date().toISOString() }
        const next = [...clients]
        next[index] = updated
        return { data: next, client: updated }
      })
      return res.status(200).json(client)
    } catch (error) {
      if (respondToStorageError(error, res)) return
      throw error
    }
  }

  if (req.method === 'DELETE') {
    const invoices = await readAllInvoices()
    const referenced = invoices.some((inv) => inv.clientId === id)
    if (referenced) {
      return res.status(409).json({ error: 'Client is used on one or more invoices' })
    }
    try {
      await updateUserData('clients', (clients) => {
        const index = clients.findIndex((c) => c.id === id)
        if (index === -1) throw new RouteError(404, 'Client not found')
        return { data: clients.filter((c) => c.id !== id) }
      })
      return res.status(204).end()
    } catch (error) {
      if (error instanceof RouteError) return res.status(error.status).json({ error: error.message })
      throw error
    }
  }

  res.setHeader('Allow', 'GET, PATCH, DELETE')
  return res.status(405).json({ error: 'Method not allowed' })
}
