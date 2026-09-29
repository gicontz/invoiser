import { readUserData, writeUserData } from './_lib/storage.js'
import { getSessionUsername } from './_lib/session.js'

// Smoke-test route for the storage layer (see memory: Epic #10) — also the
// real endpoint the Frontend Migration epic will use for the biller profile.
export default async function handler(req, res) {
  const username = await getSessionUsername(req)
  if (!username) return res.status(401).json({ error: 'Not authenticated' })

  if (req.method === 'GET') {
    const settings = await readUserData('settings', username)
    return res.status(200).json(settings)
  }

  if (req.method === 'PATCH') {
    const current = await readUserData('settings', username)
    const updated = { ...current, ...req.body }
    await writeUserData('settings', updated, username)
    return res.status(200).json(updated)
  }

  res.setHeader('Allow', 'GET, PATCH')
  return res.status(405).json({ error: 'Method not allowed' })
}
