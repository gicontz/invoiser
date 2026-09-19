import { put, get, BlobPreconditionFailedError } from '@vercel/blob'

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

// A route-level failure (not found, invalid transition, etc.) that should
// propagate immediately as-is — never retried, unlike a storage conflict.
export class RouteError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'RouteError'
    this.status = status
  }
}

// Two near-simultaneous writes to the same blob could otherwise race (see
// memory/decisions.md D4's accepted risk, closed out by this ticket: #38).
export class ConcurrencyConflictError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ConcurrencyConflictError'
  }
}

// Reads one user resource (settings/clients/banks/invoices) from Blob
// storage, plus its ETag for a subsequent conditional write. useCache:
// false always reads from origin, never a CDN-cached copy — required both
// for read-modify-write correctness and to get a strong (not cache-derived
// weak) ETag, which ifMatch requires to work at all.
export async function readUserData(resource, username = DEFAULT_USERNAME) {
  const pathname = blobPath(resource, username)
  const result = await get(pathname, { access: 'private', useCache: false })
  if (!result) {
    return { data: structuredClone(EMPTY_DEFAULTS[resource] ?? null), etag: null }
  }
  const text = await new Response(result.stream).text()
  return { data: JSON.parse(text), etag: result.blob.etag }
}

// Overwrites one user resource wholesale. Pass `etag` (from a prior
// readUserData) to make the write conditional — it throws
// BlobPreconditionFailedError if the blob changed since that read.
// addRandomSuffix: false keeps the path stable across writes (a flat file,
// not a new upload each time); allowOverwrite is implied by ifMatch when
// present, and set explicitly for the unconditional (no-etag) case.
async function writeUserDataRaw(resource, data, username, etag) {
  const pathname = blobPath(resource, username)
  const options = {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
  }
  if (etag) options.ifMatch = etag
  else options.allowOverwrite = true
  await put(pathname, JSON.stringify(data, null, 2), options)
}

// Unconditional write — kept for call sites that intentionally don't need
// the concurrency guard (nothing currently should reach for this over
// updateUserData for a real mutation; prefer that below).
export async function writeUserData(resource, data, username = DEFAULT_USERNAME) {
  await writeUserDataRaw(resource, data, username, null)
  return data
}

// Read-modify-write with an optimistic-concurrency retry. `mutate(data)`
// receives the current resource array/object and must return
// `{ data: nextData, ...anythingElseTheCallerWants }` — e.g. the record it
// just created or updated, for the route to respond with. On a write
// conflict (another request wrote to this same blob between our read and
// our write), it re-reads the now-current data and calls `mutate` again
// against it — never blindly re-writing the first attempt's stale result —
// once. If it still conflicts, throws ConcurrencyConflictError for the
// route to turn into a 409. `mutate` can throw RouteError for a genuine
// business-rule failure (not found, invalid transition); that propagates
// immediately, without retrying. No `username` parameter — like the rest
// of this module, always the single fixed user until real accounts exist.
export async function updateUserData(resource, mutate) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, etag } = await readUserData(resource)
    const outcome = mutate(data)
    try {
      await writeUserDataRaw(resource, outcome.data, DEFAULT_USERNAME, etag)
      return outcome
    } catch (error) {
      if (error instanceof BlobPreconditionFailedError) {
        if (attempt === 0) continue
        throw new ConcurrencyConflictError(`Conflicting write to ${resource}`)
      }
      throw error
    }
  }
}

// Shared error → HTTP response mapping for routes using updateUserData.
// Returns true if it handled the error (route should stop), false if the
// caller should let it propagate (a genuine unexpected failure).
export function respondToStorageError(error, res) {
  if (error instanceof RouteError) {
    res.status(error.status).json({ error: error.message })
    return true
  }
  if (error instanceof ConcurrencyConflictError) {
    res.status(409).json({ error: 'This record changed elsewhere just now — please retry' })
    return true
  }
  return false
}
