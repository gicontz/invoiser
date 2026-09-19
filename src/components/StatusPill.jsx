const LABELS = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
}

// Effective status: an invoice's own `overdue` (computed server-side) wins
// over its stored `sent` status for display purposes only.
export function effectiveStatus(invoice) {
  if (invoice.overdue) return 'overdue'
  return invoice.status
}

export default function StatusPill({ status }) {
  return <span className={`status-pill ${status}`}>{LABELS[status] || status}</span>
}
