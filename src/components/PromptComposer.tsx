import { WRAP_THEMES, WRAP_INTENSITIES, type WrapIntensity } from '../data/themes'
import { TEXT_PLACEMENTS, type TextPlacementId } from '../data/textPlacements'

const MAX_PROMPT_LENGTH = 4000
const MAX_CUSTOM_TEXT = 40

interface Props {
  description: string
  intensity: WrapIntensity
  customText: string
  customTextPlacement: TextPlacementId
  customTextExact: boolean
  onDescriptionChange: (description: string) => void
  onIntensityChange: (intensity: WrapIntensity) => void
  onCustomTextChange: (text: string) => void
  onCustomTextPlacementChange: (placement: TextPlacementId) => void
  onCustomTextExactChange: (exact: boolean) => void
}

export function PromptComposer({
  description,
  intensity,
  customText,
  customTextPlacement,
  customTextExact,
  onDescriptionChange,
  onIntensityChange,
  onCustomTextChange,
  onCustomTextPlacementChange,
  onCustomTextExactChange,
}: Props) {
  function addTitle(title: string) {
    if (!title) return
    // Only the first pick needs to set the scene; later ones just name another
    // influence instead of repeating the whole opening phrase.
    if (description.trim()) {
      insertIdea(`Inspired by "${title}"`)
      return
    }
    const category = WRAP_THEMES.find((t) => t.examples.includes(title))
    const label = category?.label.toLowerCase() ?? 'custom'
    const article = /^[aeiou]/i.test(label) ? 'An' : 'A'
    insertIdea(`${article} ${label} themed wrap inspired by "${title}"`)
  }

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
        Pick a category and a title for a quick starting point, or just write exactly what you want below. Long,
        detailed prompts are welcome.
      </p>

      <label className="field">
        <span>Add a theme to your prompt</span>
        {/*
          One grouped list rather than a category dropdown feeding a title
          dropdown. Splitting them hid every title behind the right category
          guess — you had to already know that Formula 1 lives under Motorsport
          before you could find it. Grouped options keep the categories visible
          while making the whole catalogue browsable, and native selects
          type-to-search across all of it.
        */}
        <select value="" onChange={(e) => addTitle(e.target.value)}>
          <option value="">Choose a theme…</option>
          {WRAP_THEMES.filter((t) => t.examples.length > 0).map((t) => (
            <optgroup key={t.id} label={t.label}>
              {t.examples.map((ex) => (
                <option key={ex} value={ex}>
                  {ex}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <div className="field">
        <div className="field-header">
          <span>
            Prompt description ({description.length} / {MAX_PROMPT_LENGTH})
          </span>
          <button
            type="button"
            className="clear-btn"
            disabled={!description}
            onClick={() => onDescriptionChange('')}
          >
            Clear
          </button>
        </div>
        <textarea
          value={description}
          maxLength={MAX_PROMPT_LENGTH}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="e.g. A cyberpunk cityscape at night, neon pink and cyan lighting reflecting off wet streets, holographic billboards with Japanese katakana, flying cars in the distance, cinematic Blade Runner mood..."
          rows={6}
        />
      </div>

      <div className="row">
        <label className="field">
          <span>
            Custom text on the wrap (optional, {customText.length}/{MAX_CUSTOM_TEXT})
          </span>
          <input
            type="text"
            value={customText}
            maxLength={MAX_CUSTOM_TEXT}
            onChange={(e) => onCustomTextChange(e.target.value)}
            placeholder="e.g. Tesla Camping Trip"
          />
        </label>
        <label className="field">
          <span>Where to put it</span>
          <select
            value={customTextPlacement}
            disabled={!customText.trim()}
            onChange={(e) => onCustomTextPlacementChange(e.target.value as TextPlacementId)}
          >
            {TEXT_PLACEMENTS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {customText.trim() && (
        <div className="text-mode">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={customTextExact}
              onChange={(e) => onCustomTextExactChange(e.target.checked)}
            />
            <span>Draw the text exactly (recommended)</span>
          </label>
          <p className="hint model-note">
            {customTextExact
              ? 'Lettering is drawn onto the finished wrap after generation, so the spelling and placement are always right. It reads as cleanly applied vinyl rather than artwork woven into the design.'
              : '⚠ The image model will draw the lettering as part of the artwork — better integrated, but it frequently misspells or omits text. Check the result carefully.'}
          </p>
        </div>
      )}

      <label className="field">
        <span>Coverage intensity</span>
        <select value={intensity} onChange={(e) => onIntensityChange(e.target.value as WrapIntensity)}>
          {WRAP_INTENSITIES.map((i) => (
            <option key={i.id} value={i.id}>
              {i.label} — {i.description}
            </option>
          ))}
        </select>
      </label>
    </section>
  )
}
