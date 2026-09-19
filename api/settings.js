import { readUserData, updateUserData, respondToStorageError } from './_lib/storage.js'

// Smoke-test route for the storage layer (see memory: Epic #10) — also the
// real endpoint the Frontend Migration epic will use for the biller profile.
export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { data } = await readUserData('settings')
    return res.status(200).json(data)
  }

  if (req.method === 'PATCH') {
    try {
      const { data } = await updateUserData('settings', (current) => ({
        data: { ...current, ...req.body },
      }))
      return res.status(200).json(data)
    } catch (error) {
      if (respondToStorageError(error, res)) return
      throw error
    }
  }

  res.setHeader('Allow', 'GET, PATCH')
  return res.status(405).json({ error: 'Method not allowed' })
}
