export default function Toolbar({
  onNew,
  onOpenAddressBook,
  onSaveDraft,
  draftStatus,
  onPrint,
  onDownloadPdf,
  onOpenEmail,
}) {
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
        <button className="btn btn-secondary" onClick={onPrint}>Print</button>
        <button className="btn btn-secondary" onClick={onDownloadPdf}>Download PDF</button>
        <button className="btn btn-primary" onClick={onOpenEmail}>Email Invoice</button>
      </div>
    </header>
  )
}
