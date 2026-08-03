import { BRIEF_QUESTIONS, DEFAULT_BRIEF, type BriefAnswers } from '../data/conceptBrief'

interface Props {
  answers: BriefAnswers
  existingPrompt: string
  onChange: (answers: BriefAnswers) => void
  onCancel: () => void
  onGenerate: () => void
}

export function ConceptDialog({ answers, existingPrompt, onChange, onCancel, onGenerate }: Props) {
  const untouched = BRIEF_QUESTIONS.every((q) => answers[q.key] === DEFAULT_BRIEF[q.key])

  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h3>What sort of wrap would you like?</h3>
        <p className="hint">
          All optional — leave everything on “Surprise me” for a completely random concept. The AI writes the full
          design brief from your answers, then generates it.
        </p>

        {existingPrompt.trim() && (
          <p className="hint model-note">
            Your existing prompt will also be used as a starting point: “{existingPrompt.trim().slice(0, 90)}
            {existingPrompt.trim().length > 90 ? '…' : ''}”
          </p>
        )}

        <div className="dialog-grid">
          {BRIEF_QUESTIONS.map((q) => (
            <label key={q.key} className="field">
              <span>{q.label}</span>
              <select value={answers[q.key]} onChange={(e) => onChange({ ...answers, [q.key]: e.target.value })}>
                {q.options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>

        <div className="panel-actions">
          <button type="button" className="ghost-btn" onClick={() => onChange(DEFAULT_BRIEF)} disabled={untouched}>
            Reset
          </button>
          <button type="button" className="ghost-btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" onClick={onGenerate}>
            ✨ Generate
          </button>
        </div>
      </div>
    </div>
  )
}
