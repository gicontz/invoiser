import nodemailer from 'nodemailer'
import { readUserData } from './_lib/storage.js'
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

  const { invoiceId, to, cc, bcc, subject, body } = req.body || {}
  if (!invoiceId || !to) {
    return res.status(400).json({ error: 'invoiceId and to are required' })
  }

  const [invoices, settings] = await Promise.all([
    readUserData('invoices', username),
    readUserData('settings', username),
  ])
  const invoice = invoices.find((inv) => inv.id === invoiceId)
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' })

  const biller = settings.biller || { name: '', address: '', email: '', phone: '' }

  let pdfBuffer
  try {
    const proto = req.headers['x-forwarded-proto'] || (req.headers.host?.includes('localhost') ? 'http' : 'https')
    const pdfRes = await fetch(`${proto}://${req.headers.host}/api/invoices/${invoiceId}/pdf`, {
      headers: { cookie: req.headers.cookie || '' },
    })
    if (!pdfRes.ok) throw new Error(`PDF endpoint returned ${pdfRes.status}`)
    pdfBuffer = Buffer.from(await pdfRes.arrayBuffer())
  } catch (error) {
    console.error('PDF generation failed', error)
    return res.status(500).json({ error: 'Could not generate the invoice PDF' })
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
      html: renderEmailHtml({ billerName: biller.name, bodyText: body }),
      attachments: [
        {
          filename: `${invoice.invoiceNumber || 'invoice'}.pdf`,
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
  return res.status(200).json({ sent: true })
}
