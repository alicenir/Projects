import { Link, useParams } from 'react-router-dom';
import { useApi } from '../lib/api';
import type { WineCard } from '../lib/api';
import { BarList, Figure, StatTile } from '../components/charts';
import { ErrorState, Loading, SectionTitle, WineGrid } from '../components/ui';
import { compact, flag, num } from '../lib/format';

type Payload = {
  region: {
    id: number; name: string; country: string; country_code: string; wine_count: number;
    winery_count: number; rating_count: number; rating_avg: number | null; rating_score: number | null;
    top_grape: string | null; top_type: string | null;
  };
  wines: WineCard[];
  grapes: { name: string; wines: number }[];
  wineries: { id: number; name: string; wine_count: number; rating_avg: number | null; rating_score: number | null }[];
};

export default function RegionDetail() {
  const { id } = useParams();
  const { data, error, loading } = useApi<Payload>(id ? `/regions/${id}` : null, [id]);
  if (error) return <ErrorState error={error} />;
  if (loading || !data) return <Loading />;
  const r = data.region;

  return (
    <div className="flex flex-col gap-6">
      <header className="card flex flex-col gap-2 p-5">
        <p className="text-xs text-ink-2">
          <Link to={`/atlas/${r.country_code}`} className="hover:text-accent">
            {flag(r.country_code)} {r.country}
          </Link>
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">{r.name}</h1>
        <p className="text-sm text-ink-2">
          {r.wine_count} wines from {r.winery_count} producers · mostly {r.top_type?.toLowerCase() ?? 'mixed'} · signature grape {r.top_grape ?? '—'}
        </p>
        <Link to={`/explore?region=${r.id}`} className="btn btn-primary self-start">Browse the region</Link>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Average rating" value={num(r.rating_avg, 2)} note={`${compact(r.rating_count)} ratings`} />
        <StatTile label="Weighted score" value={num(r.rating_score, 2)} note="shrunk to the global mean" />
        <StatTile label="Wines" value={String(r.wine_count)} />
        <StatTile label="Producers" value={String(r.winery_count)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Figure title="Grapes planted" subtitle="Varieties across the region's wines"
          table={{ columns: ['Grape', 'Wines'], rows: data.grapes.map((g) => [g.name, g.wines]) }}>
          <BarList rows={data.grapes.map((g) => ({ label: g.name, value: g.wines }))} format={(v) => `${v}`} />
        </Figure>
        <Figure title="Producers to know" subtitle="Ranked by weighted rating"
          table={{ columns: ['Producer', 'Wines', 'Average'], rows: data.wineries.map((w) => [w.name, w.wine_count, num(w.rating_avg, 2)]) }}>
          <BarList
            rows={data.wineries.filter((w) => w.rating_score !== null).slice(0, 12)
              .map((w) => ({ label: w.name, value: w.rating_score ?? 0, note: `${w.wine_count} wines` }))}
            max={5}
            format={(v) => v.toFixed(2)}
          />
        </Figure>
      </div>

      <section>
        <SectionTitle title="Wines from here" />
        <WineGrid wines={data.wines} />
      </section>
    </div>
  );
}
