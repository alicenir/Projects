import { Link, useParams } from 'react-router-dom';
import { useApi } from '../lib/api';
import type { WineCard } from '../lib/api';
import { BarList, Figure, StatTile } from '../components/charts';
import { ErrorState, Loading, PairingChip, SectionTitle, WineGrid } from '../components/ui';
import { compact, money, num, slug, typeColor } from '../lib/format';

type Payload = {
  grape: {
    name: string; wine_count: number; varietal_count: number; rating_count: number; rating_avg: number | null;
    abv_avg: number | null; top_type: string | null; top_country: string | null; top_body: string | null; top_acidity: string | null;
    pairings: { name: string; count: number }[];
    blends_with: { name: string; count: number }[];
    countries: { name: string; count: number }[];
    critic_n: number; critic_points: number | null; critic_price: number | null;
  };
  wines: WineCard[];
  flavours: { word: string; family: string; n: number; share: number; lift: number }[];
  critic: { n: number; points_avg: number; price_med: number; price_p10: number; price_p90: number } | null;
  criticByCountry: { country: string; n: number; points_avg: number; price_med: number }[];
  reviews: { id: number; title: string; points: number; price: number | null; description: string; taster: string | null }[];
};

export default function GrapeDetail() {
  const { name } = useParams();
  const { data, error, loading } = useApi<Payload>(name ? `/grapes/${encodeURIComponent(name)}` : null, [name]);

  if (error) return <ErrorState error={error} />;
  if (loading || !data) return <Loading />;

  const g = data.grape;

  return (
    <div className="flex flex-col gap-6">
      <header className="card flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          {g.top_type && (
            <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: typeColor(g.top_type) }} />
              usually {g.top_type.toLowerCase()}
            </span>
          )}
          <span className="text-xs text-muted">·</span>
          <span className="text-xs text-ink-2">{g.top_body?.toLowerCase() ?? 'body varies'}</span>
          <span className="text-xs text-muted">·</span>
          <span className="text-xs text-ink-2">{g.top_acidity?.toLowerCase() ?? '—'} acidity</span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">{g.name}</h1>
        <p className="max-w-3xl text-sm text-ink-2">
          {g.wine_count} wines in the catalogue, {g.varietal_count} of them made from this grape alone. Most come from{' '}
          {g.top_country ?? 'no single country'}
          {g.critic_n > 0 && (
            <>
              , and across {compact(g.critic_n)} critic reviews the variety averages {num(g.critic_points, 1)} points at a
              typical {money(g.critic_price)} a bottle
            </>
          )}
          .
        </p>
        <div className="flex flex-wrap gap-2">
          <Link to={`/explore?grape=${slug(g.name)}`} className="btn btn-primary">
            Browse every {g.name}
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Wines" value={String(g.wine_count)} note={`${g.varietal_count} single-varietal`} />
        <StatTile label="Drinker average" value={num(g.rating_avg, 2)} note={`${compact(g.rating_count)} ratings`} />
        <StatTile label="Critic average" value={g.critic_points ? num(g.critic_points, 1) : '—'} note={g.critic_n ? `${compact(g.critic_n)} reviews` : 'not covered'} />
        <StatTile label="Typical price" value={money(g.critic_price)} note="median, Wine Enthusiast" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {data.flavours.length > 0 && (
          <Figure
            title="Flavour fingerprint"
            subtitle="Descriptors used more for this grape than for wine in general"
            footnote="Lift compares each word's frequency here against all 130K reviews."
            table={{ columns: ['Descriptor', 'Family', 'Reviews', 'Lift'], rows: data.flavours.map((f) => [f.word, f.family, f.n, `${f.lift.toFixed(1)}×`]) }}
          >
            <BarList rows={data.flavours.slice(0, 12).map((f) => ({ label: f.word, value: f.lift, note: compact(f.n) }))} format={(v) => `${v.toFixed(1)}×`} />
          </Figure>
        )}

        {g.countries.length > 0 && (
          <Figure
            title="Where it grows"
            subtitle="Wines in the catalogue by country"
            table={{ columns: ['Country', 'Wines'], rows: g.countries.map((c) => [c.name, c.count]) }}
          >
            <BarList rows={g.countries.map((c) => ({ label: c.name, value: c.count }))} format={(v) => `${v} wines`} />
          </Figure>
        )}

        {data.criticByCountry.length > 0 && (
          <Figure
            title="Which country does it best"
            subtitle="Average critic points by origin (20+ reviews)"
            footnote="Points and prices come from Wine Enthusiast, so coverage is deepest in the US."
            table={{
              columns: ['Country', 'Reviews', 'Points', 'Median price'],
              rows: data.criticByCountry.map((c) => [c.country, c.n, num(c.points_avg, 1), money(c.price_med)]),
            }}
          >
            <BarList
              rows={data.criticByCountry.slice(0, 10).map((c) => ({
                label: c.country,
                value: c.points_avg,
                note: money(c.price_med),
              }))}
              max={100}
              format={(v) => num(v, 1)}
            />
          </Figure>
        )}

        {g.blends_with.length > 0 && (
          <Figure
            title="Blended with"
            subtitle="Grapes that share a bottle with it most often"
            table={{ columns: ['Grape', 'Wines'], rows: g.blends_with.map((b) => [b.name, b.count]) }}
          >
            <BarList
              rows={g.blends_with.map((b) => ({ label: b.name, value: b.count }))}
              format={(v) => `${v} wines`}
            />
          </Figure>
        )}
      </div>

      {g.pairings.length > 0 && (
        <section>
          <SectionTitle title="Serve it with" />
          <div className="flex flex-wrap gap-2">
            {g.pairings.map((p) => (
              <PairingChip key={p.name} name={p.name} />
            ))}
          </div>
        </section>
      )}

      {data.reviews.length > 0 && (
        <section>
          <SectionTitle title="A critic's take" hint="Three reviews scoring 92+ for this grape." />
          <div className="grid gap-3 md:grid-cols-3">
            {data.reviews.map((r) => (
              <article key={r.id} className="card flex flex-col gap-2 p-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-semibold tabular-nums text-ink">{r.points}</span>
                  <span className="text-xs text-muted">points</span>
                  {r.price && <span className="ml-auto text-sm text-ink-2">{money(r.price)}</span>}
                </div>
                <p className="text-sm font-medium text-ink">{r.title}</p>
                <p className="line-clamp-4 text-sm text-ink-2">{r.description}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionTitle title={`Best ${g.name} in the catalogue`} hint="Weighted rating, so volume of opinion counts." />
        <WineGrid wines={data.wines} />
      </section>
    </div>
  );
}
