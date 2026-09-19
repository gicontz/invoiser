import { readUserData, writeUserData } from '../_lib/storage.js'

// Same delete policy as clients (epic #15): block rather than orphan
// bankAccountId references on existing invoices.
export default async function handler(req, res) {
  const { id } = req.query
  const banks = await readUserData('banks')
  const index = banks.findIndex((b) => b.id === id)

  if (req.method === 'GET') {
    if (index === -1) return res.status(404).json({ error: 'Bank account not found' })
    return res.status(200).json(banks[index])
  }

  if (req.method === 'PATCH') {
    if (index === -1) return res.status(404).json({ error: 'Bank account not found' })
    let next = banks
    if (req.body?.isDefault === true) {
      next = banks.map((b) => ({ ...b, isDefault: false }))
    }
    next[index] = { ...next[index], ...req.body, id, updatedAt: new Date().toISOString() }
    await writeUserData('banks', next)
    return res.status(200).json(next[index])
  }

  if (req.method === 'DELETE') {
    if (index === -1) return res.status(404).json({ error: 'Bank account not found' })
    const invoices = await readUserData('invoices')
    const referenced = invoices.some((inv) => inv.bankAccountId === id)
    if (referenced) {
      return res.status(409).json({ error: 'Bank account is used on one or more invoices' })
    }
    banks.splice(index, 1)
    await writeUserData('banks', banks)
    return res.status(204).end()
  }

  res.setHeader('Allow', 'GET, PATCH, DELETE')
  return res.status(405).json({ error: 'Method not allowed' })
}
