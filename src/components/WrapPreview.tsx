import type { TeslaModel } from '../data/models'
import { VIEW_ANGLES } from '../data/viewAngles'
import type { WrapGenerationState, MockupState, HoodRotation } from '../types'

const ROTATIONS: HoodRotation[] = [0, 90, 180, 270]

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
  onRotateView: (step: number) => void
  hoodRotation: HoodRotation
  onHoodRotation: (degrees: HoodRotation) => void
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
  onRotateView,
  hoodRotation,
  onHoodRotation,
}: Props) {
  const busy = state.status === 'loading-concept' || state.status === 'loading-image'
  const view = mockup.views[mockup.active]
  const busyView = Object.values(mockup.views).some((v) => v.status === 'loading')

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
          {state.status === 'done' && (
            <div className="rotate-row">
              <span className="preview-label">Frunk artwork rotation</span>
              <div className="chip-row small">
                {ROTATIONS.map((deg) => (
                  <button
                    key={deg}
                    type="button"
                    className={`chip outline ${hoodRotation === deg ? 'selected' : ''}`}
                    onClick={() => onHoodRotation(deg)}
                  >
                    {deg}°
                  </button>
                ))}
              </div>
            </div>
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
            disabled={busyView}
            onClick={onPreviewOnCar}
          >
            {busyView ? 'Rendering…' : '🚗 Preview on car'}
          </button>
        )}
      </div>

      {mockup.open && (
        <div className="mockup">
          <span className="preview-label">
            On-car preview — {VIEW_ANGLES[mockup.active].label} ({mockup.active + 1}/{VIEW_ANGLES.length})
          </span>

          <div className="mockup-stage">
            <button
              type="button"
              className="ghost-btn rotate-arrow"
              onClick={() => onRotateView(-1)}
              disabled={busyView}
              aria-label="Rotate left"
            >
              ‹
            </button>

            <div
              className={`preview-frame mockup-frame ${view?.status === 'done' ? 'clickable' : ''}`}
              onClick={() => view?.status === 'done' && !busyView && onRotateView(1)}
              title={view?.status === 'done' ? 'Click to turn the car' : undefined}
            >
              {view?.status === 'loading' && (
                <div className="panel-loading">
                  <div className="spinner" />
                  <p>Rendering {VIEW_ANGLES[mockup.active].label.toLowerCase()}…</p>
                </div>
              )}
              {view?.status === 'done' && view.dataUrl && (
                <img src={view.dataUrl} alt={`${model.name} wearing the generated wrap, ${VIEW_ANGLES[mockup.active].label}`} />
              )}
              {view?.status === 'error' && <div className="panel-error">{view.error}</div>}
            </div>

            <button
              type="button"
              className="ghost-btn rotate-arrow"
              onClick={() => onRotateView(1)}
              disabled={busyView}
              aria-label="Rotate right"
            >
              ›
            </button>
          </div>

          <div className="chip-row small angle-row">
            {VIEW_ANGLES.map((a, i) => (
              <button
                key={a.label}
                type="button"
                className={`chip outline ${mockup.active === i ? 'selected' : ''}`}
                disabled={busyView}
                onClick={() => onRotateView(i - mockup.active)}
              >
                {a.label}
                {mockup.views[i]?.status === 'done' ? '' : ' •'}
              </button>
            ))}
          </div>

          <p className="meta">
            Click the car or the arrows to turn it. Angles marked • haven't been rendered yet and cost one image
            call each; once rendered they're cached and free to revisit. Illustrative only — the AI has no
            panel-mapping data, so seams won't be exact.
          </p>
        </div>
      )}
      <p className="hint small-print">
        <strong>Generate Wrap</strong> uses exactly what you typed above. <strong>AI Wrap Generation</strong> invents
        a full concept for you — instantly, or shaped by any hints you've already typed — then generates it.
      </p>
    </section>
  )
}
