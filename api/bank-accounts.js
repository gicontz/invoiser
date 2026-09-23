import { readUserData, writeUserData } from './_lib/storage.js'
import { getSessionUsername } from './_lib/session.js'

export default async function handler(req, res) {
  const username = await getSessionUsername(req)
  if (!username) return res.status(401).json({ error: 'Not authenticated' })

  if (req.method === 'GET') {
    const banks = await readUserData('banks', username)
    return res.status(200).json(banks)
  }

  if (req.method === 'POST') {
    const banks = await readUserData('banks', username)
    const now = new Date().toISOString()
    const isDefault = Boolean(req.body?.isDefault) || banks.length === 0
    const bank = {
      id: crypto.randomUUID(),
      holder: req.body?.holder || '',
      bankName: req.body?.bankName || '',
      bankAddress: req.body?.bankAddress || '',
      accountNumber: req.body?.accountNumber || '',
      swift: req.body?.swift || '',
      isDefault,
      createdAt: now,
      updatedAt: now,
    }
    // Only one default at a time.
    const next = isDefault ? banks.map((b) => ({ ...b, isDefault: false })) : banks
    next.push(bank)
    await writeUserData('banks', next, username)
    return res.status(201).json(bank)
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ error: 'Method not allowed' })
}
