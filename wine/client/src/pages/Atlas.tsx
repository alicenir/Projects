import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../lib/api';
import { BarList, Figure, Stars } from '../components/charts';
import { ErrorState, Loading, SectionTitle } from '../components/ui';
import { compact, flag, money, num, typeColor } from '../lib/format';

type Country = {
  code: string; name: string; wine_count: number; region_count: number; winery_count: number;
  rating_count: number; rating_avg: number | null; rating_score: number | null; abv_avg: number | null;
  top_grape: string | null; top_type: string | null; critic_n: number; critic_points: number | null; critic_price: number | null;
};

const SORTS = [
  { value: 'wines', label: 'Most wines' },
  { value: 'score', label: 'Best weighted rating' },
  { value: 'ratings', label: 'Most rated' },
  { value: 'price', label: 'Priciest bottles' },
  { value: 'abv', label: 'Strongest wines' },
];

export default function Atlas() {
  const { data, error, loading } = useApi<Country[]>('/countries');
  const [sort, setSort] = useState('wines');
  if (error) return <ErrorState error={error} />;
  if (loading || !data) return <Loading label="Unfolding the map…" />;

  const by: Record<string, (a: Country, b: Country) => number> = {
    wines: (a, b) => b.wine_count - a.wine_count,
    score: (a, b) => (b.rating_score ?? 0) - (a.rating_score ?? 0),
    ratings: (a, b) => b.rating_count - a.rating_count,
    price: (a, b) => (b.critic_price ?? 0) - (a.critic_price ?? 0),
    abv: (a, b) => (b.abv_avg ?? 0) - (a.abv_avg ?? 0),
  };
  const rows = [...data].sort(by[sort]);
  const rated = data.filter((c) => c.rating_count >= 500);

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle title="Wine atlas" hint={`${data.length} countries, ${data.reduce((s, c) => s + c.region_count, 0)} regions.`} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Figure
          title="Who is best rated"
          subtitle="Weighted average rating, countries with 500+ ratings"
          table={{ columns: ['Country', 'Wines', 'Ratings', 'Score'], rows: rated.map((c) => [c.name, c.wine_count, c.rating_count, num(c.rating_score, 3)]) }}
        >
          <BarList
            rows={[...rated].sort((a, b) => (b.rating_score ?? 0) - (a.rating_score ?? 0)).slice(0, 12)
              .map((c) => ({ label: `${flag(c.code)} ${c.name}`, value: c.rating_score ?? 0, note: `(${compact(c.rating_count)})` }))}
            max={Math.max(...rated.map((c) => c.rating_score ?? 0)) * 1.05}
            format={(v) => v.toFixed(2)}
          />
        </Figure>
        <Figure
          title="Where the bottles come from"
          subtitle="Wines in the catalogue per country"
          table={{ columns: ['Country', 'Wines', 'Regions', 'Producers'], rows: rows.map((c) => [c.name, c.wine_count, c.region_count, c.winery_count]) }}
        >
          <BarList rows={rows.slice(0, 12).map((c) => ({ label: `${flag(c.code)} ${c.name}`, value: c.wine_count }))} format={(v) => `${v}`} />
        </Figure>
      </div>

      <div className="card flex flex-wrap items-end gap-3 p-3">
        <label className="flex flex-col gap-1">
          <span className="label">Sort countries</span>
          <select className="field w-56" value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((c) => (
          <Link key={c.code} to={`/atlas/${c.code}`} className="card flex flex-col gap-2 p-4 transition-colors hover:border-accent">
            <div className="flex items-center gap-2">
              <span className="text-xl" aria-hidden>{flag(c.code)}</span>
              <h3 className="flex-1 text-base font-semibold text-ink">{c.name}</h3>
              {c.top_type && <span className="h-2.5 w-2.5 rounded-full" style={{ background: typeColor(c.top_type) }} />}
            </div>
            <p className="text-xs text-ink-2">
              {c.wine_count} wines · {c.region_count} regions · {c.winery_count} producers
            </p>
            <div className="flex items-center gap-2">
              <Stars value={c.rating_avg} />
              <span className="text-xs tabular-nums text-ink-2">{num(c.rating_avg, 2)}</span>
              <span className="text-[11px] text-muted">({compact(c.rating_count)})</span>
            </div>
            <p className="text-xs text-muted">
              Signature grape: {c.top_grape ?? '—'}
              {c.critic_n > 0 && ` · critics ${num(c.critic_points, 1)} pts · ${money(c.critic_price)}`}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
