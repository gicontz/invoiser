import { useMemo, useState } from 'react'
import { enqueueSnackbar } from 'notistack'
import { api } from '../api/client.js'
import { DESIGNS, renderReceiptHtml } from '../designs/index.js'
import {
  buildReceiptData, defaultReceiptEmailBody, defaultReceiptEmailSubject, defaultReceiptMessage, todayIso,
} from '../designs/receiptTemplates.js'
import { buildMailtoUrl, downloadResponse } from '../utils/mailto.js'
import EmailModal from './EmailModal.jsx'
import AsyncButton from './AsyncButton.jsx'

// Acknowledgement Receipt (issue #52): EmailModal (to/cc/bcc/subject/body +
// the same mailto: fallback as the invoice email) plus the receipt-specific
// bits — a design picker (defaults to the invoice's own design), the
// receipt wording (prefilled with real interpolated text, editable), and a
// live preview. The preview is the same HTML the server renders to PDF
// (D1/D2), so what you see is what gets attached.
export default function ReceiptModal({ invoice, biller, addressBook, onClose, onSent }) {
  const [issuedDate] = useState(todayIso)
  const [designId, setDesignId] = useState(invoice.selectedDesignId || 'default')
  const base = useMemo(() => buildReceiptData(invoice, biller, { issuedDate }), [invoice, biller, issuedDate])
  const defaultMessage = useMemo(() => defaultReceiptMessage(base), [base])
  const [message, setMessage] = useState(defaultMessage)

  const receiptOptions = { designId, message, issuedDate }
  const previewHtml = useMemo(
    () => renderReceiptHtml(buildReceiptData(invoice, biller, { designId, message, issuedDate })),
    [invoice, biller, designId, message, issuedDate],
  )
  const filename = `${invoice.invoiceNumber || 'invoice'}-receipt.pdf`

  const handleDownloadPdf = async () => {
    try {
      const res = await api.fetchReceiptPdf(invoice.id, receiptOptions)
      if (!res.ok) throw new Error('Could not generate the receipt PDF')
      await downloadResponse(res, filename)
      enqueueSnackbar('Receipt PDF downloaded', { variant: 'success' })
    } catch {
      enqueueSnackbar('Could not generate the receipt PDF', { variant: 'error' })
      throw new Error('Receipt PDF generation failed')
    }
  }

  const handleSend = async ({ to, cc, bcc, subject, body }) => {
    if (!to.trim()) {
      enqueueSnackbar('Add at least one recipient', { variant: 'warning' })
      return
    }
    try {
      const result = await api.sendReceipt({
        invoiceId: invoice.id, to, cc, bcc, subject, body, ...receiptOptions, receiptMessage: message,
      })
      if (result?.sent) {
        enqueueSnackbar('Receipt sent', { variant: 'success' })
        onSent?.(result)
        return
      }
    } catch (error) {
      // 501 = sending isn't configured here — fall through to the mail app
      // silently, exactly like the invoice email (InvoiceEditorPage).
      if (error.status && error.status !== 501) {
        enqueueSnackbar(error.message || 'Could not send the receipt — opening your mail app instead', { variant: 'error' })
      }
    }

    try {
      await handleDownloadPdf()
    } catch {
      return
    }
    window.location.href = buildMailtoUrl({ to, cc, bcc, subject, body })
    onClose()
    enqueueSnackbar('Mail client opened', { variant: 'success' })
  }

  const preview = (
    <div className="receipt-preview">
      <span className="receipt-preview-label">Preview</span>
      <div className="receipt-preview-frame">
        <iframe title="Receipt preview" srcDoc={previewHtml} />
      </div>
    </div>
  )

  return (
    <EmailModal
      open
      onClose={onClose}
      addressBook={addressBook}
      defaultSubject={defaultReceiptEmailSubject(base)}
      defaultBody={defaultReceiptEmailBody(base)}
      onSend={handleSend}
      title={`Send Receipt — ${invoice.invoiceNumber || 'invoice'}`}
      hint={
        invoice.receiptSentAt
          ? `A receipt was already sent on ${new Date(invoice.receiptSentAt).toLocaleDateString()}. You can send it again.`
          : "Optional: confirm to your client that this invoice's payment was received. The receipt PDF is attached."
      }
      sendLabel="Send Receipt"
      preview={preview}
      footerExtra={<AsyncButton className="btn btn-secondary" onClick={handleDownloadPdf}>Download PDF</AsyncButton>}
    >
      <span className="field-label" id="receiptDesignLabel">Design</span>
      <div className="design-chips" role="radiogroup" aria-labelledby="receiptDesignLabel">
        {DESIGNS.filter((d) => d.status === 'active').map((design) => (
          <button
            key={design.id}
            type="button"
            role="radio"
            aria-checked={design.id === designId}
            className={`design-chip${design.id === designId ? ' selected' : ''}`}
            onClick={() => setDesignId(design.id)}
          >
            <span className="design-chip-swatches">
              {design.swatches.map((hex) => <span key={hex} style={{ background: hex }} />)}
            </span>
            {design.name}
          </button>
        ))}
      </div>

      <div className="field-label-row">
        <label htmlFor="receiptMessage">Receipt wording</label>
        {message !== defaultMessage && (
          <button type="button" className="btn-tiny" onClick={() => setMessage(defaultMessage)}>Reset to default</button>
        )}
      </div>
      <textarea id="receiptMessage" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />
    </EmailModal>
  )
}
