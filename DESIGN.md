# Invoiser — Design guide ("Ledgerline")

> The tool feels like a well-kept ledger, not a generic dashboard template. Calm, precise, and quietly confident — it's handling someone's money and their client relationships, and it should look like it takes that seriously without being cold about it.

This governs the **app's own UI** — toolbar, navigation, Dashboard, Invoices/Clients/Bank Accounts lists, forms, modals. It does **not** touch the invoice *output* (print/PDF/email), which already has its own separate, approved design system — see [`design/styles/`](design/styles/) and the four themes in `src/designs/`. Deliberately kept distinct: the app is the operator's tool, the invoice is the document a client receives. They should never look like the same thing wearing different clothes.

Visual reference: the moodboard (link shared separately for approval).

---

## 1. Palette

Semantic status color carries the real information in this app (an invoice's state is the single most important thing on screen, repeatedly, across Dashboard and the Invoices list) — so it gets more visual weight than the brand accent, which stays restrained.

| Token | Hex | Role |
| --- | --- | --- |
| `bg` | `#F3F4F7` | App background (cool neutral, not warm cream) |
| `paper` | `#FFFFFF` | Cards, sheets, modals |
| `ink` | `#1A2035` | Primary text (soft near-black, not pure black) |
| `inkSoft` | `#5B6478` | Secondary text, labels |
| `line` | `#E2E5EA` | Borders, dividers |
| `accent` | `#1F3A5F` | Primary action, nav active state, links — deep navy, deliberately restrained |
| `accentInk` | `#FFFFFF` | Text/icons on `accent` fill |
| **Status — draft** | `#8A8F9C` | Neutral gray. Not yet real. |
| **Status — sent** | `#3B82C4` | Calm blue. Waiting. |
| **Status — paid** | `#1F8A5A` | Green. Done. |
| **Status — overdue** | `#C4432B` | Warm red. Needs attention — computed, never a stored status (see `memory/decisions.md` D8). |
| **Status — cancelled** | `#A6A9B4` | Muted gray, paired with a strikethrough — closed, not an error. |
| `danger` | `#D64545` | Destructive actions, form errors (distinct from the overdue status red — this is an *action* warning, not a *state*) |

**Contrast:** ink/bg 14.9 · inkSoft/bg 5.6 · accentInk/accent 9.8 · all five status colors carry ≥4.5:1 against `paper` for their own label text. All pass WCAG AA for body text.

Status color is a fill on a small badge/pill, never a full-row background wash — a list of invoices should still read as a calm list of rows, with color doing the pointing, not painting the whole surface.

## 2. Typography

| Style | Font | Role |
| --- | --- | --- |
| Display (page titles: "Dashboard", "Invoices") | **Manrope**, 700 | Confident, a little technical — matches the tone, not shouting |
| Body (everything else: labels, table text, form fields) | **Work Sans**, 400/500 | Neutral, highly legible at small sizes |
| Data (amounts, invoice numbers, dates in tables) | **JetBrains Mono**, 500 | Tabular figures by default — money in a list should always align in a column |

None of these three overlap with any of the four invoice-output themes' typefaces (Quicksand/Karla, Cormorant Garamond/Inter, Space Grotesk/IBM Plex) — deliberate, so the app's own chrome never gets mistaken for one of the document themes it's picking between.

Loaded via Google Fonts `<link>` (same mechanism the invoice themes already use), not bundled — this is a browser app, not a packaged binary.

Sentence case everywhere. No all-caps labels (the existing editor already does this in a couple of places — e.g. section headers in `.party-header h2` — worth revisiting once this guide lands).

## 3. Shape, space, depth

- **Radius:** cards and modals 10px (keep the existing `--radius` — no reason to change what already reads fine), status pills fully round, buttons 8px (existing).
- **Spacing:** 4px grid, extending the app's current ad-hoc spacing into a real scale: `4 · 8 · 12 · 16 · 20 · 24 · 32`.
- **Elevation:** existing soft shadow (`0 1px 3px rgba(20,20,30,.06), 0 8px 24px rgba(20,20,30,.04)`) stays the one elevation style for cards/modals — don't introduce a second shadow language for the new pages.

## 4. Iconography

No icon library dependency (matches this app's existing minimal-dependency posture). A small set of hand-authored inline SVGs, single consistent stroke weight (1.5px), 20×20 viewbox — used for: nav items (Dashboard/Invoices/Clients/Bank Accounts), the status pills, and primary row actions (mark sent, record payment, cancel). Everything else stays text labels, exactly like the app does today.

## 5. Components → features

| Feature | Component | Treatment |
| --- | --- | --- |
| Dashboard totals | `StatCard` | White card, `inkSoft` label above a large `ink` figure in Manrope; no icon, no accent border — the number is the whole point, don't decorate it |
| Dashboard status counts | `StatusCountRow` | Five small counts in a row, each prefixed by its status-color dot, not a filled badge — quieter treatment for a summary than for a list row |
| Dashboard recent invoices | `RecentInvoiceRow` | Reuses `InvoiceRow` (below) at a smaller scale, capped at 5 |
| Invoices list | `InvoiceRow` | White row: invoice #, client name, due date, a `StatusPill`, total (JetBrains Mono, right-aligned) |
| Invoices list — status | `StatusPill` | Small rounded pill, status color at 12% opacity as fill, full status color as text — never the loud saturated color as a full background |
| Invoices list — record payment | Modal | Amount + date fields, optional note, `accent`-filled submit — mirrors the existing `EmailModal`/`AddressBookModal` pattern already in the app, don't invent a new modal shape |
| Clients / Bank Accounts lists | `EntityRow` | Name + 1-2 secondary fields + edit/delete icon actions — same row shape reused for both, since they're structurally the same kind of list |
| Empty state (any list, first use) | `EmptyState` | **"No invoices yet."** / "Create your first invoice to see it here." + primary action button. Never just a blank white card. |
| Loading state (any API-backed view) | Skeleton | 3-4 `line`-colored rounded bars at the row's actual height — not a spinner. This app is about to have real network latency for the first time; skeletons keep the layout stable instead of a jump when data arrives. |
| Error state (any API-backed view) | `ErrorCard` | `danger`-tinted card: **"Couldn't load \[invoices/clients/bank accounts\]."** + a "Try again" button that re-runs the same fetch — mirrors the existing toast error copy style already established (`enqueueSnackbar`) |

## 6. Data & state conventions

This app is about to make real network requests for the first time (Frontend Migration epic, #16) — up to now everything was synchronous localStorage reads. A few rules to keep that honest instead of papering over latency:

- **The API's response is the source of truth for order and status**, same principle as the backend's own design (`memory/decisions.md`): a list re-fetches after any mutation rather than optimistically reordering itself client-side. Simpler to reason about, and this app's data volumes (personal-scale) make the extra round trip a non-issue.
- **Every API-backed view has all three states on purpose**: loading (skeleton), error (`ErrorCard` with retry), and empty (`EmptyState` with a call to action) — not just the happy path. None of these existed before because there was no network to fail; they're not optional now that there is one.
- **Motion is a single 150ms cross-fade** when a list's data changes (matches the print-preview iframe's own restrained approach to updates) — no per-row slide/move animations that would imply the app is reordering things itself. Respect `prefers-reduced-motion`.
- **Status changes always come from the dedicated status/payment endpoints**, never a generic PATCH — the UI should never construct a `status: 'paid'` field itself; it calls `POST /invoices/:id/payments` and displays whatever status comes back.

## 7. Voice

Plain, short, no jargon — matches the existing toast copy exactly ("Draft saved", "Could not save draft", "Client is used on one or more invoices"). Errors state what happened and, where possible, what to do about it. No exclamation marks. No emoji in UI copy (the toolbar's 🧾 brand mark is the one deliberate exception, already established).

## 8. CSS tokens

Extends the existing `:root` block in `src/styles.css` — additive, not a replacement. Existing tokens (`ink`, `inkSoft`, `line`, `paper`, `bg`, `radius`) are kept as-is since they already read well; only `accent` changes, and status/font tokens are new.

```css
:root {
  /* unchanged */
  --ink: #1a2035;        /* was #1a1d23 — negligible shift, keeps existing contrast */
  --ink-soft: #5b6478;   /* was #5b6270 — negligible shift */
  --line: #e2e5ea;
  --paper: #ffffff;
  --bg: #f3f4f7;         /* was #f4f5f7 — negligible shift */
  --radius: 10px;
  --danger: #d64545;

  /* changed: a deliberate navy instead of generic SaaS-blue */
  --accent: #1f3a5f;
  --accent-ink: #ffffff;

  /* new: status system */
  --status-draft: #8a8f9c;
  --status-sent: #3b82c4;
  --status-paid: #1f8a5a;
  --status-overdue: #c4432b;
  --status-cancelled: #a6a9b4;

  /* new: typography */
  --font-display: "Manrope", -apple-system, sans-serif;
  --font-body: "Work Sans", -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;

  /* new: spacing scale */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
}
```

## 9. Do / Don't

- ✅ Keep status color on badges/pills/dots — small, specific, high-signal.
- ✅ Keep the app's chrome typography and palette entirely separate from the four invoice-output themes.
- ✅ Show loading/error/empty states on every API-backed view, not just the happy path.
- ❌ Don't use a status color as a full-row or full-card background wash.
- ❌ Don't reorder or re-sort a list on the client after a mutation — re-fetch and render what the API returns.
- ❌ Don't reach for the invoice-output fonts (Quicksand, Cormorant Garamond, Space Grotesk, IBM Plex) anywhere in the app's own UI — that would blur the line this guide exists to keep.
