/**
 * Renders a DOM node to a downloadable PDF. Used both for the standalone
 * "Download PDF" button and to produce the file the user attaches when
 * emailing an invoice (browsers won't let JS attach files to a mailto link).
 *
 * html2pdf.js (and the jspdf/html2canvas it bundles) is loaded lazily so it
 * doesn't bloat the initial page load for people who never export a PDF.
 */
export async function downloadInvoicePdf(element, filename) {
  if (!element) return

  const { default: html2pdf } = await import('html2pdf.js')

  const options = {
    margin: 0.4,
    filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
  }

  return html2pdf().set(options).from(element).save()
}
