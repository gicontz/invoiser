import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import AccountingDoodle from '../components/AccountingDoodle.jsx'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const isSignup = mode === 'signup'

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(isSignup ? '/api/auth/signup' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error || (isSignup ? 'Could not create account' : 'Could not sign in'))
        return
      }
      const redirectTo = location.state?.from || '/dashboard'
      navigate(redirectTo, { replace: true })
    } catch {
      setError('Could not reach the server — try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-form-side">
        <div className="login-form-inner">
          <div className="login-brand">
            <span className="brand-mark">🧾</span>
            <span className="brand-name">Invoiser</span>
          </div>
          <h1 className="login-title">{isSignup ? 'Create your account' : 'Welcome back'}</h1>
          <p className="login-subtitle">
            {isSignup
              ? 'Pick a username and password — this is where your invoices, clients, and payments will live.'
              : 'Sign in to see your invoices, clients, and payments.'}
          </p>

          <form onSubmit={handleSubmit} className="login-form">
            <label htmlFor="loginUsername">Username</label>
            <input
              id="loginUsername"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
            {isSignup && <p className="login-hint">3-32 characters: lowercase letters, numbers, "-" or "_".</p>}

            <label htmlFor="loginPassword">Password</label>
            <input
              id="loginPassword"
              type="password"
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {isSignup && <p className="login-hint">At least 8 characters.</p>}

            {error && <p className="login-error">{error}</p>}

            <button type="submit" className="btn btn-primary login-submit" disabled={loading}>
              {loading ? (isSignup ? 'Creating account…' : 'Signing in…') : isSignup ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <button
            type="button"
            className="login-mode-toggle"
            onClick={() => {
              setMode(isSignup ? 'login' : 'signup')
              setError('')
            }}
          >
            {isSignup ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
          </button>
        </div>
      </div>

      <div className="login-art-side">
        <AccountingDoodle />
      </div>
    </div>
  )
}
