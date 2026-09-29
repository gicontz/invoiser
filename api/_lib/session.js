// Session cookie signing/verification and password hashing, all built on
// Web Crypto (crypto.subtle / crypto.getRandomValues) rather than Node's
// `crypto` module — that's the one API surface available in *both* runtimes
// this needs to run in: Edge Middleware (middleware.js, where login/signup
// live) and the Node.js Serverless Functions (every api/*.js, which need to
// resolve "which user" from the same cookie to read/write the right Blob
// path). One implementation, no drift between the two.

export const COOKIE_NAME = 'invoiser_session'
export const SESSION_DURATION_SECONDS = 30 * 24 * 60 * 60 // 30 days

const PBKDF2_ITERATIONS = 100000

function b64urlEncode(bytes) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function hmac(value, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return b64urlEncode(new Uint8Array(sig))
}

export async function makeSessionCookie(username, secret) {
  const expiresAt = Date.now() + SESSION_DURATION_SECONDS * 1000
  const payload = `${username}.${expiresAt}`
  const signature = await hmac(payload, secret)
  return `${payload}.${signature}`
}

export async function verifySessionCookie(value, secret) {
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

export function setCookieHeader(value, maxAgeSeconds) {
  return `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`
}

// Works against both a raw `Cookie` header string (Edge's `Request`) and
// Node's already-parsed `req.headers.cookie` string — both are the same
// wire format, just accessed differently by the two runtimes.
export function parseCookie(cookieHeader, name) {
  if (!cookieHeader) return null
  const found = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
  if (!found) return null
  return decodeURIComponent(found.slice(name.length + 1))
}

// Convenience for Node Serverless Functions: resolve the authenticated
// username directly from the request, or null. Middleware already blocks
// unauthenticated requests from reaching here, but each function still
// needs the actual username to know which Blob path to read/write.
export async function getSessionUsername(req) {
  const secret = process.env.SESSION_SECRET
  if (!secret) return null
  const cookieValue = parseCookie(req.headers.cookie, COOKIE_NAME)
  return verifySessionCookie(cookieValue, secret)
}

// --- Password hashing ---
// PBKDF2-SHA256 via Web Crypto: the strongest primitive available in the
// Edge runtime (bcrypt/scrypt/argon2 all depend on Node built-ins that
// don't exist there, and this needs to run in middleware.js).

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const bits = await deriveBits(password, salt, PBKDF2_ITERATIONS)
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64urlEncode(salt)}$${b64urlEncode(new Uint8Array(bits))}`
}

export async function verifyPassword(password, stored) {
  if (!stored) return false
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
  const iterations = Number(parts[1])
  const salt = b64urlDecode(parts[2])
  const expected = parts[3]
  const bits = await deriveBits(password, salt, iterations)
  const actual = b64urlEncode(new Uint8Array(bits))
  return timingSafeEqual(actual, expected)
}

async function deriveBits(password, salt, iterations) {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  return crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, keyMaterial, 256)
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return result === 0
}
