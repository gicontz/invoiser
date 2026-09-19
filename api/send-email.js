import nodemailer from 'nodemailer'
import { readUserData } from './_lib/storage.js'
import { findInvoice } from './_lib/invoiceStorage.js'
import { renderEmailHtml } from './_lib/renderEmailHtml.js'

// Two possible sending providers, both env-var configured (see #27/#30 —
// no per-instance Settings UI yet, no account system to hang it off).
// Resend is preferred when configured (the intended production path, once
// a sending domain is verified — see #30); Gmail is the fallback,
// originally built as throwaway local-dev scaffolding (#27) but also
// currently enabled in production for personal use (PR #32). If neither is
// configured, 501s so the frontend falls back to the mailto handoff.
export const config = { maxDuration: 30 }

async function sendViaResend({ to, cc, bcc, subject, text, html, attachmentBuffer, filename, fromName }) {
  const apiKey = process.env.RESEND_API_KEY
  const fromDomain = process.env.RESEND_FROM_DOMAIN
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `${fromName || 'Invoiser'} <invoices@${fromDomain}>`,
      to: to.split(',').map((s) => s.trim()),
      cc: cc ? cc.split(',').map((s) => s.trim()) : undefined,
      bcc: bcc ? bcc.split(',').map((s) => s.trim()) : undefined,
      subject,
      text,
      html,
      attachments: [{ filename, content: attachmentBuffer.toString('base64') }],
    }),
  })
  if (!res.ok) {
    const responseBody = await res.text()
    throw new Error(`Resend API error ${res.status}: ${responseBody}`)
  }
}

async function sendViaGmail({ to, cc, bcc, subject, text, html, attachmentBuffer, filename, fromName }) {
  const { GOOGLE_APP_USERNAME, GOOGLE_APP_PASSWORD } = process.env
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GOOGLE_APP_USERNAME, pass: GOOGLE_APP_PASSWORD },
  })
  await transporter.sendMail({
    from: `"${fromName || GOOGLE_APP_USERNAME}" <${GOOGLE_APP_USERNAME}>`,
    to,
    cc: cc || undefined,
    bcc: bcc || undefined,
    subject,
    text,
    html,
    attachments: [{ filename, content: attachmentBuffer, contentType: 'application/pdf' }],
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const hasResend = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_DOMAIN)
  const hasGmail = Boolean(process.env.GOOGLE_APP_USERNAME && process.env.GOOGLE_APP_PASSWORD)
  if (!hasResend && !hasGmail) {
    return res.status(501).json({ error: 'Email sending is not configured on this instance' })
  }

  const { invoiceId, to, cc, bcc, subject, body } = req.body || {}
  if (!invoiceId || !to) {
    return res.status(400).json({ error: 'invoiceId and to are required' })
  }

  const [found, { data: settings }] = await Promise.all([
    findInvoice(invoiceId),
    readUserData('settings'),
  ])
  if (!found) return res.status(404).json({ error: 'Invoice not found' })
  const { invoice } = found

  const biller = settings.biller || { name: '', address: '', email: '', phone: '' }

  let pdfBuffer
  try {
    const proto = req.headers['x-forwarded-proto'] || (req.headers.host?.includes('localhost') ? 'http' : 'https')
    const pdfRes = await fetch(`${proto}://${req.headers.host}/api/invoices/${invoiceId}/pdf`)
    if (!pdfRes.ok) throw new Error(`PDF endpoint returned ${pdfRes.status}`)
    pdfBuffer = Buffer.from(await pdfRes.arrayBuffer())
  } catch (error) {
    console.error('PDF generation failed', error)
    return res.status(500).json({ error: 'Could not generate the invoice PDF' })
  }

  const sendArgs = {
    to,
    cc,
    bcc,
    subject,
    text: body,
    html: renderEmailHtml({ billerName: biller.name, bodyText: body }),
    attachmentBuffer: pdfBuffer,
    filename: `${invoice.invoiceNumber || 'invoice'}.pdf`,
    fromName: biller.name,
  }

  try {
    if (hasResend) await sendViaResend(sendArgs)
    else await sendViaGmail(sendArgs)
  } catch (error) {
    console.error('Email send failed', error)
    return res.status(502).json({ error: 'Could not send the email' })
  }

  // pdfBuffer falls out of scope here — nothing is persisted anywhere.
  return res.status(200).json({ sent: true, provider: hasResend ? 'resend' : 'gmail' })
}
