import { WRAP_THEMES, WRAP_INTENSITIES, type WrapIntensity } from '../data/themes'

interface Props {
  themeId: string
  themeDetail: string
  intensity: WrapIntensity
  onThemeChange: (id: string) => void
  onThemeDetailChange: (detail: string) => void
  onIntensityChange: (intensity: WrapIntensity) => void
}

export function ThemeSelector({
  themeId,
  themeDetail,
  intensity,
  onThemeChange,
  onThemeDetailChange,
  onIntensityChange,
}: Props) {
  const theme = WRAP_THEMES.find((t) => t.id === themeId) ?? WRAP_THEMES[0]

  return (
    <section className="card">
      <h2>4. Pick a wrap theme</h2>
      <div className="chip-row">
        {WRAP_THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`chip ${themeId === t.id ? 'selected' : ''}`}
            onClick={() => onThemeChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {theme.examples.length > 0 && (
        <div className="chip-row small">
          {theme.examples.map((ex) => (
            <button
              key={ex}
              type="button"
              className={`chip outline ${themeDetail === ex ? 'selected' : ''}`}
              onClick={() => onThemeDetailChange(ex)}
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      <label className="field">
        <span>{theme.id === 'custom' ? 'Describe your custom theme' : 'Specific title / franchise (optional)'}</span>
        <input
          type="text"
          value={themeDetail}
          onChange={(e) => onThemeDetailChange(e.target.value)}
          placeholder={theme.id === 'custom' ? 'e.g. Retro synthwave grid with neon palm trees' : 'e.g. Cyberpunk 2077'}
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
