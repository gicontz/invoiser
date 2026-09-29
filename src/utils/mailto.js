// Mail-app fallback shared by the invoice email and the Acknowledgement
// Receipt (used when server-side sending isn't configured — send-email.js
// returns 501). Not URLSearchParams: it encodes spaces as "+", which mail
// apps show literally in mailto: links. encodeURIComponent uses %20 (D16).
export function buildMailtoUrl({ to, cc, bcc, subject, body }) {
  const query = Object.entries({ cc, bcc, subject, body })
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&')
  return `mailto:${encodeURIComponent(to)}?${query}`
}

// Saves a fetched file (e.g. a server-rendered PDF) via a temporary link.
export async function downloadResponse(res, filename) {
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
