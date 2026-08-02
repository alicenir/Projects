import { WRAP_THEMES, WRAP_INTENSITIES, type WrapIntensity } from '../data/themes'

const MAX_PROMPT_LENGTH = 4000

interface Props {
  description: string
  intensity: WrapIntensity
  onDescriptionChange: (description: string) => void
  onIntensityChange: (intensity: WrapIntensity) => void
}

export function PromptComposer({ description, intensity, onDescriptionChange, onIntensityChange }: Props) {
  function insertIdea(text: string) {
    if (!description.trim()) {
      onDescriptionChange(text)
      return
    }
    const next = `${description.trim()}. ${text}`
    onDescriptionChange(next.slice(0, MAX_PROMPT_LENGTH))
  }

  return (
    <section className="card">
      <h2>4. Describe your wrap</h2>
      <p className="hint">
        Pick a category for quick ideas — gaming, movies, TV shows, and more — or just write exactly what you want
        below. Long, detailed prompts are welcome.
      </p>

      <div className="chip-row">
        {WRAP_THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            className="chip"
            onClick={() => insertIdea(t.id === 'custom' ? '' : `A ${t.label.toLowerCase()} themed wrap`)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="chip-row small">
        {WRAP_THEMES.flatMap((t) => t.examples).map((ex) => (
          <button key={ex} type="button" className="chip outline" onClick={() => insertIdea(`Inspired by "${ex}"`)}>
            {ex}
          </button>
        ))}
      </div>

      <label className="field">
        <span>
          Prompt description ({description.length} / {MAX_PROMPT_LENGTH})
        </span>
        <textarea
          value={description}
          maxLength={MAX_PROMPT_LENGTH}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="e.g. A cyberpunk cityscape at night, neon pink and cyan lighting reflecting off wet streets, holographic billboards with Japanese katakana, flying cars in the distance, cinematic Blade Runner mood..."
          rows={6}
        />
      </label>

      <div className="field">
        <span>Coverage intensity</span>
        <div className="chip-row small">
          {WRAP_INTENSITIES.map((i) => (
            <button
              key={i.id}
              type="button"
              className={`chip outline ${intensity === i.id ? 'selected' : ''}`}
              onClick={() => onIntensityChange(i.id)}
              title={i.description}
            >
              {i.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
