import { useState } from 'react'

// Wraps a button whose onClick returns a promise: shows a spinner and
// disables the button for the duration, so a slow API call (create
// invoice, record payment, etc.) never looks like a dead click.
export default function AsyncButton({ onClick, className = '', disabled, children, ...rest }) {
  const [loading, setLoading] = useState(false)

  const handleClick = async (event) => {
    if (loading) return
    const result = onClick?.(event)
    if (result && typeof result.then === 'function') {
      setLoading(true)
      try {
        await result
      } catch {
        // Callers already surface their own errors (toasts, etc.) — this
        // just keeps a rejected promise from becoming an unhandled rejection.
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <button
      type="button"
      className={`${className}${loading ? ' is-loading' : ''}`}
      onClick={handleClick}
      disabled={disabled || loading}
      aria-busy={loading}
      {...rest}
    >
      <span className="btn-label">{children}</span>
      {loading && <span className="btn-spinner" aria-hidden="true" />}
    </button>
  )
}
