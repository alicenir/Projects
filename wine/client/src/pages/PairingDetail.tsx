import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { queryString, useApi } from '../lib/api';
import type { WineCard } from '../lib/api';
import { BarList, Figure } from '../components/charts';
import { ErrorState, Loading, SectionTitle, WineGrid } from '../components/ui';
import { num, pairingIcon, typeColor, TYPE_ORDER } from '../lib/format';

type Payload = {
  pairing: string;
  types: { type: string; wines: number; score: number | null }[];
  grapes: { name: string; wines: number }[];
  wines: WineCard[];
};

export default function PairingDetail() {
  const { name } = useParams();
  const [type, setType] = useState('');
  const { data, error, loading, refetching } = useApi<Payload>(
    name ? `/pairings/${encodeURIComponent(name)}${queryString({ type })}` : null,
    [name, type],
  );

  if (error) return <ErrorState error={error} />;
  if (loading || !data) return <Loading />;

  return (
    <div className="flex flex-col gap-6">
      <header className="card flex flex-col gap-3 p-5">
        <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight text-ink">
          <span aria-hidden>{pairingIcon(data.pairing)}</span> {data.pairing}
        </h1>
        <p className="text-sm text-ink-2">
          {data.types.reduce((s, t) => s + t.wines, 0).toLocaleString()} wines in the catalogue are tagged for this dish.
          Filter by style, then work down the list — it is sorted by weighted rating.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={`chip ${type === '' ? 'chip-active' : ''}`} onClick={() => setType('')}>
            All styles
          </button>
          {TYPE_ORDER.filter((t) => data.types.some((x) => x.type === t)).map((t) => (
            <button key={t} type="button" className={`chip ${type === t ? 'chip-active' : ''}`} onClick={() => setType(t)}>
              <span className="h-2 w-2 rounded-full" style={{ background: typeColor(t) }} />
              {t}
            </button>
          ))}
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Figure
          title="Which styles get tagged for it"
          subtitle="Wines per style, with their weighted rating"
          table={{ columns: ['Style', 'Wines', 'Score'], rows: data.types.map((t) => [t.type, t.wines, num(t.score, 2)]) }}
        >
          <BarList
            rows={data.types.map((t) => ({ label: t.type, value: t.wines, color: typeColor(t.type), note: `avg ${num(t.score, 2)}` }))}
            format={(v) => `${v}`}
          />
        </Figure>
        <Figure
          title="Grapes that show up"
          subtitle="Most common varieties tagged for this dish"
          table={{ columns: ['Grape', 'Wines'], rows: data.grapes.map((g) => [g.name, g.wines]) }}
        >
          <BarList rows={data.grapes.map((g) => ({ label: g.name, value: g.wines }))} format={(v) => `${v}`} />
        </Figure>
      </div>

      <section className={refetching ? 'is-refetching' : undefined}>
        <SectionTitle title="Open one of these" hint="Highest weighted rating among wines tagged for this dish." />
        <WineGrid wines={data.wines} />
      </section>
    </div>
  );
}
