import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApi } from '../lib/api';
import { ErrorState, Loading, SectionTitle } from '../components/ui';
import { Stars } from '../components/charts';
import { compact, money, num, slug, typeColor } from '../lib/format';

type Grape = {
  name: string;
  wine_count: number;
  varietal_count: number;
  rating_count: number;
  rating_avg: number | null;
  abv_avg: number | null;
  top_type: string | null;
  top_country: string | null;
  top_body: string | null;
  countries: { name: string; count: number }[];
  critic_n: number;
  critic_points: number | null;
  critic_price: number | null;
};

const SORTS = [
  { value: 'wines', label: 'Most wines' },
  { value: 'rating', label: 'Best rated' },
  { value: 'critic', label: 'Highest critic score' },
  { value: 'price', label: 'Priciest' },
  { value: 'name', label: 'A–Z' },
];

export default function Grapes() {
  const [params, setParams] = useSearchParams();
  const [sort, setSort] = useState('wines');
  const q = params.get('q') ?? '';
  const { data, error, loading } = useApi<Grape[]>('/grapes');

  const rows = useMemo(() => {
    const list = (data ?? []).filter((g) => !q || g.name.toLowerCase().includes(q.toLowerCase()));
    const by: Record<string, (a: Grape, b: Grape) => number> = {
      wines: (a, b) => b.wine_count - a.wine_count,
      rating: (a, b) => (b.rating_avg ?? 0) - (a.rating_avg ?? 0),
      critic: (a, b) => (b.critic_points ?? 0) - (a.critic_points ?? 0),
      price: (a, b) => (b.critic_price ?? 0) - (a.critic_price ?? 0),
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return list.sort(by[sort]);
  }, [data, q, sort]);

  if (error) return <ErrorState error={error} />;
  if (loading || !data) return <Loading label="Walking the vineyard…" />;

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle title="Grape encyclopedia" hint={`${data.length} varieties in the catalogue, with critic scores and prices attached.`} />

      <div className="card flex flex-wrap items-end gap-3 p-3">
        <label className="flex flex-col gap-1">
          <span className="label">Find a grape</span>
          <input
            className="field w-56"
            placeholder="Nebbiolo…"
            value={q}
            onChange={(e) =>
              setParams((p) => {
                const next = new URLSearchParams(p);
                if (e.target.value) next.set('q', e.target.value);
                else next.delete('q');
                return next;
              }, { replace: true })
            }
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">Sort</span>
          <select className="field w-52" value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((g) => (
          <Link key={g.name} to={`/grapes/${slug(g.name)}`} className="card flex flex-col gap-2 p-4 transition-colors hover:border-accent">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-base font-semibold leading-tight text-ink">{g.name}</h3>
              {g.top_type && (
                <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-ink-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: typeColor(g.top_type) }} />
                  {g.top_type}
                </span>
              )}
            </div>
            <p className="text-xs text-ink-2">
              {g.wine_count} wines · mostly {g.top_country ?? '—'} · {g.top_body?.toLowerCase() ?? 'style varies'}
            </p>
            <div className="flex items-center gap-2">
              <Stars value={g.rating_avg} />
              <span className="text-xs tabular-nums text-ink-2">{num(g.rating_avg, 2)}</span>
              <span className="text-[11px] text-muted">({compact(g.rating_count)})</span>
            </div>
            {g.critic_n > 0 && (
              <p className="text-xs text-muted">
                Critics: {num(g.critic_points, 1)} pts · typically {money(g.critic_price)} · {compact(g.critic_n)} reviews
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
