import { readUserData, updateUserData, respondToStorageError } from './_lib/storage.js'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { data } = await readUserData('banks')
    return res.status(200).json(data)
  }

  if (req.method === 'POST') {
    try {
      const { data, bank } = await updateUserData('banks', (banks) => {
        const now = new Date().toISOString()
        const isDefault = Boolean(req.body?.isDefault) || banks.length === 0
        const newBank = {
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
        const next = isDefault ? banks.map((b) => ({ ...b, isDefault: false })) : [...banks]
        next.push(newBank)
        return { data: next, bank: newBank }
      })
      return res.status(201).json(bank)
    } catch (error) {
      if (respondToStorageError(error, res)) return
      throw error
    }
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ error: 'Method not allowed' })
}
