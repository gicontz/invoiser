import { put, get } from '@vercel/blob'

// Single fixed user for now — no auth yet (see memory/decisions.md D5).
// Multi-user later is just resolving a real username from a session instead
// of this env var; nothing else in this module changes.
const DEFAULT_USERNAME = process.env.DEFAULT_USERNAME || 'default'

// First-run bootstrap: a resource that doesn't exist yet reads back as this,
// not an error.
const EMPTY_DEFAULTS = {
  settings: { biller: { name: '', address: '', email: '', phone: '' } },
  clients: [],
  banks: [],
  invoices: [],
}

function blobPath(resource, username) {
  return `users/${username}/${resource}.json`
}

// Reads one user resource (settings/clients/banks/invoices) from Blob
// storage. useCache: false always reads from origin, never a CDN-cached
// copy — required for a read-modify-write pattern where we can't afford to
// act on stale data (see memory/decisions.md D4).
export async function readUserData(resource, username = DEFAULT_USERNAME) {
  const pathname = blobPath(resource, username)
  const result = await get(pathname, { access: 'private', useCache: false })
  if (!result) {
    return structuredClone(EMPTY_DEFAULTS[resource] ?? null)
  }
  const text = await new Response(result.stream).text()
  return JSON.parse(text)
}

// Overwrites one user resource wholesale. addRandomSuffix: false +
// allowOverwrite: true keep the path stable across writes — this is a
// flat file, not a new upload each time.
export async function writeUserData(resource, data, username = DEFAULT_USERNAME) {
  const pathname = blobPath(resource, username)
  await put(pathname, JSON.stringify(data, null, 2), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  })
  return data
}
