const PAGE_MARGIN_MM = 8

/**
 * Renders one or more DOM nodes to a downloadable PDF, one node per A4
 * page. Each page's captured content is scaled (never cropped) to fill as
 * much of the page as its aspect ratio allows, inside a small margin.
 *
 * Used both for the standalone "Download PDF" button and to produce the
 * file the user attaches when emailing an invoice (browsers won't let JS
 * attach files to a mailto link).
 *
 * The invoice document exposes its logical pages as `.doc-page` elements
 * (see designs/templates.js) — normally just one, plus a second "Order
 * Details" page when the Separate Items option produces one.
 *
 * jsPDF and html2canvas are loaded lazily so they don't bloat the initial
 * page load for people who never export a PDF.
 */
export async function downloadInvoicePdf(pages, filename) {
  const elements = (Array.isArray(pages) ? pages : [pages]).filter(Boolean)
  if (elements.length === 0) return

  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ])

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const availableWidth = pageWidth - PAGE_MARGIN_MM * 2
  const availableHeight = pageHeight - PAGE_MARGIN_MM * 2

  for (let i = 0; i < elements.length; i++) {
    const canvas = await html2canvas(elements[i], { scale: 2, useCORS: true })
    const imgData = canvas.toDataURL('image/jpeg', 0.98)

    const canvasRatio = canvas.width / canvas.height
    const availableRatio = availableWidth / availableHeight
    let renderWidth
    let renderHeight
    if (canvasRatio > availableRatio) {
      renderWidth = availableWidth
      renderHeight = availableWidth / canvasRatio
    } else {
      renderHeight = availableHeight
      renderWidth = availableHeight * canvasRatio
    }
    const x = (pageWidth - renderWidth) / 2
    const y = (pageHeight - renderHeight) / 2

    if (i > 0) pdf.addPage()
    pdf.addImage(imgData, 'JPEG', x, y, renderWidth, renderHeight)
  }

  pdf.save(filename)
}
