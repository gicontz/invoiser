import { readUserData, writeUserData } from './_lib/storage.js'

// Smoke-test route for the storage layer (see memory: Epic #10) — also the
// real endpoint the Frontend Migration epic will use for the biller profile.
export default async function handler(req, res) {
  if (req.method === 'GET') {
    const settings = await readUserData('settings')
    return res.status(200).json(settings)
  }

  if (req.method === 'PATCH') {
    const current = await readUserData('settings')
    const updated = { ...current, ...req.body }
    await writeUserData('settings', updated)
    return res.status(200).json(updated)
  }

  res.setHeader('Allow', 'GET, PATCH')
  return res.status(405).json({ error: 'Method not allowed' })
}
