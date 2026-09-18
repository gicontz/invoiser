export default function BankDetails({ bank, onChange, onSaveDefault }) {
  const update = (field) => (e) => onChange({ ...bank, [field]: e.target.value })

  return (
    <div className="card bank-details">
      <div className="party-header">
        <h2>Bank Details</h2>
        <button className="btn btn-tiny no-print" onClick={onSaveDefault}>Save as default</button>
      </div>
      <div className="bank-grid">
        <input type="text" placeholder="Account holder name" value={bank.holder} onChange={update('holder')} />
        <input type="text" placeholder="Bank name" value={bank.bankName} onChange={update('bankName')} />
        <input type="text" placeholder="Bank address" value={bank.bankAddress} onChange={update('bankAddress')} />
        <input type="text" placeholder="Account number" value={bank.accountNumber} onChange={update('accountNumber')} />
        <input type="text" placeholder="SWIFT / BIC" value={bank.swift} onChange={update('swift')} />
      </div>
    </div>
  )
}
