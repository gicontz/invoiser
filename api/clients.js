import { readUserData, updateUserData, respondToStorageError } from './_lib/storage.js'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { data } = await readUserData('clients')
    return res.status(200).json(data)
  }

  if (req.method === 'POST') {
    try {
      const { data, client } = await updateUserData('clients', (clients) => {
        const now = new Date().toISOString()
        const newClient = {
          id: crypto.randomUUID(),
          name: req.body?.name || '',
          address: req.body?.address || '',
          email: req.body?.email || '',
          phone: req.body?.phone || '',
          createdAt: now,
          updatedAt: now,
        }
        return { data: [...clients, newClient], client: newClient }
      })
      return res.status(201).json(client)
    } catch (error) {
      if (respondToStorageError(error, res)) return
      throw error
    }
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ error: 'Method not allowed' })
}
