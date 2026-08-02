import type { TeslaModel } from '../data/models'
import type { WrapGenerationState, MockupState } from '../types'

interface Props {
  model: TeslaModel
  templateUrl: string | null
  state: WrapGenerationState
  canGenerate: boolean
  hasDescription: boolean
  onGenerate: () => void
  onAiWrapGeneration: () => void
  onDownload: () => void
  mockup: MockupState
  onPreviewOnCar: () => void
}

export function WrapPreview({
  model,
  templateUrl,
  state,
  canGenerate,
  hasDescription,
  onGenerate,
  onAiWrapGeneration,
  onDownload,
  mockup,
  onPreviewOnCar,
}: Props) {
  const busy = state.status === 'loading-concept' || state.status === 'loading-image'

  return (
    <section className="card">
      <h2>5. Generate &amp; preview</h2>
      <p className="hint">
        Generation edits Tesla's own official <strong>{model.name}</strong> template, then clips the result to that
        template's exact panel shapes. Artwork can only ever land on real body panels — the glass roof and
        everything between the panels comes out transparent, guaranteed, no matter what the AI draws. The focal
        subject of your design is placed on the hood, oriented toward the top of the template — which is the nose of
        the car, so it faces forward once applied.
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
        {state.status === 'done' && (
          <button
            type="button"
            className="ghost-btn"
            disabled={mockup.status === 'loading'}
            onClick={onPreviewOnCar}
          >
            {mockup.status === 'loading' ? 'Rendering…' : '🚗 Preview on car'}
          </button>
        )}
      </div>

      {mockup.status !== 'idle' && (
        <div className="mockup">
          <span className="preview-label">On-car preview</span>
          <div className="preview-frame mockup-frame">
            {mockup.status === 'loading' && (
              <div className="panel-loading">
                <div className="spinner" />
                <p>Rendering the car…</p>
              </div>
            )}
            {mockup.status === 'done' && mockup.dataUrl && (
              <img src={mockup.dataUrl} alt={`${model.name} wearing the generated wrap`} />
            )}
            {mockup.status === 'error' && <div className="panel-error">{mockup.error}</div>}
          </div>
          {mockup.status === 'done' && (
            <p className="meta">
              Illustrative only — the AI has no panel-mapping data, so seams won't be exact. Your car's Paint Shop
              renders the real thing.
            </p>
          )}
        </div>
      )}
      <p className="hint small-print">
        <strong>Generate Wrap</strong> uses exactly what you typed above. <strong>AI Wrap Generation</strong> invents
        a full concept for you — instantly, or shaped by any hints you've already typed — then generates it.
      </p>
    </section>
  )
}
