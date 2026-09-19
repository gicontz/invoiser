import { readPath, updatePath, listBlobPaths, RouteError, DEFAULT_USERNAME } from './storage.js'

// Invoices are split one JSON array per calendar year (bucketed by
// invoiceDate's year), plus a small id -> year index, instead of one
// ever-growing flat file — see decisions.md D4's accepted tradeoff and
// #37, which this closes out. Every mutating route pays for one year's
// worth of records, not a user's entire invoice history.
//
//   users/<username>/invoices/<year>.json   -- one array of invoices
//   users/<username>/invoices/_index.json   -- { "<invoiceId>": <year> }

function invoicesPrefix(username) {
  return `users/${username}/invoices/`
}

function invoiceYearPath(username, year) {
  return `users/${username}/invoices/${year}.json`
}

function invoiceIndexPath(username) {
  return `users/${username}/invoices/_index.json`
}

function yearOf(invoiceDate) {
  return (invoiceDate || '').slice(0, 4) || String(new Date().getFullYear())
}

// Discovers which year files actually exist — never a hardcoded range.
export async function listInvoiceYears(username = DEFAULT_USERNAME) {
  const paths = await listBlobPaths(invoicesPrefix(username))
  return paths
    .map((p) => p.split('/').pop())
    .filter((name) => /^\d{4}\.json$/.test(name))
    .map((name) => name.replace('.json', ''))
    .sort()
}

export async function readInvoiceYear(year, username = DEFAULT_USERNAME) {
  return readPath(invoiceYearPath(username, year), [])
}

export async function updateInvoiceYear(year, mutate, username = DEFAULT_USERNAME) {
  return updatePath(invoiceYearPath(username, year), [], mutate)
}

export async function readInvoiceIndex(username = DEFAULT_USERNAME) {
  return readPath(invoiceIndexPath(username), {})
}

export async function updateInvoiceIndex(mutate, username = DEFAULT_USERNAME) {
  return updatePath(invoiceIndexPath(username), {}, mutate)
}

// Reads every invoice across all year files — the one place a full-history
// read is unavoidable (GET /api/invoices, /api/dashboard). Resolved open
// question from the ticket: Dashboard's lifetime totals (total invoiced/
// received) need every invoice ever, not just recent years, so this fans
// out across all of them — but it scales with number of YEARS, not number
// of invoices, which is the actual improvement over the old flat file.
export async function readAllInvoices(username = DEFAULT_USERNAME) {
  const years = await listInvoiceYears(username)
  const perYear = await Promise.all(years.map((year) => readInvoiceYear(year, username)))
  return perYear.flatMap((y) => y.data)
}

// Resolves an id to its year via the index (one small read), then reads
// only that one year file — never fans out across years for a
// single-record lookup.
export async function findInvoice(id, username = DEFAULT_USERNAME) {
  const { data: index } = await readInvoiceIndex(username)
  const year = index[id]
  if (!year) return null
  const { data: invoices } = await readInvoiceYear(year, username)
  const invoice = invoices.find((inv) => inv.id === id)
  return invoice ? { invoice, year } : null
}

// Creates a new invoice in its invoiceDate's year file, then records
// id -> year in the index. `buildInvoice(yearInvoices, year)` must return
// the full new invoice record — it sees the current year's invoices so it
// can size a sequential invoiceNumber the same way the old flat-file
// version did, just scoped to the year (INV-<year>-NNNN) instead of a
// lifetime count, which would require the full-history fan-out this ticket
// is specifically trying to avoid on a hot path like invoice creation.
// Two separate blob writes, each individually concurrency-guarded but not
// atomic as a pair — an inherent limit of flat-file storage, the same
// trade-off already accepted for this whole architecture (D4).
export async function createInvoice(invoiceDate, buildInvoice, username = DEFAULT_USERNAME) {
  const year = yearOf(invoiceDate)
  let created
  await updateInvoiceYear(year, (invoices) => {
    created = buildInvoice(invoices, year)
    return { data: [...invoices, created] }
  }, username)
  await updateInvoiceIndex((index) => ({ data: { ...index, [created.id]: year } }), username)
  return created
}

// Reads-modifies-writes a single invoice by id. `mutate(current)` must
// return the updated record. If the update changes which year the invoice
// belongs in (an invoiceDate edit crossing a year boundary), it's moved:
// removed from the old year file, added to the new one, and the index is
// repointed — three writes instead of one for that specific edge case,
// each individually guarded.
export async function updateInvoice(id, mutate, username = DEFAULT_USERNAME) {
  const { data: index } = await readInvoiceIndex(username)
  const year = index[id]
  if (!year) throw new RouteError(404, 'Invoice not found')

  let updated
  let movedTo = null
  await updateInvoiceYear(year, (invoices) => {
    const i = invoices.findIndex((inv) => inv.id === id)
    if (i === -1) throw new RouteError(404, 'Invoice not found')
    updated = mutate(invoices[i])
    const newYear = yearOf(updated.invoiceDate)
    if (newYear === year) {
      const next = [...invoices]
      next[i] = updated
      return { data: next }
    }
    movedTo = newYear
    return { data: invoices.filter((inv) => inv.id !== id) }
  }, username)

  if (movedTo) {
    await updateInvoiceYear(movedTo, (invoices) => ({ data: [...invoices, updated] }), username)
    await updateInvoiceIndex((idx) => ({ data: { ...idx, [id]: movedTo } }), username)
  }

  return updated
}

// Deletes a single invoice by id (draft-only, enforced here). Removes it
// from its year file and drops it from the index.
export async function deleteInvoice(id, username = DEFAULT_USERNAME) {
  const { data: index } = await readInvoiceIndex(username)
  const year = index[id]
  if (!year) throw new RouteError(404, 'Invoice not found')

  await updateInvoiceYear(year, (invoices) => {
    const invoice = invoices.find((inv) => inv.id === id)
    if (!invoice) throw new RouteError(404, 'Invoice not found')
    if (invoice.status !== 'draft') {
      throw new RouteError(409, 'Only draft invoices can be deleted — cancel instead')
    }
    return { data: invoices.filter((inv) => inv.id !== id) }
  }, username)

  await updateInvoiceIndex((idx) => {
    const next = { ...idx }
    delete next[id]
    return { data: next }
  }, username)
}
