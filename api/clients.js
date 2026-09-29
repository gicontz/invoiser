import { readUserData, writeUserData } from './_lib/storage.js'
import { getSessionUsername } from './_lib/session.js'

export default async function handler(req, res) {
  const username = await getSessionUsername(req)
  if (!username) return res.status(401).json({ error: 'Not authenticated' })

  if (req.method === 'GET') {
    const clients = await readUserData('clients', username)
    return res.status(200).json(clients)
  }

  if (req.method === 'POST') {
    const clients = await readUserData('clients', username)
    const now = new Date().toISOString()
    const client = {
      id: crypto.randomUUID(),
      name: req.body?.name || '',
      address: req.body?.address || '',
      email: req.body?.email || '',
      phone: req.body?.phone || '',
      createdAt: now,
      updatedAt: now,
    }
    clients.push(client)
    await writeUserData('clients', clients, username)
    return res.status(201).json(client)
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ error: 'Method not allowed' })
}
