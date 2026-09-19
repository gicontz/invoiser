import { useRef, useState } from 'react'
import { enqueueSnackbar } from 'notistack'

const ACCEPTED_TYPES = ['image/png', 'image/svg+xml']

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export default function SignatureUpload({ signature, onChange, onSaveDefault }) {
  const inputRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState('')

  const processFile = async (file) => {
    if (!file) return
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Only PNG or SVG images are supported.')
      enqueueSnackbar('Only PNG or SVG images are supported', { variant: 'error' })
      return
    }
    try {
      const dataUrl = await readFileAsDataUrl(file)
      setError('')
      onChange(dataUrl)
      enqueueSnackbar('Signature uploaded', { variant: 'success' })
    } catch {
      setError('Could not read that file.')
      enqueueSnackbar('Could not read that file', { variant: 'error' })
    }
  }

  const handleFileInput = (e) => {
    processFile(e.target.files?.[0])
    // Reset so picking the same file again still fires onChange.
    e.target.value = ''
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    processFile(e.dataTransfer.files?.[0])
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  return (
    <div className="card signature-block">
      <div className="party-header">
        <h2>Signature</h2>
        <button
          type="button"
          className="btn btn-tiny no-print"
          onClick={() => inputRef.current?.click()}
        >
          Upload
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/svg+xml"
          className="visually-hidden no-print"
          onChange={handleFileInput}
        />
        {signature && (
          <button type="button" className="btn btn-tiny no-print" onClick={onSaveDefault}>
            Save as default
          </button>
        )}
      </div>
      <div
        className={`signature-preview${isDragging ? ' signature-dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        {signature ? (
          <img src={signature} alt="Signature" />
        ) : (
          <span className="signature-placeholder no-print">
            {isDragging ? 'Drop to upload' : 'Drag & drop, or click Upload'}
          </span>
        )}
      </div>
      {error && <p className="signature-error no-print">{error}</p>}
    </div>
  )
}
