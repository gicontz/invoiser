import AsyncButton from './AsyncButton.jsx'

export default function BillerCard({ biller, onChange, onSaveDefault }) {
  const update = (field) => (e) => onChange({ ...biller, [field]: e.target.value })

  return (
    <div className="party card">
      <div className="party-header">
        <h2>From (Biller)</h2>
        <AsyncButton className="btn btn-tiny no-print" onClick={onSaveDefault}>Save as default</AsyncButton>
      </div>
      <input
        type="text"
        placeholder="Your name / business name"
        value={biller.name}
        onChange={update('name')}
      />
      <textarea
        placeholder="Address"
        rows={2}
        value={biller.address}
        onChange={update('address')}
      />
      <input type="email" placeholder="Email" value={biller.email} onChange={update('email')} />
      <input type="text" placeholder="Phone" value={biller.phone} onChange={update('phone')} />
    </div>
  )
}
