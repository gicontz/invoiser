const BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const error = new Error(body.error || `Request failed (${res.status})`)
    error.status = res.status
    throw error
  }
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  getSettings: () => request('/settings'),
  updateSettings: (data) => request('/settings', { method: 'PATCH', body: JSON.stringify(data) }),

  listClients: () => request('/clients'),
  createClient: (data) => request('/clients', { method: 'POST', body: JSON.stringify(data) }),
  updateClient: (id, data) => request(`/clients/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteClient: (id) => request(`/clients/${id}`, { method: 'DELETE' }),

  listBankAccounts: () => request('/bank-accounts'),
  createBankAccount: (data) => request('/bank-accounts', { method: 'POST', body: JSON.stringify(data) }),
  updateBankAccount: (id, data) => request(`/bank-accounts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteBankAccount: (id) => request(`/bank-accounts/${id}`, { method: 'DELETE' }),

  listInvoices: (status) => request(`/invoices${status ? `?status=${status}` : ''}`),
  createInvoice: (data) => request('/invoices', { method: 'POST', body: JSON.stringify(data) }),
  getInvoice: (id) => request(`/invoices/${id}`),
  updateInvoice: (id, data) => request(`/invoices/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteInvoice: (id) => request(`/invoices/${id}`, { method: 'DELETE' }),
  markInvoiceStatus: (id, status) => request(`/invoices/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
  recordPayment: (id, payment) => request(`/invoices/${id}/payments`, { method: 'POST', body: JSON.stringify(payment) }),
  deletePayment: (id) => request(`/payments/${id}`, { method: 'DELETE' }),

  getDashboard: () => request('/dashboard'),

  sendEmail: (data) => request('/send-email', { method: 'POST', body: JSON.stringify(data) }),
}
