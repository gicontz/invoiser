import { renderInvoiceBody } from './templates.js'
import documentCss from './document.css?raw'
import themesCss from './themes.css?raw'

// Design registry — what a user picks between in the marketplace. Approved
// directions, see design/styles/*.md for the palette/type/layout rationale
// behind each. `swatches` drives the small color-dot preview on each card.
export const DESIGNS = [
  {
    id: 'default',
    name: 'Default',
    description: 'The clean, plain invoice look — no theme applied.',
    status: 'active',
    swatches: ['#ffffff', '#2f6fed', '#1a1d23'],
  },
  {
    id: 'pastel',
    name: 'Pastel',
    description: 'Soft, dusty tones and rounded cards for a warm, handmade feel.',
    status: 'active',
    swatches: ['#8FA893', '#E3AF9C', '#FAF6F0'],
  },
  {
    id: 'elegant',
    name: 'Elegant',
    description: 'Restrained ink-on-paper letterhead with hairline brass rules.',
    status: 'active',
    swatches: ['#1B2430', '#B08D57', '#F7F4EC'],
  },
  {
    id: 'flat',
    name: 'Flat Design',
    description: 'Bold cobalt blocks and no ornament, built for product studios.',
    status: 'active',
    swatches: ['#2D4FDE', '#F2B705', '#16181D'],
  },
]

export const DEFAULT_DESIGN_ID = 'default'

const FONTS_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Quicksand:wght@500;700&family=Karla:wght@400;600&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500;1,600&family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;700&family=IBM+Plex+Sans:wght@400;600&family=IBM+Plex+Mono:wght@500&display=swap');"

// Builds the full standalone HTML document for the invoice in the given
// design. This one string is the single source of truth for what the user
// sees in the preview iframe, what gets printed (iframe.contentWindow.print()),
// and — via the Node-safe twin api/_lib/renderInvoiceHtml.js — what gets
// rendered to a PDF for download/email (see api/_lib/renderInvoicePdf.js).
export function renderInvoiceHtml(designId, data) {
  const body = renderInvoiceBody({ designId, ...data })
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
${FONTS_IMPORT}
${documentCss}
${themesCss}
</style>
</head>
<body>
${body}
</body>
</html>`
}
