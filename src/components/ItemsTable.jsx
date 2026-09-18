import { lineSubtotal, makeEmptyItem, UNIT_OPTIONS } from '../utils/calc.js'
import { formatMoney } from '../utils/calc.js'

export default function ItemsTable({ items, currency, onChange }) {
  const updateItem = (id, field) => (e) => {
    const value = e.target.value
    onChange(items.map((item) => (item.id === id ? { ...item, [field]: value } : item)))
  }

  const addRow = () => onChange([...items, makeEmptyItem()])
  const removeRow = (id) => onChange(items.filter((item) => item.id !== id))

  return (
    <section className="items card">
      <table>
        <thead>
          <tr>
            <th className="col-item">Item / Description</th>
            <th className="col-qty">Qty</th>
            <th className="col-unit">Unit</th>
            <th className="col-rate">Rate</th>
            <th className="col-subtotal">Subtotal</th>
            <th className="col-remove no-print" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <input
                  type="text"
                  placeholder="Describe the work"
                  value={item.description}
                  onChange={updateItem(item.id, 'description')}
                />
              </td>
              <td>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={item.qty}
                  onChange={updateItem(item.id, 'qty')}
                />
              </td>
              <td>
                <select value={item.unit} onChange={updateItem(item.id, 'unit')}>
                  {UNIT_OPTIONS.map((unit) => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </td>
              <td>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.rate}
                  onChange={updateItem(item.id, 'rate')}
                />
              </td>
              <td className="subtotal-cell">{formatMoney(lineSubtotal(item), currency)}</td>
              <td className="no-print">
                <button
                  type="button"
                  className="remove-row-btn"
                  aria-label="Remove line item"
                  onClick={() => removeRow(item.id)}
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="btn btn-tiny no-print" onClick={addRow}>
        + Add line item
      </button>
    </section>
  )
}
