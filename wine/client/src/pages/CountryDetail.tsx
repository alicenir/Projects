import { Link, useParams } from 'react-router-dom';
import { useApi } from '../lib/api';
import type { WineCard } from '../lib/api';
import { BarList, Figure, StatTile } from '../components/charts';
import { ErrorState, Loading, SectionTitle, WineGrid } from '../components/ui';
import { compact, flag, money, num, slug } from '../lib/format';

type Payload = {
  country: {
    code: string; name: string; wine_count: number; region_count: number; winery_count: number;
    rating_count: number; rating_avg: number | null; abv_avg: number | null; top_grape: string | null;
    critic_n: number; critic_points: number | null; critic_price: number | null;
  };
  regions: { id: number; name: string; wine_count: number; rating_count: number; rating_score: number | null; top_grape: string | null }[];
  grapes: { name: string; wines: number; score: number | null }[];
  wines: WineCard[];
  flavours: { word: string; family: string; n: number; lift: number }[];
};

export default function CountryDetail() {
  const { code } = useParams();
  const { data, error, loading } = useApi<Payload>(code ? `/countries/${code}` : null, [code]);
  if (error) return <ErrorState error={error} />;
  if (loading || !data) return <Loading />;
  const c = data.country;

  return (
    <div className="flex flex-col gap-6">
      <header className="card flex flex-col gap-2 p-5">
        <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight text-ink">
          <span aria-hidden>{flag(c.code)}</span> {c.name}
        </h1>
        <p className="max-w-3xl text-sm text-ink-2">
          {c.wine_count} wines from {c.winery_count} producers across {c.region_count} regions. The signature grape here is{' '}
          <Link className="text-accent hover:underline" to={`/grapes/${slug(c.top_grape ?? '')}`}>{c.top_grape ?? '—'}</Link>.
        </p>
        <Link to={`/explore?country=${c.code}`} className="btn btn-primary self-start">Browse all {c.name} wines</Link>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Drinker average" value={num(c.rating_avg, 2)} note={`${compact(c.rating_count)} ratings`} />
        <StatTile label="Critic average" value={c.critic_points ? num(c.critic_points, 1) : '—'} note={c.critic_n ? `${compact(c.critic_n)} reviews` : 'not covered'} />
        <StatTile label="Typical price" value={money(c.critic_price)} note="median bottle" />
        <StatTile label="Average strength" value={c.abv_avg ? `${num(c.abv_avg, 1)}%` : '—'} note="alcohol by volume" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Figure
          title="Regions"
          subtitle="By number of wines in the catalogue"
          table={{ columns: ['Region', 'Wines', 'Ratings', 'Score'], rows: data.regions.map((r) => [r.name, r.wine_count, r.rating_count, num(r.rating_score, 2)]) }}
        >
          <BarList
            rows={data.regions.slice(0, 12).map((r) => ({ label: r.name, value: r.wine_count, note: r.top_grape ?? undefined }))}
            format={(v) => `${v}`}
          />
        </Figure>
        <Figure
          title="Grapes grown"
          subtitle="Most common varieties in this country"
          table={{ columns: ['Grape', 'Wines', 'Score'], rows: data.grapes.map((g) => [g.name, g.wines, num(g.score, 2)]) }}
        >
          <BarList rows={data.grapes.map((g) => ({ label: g.name, value: g.wines }))} format={(v) => `${v}`} />
        </Figure>
        {data.flavours.length > 0 && (
          <Figure
            title="How critics describe these wines"
            subtitle="Descriptors used more here than in reviews generally"
            table={{ columns: ['Descriptor', 'Family', 'Reviews', 'Lift'], rows: data.flavours.map((f) => [f.word, f.family, f.n, `${f.lift.toFixed(1)}×`]) }}
          >
            <BarList rows={data.flavours.slice(0, 12).map((f) => ({ label: f.word, value: f.lift, note: compact(f.n) }))} format={(v) => `${v.toFixed(1)}×`} />
          </Figure>
        )}
      </div>

      <section>
        <SectionTitle title={`Best rated from ${c.name}`} />
        <WineGrid wines={data.wines} />
      </section>
    </div>
  );
}
