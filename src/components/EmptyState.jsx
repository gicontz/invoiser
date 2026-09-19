export default function EmptyState({ title, hint, actionLabel, onAction }) {
  return (
    <div className="empty-state">
      <p>{title}</p>
      <p>{hint}</p>
      {actionLabel && (
        <button type="button" className="btn btn-primary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  )
}
