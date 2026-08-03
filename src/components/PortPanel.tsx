import { TESLA_MODELS, type TeslaModel } from '../data/models'
import type { PortedWrap } from '../types'

interface Props {
  sourceModel: TeslaModel
  ports: Record<string, PortedWrap>
  busy: boolean
  onPort: (modelId: string) => void
  onDownload: (modelId: string) => void
}

export function PortPanel({ sourceModel, ports, busy, onPort, onDownload }: Props) {
  const targets = TESLA_MODELS.filter((m) => m.id !== sourceModel.id)
  const ported = targets.filter((m) => ports[m.id])

  return (
    <section className="card">
      <h2>6. Use this design on another Tesla</h2>
      <p className="hint">
        Every model has its own panel layout, so the same PNG can't just be reused — the panels sit in different
        places. Pick another vehicle and the design is redrawn onto its template, keeping the same colours, motifs
        and style. One image call per model; results stay here so you can do several.
      </p>

      <label className="field">
        <span>Redraw this design for…</span>
        <select value="" disabled={busy} onChange={(e) => e.target.value && onPort(e.target.value)}>
          <option value="">{busy ? 'Working…' : 'Choose a model…'}</option>
          {targets.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {m.subtitle ? ` — ${m.subtitle}` : ''}
              {ports[m.id]?.status === 'done' ? ' ✓' : ''}
            </option>
          ))}
        </select>
      </label>

      {ported.length > 0 && (
        <div className="library-grid">
          {ported.map((m) => {
            const port = ports[m.id]
            return (
              <div key={m.id} className="library-card">
                <div className="preview-frame port-thumb">
                  {port.status === 'loading' && <div className="spinner" />}
                  {port.status === 'done' && port.dataUrl && (
                    <img src={port.dataUrl} alt={`Design redrawn for ${m.name}`} />
                  )}
                  {port.status === 'error' && <div className="panel-error">{port.error}</div>}
                </div>
                <strong>{m.name}</strong>
                {m.subtitle && <span className="meta">{m.subtitle}</span>}
                {port.status === 'done' && port.width && (
                  <span className="meta">
                    {port.width}×{port.height}px · {((port.sizeBytes ?? 0) / 1024).toFixed(0)} KB
                  </span>
                )}
                <div className="panel-actions">
                  {port.status === 'done' && (
                    <button type="button" className="ghost-btn" onClick={() => onDownload(m.id)}>
                      Download
                    </button>
                  )}
                  {port.status !== 'loading' && (
                    <button type="button" className="ghost-btn" disabled={busy} onClick={() => onPort(m.id)}>
                      {port.status === 'error' ? 'Retry' : 'Redo'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
