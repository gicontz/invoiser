// One-time migration for #37: buckets the existing flat
// users/<username>/invoices.json into per-year files + an id->year index,
// then deletes the old flat file once verified. Only needs to run against
// the single current DEFAULT_USERNAME blob — no multi-tenant migration
// tooling needed yet (no auth/multi-user, see decisions.md D5).
//
// Usage: BLOB_READ_WRITE_TOKEN=... node scripts/migrate-invoices-to-year-files.mjs [username]
import { get, put, del } from '@vercel/blob'

const username = process.argv[2] || process.env.DEFAULT_USERNAME || 'default'
const flatPath = `users/${username}/invoices.json`

function yearOf(invoiceDate) {
  return (invoiceDate || '').slice(0, 4) || String(new Date().getFullYear())
}

async function main() {
  const existing = await get(flatPath, { access: 'private', useCache: false })
  if (!existing) {
    console.log(`No flat file at ${flatPath} — nothing to migrate.`)
    return
  }

  const text = await new Response(existing.stream).text()
  const invoices = JSON.parse(text)
  console.log(`Read ${invoices.length} invoice(s) from ${flatPath}`)

  const byYear = new Map()
  const index = {}
  for (const invoice of invoices) {
    const year = yearOf(invoice.invoiceDate)
    if (!byYear.has(year)) byYear.set(year, [])
    byYear.get(year).push(invoice)
    index[invoice.id] = year
  }

  for (const [year, yearInvoices] of byYear) {
    const path = `users/${username}/invoices/${year}.json`
    await put(path, JSON.stringify(yearInvoices, null, 2), {
      access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true,
    })
    console.log(`Wrote ${yearInvoices.length} invoice(s) to ${path}`)
  }

  const indexPath = `users/${username}/invoices/_index.json`
  await put(indexPath, JSON.stringify(index, null, 2), {
    access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true,
  })
  console.log(`Wrote index (${Object.keys(index).length} entries) to ${indexPath}`)

  // Verify: read everything back and confirm the count matches before
  // touching the original file.
  let totalWritten = 0
  for (const year of byYear.keys()) {
    const path = `users/${username}/invoices/${year}.json`
    const r = await get(path, { access: 'private', useCache: false })
    const yearData = JSON.parse(await new Response(r.stream).text())
    totalWritten += yearData.length
  }
  const indexRead = await get(indexPath, { access: 'private', useCache: false })
  const indexData = JSON.parse(await new Response(indexRead.stream).text())

  if (totalWritten !== invoices.length || Object.keys(indexData).length !== invoices.length) {
    throw new Error(
      `Verification FAILED: original had ${invoices.length}, year files have ${totalWritten}, ` +
      `index has ${Object.keys(indexData).length}. NOT deleting the original flat file.`,
    )
  }
  console.log(`Verified: ${totalWritten} invoice(s) across ${byYear.size} year file(s), index matches.`)

  await del(flatPath)
  console.log(`Deleted old flat file ${flatPath}. Migration complete.`)
}

main().catch((error) => {
  console.error('Migration failed:', error)
  process.exit(1)
})
