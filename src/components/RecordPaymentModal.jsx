import { useState } from 'react'
import AsyncButton from './AsyncButton.jsx'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export default function RecordPaymentModal({ invoice, onClose, onSubmit }) {
  const [amount, setAmount] = useState('')
  const [receivedAt, setReceivedAt] = useState(todayIso())
  const [note, setNote] = useState('')

  const handleSubmit = () => onSubmit({ amount, receivedAt, note })

  return (
    <div className="modal-backdrop open no-print">
      <div className="modal">
        <div className="modal-header">
          <h3>Record payment — {invoice.invoiceNumber}</h3>
          <button className="btn btn-tiny" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <label htmlFor="paymentAmount">Amount received</label>
          <input
            id="paymentAmount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          <label htmlFor="paymentDate">Date received</label>
          <input
            id="paymentDate"
            type="date"
            value={receivedAt}
            onChange={(e) => setReceivedAt(e.target.value)}
          />

          <label htmlFor="paymentNote">Note (optional)</label>
          <input
            id="paymentNote"
            type="text"
            placeholder="Paid via bank transfer"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <AsyncButton className="btn btn-primary" onClick={handleSubmit}>Record payment</AsyncButton>
        </div>
      </div>
    </div>
  )
}
