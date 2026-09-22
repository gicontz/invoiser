// Auth gate for the whole app — every page and every /api route, no
// exceptions, since real confidential client/bank data lives behind both.
// Runs as Vercel Edge Middleware, a separate quota/runtime from Serverless
// Functions (confirmed empirically: a deployment with this file plus the
// existing 12 Functions succeeds — Middleware does not count toward the
// Hobby plan's 12-Function cap that broke production earlier). This is the
// quick stopgap ahead of real Google SSO (see its own ticket) —
// intentionally simple: one shared username/password (no per-user
// accounts, matching this app's existing no-multi-tenant model), a
// stateless signed session cookie (no session store), verified with the
// Web Crypto API since Edge Middleware has no Node.js `crypto` module.
//
// Username defaults to DEFAULT_USERNAME — the same value already used as
// the Blob storage folder name (users/<username>/...), so the login
// identity and the data folder identity stay the same one concept, per
// the "username is the folder name" instruction this was built to.
// BASIC_AUTH_PASSWORD and SESSION_SECRET have no defaults — if either is
// unset, every request 500s rather than silently serving the app
// unprotected.

const COOKIE_NAME = 'invoiser_session'
const SESSION_DURATION_SECONDS = 30 * 24 * 60 * 60 // 30 days

async function hmac(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function makeSessionCookie(username, secret) {
  const expiresAt = Date.now() + SESSION_DURATION_SECONDS * 1000
  const payload = `${username}.${expiresAt}`
  const signature = await hmac(payload, secret)
  return `${payload}.${signature}`
}

async function verifySessionCookie(value, secret) {
  if (!value) return null
  const parts = value.split('.')
  if (parts.length !== 3) return null
  const [username, expiresAtRaw, signature] = parts
  const payload = `${username}.${expiresAtRaw}`
  const expectedSignature = await hmac(payload, secret)
  if (signature !== expectedSignature) return null
  const expiresAt = Number(expiresAtRaw)
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null
  return username
}

function readCookie(request, name) {
  const header = request.headers.get('cookie') || ''
  for (const part of header.split(';')) {
    const trimmed = part.trim()
    if (trimmed.startsWith(`${name}=`)) return decodeURIComponent(trimmed.slice(name.length + 1))
  }
  return null
}

function setCookieHeader(value, maxAgeSeconds) {
  return `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`
}

const json = (body, status, extraHeaders = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...extraHeaders } })

// Paths reachable with no session at all — the login page itself, the
// built JS/CSS it needs to render (just code, no data), and the two
// endpoints middleware handles directly (never reaching any /api function).
const PUBLIC_PATHS = new Set(['/login', '/api/auth/login', '/api/auth/logout', '/favicon.ico'])

function isPublic(pathname) {
  return PUBLIC_PATHS.has(pathname) || pathname.startsWith('/assets/')
}

export default async function middleware(request) {
  const url = new URL(request.url)
  const secret = process.env.SESSION_SECRET
  const expectedUsername = process.env.BASIC_AUTH_USERNAME || process.env.DEFAULT_USERNAME
  const expectedPassword = process.env.BASIC_AUTH_PASSWORD

  if (!secret || !expectedUsername || !expectedPassword) {
    return json({ error: 'Auth is not configured on this instance.' }, 500)
  }

  if (url.pathname === '/api/auth/login' && request.method === 'POST') {
    let body = null
    try {
      body = await request.json()
    } catch {
      // fall through to the generic invalid-credentials response below
    }
    if (body?.username === expectedUsername && body?.password === expectedPassword) {
      const cookieValue = await makeSessionCookie(expectedUsername, secret)
      return json({ ok: true }, 200, { 'Set-Cookie': setCookieHeader(cookieValue, SESSION_DURATION_SECONDS) })
    }
    return json({ error: 'Invalid username or password' }, 401)
  }

  if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
    return json({ ok: true }, 200, { 'Set-Cookie': setCookieHeader('', 0) })
  }

  if (isPublic(url.pathname)) {
    return
  }

  const username = await verifySessionCookie(readCookie(request, COOKIE_NAME), secret)
  if (username) {
    return
  }

  const wantsHtml = request.headers.get('accept')?.includes('text/html')
  if (wantsHtml) {
    const loginUrl = new URL('/login', request.url)
    return Response.redirect(loginUrl, 302)
  }
  return json({ error: 'Not authenticated' }, 401)
}

export const config = {
  matcher: '/((?!favicon.ico).*)',
}
