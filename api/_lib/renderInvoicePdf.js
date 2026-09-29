import os from 'node:os'
import { chromium as playwright } from 'playwright-core'
import chromium from '@sparticuz/chromium'
import { renderInvoiceHtml, renderReceiptHtml } from './renderInvoiceHtml.js'

// @sparticuz/chromium ships a Linux-only binary (it's built for Lambda-style
// serverless runtimes, which is what Vercel Functions run on in production).
// Locally on macOS/Windows we fall back to a Playwright-managed Chromium
// installed via `npx playwright install chromium` — same API either way.
const isLinux = os.platform() === 'linux'

// Renders an invoice straight to a PDF Buffer — never written to disk or
// Blob storage. Callers (see api/send-email.js) attach the buffer to an
// outgoing email and let it fall out of scope once the response is sent;
// there is deliberately no caching or persistence step here.
export async function renderInvoicePdfBuffer(designId, invoiceData) {
  return renderHtmlToPdfBuffer(renderInvoiceHtml(designId, invoiceData))
}

// Acknowledgement Receipt (issue #52) — same browser pipeline, receipt HTML.
export async function renderReceiptPdfBuffer(receipt) {
  return renderHtmlToPdfBuffer(renderReceiptHtml(receipt))
}

async function renderHtmlToPdfBuffer(html) {
  const browser = await playwright.launch({
    args: isLinux ? chromium.args : [],
    executablePath: isLinux ? await chromium.executablePath() : playwright.executablePath(),
    headless: true,
  })

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle' })
    // Explicit rather than relying on page.pdf()'s default media type — the
    // document's own @media print rules (page breaks, shadow removal) must
    // apply here the same way they do for native browser printing.
    await page.emulateMedia({ media: 'print' })
    return await page.pdf({ format: 'A4', printBackground: true })
  } finally {
    await browser.close()
  }
}
