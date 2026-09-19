import { put, get, list, BlobPreconditionFailedError } from '@vercel/blob'

// Single fixed user for now — no auth yet (see memory/decisions.md D5).
// Multi-user later is just resolving a real username from a session instead
// of this env var; nothing else in this module changes.
const DEFAULT_USERNAME = process.env.DEFAULT_USERNAME || 'default'

// First-run bootstrap: a resource that doesn't exist yet reads back as this,
// not an error. Invoices aren't here — see invoiceStorage.js, which has its
// own per-year bootstrap (an empty array per year file).
const EMPTY_DEFAULTS = {
  settings: { biller: { name: '', address: '', email: '', phone: '' } },
  clients: [],
  banks: [],
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

// ---- Generic path-based primitives — shared by the simple whole-resource
// API below (settings/clients/banks) and invoiceStorage.js's per-year files.

// Reads one JSON blob by its full path, plus its ETag for a subsequent
// conditional write. useCache: false always reads from origin, never a
// CDN-cached copy. Accept-Encoding: identity additionally avoids a
// *weak* ETag (`W/"..."`, seen in testing on a compressed representation)
// — HTTP's If-Match is a strong comparison by definition, so a weak ETag
// makes ifMatch fail every single time, not occasionally: confirmed by
// reproducing it against a real blob and watching every write (including
// retries) fail with a precondition mismatch despite nothing else writing
// to it. Belt-and-suspenders: also strips any `W/` prefix that slips
// through anyway, so a future edge case here fails safe (retries once
// more) rather than silently disabling the whole guard again the way the
// result.etag/result.blob.etag mix-up did (see decisions.md D9).
// `emptyValue` is returned (not an error) when the blob doesn't exist yet —
// first-run bootstrap.
export async function readPath(pathname, emptyValue) {
  const result = await get(pathname, {
    access: 'private',
    useCache: false,
    headers: { 'Accept-Encoding': 'identity' },
  })
  if (!result) {
    return { data: structuredClone(emptyValue), etag: null }
  }
  const text = await new Response(result.stream).text()
  const rawEtag = result.blob.etag
  const etag = rawEtag?.startsWith('W/') ? rawEtag.slice(2) : rawEtag
  return { data: JSON.parse(text), etag }
}

// Overwrites one JSON blob wholesale. Pass `etag` (from a prior readPath)
// to make the write conditional — it throws BlobPreconditionFailedError if
// the blob changed since that read. addRandomSuffix: false keeps the path
// stable across writes (a flat file, not a new upload each time);
// allowOverwrite is implied by ifMatch when present, set explicitly for the
// unconditional (no-etag) case.
export async function writePath(pathname, data, etag) {
  const options = {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
  }
  if (etag) options.ifMatch = etag
  else options.allowOverwrite = true
  await put(pathname, JSON.stringify(data, null, 2), options)
}

// Read-modify-write with an optimistic-concurrency retry. `mutate(data)`
// receives the current blob's parsed content and must return
// `{ data: nextData, ...anythingElseTheCallerWants }` — e.g. the record it
// just created or updated, for the route to respond with. On a write
// conflict (another request wrote to this same blob between our read and
// our write), it re-reads the now-current data and calls `mutate` again
// against it — never blindly re-writing the first attempt's stale result —
// once. If it still conflicts, throws ConcurrencyConflictError for the
// route to turn into a 409. `mutate` can throw RouteError for a genuine
// business-rule failure (not found, invalid transition); that propagates
// immediately, without retrying.
export async function updatePath(pathname, emptyValue, mutate) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, etag } = await readPath(pathname, emptyValue)
    const outcome = mutate(data)
    try {
      await writePath(pathname, outcome.data, etag)
      return outcome
    } catch (error) {
      if (error instanceof BlobPreconditionFailedError) {
        if (attempt === 0) continue
        throw new ConcurrencyConflictError(`Conflicting write to ${pathname}`)
      }
      throw error
    }
  }
}

// Lists blob pathnames under a prefix — used by invoiceStorage.js to
// discover which year files actually exist, never a hardcoded year range.
export async function listBlobPaths(prefix) {
  const { blobs } = await list({ prefix, mode: 'expanded' })
  return blobs.map((b) => b.pathname)
}

// ---- Simple whole-resource API — settings/clients/banks. These don't grow
// per-transaction the way invoices do, so one file per resource per user is
// fine; no reason to split them (see invoiceStorage.js for invoices).

function blobPath(resource, username) {
  return `users/${username}/${resource}.json`
}

export async function readUserData(resource, username = DEFAULT_USERNAME) {
  return readPath(blobPath(resource, username), EMPTY_DEFAULTS[resource] ?? null)
}

// Unconditional write — kept for call sites that intentionally don't need
// the concurrency guard (nothing currently should reach for this over
// updateUserData for a real mutation; prefer that below).
export async function writeUserData(resource, data, username = DEFAULT_USERNAME) {
  await writePath(blobPath(resource, username), data, null)
  return data
}

// See updatePath above for the retry/conflict contract. No `username`
// parameter — like the rest of this module, always the single fixed user
// until real accounts exist.
export async function updateUserData(resource, mutate) {
  return updatePath(blobPath(resource, DEFAULT_USERNAME), EMPTY_DEFAULTS[resource] ?? null, mutate)
}

// Shared error → HTTP response mapping for routes using updateUserData /
// invoiceStorage's update helpers. Returns true if it handled the error
// (route should stop), false if the caller should let it propagate (a
// genuine unexpected failure).
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

export { DEFAULT_USERNAME }
