import { COOKIE_NAME, SESSION_DURATION_SECONDS, makeSessionCookie, verifySessionCookie, setCookieHeader, parseCookie, hashPassword, verifyPassword } from './api/_lib/session.js'
import { edgeBlobGet, edgeBlobPut } from './api/_lib/blob-edge.js'

const USERNAME_PATTERN = /^[a-z0-9_-]{3,32}$/

const json = (body, status, extraHeaders = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...extraHeaders } })

const PUBLIC_PATHS = new Set(['/login', '/api/auth/login', '/api/auth/signup', '/api/auth/logout', '/favicon.ico'])
function isPublic(pathname) { return PUBLIC_PATHS.has(pathname) || pathname.startsWith('/assets/') }

function accountPath(username) {
  return `accounts/${username}.json`
}

export default async function middleware(request) {
  const url = new URL(request.url)
  const secret = process.env.SESSION_SECRET
  const accountsToken = process.env.ACCOUNTS_READ_WRITE_TOKEN
  if (!secret || !accountsToken) return json({ error: 'Auth is not configured on this instance.' }, 500)

  if (url.pathname === '/api/auth/signup' && request.method === 'POST') {
    let body = null
    try { body = await request.json() } catch {}
    const username = (body?.username || '').trim().toLowerCase()
    const password = body?.password || ''
    if (!USERNAME_PATTERN.test(username)) {
      return json({ error: 'Username must be 3-32 characters: lowercase letters, numbers, "-" or "_".' }, 400)
    }
    if (password.length < 8) {
      return json({ error: 'Password must be at least 8 characters.' }, 400)
    }
    const existing = await edgeBlobGet(accountsToken, accountPath(username))
    if (existing) {
      return json({ error: 'That username is already taken.' }, 409)
    }
    const passwordHash = await hashPassword(password)
    await edgeBlobPut(accountsToken, accountPath(username), {
      username,
      passwordHash,
      createdAt: new Date().toISOString(),
    })
    const cookieValue = await makeSessionCookie(username, secret)
    return json({ ok: true, username }, 201, { 'Set-Cookie': setCookieHeader(cookieValue, SESSION_DURATION_SECONDS) })
  }

  if (url.pathname === '/api/auth/login' && request.method === 'POST') {
    let body = null
    try { body = await request.json() } catch {}
    const username = (body?.username || '').trim().toLowerCase()
    const password = body?.password || ''
    const account = await edgeBlobGet(accountsToken, accountPath(username))
    const valid = account && (await verifyPassword(password, account.passwordHash))
    if (!valid) {
      return json({ error: 'Invalid username or password' }, 401)
    }
    const cookieValue = await makeSessionCookie(username, secret)
    return json({ ok: true, username }, 200, { 'Set-Cookie': setCookieHeader(cookieValue, SESSION_DURATION_SECONDS) })
  }

  if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
    return json({ ok: true }, 200, { 'Set-Cookie': setCookieHeader('', 0) })
  }

  if (isPublic(url.pathname)) return

  const username = await verifySessionCookie(parseCookie(request.headers.get('cookie'), COOKIE_NAME), secret)
  if (username) return

  const wantsHtml = request.headers.get('accept')?.includes('text/html')
  if (wantsHtml) return Response.redirect(new URL('/login', request.url), 302)
  return json({ error: 'Not authenticated' }, 401)
}

export const config = { matcher: '/((?!favicon.ico).*)' }
