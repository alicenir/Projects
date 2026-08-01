import { WRAP_PANELS } from '../data/models'
import type { PanelStateMap } from '../types'

interface Props {
  panelStates: PanelStateMap
  canGenerate: boolean
  onGenerate: (panelId: string) => void
  onDownload: (panelId: string) => void
}

export function PanelGrid({ panelStates, canGenerate, onGenerate, onDownload }: Props) {
  return (
    <section className="card">
      <h2>5. Generate each panel</h2>
      <p className="hint">
        The roof is always excluded below — it's glass, so it never gets an image or background. The frunk/hood
        panel is always prompted to keep its artwork facing toward the front of the car.
      </p>
      <div className="panel-grid">
        {WRAP_PANELS.map((panel) => {
          const state = panelStates[panel.id] ?? { status: 'idle' }
          return (
            <div key={panel.id} className={`panel-card ${panel.disabled ? 'disabled' : ''}`}>
              <div className="panel-card-head">
                <strong>{panel.label}</strong>
                <span className="muted">{panel.description}</span>
              </div>

              {panel.disabled ? (
                <div className="panel-locked">
                  <span className="lock-icon">🔒</span>
                  <p>{panel.disabledReason}</p>
                </div>
              ) : (
                <>
                  <div className="panel-preview">
                    {state.status === 'loading' && <div className="spinner" aria-label="Generating" />}
                    {state.status === 'done' && state.dataUrl && (
                      <img src={state.dataUrl} alt={`${panel.label} wrap preview`} />
                    )}
                    {state.status === 'error' && <div className="panel-error">{state.error}</div>}
                    {state.status === 'idle' && <div className="panel-empty">No wrap generated yet</div>}
                  </div>

                  {state.status === 'done' && state.width && (
                    <p className="meta">
                      {state.width}×{state.height}px PNG · {((state.sizeBytes ?? 0) / 1024).toFixed(0)} KB
                    </p>
                  )}

                  <div className="panel-actions">
                    <button
                      type="button"
                      disabled={!canGenerate || state.status === 'loading'}
                      onClick={() => onGenerate(panel.id)}
                    >
                      {state.status === 'loading'
                        ? 'Generating…'
                        : state.status === 'done'
                          ? 'Regenerate'
                          : 'Generate'}
                    </button>
                    {state.status === 'done' && (
                      <button type="button" className="ghost-btn" onClick={() => onDownload(panel.id)}>
                        Download PNG
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
