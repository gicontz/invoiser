import { readUserData, writeUserData } from '../_lib/storage.js'

// Delete policy (epic #14): block rather than orphan clientId references on
// existing invoices.
export default async function handler(req, res) {
  const { id } = req.query
  const clients = await readUserData('clients')
  const index = clients.findIndex((c) => c.id === id)

  if (req.method === 'GET') {
    if (index === -1) return res.status(404).json({ error: 'Client not found' })
    return res.status(200).json(clients[index])
  }

  if (req.method === 'PATCH') {
    if (index === -1) return res.status(404).json({ error: 'Client not found' })
    clients[index] = { ...clients[index], ...req.body, id, updatedAt: new Date().toISOString() }
    await writeUserData('clients', clients)
    return res.status(200).json(clients[index])
  }

  if (req.method === 'DELETE') {
    if (index === -1) return res.status(404).json({ error: 'Client not found' })
    const invoices = await readUserData('invoices')
    const referenced = invoices.some((inv) => inv.clientId === id)
    if (referenced) {
      return res.status(409).json({ error: 'Client is used on one or more invoices' })
    }
    clients.splice(index, 1)
    await writeUserData('clients', clients)
    return res.status(204).end()
  }

  res.setHeader('Allow', 'GET, PATCH, DELETE')
  return res.status(405).json({ error: 'Method not allowed' })
}
