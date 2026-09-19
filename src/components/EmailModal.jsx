import { useEffect, useState } from 'react'
import AsyncButton from './AsyncButton.jsx'

export default function EmailModal({ open, onClose, addressBook, defaultSubject, defaultBody, onSend }) {
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

  return (
    <div className="modal-backdrop open no-print">
      <div className="modal">
        <div className="modal-header">
          <h3>Email Invoice</h3>
          <button className="btn btn-tiny" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="modal-hint">
            A PDF of this invoice will download automatically — attach it to the email that opens in
            your default mail app (browsers can't auto-attach files for security reasons).
          </p>

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
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <AsyncButton className="btn btn-primary" onClick={handleSend}>Download PDF &amp; Open Email</AsyncButton>
        </div>
      </div>
    </div>
  )
}
