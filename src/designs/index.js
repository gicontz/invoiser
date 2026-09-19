// Design registry — the seam where real invoice themes plug in later.
//
// Each entry describes a visual design that (eventually) skins the invoice
// *output* (print/PDF/email) while the live editor form stays plain. Only
// 'default' is actually implemented today; the rest are placeholders for
// designs still pending visual approval (see design/styles/*.md).
export const DESIGNS = [
  {
    id: 'default',
    name: 'Default',
    description: 'The clean, plain invoice look you see today — no theme applied.',
    status: 'active',
  },
  {
    id: 'pastel',
    name: 'Pastel',
    description: 'Soft, dusty tones and rounded cards for a warm, handmade feel.',
    status: 'coming-soon',
  },
  {
    id: 'elegant',
    name: 'Elegant',
    description: 'Restrained ink-on-paper letterhead with hairline brass rules.',
    status: 'coming-soon',
  },
  {
    id: 'flat',
    name: 'Flat Design',
    description: 'Bold cobalt blocks and no ornament, built for product studios.',
    status: 'coming-soon',
  },
]

export const DEFAULT_DESIGN_ID = 'default'
