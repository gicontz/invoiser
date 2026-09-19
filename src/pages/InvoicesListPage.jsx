import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { enqueueSnackbar } from 'notistack'
import { api } from '../api/client.js'
import { formatMoney } from '../utils/calc.js'
import StatusPill, { effectiveStatus } from '../components/StatusPill.jsx'
import EmptyState from '../components/EmptyState.jsx'
import ErrorCard from '../components/ErrorCard.jsx'
import Skeleton from '../components/Skeleton.jsx'
import RecordPaymentModal from '../components/RecordPaymentModal.jsx'
import AsyncButton from '../components/AsyncButton.jsx'

export default function InvoicesListPage() {
  const navigate = useNavigate()
  const [state, setState] = useState({ status: 'loading', invoices: [], error: null })
  const [paymentTarget, setPaymentTarget] = useState(null)

  const load = () => {
    setState((prev) => ({ ...prev, status: 'loading', error: null }))
    api.listInvoices()
      .then((invoices) => setState({ status: 'ready', invoices, error: null }))
      .catch((error) => setState({ status: 'error', invoices: [], error }))
  }

  useEffect(load, [])

  const handleNewInvoice = async () => {
    try {
      const invoice = await api.createInvoice({})
      navigate(`/invoices/${invoice.id}`)
    } catch {
      enqueueSnackbar('Could not create a new invoice', { variant: 'error' })
    }
  }

  const handleMarkSent = async (id) => {
    try {
      await api.markInvoiceStatus(id, 'sent')
      enqueueSnackbar('Invoice marked sent', { variant: 'success' })
      load()
    } catch (error) {
      enqueueSnackbar(error.message || 'Could not update status', { variant: 'error' })
    }
  }

  const handleCancel = async (id) => {
    try {
      await api.markInvoiceStatus(id, 'cancelled')
      enqueueSnackbar('Invoice cancelled', { variant: 'warning' })
      load()
    } catch (error) {
      enqueueSnackbar(error.message || 'Could not cancel', { variant: 'error' })
    }
  }

  const handleRecordPayment = async (payment) => {
    try {
      await api.recordPayment(paymentTarget.id, payment)
      enqueueSnackbar('Payment recorded', { variant: 'success' })
      setPaymentTarget(null)
      load()
    } catch (error) {
      enqueueSnackbar(error.message || 'Could not record payment', { variant: 'error' })
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Invoices</h1>
        <AsyncButton className="btn btn-primary" onClick={handleNewInvoice}>+ New Invoice</AsyncButton>
      </div>

      {state.status === 'loading' && <Skeleton rows={6} />}

      {state.status === 'error' && <ErrorCard message="Couldn't load invoices." onRetry={load} />}

      {state.status === 'ready' && state.invoices.length === 0 && (
        <EmptyState
          title="No invoices yet."
          hint="Create your first invoice to see it here."
          actionLabel="+ New Invoice"
          onAction={handleNewInvoice}
        />
      )}

      {state.status === 'ready' && state.invoices.length > 0 && (
        <div className="list-card">
          {state.invoices.map((inv) => {
            const status = effectiveStatus(inv)
            return (
              <div key={inv.id} className="list-row" style={{ gridTemplateColumns: '100px 1.4fr 110px 110px 130px 220px' }}>
                <Link to={`/invoices/${inv.id}`} className="num" style={{ textDecoration: 'none' }}>{inv.invoiceNumber || '—'}</Link>
                <Link to={`/invoices/${inv.id}`} className="primary" style={{ textDecoration: 'none', color: 'inherit' }}>{inv.clientName || '—'}</Link>
                <span className="muted">{inv.dueDate || '—'}</span>
                <StatusPill status={status} />
                <span className="amt">{formatMoney(inv.total, inv.currency)}</span>
                <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  {inv.status === 'draft' && (
                    <AsyncButton className="btn-tiny" onClick={() => handleMarkSent(inv.id)}>Mark Sent</AsyncButton>
                  )}
                  {inv.status === 'sent' && (
                    <>
                      <button type="button" className="btn-tiny" onClick={() => setPaymentTarget(inv)}>Record Payment</button>
                      <AsyncButton className="btn-tiny" onClick={() => handleCancel(inv.id)}>Cancel</AsyncButton>
                    </>
                  )}
                  {inv.status === 'draft' && (
                    <AsyncButton className="btn-tiny" onClick={() => handleCancel(inv.id)}>Cancel</AsyncButton>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {paymentTarget && (
        <RecordPaymentModal
          invoice={paymentTarget}
          onClose={() => setPaymentTarget(null)}
          onSubmit={handleRecordPayment}
        />
      )}
    </div>
  )
}
