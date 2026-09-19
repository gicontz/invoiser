import { DESIGNS } from '../designs/index.js'

export default function DesignMarketplace({ open, onClose, selectedDesignId, onSelect }) {
  if (!open) return null

  return (
    <div className="modal-backdrop open no-print">
      <div className="modal modal-wide">
        <div className="modal-header">
          <h3>Designs</h3>
          <button className="btn btn-tiny" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="modal-hint">
            Pick a visual design for your invoice output (print, PDF, email). The editor you fill
            in always stays plain — only the generated invoice changes look.
          </p>

          <div className="design-grid">
            {DESIGNS.map((design) => {
              const isSelected = design.id === selectedDesignId
              const isLocked = design.status === 'coming-soon'
              return (
                <div
                  key={design.id}
                  className={`design-card${isSelected ? ' selected' : ''}${isLocked ? ' locked' : ''}`}
                >
                  {isLocked && <span className="design-badge">Coming soon</span>}
                  <h4>{design.name}</h4>
                  <p>{design.description}</p>
                  {isLocked ? (
                    <button type="button" className="btn btn-tiny" disabled>
                      Locked
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-tiny"
                      disabled={isSelected}
                      onClick={() => onSelect(design.id)}
                    >
                      {isSelected ? 'Selected' : 'Select'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
