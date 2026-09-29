import nodemailer from 'nodemailer'
import { readUserData, writeUserData } from './_lib/storage.js'
import { renderEmailHtml } from './_lib/renderEmailHtml.js'
import { getSessionUsername } from './_lib/session.js'

// Gmail sending path (issue #27) — env vars, not per-instance Settings.
// Temporarily enabled in this production deployment too: this is currently
// personal use (a single instance, run by the maintainer), not a public
// self-hosted release yet, so there's no other deployment this could affect.
// Once the app goes public, this reverts to local-dev-only (or is replaced
// outright) and #30 (Resend, with a verified sending domain) becomes the
// real production path.
//
// Fetches the PDF from GET /api/invoices/:id/pdf (an internal HTTP call to
// its sibling function) rather than importing renderInvoicePdf.js directly —
// that pulls in Playwright + @sparticuz/chromium (~76MB), and having both
// this function and pdf.js bundle it independently pushed the deployment
// over Vercel's total size limit and broke every route, not just this one.
//
// documentType: 'receipt' sends an invoice's Acknowledgement Receipt
// (issue #52) through this same function — no new Serverless Function, see
// decisions.md D17. It fetches pdf.js's ?type=receipt variant (same
// cookie-forwarding hop, D16) with the chosen design + edited wording, and
// stamps invoice.receiptSentAt after a successful send.
export const config = { maxDuration: 30 }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { GOOGLE_APP_USERNAME, GOOGLE_APP_PASSWORD } = process.env
  if (!GOOGLE_APP_USERNAME || !GOOGLE_APP_PASSWORD) {
    return res.status(501).json({ error: 'Email sending is not configured on this instance' })
  }

  const username = await getSessionUsername(req)
  if (!username) return res.status(401).json({ error: 'Not authenticated' })

  const { invoiceId, to, cc, bcc, subject, body, documentType = 'invoice' } = req.body || {}
  if (!invoiceId || !to) {
    return res.status(400).json({ error: 'invoiceId and to are required' })
  }
  if (documentType !== 'invoice' && documentType !== 'receipt') {
    return res.status(400).json({ error: "documentType must be 'invoice' or 'receipt'" })
  }
  const isReceipt = documentType === 'receipt'

  const [invoices, settings] = await Promise.all([
    readUserData('invoices', username),
    readUserData('settings', username),
  ])
  const invoice = invoices.find((inv) => inv.id === invoiceId)
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
  if (isReceipt && invoice.status !== 'paid') {
    return res.status(409).json({ error: 'A receipt can only be sent once the invoice is paid' })
  }

  const biller = settings.biller || { name: '', address: '', email: '', phone: '' }

  let pdfBuffer
  try {
    const proto = req.headers['x-forwarded-proto'] || (req.headers.host?.includes('localhost') ? 'http' : 'https')
    // This server-to-server hop goes through middleware.js's auth gate like
    // any other request, and doesn't inherit the caller's session — forward
    // the cookie explicitly or it 401s (see memory/decisions.md D16).
    const pdfUrl = `${proto}://${req.headers.host}/api/invoices/${invoiceId}/pdf${isReceipt ? '?type=receipt' : ''}`
    const pdfRes = await fetch(pdfUrl, isReceipt
      ? {
          method: 'POST',
          headers: { cookie: req.headers.cookie || '', 'content-type': 'application/json' },
          body: JSON.stringify({
            designId: req.body.designId,
            message: req.body.receiptMessage,
            issuedDate: req.body.issuedDate,
          }),
        }
      : { headers: { cookie: req.headers.cookie || '' } })
    if (!pdfRes.ok) throw new Error(`PDF endpoint returned ${pdfRes.status}`)
    pdfBuffer = Buffer.from(await pdfRes.arrayBuffer())
  } catch (error) {
    console.error('PDF generation failed', error)
    return res.status(500).json({ error: `Could not generate the ${documentType} PDF` })
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GOOGLE_APP_USERNAME, pass: GOOGLE_APP_PASSWORD },
  })

  try {
    await transporter.sendMail({
      from: `"${biller.name || GOOGLE_APP_USERNAME}" <${GOOGLE_APP_USERNAME}>`,
      to,
      cc: cc || undefined,
      bcc: bcc || undefined,
      subject,
      text: body,
      html: renderEmailHtml({
        billerName: biller.name,
        bodyText: body,
        attachmentLabel: isReceipt ? 'Acknowledgement receipt PDF attached' : 'Invoice PDF attached',
      }),
      attachments: [
        {
          filename: `${invoice.invoiceNumber || 'invoice'}${isReceipt ? '-receipt' : ''}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    })
  } catch (error) {
    console.error('Email send failed', error)
    return res.status(502).json({ error: 'Could not send the email' })
  }

  // pdfBuffer falls out of scope here — nothing is persisted anywhere.
  if (isReceipt) {
    // The email already went out — a failed audit stamp must not turn that
    // into an error the user would retry (and double-send) on.
    const receiptSentAt = await stampReceiptSent(invoiceId, username).catch((error) => {
      console.error('Could not record receiptSentAt', error)
      return null
    })
    return res.status(200).json({ sent: true, receiptSentAt })
  }
  return res.status(200).json({ sent: true })
}

// Re-reads rather than reusing the earlier snapshot: PDF render + SMTP take
// seconds, and writing back a stale copy would clobber any edit made in
// between (D4's whole-file read-modify-write). Re-sending is allowed; this
// just records the latest send.
async function stampReceiptSent(invoiceId, username) {
  const invoices = await readUserData('invoices', username)
  const invoice = invoices.find((inv) => inv.id === invoiceId)
  if (!invoice) return null
  invoice.receiptSentAt = new Date().toISOString()
  await writeUserData('invoices', invoices, username)
  return invoice.receiptSentAt
}
