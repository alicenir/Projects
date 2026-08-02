import type { TeslaModel } from '../data/models'
import type { WrapGenerationState } from '../types'

interface Props {
  model: TeslaModel
  templateUrl: string | null
  state: WrapGenerationState
  canGenerate: boolean
  hasDescription: boolean
  libraryAvailable: boolean
  saveStatus: 'idle' | 'saving' | 'saved'
  onGenerate: () => void
  onAiWrapGeneration: () => void
  onDownload: () => void
  onSaveToNas: () => void
}

export function WrapPreview({
  model,
  templateUrl,
  state,
  canGenerate,
  hasDescription,
  libraryAvailable,
  saveStatus,
  onGenerate,
  onAiWrapGeneration,
  onDownload,
  onSaveToNas,
}: Props) {
  const busy = state.status === 'loading-concept' || state.status === 'loading-image'

  return (
    <section className="card">
      <h2>5. Generate &amp; preview</h2>
      <p className="hint">
        Generation edits Tesla's own official <strong>{model.name}</strong> template in place, so the design always
        lands inside the real panel outlines. That template has no roof region at all — Tesla's own visualizer
        always renders the glass roof on top of any wrap — so the roof can never end up with an image or background
        here, by construction.
      </p>

      <div className="preview-columns">
        <div className="preview-box">
          <span className="preview-label">Official template (reference)</span>
          <div className="preview-frame">
            {templateUrl ? <img src={templateUrl} alt={`${model.name} wrap template`} /> : <div className="spinner" />}
          </div>
        </div>

        <div className="preview-box wide">
          <span className="preview-label">Generated wrap preview</span>
          <div className="preview-frame">
            {state.status === 'loading-concept' && (
              <div className="panel-loading">
                <div className="spinner" />
                <p>Inventing a concept…</p>
              </div>
            )}
            {state.status === 'loading-image' && (
              <div className="panel-loading">
                <div className="spinner" />
                <p>Painting the template…</p>
              </div>
            )}
            {state.status === 'done' && state.dataUrl && <img src={state.dataUrl} alt={`${model.name} generated wrap`} />}
            {state.status === 'error' && <div className="panel-error">{state.error}</div>}
            {state.status === 'idle' && <div className="panel-empty">Your generated wrap will appear here</div>}
          </div>
          {state.status === 'done' && state.width && (
            <p className="meta">
              {state.width}×{state.height}px PNG · {((state.sizeBytes ?? 0) / 1024).toFixed(0)} KB
            </p>
          )}
        </div>
      </div>

      <div className="panel-actions generate-actions">
        <button type="button" disabled={!canGenerate || !hasDescription || busy} onClick={onGenerate}>
          {busy ? 'Working…' : 'Generate Wrap'}
        </button>
        <button type="button" className="ghost-btn ai-btn" disabled={!canGenerate || busy} onClick={onAiWrapGeneration}>
          ✨ AI Wrap Generation
        </button>
        {state.status === 'done' && (
          <button type="button" className="ghost-btn" onClick={onDownload}>
            Download PNG
          </button>
        )}
        {state.status === 'done' && libraryAvailable && (
          <button type="button" className="ghost-btn" disabled={saveStatus !== 'idle'} onClick={onSaveToNas}>
            {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? '✓ Saved' : 'Save to NAS'}
          </button>
        )}
      </div>
      <p className="hint small-print">
        <strong>Generate Wrap</strong> uses exactly what you typed above. <strong>AI Wrap Generation</strong> invents
        a full concept for you — instantly, or shaped by any hints you've already typed — then generates it.
      </p>
    </section>
  )
}
