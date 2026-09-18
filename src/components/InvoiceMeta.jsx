export default function InvoiceMeta({ meta, onChange }) {
  const update = (field) => (e) => onChange({ ...meta, [field]: e.target.value })

  return (
    <section className="invoice-head">
      <h1 className="invoice-title">INVOICE</h1>

      <div className="field-row">
        <label htmlFor="invoiceNumber">Invoice #</label>
        <input
          id="invoiceNumber"
          type="text"
          placeholder="INV-0001"
          value={meta.invoiceNumber}
          onChange={update('invoiceNumber')}
        />
      </div>

      <div className="field-row">
        <label htmlFor="invoiceDate">Date Issued</label>
        <input id="invoiceDate" type="date" value={meta.invoiceDate} onChange={update('invoiceDate')} />
      </div>

      <div className="field-row">
        <label htmlFor="dueDate">Due Date</label>
        <input id="dueDate" type="date" value={meta.dueDate} onChange={update('dueDate')} />
      </div>

      <div className="field-row">
        <label htmlFor="currency">Currency</label>
        <input id="currency" type="text" maxLength={6} value={meta.currency} onChange={update('currency')} />
      </div>
    </section>
  )
}
