// "Overdue" is never stored — computed here at read time (memory/decisions.md D8).
export function isOverdue(invoice) {
  const today = new Date().toISOString().slice(0, 10)
  return invoice.status === 'sent' && Boolean(invoice.dueDate) && invoice.dueDate < today
}
