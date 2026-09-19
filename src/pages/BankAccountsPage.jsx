import { useEffect, useState } from 'react'
import { enqueueSnackbar } from 'notistack'
import { api } from '../api/client.js'
import EmptyState from '../components/EmptyState.jsx'
import ErrorCard from '../components/ErrorCard.jsx'
import Skeleton from '../components/Skeleton.jsx'
import BankAccountFormModal from '../components/BankAccountFormModal.jsx'
import AsyncButton from '../components/AsyncButton.jsx'

function maskAccountNumber(number) {
  if (!number) return '—'
  const digits = number.replace(/\s+/g, '')
  if (digits.length <= 4) return digits
  return `•••• ${digits.slice(-4)}`
}

export default function BankAccountsPage() {
  const [state, setState] = useState({ status: 'loading', banks: [], error: null })
  const [modal, setModal] = useState(null)

  const load = () => {
    setState((prev) => ({ ...prev, status: 'loading', error: null }))
    api.listBankAccounts()
      .then((banks) => setState({ status: 'ready', banks, error: null }))
      .catch((error) => setState({ status: 'error', banks: [], error }))
  }

  useEffect(load, [])

  const handleAdd = async (data) => {
    try {
      await api.createBankAccount(data)
      enqueueSnackbar('Bank account saved', { variant: 'success' })
      setModal(null)
      load()
    } catch {
      enqueueSnackbar('Could not save bank account', { variant: 'error' })
    }
  }

  const handleEdit = async (data) => {
    try {
      await api.updateBankAccount(modal.id, data)
      enqueueSnackbar('Bank account updated', { variant: 'success' })
      setModal(null)
      load()
    } catch {
      enqueueSnackbar('Could not update bank account', { variant: 'error' })
    }
  }

  const handleDelete = async (bank) => {
    try {
      await api.deleteBankAccount(bank.id)
      enqueueSnackbar('Bank account deleted', { variant: 'warning' })
      load()
    } catch (error) {
      enqueueSnackbar(error.message || 'Could not delete bank account', { variant: 'error' })
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Bank Accounts</h1>
        <button type="button" className="btn btn-primary" onClick={() => setModal('add')}>+ Add Bank Account</button>
      </div>

      {state.status === 'loading' && <Skeleton rows={3} />}
      {state.status === 'error' && <ErrorCard message="Couldn't load bank accounts." onRetry={load} />}

      {state.status === 'ready' && state.banks.length === 0 && (
        <EmptyState
          title="No bank accounts yet."
          hint="Add one to select it when creating an invoice."
          actionLabel="+ Add Bank Account"
          onAction={() => setModal('add')}
        />
      )}

      {state.status === 'ready' && state.banks.length > 0 && (
        <div className="entity-list">
          {state.banks.map((bank) => (
            <div key={bank.id} className="entity-card">
              <div>
                <p className="entity-name">
                  {bank.bankName}
                  {bank.isDefault && <span className="badge-default">Default</span>}
                </p>
                <p className="entity-meta">{bank.holder} — {maskAccountNumber(bank.accountNumber)}</p>
              </div>
              <div className="entity-actions">
                <button type="button" className="btn-tiny" onClick={() => setModal(bank)}>Edit</button>
                <AsyncButton className="btn-tiny" onClick={() => handleDelete(bank)}>Delete</AsyncButton>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal === 'add' && (
        <BankAccountFormModal onClose={() => setModal(null)} onSubmit={handleAdd} />
      )}
      {modal && modal !== 'add' && (
        <BankAccountFormModal initial={modal} onClose={() => setModal(null)} onSubmit={handleEdit} />
      )}
    </div>
  )
}
