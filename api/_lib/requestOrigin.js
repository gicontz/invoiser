// The origin (https://host) a request came in on, so server-rendered output
// can name the domain the app is actually served from without hardcoding it
// (issue #57's watermark): *.vercel.app today, the dedicated domain after
// the move, localhost under `vercel dev`. Vercel sets x-forwarded-host /
// x-forwarded-proto at its edge; plain Host is the fallback.
//
// Both headers are client-influenced, so anything that isn't a plain
// hostname[:port] is rejected and the caller falls back to no domain at all,
// rather than printing an arbitrary string on a document.
const HOST_PATTERN = /^[a-z0-9.-]+(:\d{1,5})?$/i

function firstValue(header) {
  return String(header || '').split(',')[0].trim()
}

export function requestOrigin(req) {
  const host = firstValue(req.headers['x-forwarded-host']) || firstValue(req.headers.host)
  if (!HOST_PATTERN.test(host)) return ''
  const forwardedProto = firstValue(req.headers['x-forwarded-proto'])
  const proto = forwardedProto === 'http' || forwardedProto === 'https'
    ? forwardedProto
    : (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? 'http' : 'https')
  return `${proto}://${host.toLowerCase()}`
}
