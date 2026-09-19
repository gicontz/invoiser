import { useState } from 'react'
import AsyncButton from './AsyncButton.jsx'

const emptyClient = { name: '', address: '', email: '', phone: '' }

export default function ClientFormModal({ initial, onClose, onSubmit }) {
  const [client, setClient] = useState(initial || emptyClient)

  const update = (field) => (e) => setClient({ ...client, [field]: e.target.value })

  return (
    <div className="modal-backdrop open no-print">
      <div className="modal">
        <div className="modal-header">
          <h3>{initial ? 'Edit client' : 'Add client'}</h3>
          <button className="btn btn-tiny" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <label htmlFor="clientName">Name</label>
          <input id="clientName" type="text" value={client.name} onChange={update('name')} />

          <label htmlFor="clientAddress">Address</label>
          <input id="clientAddress" type="text" value={client.address} onChange={update('address')} />

          <label htmlFor="clientEmail">Email</label>
          <input id="clientEmail" type="email" value={client.email} onChange={update('email')} />

          <label htmlFor="clientPhone">Phone</label>
          <input id="clientPhone" type="text" value={client.phone} onChange={update('phone')} />
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <AsyncButton
            className="btn btn-primary"
            onClick={() => onSubmit(client)}
            disabled={!client.name.trim()}
          >
            {initial ? 'Save changes' : 'Add client'}
          </AsyncButton>
        </div>
      </div>
    </div>
  )
}
