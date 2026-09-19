import AsyncButton from './AsyncButton.jsx'

export default function EmptyState({ title, hint, actionLabel, onAction }) {
  return (
    <div className="empty-state">
      <p>{title}</p>
      <p>{hint}</p>
      {actionLabel && (
        <AsyncButton className="btn btn-primary" onClick={onAction}>
          {actionLabel}
        </AsyncButton>
      )}
    </div>
  )
}
