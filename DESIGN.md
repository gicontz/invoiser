# Invoiser — Style guide ("Ledgerline")

> A ledger that feels like warm paper, not a cold dashboard. Soft, round, and precise about the money — never corporate about it.

This governs the **app's own UI** — toolbar, navigation, Dashboard, Invoices/Clients/Bank Accounts lists, forms, modals. It does **not** touch the invoice *output* (print/PDF/email), which already has its own separate, approved design system — see [`design/styles/`](design/styles/) and the four themes in `src/designs/`. The app is the operator's tool; the invoice is the document a client receives. They stay visually distinct on purpose.

Built on the same core concept as `gawa-brain`'s other style guides (see cartly's `design/STYLE.md`): soft rounded shapes, a tinted shadow instead of grey, pastel fills paired with a deep partner color for text, and warmth that never compromises how clearly the data reads.

---

## 1. Palette

Pastels are for **fills only**. All text and icons use Ink or a deep partner color so contrast holds — same rule as cartly.

| Token | Hex | Role |
| --- | --- | --- |
| `cream` | `#FFF8F0` | App background |
| `white` | `#FFFFFF` | Cards, sheets, modals |
| `lilac` | `#E7E3FA` | Skeleton loading bars |
| `ink` | `#26263A` | Primary text |
| `inkMuted` | `#63607A` | Secondary text, labels |
| `accent` | `#1F3A5F` | Primary action (buttons, nav active state, links) — a deep ledger-ink navy, invoiser's own hue in the same family role as cartly's berry |
| `accentInk` | `#FFFFFF` | Text/icons on `accent` fill |
| `draftFill` / `draftDeep` | `#E9E7F2` / `#6B6480` | Draft status pill |
| `sentFill` / `sentDeep` | `#DCEAF6` / `#2C5D82` | Sent status pill |
| `paidFill` / `paidDeep` | `#DFF3E6` / `#1F6E52` | Paid status pill — reuses cartly's exact `mintDeep`: both mean "done, successfully" |
| `overdueFill` / `overdueDeep` | `#FBE1DD` / `#A8261E` | Overdue status pill — reuses cartly's exact `error`: both mean "needs attention" |
| `cancelledFill` / `cancelledDeep` | `#ECEBEE` / `#86808F` | Cancelled status pill, paired with a strikethrough |
| `error` / `errorBg` | `#A8261E` / `#FFE3E0` | Form/action errors — same pair as cartly's, same concept |

**Contrast (WCAG):** ink/cream 12.8 · inkMuted/cream 5.4 · white on accent 9.6 · paidDeep/paidFill 5.1 · overdueDeep/overdueFill 5.9 · error/errorBg 5.9. All pass AA for body text.

## 2. Typography

Same two families as cartly — this is the clearest cross-project alignment point, deliberately kept identical rather than "inspired by."

| Style | Font | Size / weight |
| --- | --- | --- |
| Display (page titles: "Dashboard", "Invoices") | **Fredoka** | 32 / 600 |
| Title (modal/sheet titles) | Fredoka | 22 / 600 |
| Row primary text (client name, invoice number) | **Nunito** | 17 / 700 |
| Body | Nunito | 15 / 500 |
| Label (pill, button) | Nunito | 14 / 800 |
| Data (amounts, dates in tables) | **JetBrains Mono**, 500 | The one addition beyond cartly's pair — an invoicing-specific need (tabular figures so money aligns in a column) that a shopping list never had. Used narrowly: table/list numeric columns only, never headings or labels. |

**Loaded via Google Fonts `<link>`**, not bundled — this is a browser app, not a packaged binary, so there's no offline-asset requirement the way cartly's Flutter app has. Same loading mechanism the four invoice-output themes already use.

Sentence case everywhere, never all caps — including existing spots in the current editor (e.g. `.party-header h2`) worth revisiting once this guide lands.

## 3. Shape, space, depth

- **Radius:** cards and modals 24px, pills and buttons fully round (`border-radius: 999px`), text fields 18px — all matching cartly's numbers exactly, not just its philosophy.
- **Spacing:** 4px grid. Screen padding 20, gap between rows 10, row padding 16 — same as cartly.
- **Elevation:** no grey shadows. A *tinted* soft shadow using the accent color: `box-shadow: 0 8px 20px rgba(31, 58, 95, 0.10)` — cartly's exact formula, navy instead of berry.

## 4. Iconography

No icon library dependency (matches this app's existing minimal-dependency posture). A small set of hand-authored inline SVGs, rounded line caps and joins, 1.5px stroke, 20×20 viewbox — used for nav items, status pills, and primary row actions (mark sent, record payment, cancel). Everything else stays a text label, same as today.

## 5. Components → features

| Feature | Component | Treatment |
| --- | --- | --- |
| Dashboard totals | `StatCard` | White 24px-radius card: `inkMuted` label above a large `ink` figure in Fredoka |
| Dashboard status counts | `StatusCountRow` | A dot (not a filled badge) + Nunito count per status — quieter than a list row, summary scale |
| Dashboard recent invoices | `RecentInvoiceRow` | Reuses `InvoiceRow` at a smaller scale, capped at 5 |
| Invoices list | `InvoiceRow` | White card row: invoice #, client name (Nunito 700), due date, a `StatusPill`, total (JetBrains Mono, right-aligned) |
| Invoices list — status | `StatusPill` | Stadium pill, pastel fill + deep partner text — never the saturated color as a full background |
| Record payment | Bottom sheet / modal | Amount field, date field, optional note, `accent`-filled "Record payment" button — reuses the existing `EmailModal`/`AddressBookModal` shape already in the app, no new modal pattern |
| Clients / Bank Accounts lists | `EntityRow` | Name + 1–2 secondary fields + rounded icon actions — same row shape reused for both |
| Empty state (any list, first use) | `EmptyState` | **"No invoices yet."** / "Create your first invoice to see it here." + pill "New Invoice" button |
| Loading (any API-backed view) | Skeleton | 3–4 `lilac` rounded bars at the row's real height — not a spinner |
| Error (any API-backed view) | `ErrorCard` | `errorBg` card: **"Couldn't load \[invoices/clients/bank accounts\]."** + pill "Try again" that re-runs the same fetch |

## 6. Data & state conventions

This app makes real network requests for the first time with the backend (Frontend Migration, #16) — up to now everything was a synchronous localStorage read. Cartly's own rule applies just as directly here:

- **The API's response is the source of truth for order and status.** A list re-fetches after any mutation instead of reordering itself client-side.
- **Every API-backed view gets all three states on purpose** — loading (skeleton), error (`ErrorCard` + retry), empty (`EmptyState` + call to action) — not just the happy path.
- **Motion is a single ~200ms cross-fade** when a list's data changes — no per-row slide/move animations implying the app itself is reordering things. Respect `prefers-reduced-motion`.
- **Status changes always come from the dedicated status/payment endpoints**, never a generic PATCH the UI constructs itself.

## 7. Voice

Warm, short, plain. No emoji in UI copy (the toolbar's 🧾 brand mark is the one deliberate exception, already established). No exclamation marks in errors. Matches the app's existing toast copy exactly: "Draft saved," "Could not save draft," "Client is used on one or more invoices."

## 8. CSS tokens

Extends the existing `:root` block in `src/styles.css` — additive. `--radius`, `--line`, `--paper` stay conceptually the same idea, renamed/retuned to match this guide; `--accent` changes from the old generic blue to the navy above.

```css
:root {
  --cream: #fff8f0;
  --white: #ffffff;
  --lilac: #e7e3fa;
  --ink: #26263a;
  --ink-muted: #63607a;

  --accent: #1f3a5f;
  --accent-ink: #ffffff;

  --draft-fill: #e9e7f2;   --draft-deep: #6b6480;
  --sent-fill: #dceaf6;    --sent-deep: #2c5d82;
  --paid-fill: #dff3e6;    --paid-deep: #1f6e52;
  --overdue-fill: #fbe1dd; --overdue-deep: #a8261e;
  --cancelled-fill: #ecebee; --cancelled-deep: #86808f;

  --error: #a8261e;
  --error-bg: #ffe3e0;

  --radius-card: 24px;
  --radius-field: 18px;
  --radius-pill: 999px;

  --shadow-soft: 0 8px 20px rgba(31, 58, 95, 0.10);

  --font-display: "Fredoka", -apple-system, sans-serif;
  --font-body: "Nunito", -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
}
```

## 9. Do / Don't

- ✅ Keep pastels as fills and deep colors for text — never pastel text on white.
- ✅ Keep the tinted-shadow, stadium-pill, 24px-card language consistent across every new page.
- ✅ Show loading/error/empty states on every API-backed view, not just the happy path.
- ❌ Don't use a status color as a full-row or full-card background wash.
- ❌ Don't reorder or re-sort a list on the client after a mutation — re-fetch and render what the API returns.
- ❌ Don't reach for the invoice-output fonts (Quicksand, Cormorant Garamond, Space Grotesk, IBM Plex) anywhere in the app's own UI — that would blur the line this guide exists to keep.
