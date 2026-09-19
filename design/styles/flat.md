# Flat Design — "Signal & Block"

**Who it's for:** product studios, startups, and tech shops that want their invoice to look
like it shipped from the same design system as their app — bold, graphic, no ornament.

## Palette

| Token | Hex | Use |
|---|---|---|
| Cobalt | `#2D4FDE` | Primary — header band, grand total block |
| Off-black | `#16181D` | Text |
| Paper | `#FFFFFF` | Background |
| Mustard | `#F2B705` | Single secondary accent — status/paid tags only |
| Fog | `#EEF0F4` | Alternating row tint (flat, no border) |

Solid fills only — no gradients, no drop shadows, no tints-on-tints. Color does the
organizing work that borders would otherwise do.

## Type

- **Headings:** Space Grotesk (geometric, confident, slightly technical)
- **Body / data:** IBM Plex Sans — invoice number and amounts set in Plex Mono for a
  data-forward feel that fits the product context (a deliberate choice here, not a
  generic label treatment)

## Layout

- Full-bleed cobalt header band with biller info reversed in white — this is the hero moment
- Sharp corners everywhere except one consistent small radius (6px) reserved for tags/badges,
  so radius itself becomes a meaningful signal ("this is a tag") rather than decoration
- Items table uses alternating flat fog/white row bands instead of borders
- Grand total is a solid cobalt block with white text — not a bordered cell
- Totals block must support the optional capped-total row (`invoiser_selected_design` reads
  from `computeTotals`, which now returns `billed`/`capped`): when a cap is set and exceeded,
  show "Logged total (uncapped)" as a plain row above the cobalt grand-total block, which then
  reads "Total Due (capped)" — fits the retainer/hourly-billing audience well

## Principle

*Function over ornament.* Every visual device (color block, alternating row, tag radius)
encodes something about the content. Nothing is there to decorate.
