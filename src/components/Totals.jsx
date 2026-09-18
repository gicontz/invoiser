import { formatMoney } from '../utils/calc.js'

export default function Totals({ subtotal, tax, taxPercent, discount, grandTotal, currency, onTaxChange, onDiscountChange }) {
  return (
    <div className="totals">
      <div className="totals-row">
        <span>Subtotal</span>
        <span>{formatMoney(subtotal, currency)}</span>
      </div>

      <div className="totals-row">
        <label htmlFor="taxPercent">Tax (%)</label>
        <input
          id="taxPercent"
          type="number"
          min="0"
          step="0.01"
          value={taxPercent}
          onChange={(e) => onTaxChange(e.target.value)}
        />
      </div>

      <div className="totals-row">
        <span>Tax amount</span>
        <span>{formatMoney(tax, currency)}</span>
      </div>

      <div className="totals-row">
        <label htmlFor="discountAmount">Discount</label>
        <input
          id="discountAmount"
          type="number"
          min="0"
          step="0.01"
          value={discount}
          onChange={(e) => onDiscountChange(e.target.value)}
        />
      </div>

      <div className="totals-row grand-total">
        <span>Total Due</span>
        <span>{formatMoney(grandTotal, currency)}</span>
      </div>
    </div>
  )
}
