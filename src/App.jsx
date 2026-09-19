import { Routes, Route, Navigate } from 'react-router-dom'
import Toolbar from './components/Toolbar.jsx'
import InvoiceEditorPage from './pages/InvoiceEditorPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import InvoicesListPage from './pages/InvoicesListPage.jsx'
import ClientsPage from './pages/ClientsPage.jsx'

function ComingSoonPage({ title }) {
  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">{title}</h1>
      </div>
      <div className="empty-state">
        <p>{title} is coming soon.</p>
        <p>This page ships in its own follow-up release.</p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <>
      <Toolbar />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/invoices" element={<InvoicesListPage />} />
        <Route path="/invoices/new" element={<InvoiceEditorPage />} />
        <Route path="/invoices/:id" element={<InvoiceEditorPage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/bank-accounts" element={<ComingSoonPage title="Bank Accounts" />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  )
}
