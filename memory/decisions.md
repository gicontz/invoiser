# Decisions — Invoiser

Durable project-specific engineering decisions. Include context and the tradeoff accepted.

---

## D1: HTML String Templates (Not React Components) for Invoice Output

**Decision:** The invoice document that gets printed, exported to PDF, and emailed is built from plain JS string-template functions (`src/designs/templates.js`) — not a React component tree.

**Why:** The output needs to live inside an isolated `<iframe>` (see D2) as `srcdoc`, refreshed as a full document replace rather than a live re-render, and also serve as `html2canvas`'s capture source for PDF export. A React component tree adds real complexity for that specific access pattern (portal timing into a cross-document iframe, reconciliation you don't need since the whole document gets replaced wholesale anyway). A plain string builder maps directly onto "generate the final HTML, hand it to the iframe/canvas."

**Tradeoff accepted:** No JSX ergonomics for this code — string concatenation instead of markup, and every interpolated user field must be manually HTML-escaped (`escapeHtml()`) to stay XSS-safe and avoid a stray `<`/`&` in a client name breaking the markup. Worth it for the simplicity win on the iframe/canvas integration.

---

## D2: Isolated `<iframe>` as the Single Source for Preview, Print, and PDF Capture

**Decision:** One always-mounted `<iframe>` (`PreviewPane.jsx`) hosts the rendered invoice HTML. It serves three roles: the visible on-screen preview, the native Print target (`iframe.contentWindow.print()`), and the `html2canvas` capture source for PDF/email export.

**Why:** Printing the main app document directly required hiding the toolbar/editor via `.no-print`/`@media print` CSS sprinkled across the whole page — fragile, easy to miss a spot, and a direct `Cmd+P` would still print the raw editable form. An iframe's `contentWindow.print()` prints *only* that document — nothing else on the page needs to know printing is happening.

**Tradeoff accepted:** A separate document context to manage (its own injected `<style>`, own font `@import`, own load-timing before capture/print can safely run). Worth it — it eliminated an entire class of "did I hide everything correctly" bugs.

---

## D3: `jsPDF` + `html2canvas` Directly, Not `html2pdf.js`

**Decision:** PDF export uses `jsPDF` and `html2canvas` directly (`src/utils/pdf.js`), lazy-loaded via dynamic `import()`, instead of the `html2pdf.js` wrapper the project started with.

**Why:** The requirement was "always exactly one A4 page per logical page, full page used, never cropped." `html2pdf.js`'s default behavior is automatic multi-page slicing (designed for pagination, not shrink-to-fit), which fights that requirement without deep fighting of its API. Direct control over the canvas→PDF scaling math (fit-to-width or fit-to-height, whichever avoids cropping, then center) gets exactly the wanted behavior in ~20 lines.

**Tradeoff accepted:** Print (native browser) and PDF (canvas capture) are now two genuinely different code paths that can drift apart if not both re-checked after a template change — Print gets real CSS pagination (`break-before: page`), PDF gets explicit per-`.doc-page` canvas capture, one page each. Worth it for correctness over relying on a wrapper's default pagination heuristics.

---

## D4: Backend Is Vercel Serverless Functions + Vercel Blob Storage (No Relational DB)

**Decision:** The planned backend (Dashboard, Invoices List, Clients, Bank Accounts features) uses Vercel Serverless Functions under `/api/*`, backed by Vercel Blob Storage holding one JSON document per resource per user (`users/<username>/invoices.json`, `clients.json`, `banks.json`, `settings.json`) — not a relational database.

**Why:** Vercel serverless functions have no writable persistent filesystem (only ephemeral `/tmp`, wiped between invocations, not shared across instances) — a literal "just write a flat file to disk" approach silently fails to persist in production. Vercel Blob is Vercel's own durable object storage, addressable by a stable path (`addRandomSuffix: false`, `allowOverwrite: true`), which gives real file-path semantics that actually persist. A per-feature comparison against Vercel KV (Redis-backed) favored Blob 4-for-4 once "Dashboard" was correctly recognized as reading the same file Invoices writes rather than an independent choice — object storage's durability-first design fits ledger/financial data (invoices, payments) better than Redis's in-memory-first persistence model, and KV's advantages (stronger read consistency, native transaction primitives) didn't outweigh that for any feature actually being built.

**Tradeoff accepted:** No query language — every mutation is read-the-whole-file → modify the in-memory array → write-the-whole-file-back, and every read for aggregation (Dashboard) is a plain `.reduce()`/`.filter()` in a function. Fine at personal-app scale (dozens/hundreds of records); would need a real DB before this holds up at real multi-tenant scale. The whole thing sits behind a small `Storage` interface (`readUserData`/`writeUserData`) specifically so a future "bring your own DB" mode is a second implementation of that interface, not a rewrite.

---

## D5: No Auth, For Now

**Decision:** The backend ships with no authentication or access control. `<username>` in the storage path is a single fixed value (env var), not resolved from a login.

**Why:** Personal, single-operator use for now. Explicit tradeoff, made with the risk stated plainly rather than defaulted into silently.

**Tradeoff accepted:** Bank account numbers and client PII are reachable by anyone with the deployed URL. Retrofitting real auth later doesn't require touching the storage layer (it's already username-namespaced) — only resolving a real username from a session instead of a fixed env var.

---

## D6: Full Migration of the Editor to the Backend (Not a Hybrid)

**Decision:** The existing single-draft, localStorage-backed invoice editor is being migrated fully onto the new API-backed model — it becomes "edit this DB-backed invoice," loaded/saved via `/api/invoices/:id` — rather than kept as a separate local-only flow alongside a new persisted Invoices List.

**Why:** One source of truth. A hybrid (local editor + a separate "save to Invoices" action) would mean two different data models to reason about indefinitely, and an Invoices List/Dashboard that only reflects some invoices, not all of them.

**Tradeoff accepted:** Bigger single-change regression risk — this touches the data flow behind everything already working (print, PDF, email, signatures, all 3 themes, Separate Items grouping) in one migration instead of incrementally. None of the editor's UI components change, only where their data comes from/goes to, which limits (but doesn't eliminate) the blast radius.

---

## D7: Payments Are a Manual Embedded Ledger, Not a Payment Gateway Integration

**Decision:** "Recording a payment" on an invoice is a manual entry (amount + date + optional note) appended to that invoice's own `payments` array — not an integration with Stripe, PayPal, or any payment processor.

**Why:** The feature is bookkeeping ("did money arrive, how much, when"), not payment collection. Embedding the ledger inside each invoice record (rather than a separate `payments.json` file) fits the document-storage model naturally — no join needed for a parent-child relationship that's always read together.

**Tradeoff accepted:** None really — this is strictly simpler than a gateway integration. Noted as a decision mainly because "payments" as a word invites the assumption of a processor integration, which this explicitly is not.

---

## D8: "Overdue" Is Computed, Never Stored — No Cron Job Anywhere

**Decision:** Invoice status is one of `draft | sent | paid | cancelled`. "Overdue" is never a stored status — it's computed at read time as `status === 'sent' && dueDate < today`.

**Why:** Storing "overdue" as a real status would require a scheduled job (cron) to sweep and flip invoices as they cross their due date. Computing it at read time keeps the whole backend serverless with zero scheduled/background functions.

**Tradeoff accepted:** None functionally — every place that displays or filters by status must remember to apply the computed-overdue check on top of the stored `sent` status, rather than being able to filter on a stored `overdue` value directly.
