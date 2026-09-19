import nodemailer from 'nodemailer'
import { readUserData } from './_lib/storage.js'
import { renderInvoicePdfBuffer } from './_lib/renderInvoicePdf.js'
import { computeTotals } from '../src/utils/calc.js'

// Gmail sending path (issue #27) — env vars, not per-instance Settings.
// Temporarily enabled in this production deployment too: this is currently
// personal use (a single instance, run by the maintainer), not a public
// self-hosted release yet, so there's no other deployment this could affect.
// Once the app goes public, this reverts to local-dev-only (or is replaced
// outright) and #30 (Resend, with a verified sending domain) becomes the
// real production path.
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

  const { invoiceId, to, cc, bcc, subject, body } = req.body || {}
  if (!invoiceId || !to) {
    return res.status(400).json({ error: 'invoiceId and to are required' })
  }

  const [invoices, settings] = await Promise.all([
    readUserData('invoices'),
    readUserData('settings'),
  ])
  const invoice = invoices.find((inv) => inv.id === invoiceId)
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' })

  const biller = settings.biller || { name: '', address: '', email: '', phone: '' }
  const totals = computeTotals(invoice.items, invoice.taxPercent, invoice.discountAmount, invoice.capAmount)
  const invoiceData = {
    biller,
    client: invoice.client,
    meta: {
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      currency: invoice.currency,
    },
    items: invoice.items,
    notes: invoice.notes,
    totals,
    bank: invoice.bank,
    signature: invoice.signature,
    signatoryName: invoice.sameAsBusiness ? biller.name : invoice.signatoryName,
    separateItems: invoice.separateItems,
  }

  let pdfBuffer
  try {
    pdfBuffer = await renderInvoicePdfBuffer(invoice.selectedDesignId, invoiceData)
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
