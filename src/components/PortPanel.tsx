import { TESLA_MODELS, type TeslaModel } from '../data/models'
import type { PortedWrap } from '../types'

interface Props {
  sourceModel: TeslaModel
  ports: Record<string, PortedWrap>
  busy: boolean
  /** Progress of a running "all models" batch, or null when none is running. */
  portAll: { done: number; total: number } | null
  onPort: (modelId: string) => void
  onPortAll: () => void
  onStopPortAll: () => void
  onDownload: (modelId: string) => void
  onDownloadAll: () => void
}

export function PortPanel({
  sourceModel,
  ports,
  busy,
  portAll,
  onPort,
  onPortAll,
  onStopPortAll,
  onDownload,
  onDownloadAll,
}: Props) {
  const targets = TESLA_MODELS.filter((m) => m.id !== sourceModel.id)
  const ported = targets.filter((m) => ports[m.id])
  const doneCount = targets.filter((m) => ports[m.id]?.status === 'done').length
  const remaining = targets.length - doneCount

  return (
    <section className="card">
      <h2>6. Use this design on another Tesla</h2>
      <p className="hint">
        Every model has its own panel layout, so the same PNG can't just be reused — the panels sit in different
        places. Pick another vehicle and the design is redrawn onto its template, keeping the same colours, motifs
        and style. One image call per model; results stay here so you can do several.
      </p>

      <div className="panel-actions port-all">
        {portAll ? (
          <button type="button" className="ghost-btn" onClick={onStopPortAll}>
            Stop after current ({portAll.done}/{portAll.total})
          </button>
        ) : (
          <button type="button" disabled={busy || remaining === 0} onClick={onPortAll}>
            {remaining === 0
              ? 'All models done ✓'
              : doneCount > 0
                ? `Redraw for remaining ${remaining} ${remaining === 1 ? 'model' : 'models'}`
                : `Redraw for all ${remaining} models`}
          </button>
        )}
        <button type="button" className="ghost-btn" disabled={doneCount === 0} onClick={onDownloadAll}>
          Download all (.zip{doneCount > 0 ? `, ${doneCount + 1} wraps` : ''})
        </button>
      </div>
      {!portAll && remaining > 0 && (
        <p className="meta">
          Runs one model at a time and uses {remaining} image calls, which can be most of a free-tier daily quota.
          If it stops on a quota error, press it again later to pick up where it left off.
        </p>
      )}

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
