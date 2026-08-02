import { TESLA_MODELS } from '../data/models'

interface Props {
  selectedId: string
  onSelect: (id: string) => void
}

export function ModelSelector({ selectedId, onSelect }: Props) {
  return (
    <section className="card">
      <h2>2. Choose your Tesla</h2>
      <p className="hint">
        Vehicles and thumbnails are pulled live from{' '}
        <a href="https://github.com/teslamotors/custom-wraps" target="_blank" rel="noreferrer">
          teslamotors/custom-wraps
        </a>
        , using their exact names.
      </p>
      <div className="grid-cards vehicle-grid">
        {TESLA_MODELS.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`pick-card vehicle-card ${selectedId === m.id ? 'selected' : ''}`}
            onClick={() => onSelect(m.id)}
          >
            <img src={m.vehicleImageUrl} alt={m.name} loading="lazy" />
            <strong>{m.name}</strong>
            {m.subtitle && <span className="muted">{m.subtitle}</span>}
          </button>
        ))}
      </div>
    </section>
  )
}
