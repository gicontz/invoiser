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
import ReceiptModal from '../components/ReceiptModal.jsx'
import { useLocalStorage } from '../hooks/useLocalStorage.js'

export default function InvoicesListPage() {
  const navigate = useNavigate()
  const [state, setState] = useState({ status: 'loading', invoices: [], error: null })
  const [paymentTarget, setPaymentTarget] = useState(null)
  // { invoice, biller } — the biller (settings) is fetched on open, since
  // the receipt's letterhead and default wording need it.
  const [receiptTarget, setReceiptTarget] = useState(null)
  const [addressBook] = useLocalStorage('invoiser_address_book', [])

  const load = () => {
    setState((prev) => ({ ...prev, status: 'loading', error: null }))
    api.listInvoices()
      .then((invoices) => setState({ status: 'ready', invoices, error: null }))
      .catch((error) => setState({ status: 'error', invoices: [], error }))
  }

  useEffect(load, [])

  // Creation itself (including attaching the default bank account/
  // signature) is InvoiceEditorPage's job, triggered by the literal id
  // "new" — see memory/decisions.md D15. Calling api.createInvoice directly
  // here used to skip that defaulting logic entirely.
  const handleNewInvoice = () => navigate('/invoices/new')

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

  const handleDelete = async (invoice) => {
    if (!window.confirm(`Delete draft ${invoice.invoiceNumber || 'invoice'}? This can't be undone.`)) return
    try {
      await api.deleteInvoice(invoice.id)
      enqueueSnackbar('Draft deleted', { variant: 'warning' })
      load()
    } catch (error) {
      enqueueSnackbar(error.message || 'Could not delete', { variant: 'error' })
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

  const handleOpenReceipt = async (invoice) => {
    try {
      const settings = await api.getSettings()
      setReceiptTarget({ invoice, biller: settings.biller || {} })
    } catch (error) {
      enqueueSnackbar(error.message || 'Could not load your business details', { variant: 'error' })
    }
  }

  const handleReceiptSent = () => {
    setReceiptTarget(null)
    load()
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
                  {/* Optional, and only once fully paid (issue #52). */}
                  {inv.status === 'paid' && (
                    <AsyncButton
                      className="btn-tiny"
                      onClick={() => handleOpenReceipt(inv)}
                      title={inv.receiptSentAt ? `Receipt sent ${new Date(inv.receiptSentAt).toLocaleDateString()}` : undefined}
                    >
                      {inv.receiptSentAt ? 'Resend Receipt' : 'Send Receipt'}
                    </AsyncButton>
                  )}
                  {inv.status === 'draft' && (
                    <>
                      <AsyncButton className="btn-tiny" onClick={() => handleCancel(inv.id)}>Cancel</AsyncButton>
                      <AsyncButton className="btn-tiny" onClick={() => handleDelete(inv)}>Delete</AsyncButton>
                    </>
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

      {receiptTarget && (
        <ReceiptModal
          invoice={receiptTarget.invoice}
          biller={receiptTarget.biller}
          addressBook={addressBook}
          onClose={() => setReceiptTarget(null)}
          onSent={handleReceiptSent}
        />
      )}
    </div>
  )
}
