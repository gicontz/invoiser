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

---

## D9: Optimistic Concurrency Guard on Blob Writes (Closes the D4 Race-Condition Risk)

**Decision:** Every mutating write to a Blob resource is now conditional on the ETag read moments before (`@vercel/blob`'s `ifMatch`), via a shared `updateUserData(resource, mutate)` helper in `storage.js`. On a write conflict it re-reads the now-current data, re-runs `mutate` against it, and retries once; a second conflict surfaces as a 409, not a silent overwrite or a raw 500.

**Why:** D4 accepted read-modify-write-per-blob as fine at personal scale but flagged the unaddressed race: two near-simultaneous writes to the same file could clobber each other. This closes that out before go-live rather than shipping on the accepted-risk footnote indefinitely.

**A real bug caught while implementing this, worth recording:** `@vercel/blob`'s `get()` returns the ETag nested at `result.blob.etag`, not `result.etag` (despite the latter looking plausible from the type names). The first version of this guard read the wrong field, got `undefined`, and silently passed `ifMatch: undefined` — meaning every write was still unconditional, exactly the bug this was meant to fix, but appearing to work fine until tested against a real two-writer race (one edit silently clobbered the other with no error). Caught by writing an isolated script against the real Blob store that explicitly asserted a stale ETag gets rejected — glancing at the code was not enough to catch this.

**Tradeoff accepted:** A route's `mutate` function must be a pure function of "current data → new data" (no closing over the first read) so the retry's re-invocation is correct — this constrains how mutating routes can be written, in exchange for correctness under real contention.

**A second bug found later (while building #37), same mechanism:** some blobs' `get()` responses return a *weak* ETag (`W/"..."`) rather than a strong one, reproduced live against `users/me/invoices/2026.json`. HTTP's `If-Match` is a strong comparison by definition, so a weak ETag makes `ifMatch` fail *every* write against that blob, not occasionally — confirmed by watching a plain invoice creation exhaust both the original attempt and the one retry, both rejected with a precondition mismatch despite nothing else writing to it. Fixed two ways: requesting `Accept-Encoding: identity` on the read (avoids the compressed/weak representation at the source — this alone was sufficient in testing) and, defensively, stripping any `W/` prefix that slips through anyway before using it in `ifMatch`. This is exactly the risk ticket #38 flagged up front ("verify this is actually true for this SDK version before relying on it") — worth remembering that the earlier verification (an isolated test against a fresh, quiet test blob) didn't reproduce it; it only showed up against a blob with real read/write history, so a single clean test isn't sufficient assurance for this class of bug.

---

## D10: Invoices Split Into Per-Year Blob Files + an ID→Year Index

**Decision:** `users/<username>/invoices.json` (one ever-growing array) is replaced with `users/<username>/invoices/<year>.json` (one array per calendar year, bucketed by `invoiceDate`) plus `users/<username>/invoices/_index.json` (`{ "<invoiceId>": "<year>" }` for O(1) id→year lookup). A single-record operation (edit one invoice, record one payment, flip one status) now reads/writes one year's worth of records, not a user's entire history.

**Why:** D4 accepted whole-file read-modify-write as fine at personal scale but flagged it wouldn't hold up as history grows — every edit paying for the full lifetime archive. Splitting by year bounds that cost by how many invoices happen in a year, not how many years the account has existed.

**Resolved open question from the ticket:** Dashboard's lifetime totals (total invoiced/received) need every invoice ever, not just recent years — so `GET /api/invoices` and `/api/dashboard` still fan out across every year file. This is deliberately the one remaining full-history read; it scales with number of *years*, not number of invoices, which is the actual improvement.

**A related, deliberate change:** auto-generated invoice numbers moved from a lifetime count (`INV-0001`, `INV-0002`, ...) to a per-year count (`INV-<year>-0001`, ...), to avoid needing the full-history fan-out just to number a new invoice — which would have undone the point of this ticket on its most common operation. Existing invoice numbers are untouched (the field is just stored data, migrated as-is); only new auto-generated ones use the new format. A user-supplied `invoiceNumber` always wins regardless of format either way.

**Tradeoff accepted:** Moving an invoice across a year boundary (editing its `invoiceDate` into a different year) now requires three separate blob writes (remove from the old year file, add to the new one, repoint the index) instead of one — not atomic as a set, same inherent limit as everything else built on flat-file storage (D4). An edit that fails partway through this sequence could leave the invoice duplicated or missing until reconciled by hand; accepted as a rare edge case (how often does an invoice's date cross a year boundary after creation) rather than building distributed-transaction machinery Blob storage has no primitive for anyway.
