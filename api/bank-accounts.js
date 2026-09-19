import { readUserData, writeUserData } from './_lib/storage.js'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const banks = await readUserData('banks')
    return res.status(200).json(banks)
  }

  if (req.method === 'POST') {
    const banks = await readUserData('banks')
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
    await writeUserData('banks', next)
    return res.status(201).json(bank)
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ error: 'Method not allowed' })
}
