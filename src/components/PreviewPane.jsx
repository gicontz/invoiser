import { forwardRef, useImperativeHandle, useRef, useState } from 'react'

// Isolated iframe hosting the rendered invoice HTML (see
// designs/index.js#renderInvoiceHtml). It's the single source for three
// things: the visible, toggleable on-screen preview; Print
// (iframe.contentWindow.print() prints only the iframe's own document, so
// nothing elsewhere on the page needs to be hidden via .no-print/@media
// print, and real multi-page reflow — e.g. the Order Details page — is
// handled by the browser's own pagination via CSS break-before); and
// PDF/email export (html2canvas captures each `.doc-page` element as its
// own A4 page — see utils/pdf.js). Always mounted, even while visually
// closed, so Print/PDF work regardless of whether the user has the
// preview panel open. Content is set via srcdoc — a full replace on
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
    getCapturePages() {
      const doc = iframeRef.current?.contentDocument
      if (!doc) return []
      const pages = Array.from(doc.querySelectorAll('.doc-page'))
      return pages.length > 0 ? pages : [doc.body?.firstElementChild].filter(Boolean)
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
