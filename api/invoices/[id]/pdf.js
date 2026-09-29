import { readUserData } from '../../_lib/storage.js'
import { renderInvoicePdfBuffer, renderReceiptPdfBuffer } from '../../_lib/renderInvoicePdf.js'
import { computeTotals } from '../../../src/utils/calc.js'
import { buildReceiptData, normalizeReceiptOptions } from '../../../src/designs/receiptTemplates.js'
import { getSessionUsername } from '../../_lib/session.js'

// Server-rendered PDF via Playwright (see _lib/renderInvoicePdf.js) — the
// same real-Chromium pipeline already proven in production for email
// (issue #27/#28), used here for the "Download PDF" button too so both
// paths render identically and neither depends on html2canvas's
// approximate text layout (the source of the margin/letter-spacing bugs
// in the old client-side jsPDF+html2canvas export).
//
// ?type=receipt renders the invoice's Acknowledgement Receipt instead
// (issue #52) — folded into this function rather than a new one because the
// project sits at Vercel Hobby's 12-Serverless-Function cap (decisions.md
// D17). Receipt options (designId, message, issuedDate) come from the query
// string on GET or the JSON body on POST (POST because the edited wording
// can be long; send-email.js uses it).
export const config = { maxDuration: 30 }

function buildInvoiceData(invoice, biller) {
  const totals = computeTotals(invoice.items, invoice.taxPercent, invoice.discountAmount, invoice.capAmount)
  return {
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
}

export default async function handler(req, res) {
  const isReceipt = req.query.type === 'receipt'
  const allowed = isReceipt ? ['GET', 'POST'] : ['GET']
  if (!allowed.includes(req.method)) {
    res.setHeader('Allow', allowed.join(', '))
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const username = await getSessionUsername(req)
  if (!username) return res.status(401).json({ error: 'Not authenticated' })

  const { id } = req.query
  const [invoices, settings] = await Promise.all([
    readUserData('invoices', username),
    readUserData('settings', username),
  ])
  const invoice = invoices.find((inv) => inv.id === id)
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' })

  const biller = settings.biller || { name: '', address: '', email: '', phone: '' }

  if (isReceipt && invoice.status !== 'paid') {
    return res.status(409).json({ error: 'A receipt is only available once the invoice is paid' })
  }

  let pdfBuffer
  try {
    if (isReceipt) {
      const options = normalizeReceiptOptions(req.method === 'POST' ? req.body || {} : req.query)
      pdfBuffer = await renderReceiptPdfBuffer(buildReceiptData(invoice, biller, options))
    } else {
      pdfBuffer = await renderInvoicePdfBuffer(invoice.selectedDesignId, buildInvoiceData(invoice, biller))
    }
  } catch (error) {
    console.error('PDF generation failed', error)
    return res.status(500).json({ error: `Could not generate the ${isReceipt ? 'receipt' : 'invoice'} PDF` })
  }

  const baseName = invoice.invoiceNumber || 'invoice'
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${isReceipt ? `${baseName}-receipt` : baseName}.pdf"`)
  return res.status(200).send(pdfBuffer)
}
