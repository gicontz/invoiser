import { NavLink, useNavigate } from 'react-router-dom'
import { api } from '../api/client.js'

// Global app-wide nav only — invoice-specific actions (New, Print, Download
// PDF, Email, Designs, Preview) live in the editor page itself now that
// there are multiple pages (see DESIGN.md §5 on the app shell).
export default function Toolbar() {
  const navigate = useNavigate()

  const handleLogout = async () => {
    await api.logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="toolbar no-print">
      <div className="toolbar-inner">
        <div className="toolbar-brand">
          <span className="brand-mark">🧾</span>
          <span className="brand-name">Invoiser</span>
        </div>
        <nav className="toolbar-nav">
          <NavLink to="/dashboard" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            Dashboard
          </NavLink>
          <NavLink to="/invoices" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            Invoices
          </NavLink>
          <NavLink to="/clients" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            Clients
          </NavLink>
          <NavLink to="/bank-accounts" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            Bank Accounts
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            Settings
          </NavLink>
        </nav>
        <button type="button" className="btn-tiny toolbar-logout" onClick={handleLogout}>
          Sign out
        </button>
      </div>
    </header>
  )
}
