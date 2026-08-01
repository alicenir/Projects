import { TESLA_COLORS } from '../data/colors'

interface Props {
  selectedId: string
  customHex: string
  customName: string
  onSelect: (id: string) => void
  onCustomHexChange: (hex: string) => void
  onCustomNameChange: (name: string) => void
}

export function ColorPicker({
  selectedId,
  customHex,
  customName,
  onSelect,
  onCustomHexChange,
  onCustomNameChange,
}: Props) {
  const isCustom = selectedId === 'custom'

  return (
    <section className="card">
      <h2>3. What color is your car?</h2>
      <p className="hint">
        Every wrap is generated to harmonize with your car's actual factory paint, so the theme art and the visible
        painted panels feel like one cohesive design instead of clashing.
      </p>
      <div className="swatch-row">
        {TESLA_COLORS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`swatch ${selectedId === c.id ? 'selected' : ''}`}
            style={{ background: c.id === 'custom' ? undefined : c.hex }}
            onClick={() => onSelect(c.id)}
            title={c.name}
          >
            {c.id === 'custom' && <span className="swatch-custom-icon">🎨</span>}
          </button>
        ))}
      </div>
      <div className="swatch-labels">
        <span className="active-label">{TESLA_COLORS.find((c) => c.id === selectedId)?.name}</span>
      </div>
      {isCustom && (
        <div className="row">
          <label className="field">
            <span>Custom color name</span>
            <input
              type="text"
              value={customName}
              onChange={(e) => onCustomNameChange(e.target.value)}
              placeholder="e.g. Midnight Cherry"
            />
          </label>
          <label className="field">
            <span>Custom color swatch</span>
            <input type="color" value={customHex} onChange={(e) => onCustomHexChange(e.target.value)} />
          </label>
        </div>
      )}
    </section>
  )
}
