# Invoiser — Memory Index

Project-specific engineering knowledge for Invoiser. Patterns, conventions, and decisions specific to this codebase — not general Gawa-wide knowledge (see gawa-brain for that).

## Canonical Memory

- [Engineering](engineering.md) — print/PDF architecture patterns, date-parsing gotchas, serverless-backend constraints, anti-patterns
- [Decisions](decisions.md) — durable project decisions with context and tradeoffs (template architecture, iframe-based print, Vercel Blob over a DB, no auth, full editor migration, ledger-not-gateway payments, computed-overdue)

## Current State (as of 2026-09-20)

**Shipped:** A no-backend, localStorage-based invoicing SPA — biller/client info, line items, totals (with tax/discount/cap), signature + signatory, three visual themes (Pastel/Elegant/Flat) plus Default, a design marketplace picker, an isolated-iframe preview/print/PDF pipeline (A4, single-page, page-numbered, with a grouped "Separate Items" mode and an Order Details second page), toast notifications, and a due-date-driven payment-terms note.

**In flight (not started, tickets only):** Migrating to a real backend — Vercel Serverless Functions + Vercel Blob Storage (JSON flat files per user, no relational DB, no auth yet) — to support four new features: Dashboard, Invoices List & Lifecycle (status tracking, payment ledger), Clients List, Bank Accounts List. Tracked as GitHub epics:

- #10 — Backend Setup & Bootstrapping (Vercel + Blob Storage)
- #11 — API Routes — Invoices, Clients, Bank Accounts, Payments
- #12 — Dashboard
- #13 — Invoices List & Lifecycle
- #14 — Clients List
- #15 — Bank Accounts List

**Also open:**
- #5 — Migrate PDF/print export from `html2canvas` to a Playwright-rendered backend (deferred — would require adding a server, rejected for now to stay backend-free on that specific concern; now moot in spirit once the epics above add a backend anyway, but not yet revisited)
- #8 — Polish: enforce the 15-group cap, a per-line character limit, and real multi-page pagination for Order Details beyond 2 pages
