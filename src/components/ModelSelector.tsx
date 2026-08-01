import { TESLA_MODELS } from '../data/models'

interface Props {
  selectedId: string
  onSelect: (id: string) => void
}

export function ModelSelector({ selectedId, onSelect }: Props) {
  return (
    <section className="card">
      <h2>2. Choose your Tesla model</h2>
      <div className="grid-cards">
        {TESLA_MODELS.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`pick-card ${selectedId === m.id ? 'selected' : ''}`}
            onClick={() => onSelect(m.id)}
          >
            <strong>{m.name}</strong>
            <span>{m.years}</span>
            <span className="muted">{m.bodyStyle}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
