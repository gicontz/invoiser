import { Routes, Route, Navigate } from 'react-router-dom'
import Toolbar from './components/Toolbar.jsx'
import LoginPage from './pages/LoginPage.jsx'
import InvoiceEditorPage from './pages/InvoiceEditorPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import InvoicesListPage from './pages/InvoicesListPage.jsx'
import ClientsPage from './pages/ClientsPage.jsx'
import BankAccountsPage from './pages/BankAccountsPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'

export default function App() {
  return (
    <Routes>
      {/* No Toolbar here — the login screen has its own plain layout, and
          showing app nav before someone's authenticated makes no sense. */}
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="*"
        element={
          <>
            <Toolbar />
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/invoices" element={<InvoicesListPage />} />
              <Route path="/invoices/new" element={<InvoiceEditorPage />} />
              <Route path="/invoices/:id" element={<InvoiceEditorPage />} />
              <Route path="/clients" element={<ClientsPage />} />
              <Route path="/bank-accounts" element={<BankAccountsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </>
        }
      />
    </Routes>
  )
}
