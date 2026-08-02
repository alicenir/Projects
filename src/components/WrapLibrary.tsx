import { wrapUrl, type SavedWrap } from '../lib/wrapLibrary'

interface Props {
  wraps: SavedWrap[]
  error: string | null
  onDelete: (name: string) => void
}

export function WrapLibrary({ wraps, error, onDelete }: Props) {
  return (
    <section className="card">
      <h2>6. Saved on your NAS</h2>
      <p className="hint">
        Wraps you save are written to the folder mounted into this container, so they're reachable from any device on
        your network — generate on your phone, then grab them from a computer to copy onto a USB drive.
      </p>

      {error && <p className="hint error-text">{error}</p>}

      {wraps.length === 0 ? (
        <p className="panel-empty">Nothing saved yet. Generate a wrap, then hit “Save to NAS”.</p>
      ) : (
        <div className="library-grid">
          {wraps.map((w) => (
            <div key={w.name} className="library-card">
              <a href={wrapUrl(w.name)} target="_blank" rel="noreferrer" className="library-thumb">
                <img src={wrapUrl(w.name)} alt={w.name} loading="lazy" />
              </a>
              <strong title={w.name}>{w.name.replace(/\.png$/i, '')}</strong>
              <span className="meta">
                {(w.size / 1024).toFixed(0)} KB · {new Date(w.modified).toLocaleDateString()}
              </span>
              <div className="panel-actions">
                <a className="ghost-btn link-btn" href={wrapUrl(w.name)} download={w.name}>
                  Download
                </a>
                <button type="button" className="ghost-btn danger-btn" onClick={() => onDelete(w.name)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
