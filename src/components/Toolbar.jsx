import { useRef } from 'react'

export default function Toolbar({
  onNew,
  onOpenAddressBook,
  onSaveDraft,
  draftStatus,
  onExport,
  onImportFile,
  onPrint,
  onDownloadPdf,
  onOpenEmail,
}) {
  const importInputRef = useRef(null)

  return (
    <header className="toolbar no-print">
      <div className="toolbar-brand">
        <span className="brand-mark">🧾</span>
        <span className="brand-name">Invoiser</span>
      </div>
      <div className="toolbar-actions">
        <button className="btn btn-ghost" onClick={onNew}>New</button>
        <button className="btn btn-ghost" onClick={onOpenAddressBook}>Address Book</button>
        <button className="btn btn-secondary" onClick={onSaveDraft}>Save Draft</button>
        {draftStatus && <span className="draft-status">{draftStatus}</span>}
        <button className="btn btn-secondary" onClick={onExport}>Export JSON</button>
        <button className="btn btn-secondary" onClick={() => importInputRef.current?.click()}>
          Import JSON
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json"
          className="visually-hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onImportFile(file)
            e.target.value = ''
          }}
        />
        <button className="btn btn-secondary" onClick={onPrint}>Print</button>
        <button className="btn btn-secondary" onClick={onDownloadPdf}>Download PDF</button>
        <button className="btn btn-primary" onClick={onOpenEmail}>Email Invoice</button>
      </div>
    </header>
  )
}
