# Invoiser

A simple, no-backend invoicing tool for freelancers and small projects. Everything runs in the
browser — your data stays in `localStorage` on your own machine.

## Features (v1)

- **Biller & client info** — your details and your client/customer's details side by side.
- **Line items (SKUs)** — item description, quantity, unit (per hour / per day / per month / fixed),
  rate, and an auto-calculated subtotal per line.
- **Auto-calculated totals** — subtotal, tax %, discount, and grand total update live as you type.
- **Signature upload** — attach a PNG or SVG signature image to the invoice.
- **Bank details** — account holder, bank name/address, account number, SWIFT/BIC.
- **Print or export to PDF** — a print-friendly layout, or a one-click PDF download.
- **Email the invoice** — opens your default mail client with To/CC/BCC, subject, and body
  prefilled, and downloads a PDF for you to attach (browsers can't attach files to a `mailto:`
  link automatically — see [Limitations](#limitations)).
- **Saved address book** — save frequently used recipient/CC/BCC emails and reuse them via
  autocomplete.
- **Saved defaults** — save your biller info, bank details, and signature once and reuse them
  on every new invoice; save clients to reload their info from a dropdown.

## Roadmap (v2)

- A dashboard to calculate earnings and attach contracts per client.
- Tracked in [issues](../../issues) as the v2 epic.

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL in your browser.

### Build for production

```bash
npm run build
npm run preview
```

`npm run build` outputs a static `dist/` folder — deployable to any static host (GitHub Pages,
Netlify, Vercel, S3, etc.) since there's no backend.

## Tech stack

- [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- [html2pdf.js](https://github.com/eKoopmans/html2pdf.js) for PDF export
- Plain CSS, no UI framework
- `localStorage` for persistence (biller/bank defaults, signature, saved clients, address book)

## Limitations

- **No real backend/email sending.** "Email Invoice" downloads a PDF and opens a `mailto:` link
  with everything prefilled — you still attach the downloaded PDF yourself. Browsers intentionally
  don't allow JavaScript to attach files to outgoing email for security reasons.
- **Data is per-browser.** Saved defaults, clients, and the address book live in that browser's
  `localStorage` only — they don't sync across devices and clearing site data clears them.
- **No multi-currency conversion.** The currency field is a plain label, not a converter.

## License

MIT — see [LICENSE](LICENSE).
