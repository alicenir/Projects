import { useState } from 'react'
import { WRAP_THEMES, WRAP_INTENSITIES, type WrapIntensity } from '../data/themes'

const MAX_PROMPT_LENGTH = 4000

interface Props {
  description: string
  intensity: WrapIntensity
  onDescriptionChange: (description: string) => void
  onIntensityChange: (intensity: WrapIntensity) => void
}

export function PromptComposer({ description, intensity, onDescriptionChange, onIntensityChange }: Props) {
  // Which category's titles are listed. Purely a filter for the picker below —
  // nothing is added to the prompt until a title is actually chosen.
  const [categoryId, setCategoryId] = useState(WRAP_THEMES[0].id)
  const category = WRAP_THEMES.find((t) => t.id === categoryId) ?? WRAP_THEMES[0]

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

      <div className="row">
        <label className="field">
          <span>Theme category</span>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {WRAP_THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Add a title to your prompt</span>
          <select
            value=""
            disabled={category.examples.length === 0}
            onChange={(e) => {
              const title = e.target.value
              if (!title) return
              // Only the first pick needs to set the scene; later ones just name
              // another influence instead of repeating the whole phrase.
              if (description.trim()) {
                insertIdea(`Inspired by "${title}"`)
                return
              }
              const article = /^[aeiou]/i.test(category.label) ? 'An' : 'A'
              insertIdea(`${article} ${category.label.toLowerCase()} themed wrap inspired by "${title}"`)
            }}
          >
            <option value="">
              {category.examples.length ? 'Choose a title…' : 'Type your own description below'}
            </option>
            {category.examples.map((ex) => (
              <option key={ex} value={ex}>
                {ex}
              </option>
            ))}
          </select>
        </label>
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
