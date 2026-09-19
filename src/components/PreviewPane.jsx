import { formatMoney, lineSubtotal } from '../utils/calc.js'

// Read-only, live-updating preview of the current invoice. Reuses the same
// totals/calc utilities and state already computed in App.jsx — this
// component only renders, it never recalculates.
export default function PreviewPane({ open, biller, client, meta, items, notes, totals, bank, signature }) {
  if (!open) return null

  const hasBankDetails = bank.holder || bank.bankName || bank.bankAddress || bank.accountNumber || bank.swift

  return (
    <aside className="preview-pane no-print" aria-label="Invoice preview">
      <div className="preview-pane-label">Preview</div>
      <div className="preview-sheet">
        <h1 className="invoice-title">INVOICE</h1>

        <div className="preview-meta">
          <div><span>Invoice #</span><strong>{meta.invoiceNumber || '—'}</strong></div>
          <div><span>Date Issued</span><strong>{meta.invoiceDate || '—'}</strong></div>
          <div><span>Due Date</span><strong>{meta.dueDate || '—'}</strong></div>
        </div>

        <div className="preview-parties">
          <div className="preview-party">
            <h2>From</h2>
            <p>{biller.name || '—'}</p>
            {biller.address && <p className="preview-muted">{biller.address}</p>}
            {biller.email && <p className="preview-muted">{biller.email}</p>}
            {biller.phone && <p className="preview-muted">{biller.phone}</p>}
          </div>
          <div className="preview-party">
            <h2>Bill To</h2>
            <p>{client.name || '—'}</p>
            {client.address && <p className="preview-muted">{client.address}</p>}
            {client.email && <p className="preview-muted">{client.email}</p>}
            {client.phone && <p className="preview-muted">{client.phone}</p>}
          </div>
        </div>

        <table className="preview-items">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.description || '—'}</td>
                <td>{item.qty || 0}</td>
                <td>{formatMoney(parseFloat(item.rate) || 0, meta.currency)}</td>
                <td>{formatMoney(lineSubtotal(item), meta.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {notes && <p className="preview-notes">{notes}</p>}

        <div className="preview-totals">
          <div><span>Subtotal</span><span>{formatMoney(totals.subtotal, meta.currency)}</span></div>
          <div><span>Tax</span><span>{formatMoney(totals.tax, meta.currency)}</span></div>
          <div><span>Discount</span><span>{formatMoney(totals.discount, meta.currency)}</span></div>
          <div className="preview-grand-total">
            <span>Total Due</span><span>{formatMoney(totals.grandTotal, meta.currency)}</span>
          </div>
        </div>

        {hasBankDetails && (
          <div className="preview-bank">
            <h2>Bank Details</h2>
            {bank.holder && <p>{bank.holder}</p>}
            {bank.bankName && <p>{bank.bankName}</p>}
            {bank.bankAddress && <p>{bank.bankAddress}</p>}
            {bank.accountNumber && <p>{bank.accountNumber}</p>}
            {bank.swift && <p>{bank.swift}</p>}
          </div>
        )}

        {signature && (
          <div className="preview-signature">
            <img src={signature} alt="Signature" />
          </div>
        )}
      </div>
    </aside>
  )
}
