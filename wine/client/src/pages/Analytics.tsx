import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { queryString, useApi } from '../lib/api';
import { BarList, ColumnChart, Figure, Heatmap, LineChart, StackedBar, StatTile, TipRow } from '../components/charts';
import { ErrorState, Loading, SectionTitle } from '../components/ui';
import { compact, flag, money, num, slug, typeColor, TYPE_ORDER } from '../lib/format';

const BODY_ORDER = ['Very light-bodied', 'Light-bodied', 'Medium-bodied', 'Full-bodied', 'Very full-bodied'];
const ACIDITY_ORDER = ['Low', 'Medium', 'High'];

const TABS = [
  { id: 'ratings', label: 'Ratings & quality' },
  { id: 'styles', label: 'Styles & places' },
  { id: 'market', label: 'Prices & critics' },
  { id: 'flavour', label: 'Flavour' },
];

export default function Analytics() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'ratings';
  const setTab = (id: string) =>
    setParams((p) => {
      const next = new URLSearchParams(p);
      next.set('tab', id);
      return next;
    }, { replace: true });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <SectionTitle
          title="Analytics"
          hint="Two open datasets, side by side: what drinkers score, and what critics charge."
        />
        <div className="flex flex-wrap gap-2" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`chip ${tab === t.id ? 'chip-active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'ratings' && <RatingsTab />}
      {tab === 'styles' && <StylesTab />}
      {tab === 'market' && <MarketTab />}
      {tab === 'flavour' && <FlavourTab />}
    </div>
  );
}

/* ------------------------------------------------------------ filter row */

type CatalogueFilters = { type: string; country: string; minRatings: string };

function FilterRow({
  value,
  onChange,
  countries,
}: {
  value: CatalogueFilters;
  onChange: (next: CatalogueFilters) => void;
  countries: { code: string; name: string }[];
}) {
  return (
    <div className="card flex flex-wrap items-end gap-3 p-3">
      <label className="flex flex-col gap-1">
        <span className="label">Style</span>
        <select className="field w-44" value={value.type} onChange={(e) => onChange({ ...value, type: e.target.value })}>
          <option value="">All styles</option>
          {TYPE_ORDER.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="label">Country</span>
        <select className="field w-48" value={value.country} onChange={(e) => onChange({ ...value, country: e.target.value })}>
          <option value="">Everywhere</option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="label">Minimum ratings per wine</span>
        <select className="field w-40" value={value.minRatings} onChange={(e) => onChange({ ...value, minRatings: e.target.value })}>
          <option value="">Any</option>
          <option value="10">10+</option>
          <option value="50">50+</option>
          <option value="200">200+</option>
        </select>
      </label>
      {(value.type || value.country || value.minRatings) && (
        <button type="button" className="btn" onClick={() => onChange({ type: '', country: '', minRatings: '' })}>
          Reset
        </button>
      )}
    </div>
  );
}

function useCountries() {
  const { data } = useApi<{ code: string; name: string; wine_count: number }[]>('/countries');
  return data ?? [];
}

/* ------------------------------------------------------------ tab: ratings */

type RatingsPayload = {
  distribution: { bucket: number; n: number }[];
  timeline: { ym: string; n: number; avg: number }[];
  vintages: { vintage: number; n: number; avg: number }[];
  byType: { type: string; n: number; avg: number }[];
};

type Summary = {
  wines: number;
  ratings: number;
  tasters: number;
  avg_rating: number;
  countries: number;
  wineries: number;
  grapes: number;
  critic_reviews: number;
};

function RatingsTab() {
  const [filters, setFilters] = useState<CatalogueFilters>({ type: '', country: '', minRatings: '' });
  const countries = useCountries();
  const summary = useApi<Summary>('/analytics/summary');
  const q = queryString(filters);
  const { data, error, loading, refetching } = useApi<RatingsPayload>(`/analytics/ratings${q}`);

  if (error) return <ErrorState error={error} />;

  const ymToX = (ym: string) => Number(ym.slice(0, 4)) + (Number(ym.slice(5, 7)) - 1) / 12;
  const monthly = data?.timeline ?? [];
  const total = data?.distribution.reduce((s, d) => s + d.n, 0) ?? 0;
  const positive = data?.distribution.filter((d) => d.bucket >= 4).reduce((s, d) => s + d.n, 0) ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <FilterRow value={filters} onChange={setFilters} countries={countries} />

      {loading && !data ? (
        <Loading />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="Ratings in view" value={compact(total)} hero />
            <StatTile label="Average score" value={num(data && total ? data.distribution.reduce((s, d) => s + d.bucket * d.n, 0) / total : null, 2)} note="out of 5" />
            <StatTile label="Rated 4 stars or better" value={total ? `${Math.round((positive / total) * 100)}%` : '—'} />
            <StatTile label="Catalogue" value={compact(summary.data?.wines)} note={`${compact(summary.data?.wineries)} producers`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Figure
              title="How drinkers rate"
              subtitle="Every rating in view, by star value"
              refetching={refetching}
              table={{ columns: ['Stars', 'Ratings'], rows: (data?.distribution ?? []).map((d) => [d.bucket, d.n]) }}
            >
              <ColumnChart
                data={(data?.distribution ?? []).map((d) => ({
                  label: String(d.bucket),
                  value: d.n,
                  tip: <TipRow label={`${d.bucket} stars`} value={`${d.n.toLocaleString()} (${((d.n / total) * 100).toFixed(1)}%)`} />,
                }))}
                format={compact}
                height={200}
              />
            </Figure>

            <Figure
              title="Ratings posted per month"
              subtitle="Volume of reviews over the life of the dataset"
              refetching={refetching}
              legend={[{ label: 'Ratings per month', color: 'var(--series-1)', shape: 'line' }]}
              table={{ columns: ['Month', 'Ratings', 'Average'], rows: monthly.map((m) => [m.ym, m.n, m.avg.toFixed(2)]) }}
            >
              {monthly.length > 2 ? (
                <LineChart
                  series={[{ label: 'Ratings per month', color: 'var(--series-1)', points: monthly.map((m) => ({ x: ymToX(m.ym), y: m.n })) }]}
                  formatX={(v) => String(Math.round(v))}
                  formatY={(v) => compact(Math.round(v))}
                  height={220}
                  area
                  zeroBased
                />
              ) : (
                <p className="py-10 text-center text-sm text-muted">Not enough months in this slice.</p>
              )}
            </Figure>

            <Figure
              title="Do older vintages score better?"
              subtitle="Average rating by the vintage in the bottle (30+ ratings per year)"
              refetching={refetching}
              legend={[{ label: 'Average rating', color: 'var(--series-2)', shape: 'line' }]}
              footnote="Survivorship bias: only wines worth keeping get opened decades later, so old vintages flatter themselves."
              table={{ columns: ['Vintage', 'Ratings', 'Average'], rows: (data?.vintages ?? []).map((v) => [v.vintage, v.n, v.avg.toFixed(2)]) }}
            >
              {data && data.vintages.length > 2 ? (
                <LineChart
                  series={[{ label: 'Average rating', color: 'var(--series-2)', points: data.vintages.map((v) => ({ x: v.vintage, y: v.avg })) }]}
                  yDomain={[3, 5]}
                  formatX={(v) => String(Math.round(v))}
                  formatY={(v) => v.toFixed(1)}
                  height={220}
                />
              ) : (
                <p className="py-10 text-center text-sm text-muted">Not enough vintage data in this slice.</p>
              )}
            </Figure>

            <Figure
              title="Average rating by style"
              subtitle="Weighted by how many ratings each style attracted"
              refetching={refetching}
              table={{ columns: ['Style', 'Ratings', 'Average'], rows: (data?.byType ?? []).map((t) => [t.type, t.n, t.avg.toFixed(2)]) }}
            >
              <BarList
                rows={(data?.byType ?? [])
                  .slice()
                  .sort((a, b) => b.avg - a.avg)
                  .map((t) => ({ label: t.type, value: t.avg, color: typeColor(t.type), note: `(${compact(t.n)})` }))}
                max={5}
                format={(v) => v.toFixed(2)}
              />
            </Figure>
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- tab: styles */

type StylesPayload = {
  types: { type: string; wines: number; ratings: number; score: number | null; abv: number | null }[];
  bodyAcidity: { body: string; acidity: string; wines: number; ratings: number; score: number | null }[];
  abv: { type: string; bucket: number; n: number }[];
  elaborate: { kind: string; wines: number; score: number | null }[];
};

type GeographyPayload = {
  countries: {
    code: string; name: string; wine_count: number; rating_count: number; rating_avg: number | null;
    rating_score: number | null; abv_avg: number | null; top_grape: string | null; critic_points: number | null; critic_price: number | null;
  }[];
  regions: { id: number; name: string; country: string; wine_count: number; rating_count: number; rating_score: number | null; top_grape: string | null }[];
  wineries: { id: number; name: string; country: string; wine_count: number; rating_count: number; rating_score: number | null }[];
};

function StylesTab() {
  const [filters, setFilters] = useState<CatalogueFilters>({ type: '', country: '', minRatings: '' });
  const countries = useCountries();
  const q = queryString(filters);
  const styles = useApi<StylesPayload>(`/analytics/styles${q}`);
  const geo = useApi<GeographyPayload>('/analytics/geography');
  const grapes = useApi<{ grapes: { name: string; wine_count: number; rating_count: number; rating_avg: number | null; critic_points: number | null }[] }>(
    '/analytics/grapes?limit=18',
  );

  if (styles.error) return <ErrorState error={styles.error} />;
  if (!styles.data) return <Loading />;

  const ranked = [...styles.data.types].sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type));
  const rated = geo.data?.countries.filter((c) => c.rating_count >= 500) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <FilterRow value={filters} onChange={setFilters} countries={countries} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Figure
          title="What the catalogue is made of"
          subtitle="Share of wines by style"
          legend={ranked.map((t) => ({ label: t.type, color: typeColor(t.type) }))}
          refetching={styles.refetching}
          table={{ columns: ['Style', 'Wines', 'Ratings', 'Score'], rows: ranked.map((t) => [t.type, t.wines, t.ratings, num(t.score, 2)]) }}
        >
          <div className="flex flex-col gap-4 py-2">
            <StackedBar segments={ranked.map((t) => ({ label: t.type, value: t.wines, color: typeColor(t.type) }))} />
            <BarList
              rows={ranked.map((t) => ({ label: t.type, value: t.wines, color: typeColor(t.type) }))}
              format={(v) => v.toLocaleString()}
            />
          </div>
        </Figure>

        <Figure
          title="Style profile: body against acidity"
          subtitle="Weighted average rating in each cell — the legend runs from the lowest to the highest"
          refetching={styles.refetching}
          footnote="Cells with no wines are left blank."
          table={{
            columns: ['Body', 'Acidity', 'Wines', 'Score'],
            rows: styles.data.bodyAcidity.map((c) => [c.body, c.acidity, c.wines, num(c.score, 2)]),
          }}
        >
          <Heatmap
            rows={BODY_ORDER.filter((b) => styles.data!.bodyAcidity.some((c) => c.body === b))}
            columns={ACIDITY_ORDER}
            cells={styles.data.bodyAcidity.map((c) => ({ row: c.body, column: c.acidity, value: c.score, count: c.wines }))}
            legendLabel="avg rating"
          />
        </Figure>

        <Figure
          title="Alcohol by style"
          subtitle="Average ABV of the wines in view"
          refetching={styles.refetching}
          table={{ columns: ['Style', 'ABV', 'Wines'], rows: ranked.map((t) => [t.type, num(t.abv, 1), t.wines]) }}
        >
          <BarList
            rows={ranked
              .filter((t) => t.abv !== null)
              .sort((a, b) => (b.abv ?? 0) - (a.abv ?? 0))
              .map((t) => ({ label: t.type, value: t.abv ?? 0, color: typeColor(t.type) }))}
            format={(v) => `${v.toFixed(1)}%`}
          />
        </Figure>

        <Figure
          title="Single grape or blend?"
          subtitle="Wines by how they are made, with their average score"
          refetching={styles.refetching}
          table={{ columns: ['Kind', 'Wines', 'Score'], rows: styles.data.elaborate.map((e) => [e.kind, e.wines, num(e.score, 2)]) }}
        >
          <BarList
            rows={styles.data.elaborate.map((e) => ({ label: e.kind, value: e.wines, note: `avg ${num(e.score, 2)}` }))}
            format={(v) => v.toLocaleString()}
          />
        </Figure>

        <Figure
          title="Countries by weighted rating"
          subtitle="Countries with 500+ ratings, shrunk towards the global mean"
          footnote="Shrinking keeps a country with three enthusiastic reviews off the top of the chart."
          table={{
            columns: ['Country', 'Wines', 'Ratings', 'Score'],
            rows: rated.map((c) => [c.name, c.wine_count, c.rating_count, num(c.rating_score, 3)]),
          }}
        >
          <BarList
            rows={[...rated]
              .sort((a, b) => (b.rating_score ?? 0) - (a.rating_score ?? 0))
              .slice(0, 12)
              .map((c) => ({ label: `${flag(c.code)} ${c.name}`, value: c.rating_score ?? 0, note: `(${compact(c.rating_count)})` }))}
            max={Math.max(...rated.map((c) => c.rating_score ?? 0)) * 1.05}
            format={(v) => v.toFixed(2)}
          />
        </Figure>

        <Figure
          title="Most planted grapes here"
          subtitle="By number of wines in the catalogue"
          table={{
            columns: ['Grape', 'Wines', 'Ratings', 'Avg', 'Critic pts'],
            rows: (grapes.data?.grapes ?? []).map((g) => [g.name, g.wine_count, g.rating_count, num(g.rating_avg, 2), num(g.critic_points, 1)]),
          }}
        >
          <BarList
            rows={(grapes.data?.grapes ?? []).slice(0, 12).map((g) => ({ label: g.name, value: g.wine_count }))}
            format={(v) => `${v} wines`}
          />
        </Figure>
      </div>

      {geo.data && (
        <Figure title="Regions punching above their weight" subtitle="Weighted rating, regions with 5+ wines">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {geo.data.regions.slice(0, 12).map((r) => (
              <Link key={r.id} to={`/region/${r.id}`} className="flex items-center gap-3 rounded-xl border border-line p-3 hover:border-accent">
                <span className="text-lg font-semibold tabular-nums text-ink">{num(r.rating_score, 2)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{r.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {r.country} · {r.top_grape ?? '—'} · {compact(r.rating_count)} ratings
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </Figure>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- tab: market */

type MarketPayload = {
  priceByPoints: { points: number; n: number; avg_price: number }[];
  priceHistogram: { bucket: number; n: number; avg_points: number }[];
  valueByGrape: { name: string; n: number; points_avg: number; price_med: number; points_per_unit: number }[];
  valueByCountry: { name: string; n: number; points_avg: number; price_med: number; points_per_unit: number }[];
  bargains: { id: number; title: string; variety: string; country: string; points: number; price: number; description: string }[];
  priciest: { id: number; title: string; variety: string; country: string; points: number; price: number }[];
};

function MarketTab() {
  const [country, setCountry] = useState('');
  const critics = ['', 'US', 'France', 'Italy', 'Spain', 'Portugal', 'Chile', 'Argentina', 'Austria', 'Australia', 'Germany', 'New Zealand', 'South Africa'];
  const { data, error, loading, refetching } = useApi<MarketPayload>(`/analytics/market${queryString({ criticCountry: country })}`);

  if (error) return <ErrorState error={error} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex flex-wrap items-end gap-3 p-3">
        <label className="flex flex-col gap-1">
          <span className="label">Critic reviews from</span>
          <select className="field w-52" value={country} onChange={(e) => setCountry(e.target.value)}>
            {critics.map((c) => (
              <option key={c} value={c}>
                {c || 'Everywhere'}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-muted">Prices are US dollars as published by Wine Enthusiast; the set was collected in 2017.</p>
      </div>

      {loading && !data ? (
        <Loading />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Figure
            title="What a point costs"
            subtitle="Average bottle price at each critic score"
            refetching={refetching}
            legend={[{ label: 'Average price', color: 'var(--series-2)', shape: 'line' }]}
            footnote="The curve bends upward: the last few points are the expensive ones."
            table={{ columns: ['Points', 'Reviews', 'Avg price'], rows: (data?.priceByPoints ?? []).map((p) => [p.points, p.n, money(p.avg_price)]) }}
          >
            <LineChart
              series={[{ label: 'Average price', color: 'var(--series-2)', points: (data?.priceByPoints ?? []).map((p) => ({ x: p.points, y: p.avg_price })) }]}
              formatX={(v) => String(Math.round(v))}
              formatY={(v) => money(v)}
              height={240}
              zeroBased
            />
          </Figure>

          <Figure
            title="What wine actually costs"
            subtitle="Reviews by price bracket (bottles over $100 grouped)"
            refetching={refetching}
            table={{ columns: ['Price from', 'Reviews', 'Avg points'], rows: (data?.priceHistogram ?? []).map((p) => [money(p.bucket), p.n, num(p.avg_points, 1)]) }}
          >
            <ColumnChart
              data={(data?.priceHistogram ?? []).map((p) => ({
                label: p.bucket >= 100 ? '100+' : String(p.bucket),
                value: p.n,
                tip: <TipRow label={`${money(p.bucket)}+`} value={`${compact(p.n)} reviews · ${num(p.avg_points, 1)} pts`} />,
              }))}
              labelEvery={2}
              format={compact}
              height={240}
            />
          </Figure>

          <Figure
            title="Best value grapes"
            subtitle="Critic points per dollar at the median price (300+ reviews)"
            refetching={refetching}
            table={{
              columns: ['Grape', 'Reviews', 'Avg points', 'Median price', 'Points/$'],
              rows: (data?.valueByGrape ?? []).map((g) => [g.name, g.n, num(g.points_avg, 1), money(g.price_med), num(g.points_per_unit, 2)]),
            }}
          >
            <BarList
              rows={(data?.valueByGrape ?? []).slice(0, 10).map((g) => ({
                label: g.name.replace(/\b\w/g, (c) => c.toUpperCase()),
                value: g.points_per_unit,
                note: `${money(g.price_med)} · ${num(g.points_avg, 1)}pts`,
              }))}
              format={(v) => v.toFixed(1)}
            />
          </Figure>

          <Figure
            title="Best value countries"
            subtitle="Critic points per dollar at the median price (200+ reviews)"
            refetching={refetching}
            table={{
              columns: ['Country', 'Reviews', 'Avg points', 'Median price', 'Points/$'],
              rows: (data?.valueByCountry ?? []).map((c) => [c.name, c.n, num(c.points_avg, 1), money(c.price_med), num(c.points_per_unit, 2)]),
            }}
          >
            <BarList
              rows={(data?.valueByCountry ?? []).slice(0, 10).map((c) => ({
                label: c.name,
                value: c.points_per_unit,
                note: `${money(c.price_med)} · ${num(c.points_avg, 1)}pts`,
              }))}
              format={(v) => v.toFixed(1)}
            />
          </Figure>

          <div className="card flex flex-col gap-3 p-5 lg:col-span-2">
            <div>
              <h3 className="text-sm font-semibold text-ink">Under $25, 90 points or better</h3>
              <p className="text-xs text-ink-2">The critics&apos; own bargain bin.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {(data?.bargains ?? []).slice(0, 6).map((b) => (
                <article key={b.id} className="rounded-xl border border-line p-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-base font-semibold tabular-nums text-ink">{b.points}</span>
                    <span className="text-xs text-muted">pts</span>
                    <span className="ml-auto text-sm font-medium text-accent">{money(b.price)}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium leading-snug text-ink">{b.title}</p>
                  <p className="text-xs text-muted">
                    {b.variety} · {b.country}
                  </p>
                  <p className="mt-1 line-clamp-3 text-xs text-ink-2">{b.description}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ tab: flavour */

type FlavourPayload = {
  global: { word: string; family: string; n: number; share: number }[];
  grape: { word: string; family: string; n: number; share: number; lift: number }[];
  grapeOptions: string[];
};

function FlavourTab() {
  const [grape, setGrape] = useState('pinot noir');
  const { data, error, loading, refetching } = useApi<FlavourPayload>(`/analytics/flavours${queryString({ grape })}`);

  if (error) return <ErrorState error={error} />;
  if (loading && !data) return <Loading />;

  const families = new Map<string, number>();
  for (const d of data?.global ?? []) families.set(d.family, (families.get(d.family) ?? 0) + d.n);

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex flex-wrap items-end gap-3 p-3">
        <label className="flex flex-col gap-1">
          <span className="label">Grape fingerprint</span>
          <select className="field w-60" value={grape} onChange={(e) => setGrape(e.target.value)}>
            {(data?.grapeOptions ?? []).map((g) => (
              <option key={g} value={g}>
                {g.replace(/\b\w/g, (c) => c.toUpperCase())}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-muted">Counted across 130K Wine Enthusiast tasting notes.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Figure
          title="The words critics reach for"
          subtitle="Share of all tasting notes mentioning each term"
          table={{ columns: ['Descriptor', 'Family', 'Reviews', 'Share'], rows: (data?.global ?? []).map((d) => [d.word, d.family, d.n, `${(d.share * 100).toFixed(1)}%`]) }}
        >
          <BarList
            rows={(data?.global ?? []).slice(0, 14).map((d) => ({ label: d.word, value: d.share * 100, note: compact(d.n) }))}
            format={(v) => `${v.toFixed(1)}%`}
          />
        </Figure>

        <Figure
          title="Flavour families"
          subtitle="Mentions grouped by aroma family"
          table={{ columns: ['Family', 'Mentions'], rows: [...families].map(([f, n]) => [f, n]) }}
        >
          <BarList rows={[...families].sort((a, b) => b[1] - a[1]).map(([f, n]) => ({ label: f, value: n }))} format={compact} />
        </Figure>

        <Figure
          title={`What makes ${grape.replace(/\b\w/g, (c) => c.toUpperCase())} taste like itself`}
          subtitle="Descriptors used far more often for this grape than for wine in general"
          refetching={refetching}
          footnote="Lift of 4× means the word shows up four times as often as it does across all reviews."
          table={{ columns: ['Descriptor', 'Family', 'Reviews', 'Lift'], rows: (data?.grape ?? []).map((d) => [d.word, d.family, d.n, `${d.lift.toFixed(1)}×`]) }}
        >
          <BarList
            rows={(data?.grape ?? []).slice(0, 14).map((d) => ({ label: d.word, value: d.lift, note: compact(d.n) }))}
            format={(v) => `${v.toFixed(1)}×`}
          />
        </Figure>

        <div className="card flex flex-col gap-3 p-5">
          <h3 className="text-sm font-semibold text-ink">Read this grape&apos;s page</h3>
          <p className="text-sm text-ink-2">
            Flavour is only half the story — the grape pages add where it grows, what it costs and which bottles in the
            catalogue are worth opening.
          </p>
          <Link to={`/grapes?q=${slug(grape)}`} className="btn btn-primary self-start">
            Open the grape page
          </Link>
        </div>
      </div>
    </div>
  );
}
