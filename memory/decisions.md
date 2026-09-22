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

## D11: Basic Auth Gate via Edge Middleware (Stopgap Ahead of Google SSO)

**Decision:** The whole app — every page and every `/api` route — is now gated behind a single shared username/password (username defaults to `DEFAULT_USERNAME`, matching the Blob storage folder name), enforced by `middleware.js` (Vercel Edge Middleware), not a Serverless Function. A custom two-column login page issues a stateless, HMAC-signed session cookie (Web Crypto, no session store) on success.

*(Numbered D11, skipping D9/D10 — those exist on the not-yet-merged `feature/completion` branch — the optimistic concurrency guard and the per-year invoice split. Renumber if there's a collision once that branch merges.)*

**Why:** The app started holding real confidential data (client PII, bank account numbers) with the D5-accepted "no auth" risk still in effect. Full Google SSO (tracked separately — see its own issue) is blocked on a Google Cloud OAuth Client that only the user can create; this closes the actual exposure immediately rather than leaving it open until that's set up.

**Why Middleware, not a Serverless Function:** The project was already sitting at Vercel Hobby's 12-Serverless-Function ceiling (see the earlier function-count production incident). Confirmed empirically this session — a deployment with `middleware.js` present alongside the existing 12 Functions succeeds — that Edge Middleware is a genuinely separate quota/runtime, not counted against that cap. This means the whole auth gate, including the login/logout endpoints (handled directly inside middleware, never reaching a `/api` function), costs zero additional Functions.

**A `vercel dev` quirk hit while building this, worth recording:** locally, `vercel dev` served a 200 response with an empty body (`Content-Length: 0`) for `/login` once middleware was added in front of the existing SPA rewrite — looked like a real bug in the code. It wasn't: a real preview deployment (real Vercel infrastructure, not the local emulator) served the page correctly. `vercel dev`'s middleware emulation has already proven unreliable once before this session (see the SPA-rewrite/white-screen incident); this is the same category of issue — verify anything middleware-related against a real deployment, not just local dev.

**A CSS ordering bug caught while checking mobile responsiveness:** the mobile-only override for the visible preview pane (`position: static`, meant only for when it's open) was unscoped and, being later in the file, silently overrode the closed-state's `position: fixed` fix from earlier this session — reintroducing that exact bug (a wide, misplaced element) only on narrow viewports. A near-identical mistake recurred for the login page's own two-column-to-single-column mobile rule: it was placed *before* the base `.login-page`/`.login-art-side` rules in the file, so the later base rule won regardless of the media query. Same lesson twice in one sitting: a mobile override needs to come after the rule it's overriding in source order, not just be wrapped in a `@media` block — equal-specificity cascade doesn't care about media query nesting, only position in the file.

**Tradeoff accepted:** One shared password, not per-user accounts — fine for a single-operator app, matching the no-multi-tenant model everywhere else. No password reset flow, no rate limiting on login attempts — acceptable for now given the small, known audience; would need hardening before this app is ever exposed more broadly (which is exactly why this is a stopgap, not the intended end state).

---

## D12: Every Deploy to `main` Needs a Manual CLI Push (Vercel Platform Quirk)

**Decision (operational, not code):** Until this is resolved, pushing to `main` and letting Vercel's GitHub integration auto-deploy is **not reliable** — it fails with the same `exceeded_serverless_functions_per_deployment` error as the earlier 3-day incident (D-something above), even though the project is correctly at exactly 12 Functions + 1 Middleware. The fix each time is a manual `rm -rf .vercel/output && vercel build --yes --target production && vercel deploy --prebuilt --prod --yes` from a local machine.

**What was actually verified, twice, right after shipping #48 and #49 (same commit, both times):**
- GitHub-triggered deploy: fails. Build log shows `Restored build cache from previous deployment (<dpl-id>)`.
- `vercel deploy --prod --force` (a *remote* build — source uploaded, Vercel's own infrastructure runs `vite build`/the function bundler): also fails, with the identical error, even though `--force` is documented to skip the build cache.
- `vercel build` (runs `vite build` and the function bundler **locally**) + `vercel deploy --prebuilt --prod`: succeeds, every time, for the identical commit that just failed the other two ways.

**Conclusion:** this isn't (just) a stale-cache problem — a supposedly cache-free remote build failed too. Something about how Vercel's own build machines execute the build/bundle step (for this project, at this function/middleware count) differs from running the identical build locally and uploading the result. Not root-caused further this session; flagging it plainly rather than guessing at a fix that can't be verified.

**Practical impact:** after merging any PR to `main`, don't assume it's live — check `vercel ls` / the deployment's `readyState`, and if it's `ERROR` with this same `errorCode`, run the manual local-build-and-upload sequence above rather than retrying the git-triggered path (which has failed 100% of the time it's been tried since the function count first hit 12+1).

**Tradeoff accepted:** An extra manual step after every merge to `main`, for as long as this is unresolved. Worth revisiting if it starts happening even with real headroom below 12 Functions (would suggest it's not actually about the count at all), or by asking Vercel support directly, or by moving to a Pro plan (removes the 12-Function ceiling this is all downstream of in the first place).
