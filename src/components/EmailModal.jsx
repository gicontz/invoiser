import { useEffect, useState } from 'react'
import AsyncButton from './AsyncButton.jsx'

const DEFAULT_HINT =
  "We'll send this on your behalf, PDF attached. If email sending isn't set up on this " +
  'instance, a PDF downloads instead and your own mail app opens so you can attach it and ' +
  'send it yourself.'

// Shared by the invoice email (InvoiceEditorPage) and the Acknowledgement
// Receipt (ReceiptModal, issue #52). The optional props only exist for the
// receipt: `children` renders document-specific fields above To/CC/BCC,
// `preview` adds a side column, `footerExtra` sits left of Cancel/Send.
export default function EmailModal({
  open, onClose, addressBook, defaultSubject, defaultBody, onSend,
  title = 'Email Invoice', hint = DEFAULT_HINT, sendLabel = 'Send Email',
  children = null, preview = null, footerExtra = null,
}) {
  const [to, setTo] = useState('')
  const [cc, setCc] = useState('')
  const [bcc, setBcc] = useState('')
  const [subject, setSubject] = useState(defaultSubject)
  const [body, setBody] = useState(defaultBody)

  // Refresh the prefilled subject/body whenever the modal is (re)opened,
  // so it reflects the current invoice number/total.
  useEffect(() => {
    if (open) {
      setSubject(defaultSubject)
      setBody(defaultBody)
    }
  }, [open, defaultSubject, defaultBody])

  if (!open) return null

  const handleSend = () => onSend({ to, cc, bcc, subject, body })

  const fields = (
    <div className="modal-fields">
      <p className="modal-hint">{hint}</p>

      {children}

      <label htmlFor="emailTo">To</label>
      <input
        id="emailTo"
        type="text"
        list="addressBookList"
        placeholder="recipient@example.com, another@example.com"
        value={to}
        onChange={(e) => setTo(e.target.value)}
      />

      <label htmlFor="emailCc">CC</label>
      <input
        id="emailCc"
        type="text"
        list="addressBookList"
        placeholder="cc@example.com"
        value={cc}
        onChange={(e) => setCc(e.target.value)}
      />

      <label htmlFor="emailBcc">BCC</label>
      <input
        id="emailBcc"
        type="text"
        list="addressBookList"
        placeholder="bcc@example.com"
        value={bcc}
        onChange={(e) => setBcc(e.target.value)}
      />

      <datalist id="addressBookList">
        {addressBook.map((entry) => (
          <option key={entry.id} value={entry.email}>{entry.label}</option>
        ))}
      </datalist>

      <label htmlFor="emailSubject">Subject</label>
      <input id="emailSubject" type="text" value={subject} onChange={(e) => setSubject(e.target.value)} />

      <label htmlFor="emailBody">Message</label>
      <textarea id="emailBody" rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
    </div>
  )

  return (
    <div className="modal-backdrop open no-print">
      <div className={`modal${preview ? ' modal-xwide' : ''}`}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="btn btn-tiny" onClick={onClose}>✕</button>
        </div>
        <div className={`modal-body${preview ? ' modal-body-split' : ''}`}>
          {fields}
          {preview}
        </div>
        <div className="modal-footer">
          {footerExtra && <span className="modal-footer-extra">{footerExtra}</span>}
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <AsyncButton className="btn btn-primary" onClick={handleSend}>{sendLabel}</AsyncButton>
        </div>
      </div>
    </div>
  )
}
