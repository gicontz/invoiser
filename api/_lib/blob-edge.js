// A minimal, Edge-compatible Blob client for the `accounts/` namespace,
// used only from middleware.js.
//
// @vercel/blob's SDK can't run in Edge Middleware — it depends on `undici`
// and Node built-ins (node:stream, node:net, node:tls, ...) that don't
// exist in that runtime (confirmed empirically: importing it there breaks
// the deployment outright). This reimplements just the two operations
// needed (read one JSON object, write one JSON object) as plain `fetch()`
// calls against Blob's actual HTTP contract, reverse-engineered from the
// SDK's own source (node_modules/@vercel/blob/dist/*.js):
//   - get(): a direct GET against the store's own CDN host.
//   - put(): a PUT against Vercel's control-plane API (vercel.com/api/blob),
//     not the CDN host — that's what actually creates/overwrites a blob.
// Every user's login/signup account record lives in its own private Blob
// store (`invoiser-accounts`, access: private) — a distinct security
// boundary from the app-data store, so a compromise of one token doesn't
// expose the other.

function storeIdFromToken(token) {
  // Read-write tokens look like `vercel_blob_rw_<storeId>_<secret>`.
  return token.split('_')[3]
}

export async function edgeBlobGet(token, pathname) {
  const storeId = storeIdFromToken(token)
  const url = new URL(`https://${storeId}.private.blob.vercel-storage.com/${pathname}`)
  url.searchParams.set('cache', '0')
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Blob GET ${pathname} failed: ${res.status}`)
  return res.json()
}

export async function edgeBlobPut(token, pathname, data) {
  const storeId = storeIdFromToken(token)
  const params = new URLSearchParams({ pathname })
  const res = await fetch(`https://vercel.com/api/blob/?${params.toString()}`, {
    method: 'PUT',
    body: JSON.stringify(data),
    headers: {
      authorization: `Bearer ${token}`,
      'x-vercel-blob-store-id': storeId,
      'x-api-version': '12',
      'x-content-type': 'application/json',
      'x-vercel-blob-access': 'private',
      'x-allow-overwrite': '1',
      'x-add-random-suffix': '0',
    },
  })
  if (!res.ok) throw new Error(`Blob PUT ${pathname} failed: ${res.status}`)
  return res.json()
}
