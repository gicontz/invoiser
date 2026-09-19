import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { renderInvoiceBody } from '../../src/designs/templates.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const documentCss = readFileSync(join(__dirname, '../../src/designs/document.css'), 'utf-8')
const themesCss = readFileSync(join(__dirname, '../../src/designs/themes.css'), 'utf-8')

// Keep in sync with src/designs/index.js's FONTS_IMPORT.
const FONTS_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Quicksand:wght@500;700&family=Karla:wght@400;600&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500;1,600&family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;700&family=IBM+Plex+Sans:wght@400;600&family=IBM+Plex+Mono:wght@500&display=swap');"

// Server-side twin of src/designs/index.js#renderInvoiceHtml — same output,
// but reads the CSS from disk instead of Vite's `?raw` import, which only
// resolves inside the Vite-bundled frontend, not a plain Node function.
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
