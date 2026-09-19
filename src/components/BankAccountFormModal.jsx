import { useState } from 'react'

const emptyBank = { holder: '', bankName: '', bankAddress: '', accountNumber: '', swift: '', isDefault: false }

export default function BankAccountFormModal({ initial, onClose, onSubmit }) {
  const [bank, setBank] = useState(initial || emptyBank)

  const update = (field) => (e) => setBank({ ...bank, [field]: e.target.value })

  return (
    <div className="modal-backdrop open no-print">
      <div className="modal">
        <div className="modal-header">
          <h3>{initial ? 'Edit bank account' : 'Add bank account'}</h3>
          <button className="btn btn-tiny" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <label htmlFor="bankHolder">Account holder</label>
          <input id="bankHolder" type="text" value={bank.holder} onChange={update('holder')} />

          <label htmlFor="bankName">Bank name</label>
          <input id="bankName" type="text" value={bank.bankName} onChange={update('bankName')} />

          <label htmlFor="bankAddress">Bank address</label>
          <input id="bankAddress" type="text" value={bank.bankAddress} onChange={update('bankAddress')} />

          <label htmlFor="bankAccountNumber">Account number</label>
          <input id="bankAccountNumber" type="text" value={bank.accountNumber} onChange={update('accountNumber')} />

          <label htmlFor="bankSwift">SWIFT / BIC</label>
          <input id="bankSwift" type="text" value={bank.swift} onChange={update('swift')} />

          <label className="checkbox-label" style={{ marginTop: 12 }}>
            <input
              type="checkbox"
              checked={bank.isDefault}
              onChange={(e) => setBank({ ...bank, isDefault: e.target.checked })}
            />
            Use as default
          </label>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={() => onSubmit(bank)}
            disabled={!bank.holder.trim() || !bank.bankName.trim()}
          >
            {initial ? 'Save changes' : 'Add bank account'}
          </button>
        </div>
      </div>
    </div>
  )
}
