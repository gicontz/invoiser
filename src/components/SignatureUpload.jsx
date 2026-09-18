export default function SignatureUpload({ signature, onChange, onSaveDefault }) {
  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => onChange(reader.result)
    reader.readAsDataURL(file)
  }

  return (
    <div className="card signature-block">
      <div className="party-header">
        <h2>Signature</h2>
        <label className="btn btn-tiny no-print" htmlFor="signatureUpload">Upload</label>
        <input
          id="signatureUpload"
          type="file"
          accept="image/png,image/svg+xml"
          className="visually-hidden no-print"
          onChange={handleFile}
        />
        {signature && (
          <button className="btn btn-tiny no-print" onClick={onSaveDefault}>Save as default</button>
        )}
      </div>
      <div className="signature-preview">
        {signature ? (
          <img src={signature} alt="Signature" />
        ) : (
          <span className="signature-placeholder no-print">No signature uploaded</span>
        )}
      </div>
    </div>
  )
}
