import AsyncButton from './AsyncButton.jsx'

export default function ClientCard({ client, clients, onChange, onLoadClient, onSaveClient }) {
  const update = (field) => (e) => onChange({ ...client, [field]: e.target.value })

  return (
    <div className="party card">
      <div className="party-header">
        <h2>Bill To (Client)</h2>
        <div className="party-header-actions no-print">
          <select
            value=""
            onChange={(e) => {
              const selected = clients.find((c) => c.id === e.target.value)
              if (selected) onLoadClient(selected)
            }}
          >
            <option value="">Load saved client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name || 'Untitled client'}</option>
            ))}
          </select>
          <AsyncButton className="btn btn-tiny" onClick={onSaveClient}>Save client</AsyncButton>
        </div>
      </div>
      <input
        type="text"
        placeholder="Client / company name"
        value={client.name}
        onChange={update('name')}
      />
      <textarea
        placeholder="Address"
        rows={2}
        value={client.address}
        onChange={update('address')}
      />
      <input type="email" placeholder="Email" value={client.email} onChange={update('email')} />
      <input type="text" placeholder="Phone" value={client.phone} onChange={update('phone')} />
    </div>
  )
}
