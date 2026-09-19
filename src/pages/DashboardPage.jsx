import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client.js'
import { formatMoney } from '../utils/calc.js'
import StatusPill, { effectiveStatus } from '../components/StatusPill.jsx'
import ErrorCard from '../components/ErrorCard.jsx'
import Skeleton from '../components/Skeleton.jsx'

export default function DashboardPage() {
  const [state, setState] = useState({ status: 'loading', data: null, error: null })

  const load = () => {
    setState({ status: 'loading', data: null, error: null })
    api.getDashboard()
      .then((data) => setState({ status: 'ready', data, error: null }))
      .catch((error) => setState({ status: 'error', data: null, error }))
  }

  useEffect(load, [])

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <Link to="/invoices/new" className="btn btn-primary">+ New Invoice</Link>
      </div>

      {state.status === 'loading' && <Skeleton rows={5} />}

      {state.status === 'error' && (
        <ErrorCard message="Couldn't load the dashboard." onRetry={load} />
      )}

      {state.status === 'ready' && (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <p className="stat-label">Total invoiced</p>
              <p className="stat-value"><span className="cur">₱</span>{formatMoney(state.data.totalInvoiced)}</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Total received</p>
              <p className="stat-value"><span className="cur">₱</span>{formatMoney(state.data.totalReceived)}</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Outstanding</p>
              <p className="stat-value"><span className="cur">₱</span>{formatMoney(state.data.totalOutstanding)}</p>
            </div>
          </div>

          <div className="status-count-row">
            <span className="status-count"><span className="dot" style={{ background: 'var(--draft-deep)' }} />Draft <b>{state.data.counts.draft}</b></span>
            <span className="status-count"><span className="dot" style={{ background: 'var(--sent-deep)' }} />Sent <b>{state.data.counts.sent}</b></span>
            <span className="status-count"><span className="dot" style={{ background: 'var(--paid-deep)' }} />Paid <b>{state.data.counts.paid}</b></span>
            <span className="status-count"><span className="dot" style={{ background: 'var(--overdue-deep)' }} />Overdue <b>{state.data.counts.overdue}</b></span>
            <span className="status-count"><span className="dot" style={{ background: 'var(--cancelled-deep)' }} />Cancelled <b>{state.data.counts.cancelled}</b></span>
          </div>

          <p className="section-title">Recent invoices</p>
          {state.data.recent.length === 0 ? (
            <div className="empty-state">
              <p>No invoices yet.</p>
              <p>Create your first invoice to see it here.</p>
            </div>
          ) : (
            <div className="list-card">
              {state.data.recent.map((inv) => (
                <Link key={inv.id} to={`/invoices/${inv.id}`} className="list-row linked">
                  <span className="num">{inv.invoiceNumber || '—'}</span>
                  <span className="primary">{inv.clientName || '—'}</span>
                  <StatusPill status={effectiveStatus(inv)} />
                  <span />
                  <span className="amt">{formatMoney(inv.total)}</span>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
