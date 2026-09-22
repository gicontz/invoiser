import { useEffect, useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { api } from '../api/client.js'

const NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/invoices', label: 'Invoices' },
  { to: '/clients', label: 'Clients' },
  { to: '/bank-accounts', label: 'Bank Accounts' },
  { to: '/settings', label: 'Settings' },
]

// Global app-wide nav — invoice-specific actions (New, Print, Download PDF,
// Email, Designs, Preview) live in the editor page itself now that there
// are multiple pages (see DESIGN.md §5 on the app shell). Collapses into a
// hamburger-triggered menu below 720px, matching the breakpoint the rest
// of the app's mobile layout already uses.
export default function Toolbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  // A route change (tapping a link) should always close the mobile menu —
  // otherwise it stays open over the newly-navigated page.
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  const handleLogout = async () => {
    await api.logout()
    navigate('/login', { replace: true })
  }

  const navLinkClass = ({ isActive }) => `nav-link${isActive ? ' active' : ''}`

  return (
    <header className="toolbar no-print">
      <div className="toolbar-inner">
        <div className="toolbar-brand">
          <span className="brand-mark">🧾</span>
          <span className="brand-name">Invoiser</span>
        </div>

        <nav className="toolbar-nav toolbar-nav-desktop">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} className={navLinkClass}>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <button type="button" className="btn-tiny toolbar-logout toolbar-logout-desktop" onClick={handleLogout}>
          Sign out
        </button>

        <button
          type="button"
          className="toolbar-menu-toggle"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((prev) => !prev)}
        >
          <span className={`toolbar-menu-icon${menuOpen ? ' open' : ''}`} />
        </button>
      </div>

      {menuOpen && (
        <nav className="toolbar-nav-mobile">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} className={navLinkClass}>
              {link.label}
            </NavLink>
          ))}
          <button type="button" className="btn-tiny toolbar-logout" onClick={handleLogout}>
            Sign out
          </button>
        </nav>
      )}
    </header>
  )
}
