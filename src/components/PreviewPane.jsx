import { forwardRef, useImperativeHandle, useRef, useState } from 'react'

// Isolated iframe hosting the rendered invoice HTML (see
// designs/index.js#renderInvoiceHtml). It's the single source for the
// visible, toggleable on-screen preview and for Print
// (iframe.contentWindow.print() prints only the iframe's own document, so
// nothing elsewhere on the page needs to be hidden via .no-print/@media
// print, and real multi-page reflow — e.g. the Order Details page — is
// handled by the browser's own pagination via CSS break-before). PDF/email
// export is server-rendered via Playwright instead (see
// api/_lib/renderInvoicePdf.js) — the same HTML, but through the real
// browser engine rather than this iframe. Always mounted, even while
// visually closed, so Print still works regardless of whether the user has
// the preview panel open. Content is set via srcdoc — a full replace on
// refresh(), not a live React re-render.
const PreviewPane = forwardRef(function PreviewPane({ open }, ref) {
  const iframeRef = useRef(null)
  const [height, setHeight] = useState(600)

  useImperativeHandle(ref, () => ({
    refresh(html) {
      return new Promise((resolve) => {
        const iframe = iframeRef.current
        if (!iframe) return resolve()
        const onLoad = () => {
          iframe.removeEventListener('load', onLoad)
          const root = iframe.contentDocument?.body?.firstElementChild
          if (root) setHeight(root.scrollHeight)
          resolve()
        }
        iframe.addEventListener('load', onLoad)
        iframe.srcdoc = html
      })
    },
    print() {
      iframeRef.current?.contentWindow?.print()
    },
  }))

  return (
    <aside className={`preview-pane no-print${open ? '' : ' preview-pane-closed'}`} aria-label="Invoice preview">
      <div className="preview-pane-label">Preview</div>
      <iframe ref={iframeRef} title="Invoice preview" className="preview-frame" style={{ height }} />
    </aside>
  )
})

export default PreviewPane
