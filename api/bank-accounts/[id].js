import { readUserData, updateUserData, respondToStorageError, RouteError } from '../_lib/storage.js'

// Same delete policy as clients (epic #15): block rather than orphan
// bankAccountId references on existing invoices.
export default async function handler(req, res) {
  const { id } = req.query

  if (req.method === 'GET') {
    const { data: banks } = await readUserData('banks')
    const bank = banks.find((b) => b.id === id)
    if (!bank) return res.status(404).json({ error: 'Bank account not found' })
    return res.status(200).json(bank)
  }

  if (req.method === 'PATCH') {
    try {
      const { bank } = await updateUserData('banks', (banks) => {
        const index = banks.findIndex((b) => b.id === id)
        if (index === -1) throw new RouteError(404, 'Bank account not found')
        let next = banks
        if (req.body?.isDefault === true) {
          next = banks.map((b) => ({ ...b, isDefault: false }))
        } else {
          next = [...banks]
        }
        const updated = { ...next[index], ...req.body, id, updatedAt: new Date().toISOString() }
        next[index] = updated
        return { data: next, bank: updated }
      })
      return res.status(200).json(bank)
    } catch (error) {
      if (respondToStorageError(error, res)) return
      throw error
    }
  }

  if (req.method === 'DELETE') {
    const { data: invoices } = await readUserData('invoices')
    const referenced = invoices.some((inv) => inv.bankAccountId === id)
    if (referenced) {
      return res.status(409).json({ error: 'Bank account is used on one or more invoices' })
    }
    try {
      await updateUserData('banks', (banks) => {
        const index = banks.findIndex((b) => b.id === id)
        if (index === -1) throw new RouteError(404, 'Bank account not found')
        return { data: banks.filter((b) => b.id !== id) }
      })
      return res.status(204).end()
    } catch (error) {
      if (error instanceof RouteError) return res.status(error.status).json({ error: error.message })
      throw error
    }
  }

  res.setHeader('Allow', 'GET, PATCH, DELETE')
  return res.status(405).json({ error: 'Method not allowed' })
}
