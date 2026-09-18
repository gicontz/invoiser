export function lineSubtotal(item) {
  const qty = parseFloat(item.qty)
  const rate = parseFloat(item.rate)
  return (Number.isFinite(qty) ? qty : 0) * (Number.isFinite(rate) ? rate : 0)
}

export function computeTotals(items, taxPercent, discountAmount) {
  const subtotal = items.reduce((sum, item) => sum + lineSubtotal(item), 0)
  const tax = subtotal * ((parseFloat(taxPercent) || 0) / 100)
  const discount = parseFloat(discountAmount) || 0
  const grandTotal = Math.max(0, subtotal + tax - discount)
  return { subtotal, tax, discount, grandTotal }
}

export function formatMoney(amount, currency) {
  const value = Number.isFinite(amount) ? amount : 0
  const formatted = value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return currency ? `${currency} ${formatted}` : formatted
}

export function makeEmptyItem() {
  return {
    id: crypto.randomUUID(),
    description: '',
    qty: 1,
    unit: 'per hour',
    rate: '',
  }
}

export const UNIT_OPTIONS = ['per hour', 'per day', 'per month', 'fixed']
