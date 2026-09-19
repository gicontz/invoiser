import { readUserData } from '../../_lib/storage.js'
import { findInvoice } from '../../_lib/invoiceStorage.js'
import { renderInvoicePdfBuffer } from '../../_lib/renderInvoicePdf.js'
import { computeTotals } from '../../../src/utils/calc.js'

// Server-rendered PDF via Playwright (see _lib/renderInvoicePdf.js) — the
// same real-Chromium pipeline already proven in production for email
// (issue #27/#28), used here for the "Download PDF" button too so both
// paths render identically and neither depends on html2canvas's
// approximate text layout (the source of the margin/letter-spacing bugs
// in the old client-side jsPDF+html2canvas export).
export const config = { maxDuration: 30 }

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { id } = req.query
  const [found, { data: settings }] = await Promise.all([
    findInvoice(id),
    readUserData('settings'),
  ])
  if (!found) return res.status(404).json({ error: 'Invoice not found' })
  const { invoice } = found

  const biller = settings.biller || { name: '', address: '', email: '', phone: '' }
  const totals = computeTotals(invoice.items, invoice.taxPercent, invoice.discountAmount, invoice.capAmount)
  const invoiceData = {
    biller,
    // A fresh invoice's client/bank are null until the editor's ClientCard/
    // BankDetails actually set them — renderInvoiceBody accesses their
    // fields unconditionally (e.g. client.name), so a bare null here
    // crashes PDF generation entirely for any never-edited draft.
    client: invoice.client || { name: '', address: '', email: '', phone: '' },
    meta: {
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      currency: invoice.currency,
    },
    items: invoice.items,
    notes: invoice.notes,
    totals,
    bank: invoice.bank || { holder: '', bankName: '', bankAddress: '', accountNumber: '', swift: '' },
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

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber || 'invoice'}.pdf"`)
  return res.status(200).send(pdfBuffer)
}
