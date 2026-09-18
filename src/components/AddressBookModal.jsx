import { useState } from 'react'

export default function AddressBookModal({ open, onClose, addresses, onAdd, onRemove }) {
  const [label, setLabel] = useState('')
  const [email, setEmail] = useState('')

  if (!open) return null

  const handleAdd = () => {
    if (!email.trim()) return
    onAdd({ id: crypto.randomUUID(), label: label.trim() || email.trim(), email: email.trim() })
    setLabel('')
    setEmail('')
  }

  return (
    <div className="modal-backdrop open no-print">
      <div className="modal">
        <div className="modal-header">
          <h3>Address Book</h3>
          <button className="btn btn-tiny" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="address-add-row">
            <input
              type="text"
              placeholder="Label (e.g. Client — Accounting)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <input
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="btn btn-tiny" onClick={handleAdd}>Add</button>
          </div>

          <ul className="address-list">
            {addresses.length === 0 && <li>No saved addresses yet.</li>}
            {addresses.map((entry) => (
              <li key={entry.id}>
                <div className="address-meta">
                  <span className="address-label">{entry.label}</span>
                  <span className="address-email">{entry.email}</span>
                </div>
                <button className="btn btn-tiny" onClick={() => onRemove(entry.id)}>Remove</button>
              </li>
            ))}
          </ul>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
