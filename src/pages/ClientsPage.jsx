import { useEffect, useState } from 'react'
import { enqueueSnackbar } from 'notistack'
import { api } from '../api/client.js'
import EmptyState from '../components/EmptyState.jsx'
import ErrorCard from '../components/ErrorCard.jsx'
import Skeleton from '../components/Skeleton.jsx'
import ClientFormModal from '../components/ClientFormModal.jsx'
import AsyncButton from '../components/AsyncButton.jsx'

export default function ClientsPage() {
  const [state, setState] = useState({ status: 'loading', clients: [], error: null })
  const [modal, setModal] = useState(null) // null | 'add' | client object being edited

  const load = () => {
    setState((prev) => ({ ...prev, status: 'loading', error: null }))
    api.listClients()
      .then((clients) => setState({ status: 'ready', clients, error: null }))
      .catch((error) => setState({ status: 'error', clients: [], error }))
  }

  useEffect(load, [])

  const handleAdd = async (data) => {
    try {
      await api.createClient(data)
      enqueueSnackbar('Client saved', { variant: 'success' })
      setModal(null)
      load()
    } catch {
      enqueueSnackbar('Could not save client', { variant: 'error' })
    }
  }

  const handleEdit = async (data) => {
    try {
      await api.updateClient(modal.id, data)
      enqueueSnackbar('Client updated', { variant: 'success' })
      setModal(null)
      load()
    } catch {
      enqueueSnackbar('Could not update client', { variant: 'error' })
    }
  }

  const handleDelete = async (client) => {
    try {
      await api.deleteClient(client.id)
      enqueueSnackbar('Client deleted', { variant: 'warning' })
      load()
    } catch (error) {
      enqueueSnackbar(error.message || 'Could not delete client', { variant: 'error' })
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Clients</h1>
        <button type="button" className="btn btn-primary" onClick={() => setModal('add')}>+ Add Client</button>
      </div>

      {state.status === 'loading' && <Skeleton rows={4} />}
      {state.status === 'error' && <ErrorCard message="Couldn't load clients." onRetry={load} />}

      {state.status === 'ready' && state.clients.length === 0 && (
        <EmptyState
          title="No clients yet."
          hint="Add a client to reuse them across invoices."
          actionLabel="+ Add Client"
          onAction={() => setModal('add')}
        />
      )}

      {state.status === 'ready' && state.clients.length > 0 && (
        <div className="entity-list">
          {state.clients.map((client) => (
            <div key={client.id} className="entity-card">
              <div>
                <p className="entity-name">{client.name}</p>
                <p className="entity-meta">{[client.email, client.phone].filter(Boolean).join(' — ') || client.address || '—'}</p>
              </div>
              <div className="entity-actions">
                <button type="button" className="btn-tiny" onClick={() => setModal(client)}>Edit</button>
                <AsyncButton className="btn-tiny" onClick={() => handleDelete(client)}>Delete</AsyncButton>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal === 'add' && (
        <ClientFormModal onClose={() => setModal(null)} onSubmit={handleAdd} />
      )}
      {modal && modal !== 'add' && (
        <ClientFormModal initial={modal} onClose={() => setModal(null)} onSubmit={handleEdit} />
      )}
    </div>
  )
}
