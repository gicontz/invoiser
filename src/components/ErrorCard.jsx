export default function ErrorCard({ message, onRetry }) {
  return (
    <div className="error-card">
      <p>{message}</p>
      <button type="button" className="btn-retry" onClick={onRetry}>
        Try again
      </button>
    </div>
  )
}
