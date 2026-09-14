import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, useApi } from '../lib/api';
import type { WineCard } from '../lib/api';
import { BarList, ColumnChart, Figure, LineChart, Stars, TipRow } from '../components/charts';
import { Bottle, ErrorState, Loading, PairingChip, SectionTitle, WineGrid } from '../components/ui';
import { compact, flag, money, num, slug, typeColor, vintageRange } from '../lib/format';

type Detail = {
  wine: WineCard & { website: string; vintages: number[] };
  winery: { id: number; name: string; wine_count: number; rating_avg: number | null } | null;
  region: { id: number; name: string; country: string; wine_count: number } | null;
  country: { code: string; name: string; wine_count: number; rating_avg: number | null } | null;
  histogram: { bucket: number; n: number }[];
  byYear: { year: number; n: number; avg: number }[];
  byVintage: { vintage: number; n: number; avg: number }[];
  similar: { profile: WineCard[]; taste: WineCard[] };
  benchmark: { n: number; points_avg: number; price_med: number; price_p10: number; price_p90: number } | null;
  benchmarkHere: { n: number; points_avg: number; price_med: number } | null;
  flavours: { word: string; family: string; n: number; share: number; lift: number }[];
  criticNotes: { id: number; title: string; variety: string; points: number; price: number | null; description: string; taster: string | null }[];
  cellar: {
    bottles: { id: number; vintage: number | null; quantity: number; price_paid: number | null; location: string | null }[];
    notes: { id: number; rating: number | null; notes: string | null; tasted_on: string }[];
    wishlisted: boolean;
  };
};

export default function WineDetail() {
  const { id } = useParams();
  const { data, error, loading, reload } = useApi<Detail>(id ? `/wines/${id}` : null, [id]);

  if (error) return <ErrorState error={error} />;
  if (loading || !data) return <Loading label="Pouring…" />;

  const { wine } = data;
  const totalRatings = data.histogram.reduce((s, h) => s + h.n, 0);

  return (
    <div className="flex flex-col gap-6">
      <header className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:gap-6">
        <Bottle wine={wine} size={88} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-2">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: typeColor(wine.type) }} />
              {wine.type}
            </span>
            <span>·</span>
            <span>{wine.elaborate.replace('/', ' · ')}</span>
            {wine.abv !== null && (
              <>
                <span>·</span>
                <span>{wine.abv}% ABV</span>
              </>
            )}
          </div>
          <h1 className="mt-1 text-2xl font-semibold leading-tight tracking-tight text-ink sm:text-3xl">{wine.name}</h1>
          <p className="mt-1 text-sm text-ink-2">
            {data.winery ? (
              <Link to={`/explore?winery=${wine.winery_id}`} className="hover:text-accent">
                {wine.winery}
              </Link>
            ) : (
              wine.winery
            )}
            {' · '}
            {data.region && (
              <Link to={`/region/${data.region.id}`} className="hover:text-accent">
                {wine.region}
              </Link>
            )}
            {' · '}
            <Link to={`/atlas/${wine.country_code}`} className="hover:text-accent">
              {flag(wine.country_code)} {wine.country}
            </Link>
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Stars value={wine.rating_avg} size={18} />
              <span className="text-lg font-semibold tabular-nums text-ink">{num(wine.rating_avg, 2)}</span>
              <span className="text-xs text-muted">from {compact(wine.rating_count)} ratings</span>
            </div>
            {data.benchmark && (
              <span className="rounded-full bg-raised px-2.5 py-1 text-xs text-ink-2">
                Critics on {wine.grapes[0]}: {num(data.benchmark.points_avg, 1)} pts · typically {money(data.benchmark.price_med)}
              </span>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {wine.grapes.map((g) => (
              <Link key={g} to={`/grapes/${slug(g)}`} className="chip">
                🍇 {g}
              </Link>
            ))}
            <span className="chip">{wine.body}</span>
            <span className="chip">{wine.acidity} acidity</span>
            <span className="chip">Vintages {vintageRange(wine)}</span>
          </div>
        </div>
      </header>

      <CellarActions detail={data} onChange={reload} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Figure
          title="How drinkers scored it"
          subtitle={`${compact(totalRatings)} ratings, 1–5 stars`}
          table={{ columns: ['Stars', 'Ratings'], rows: data.histogram.map((h) => [h.bucket, h.n]) }}
        >
          <ColumnChart
            data={data.histogram.map((h) => ({
              label: String(h.bucket),
              value: h.n,
              color: 'var(--series-1)',
              tip: <TipRow label={`${h.bucket} stars`} value={`${h.n.toLocaleString()} ratings`} />,
            }))}
            height={180}
          />
        </Figure>

        {data.byYear.length > 2 ? (
          <Figure
            title="Reputation over time"
            subtitle="Average rating by the year the review was posted"
            legend={[
              { label: 'Average rating', color: 'var(--series-1)', shape: 'line' },
            ]}
            table={{ columns: ['Year', 'Ratings', 'Average'], rows: data.byYear.map((y) => [y.year, y.n, y.avg.toFixed(2)]) }}
          >
            <LineChart
              series={[{ label: 'Average rating', color: 'var(--series-1)', points: data.byYear.map((y) => ({ x: y.year, y: y.avg })) }]}
              yDomain={[Math.min(3, ...data.byYear.map((y) => y.avg)) - 0.2, Math.max(...data.byYear.map((y) => y.avg)) + 0.2]}
              formatX={(v) => String(Math.round(v))}
              formatY={(v) => v.toFixed(1)}
              height={200}
              area
            />
          </Figure>
        ) : (
          <Figure title="Reputation over time" subtitle="Not enough dated ratings for this bottle yet">
            <p className="py-8 text-center text-sm text-muted">Fewer than three years of ratings.</p>
          </Figure>
        )}

        {data.byVintage.length > 0 && (
          <Figure
            title="Which vintage to buy"
            subtitle="Average rating per vintage, vintages with at least 3 ratings"
            table={{ columns: ['Vintage', 'Ratings', 'Average'], rows: data.byVintage.map((v) => [v.vintage, v.n, v.avg.toFixed(2)]) }}
          >
            <BarList
              rows={data.byVintage.slice(0, 12).map((v) => ({
                label: String(v.vintage),
                value: v.avg,
                note: `(${v.n})`,
                color: typeColor(wine.type),
              }))}
              max={5}
              format={(v) => v.toFixed(2)}
            />
          </Figure>
        )}

        {data.flavours.length > 0 && (
          <Figure
            title={`What ${wine.grapes[0]} usually tastes like`}
            subtitle="Descriptors critics use for this grape far more than for wine in general"
            footnote="Lift = how much more often the word appears for this grape than across all reviews."
            table={{
              columns: ['Descriptor', 'Family', 'Reviews', 'Lift'],
              rows: data.flavours.map((f) => [f.word, f.family, f.n, `${f.lift.toFixed(1)}×`]),
            }}
          >
            <div className="flex flex-wrap gap-2 py-1">
              {data.flavours.map((f) => (
                <span
                  key={f.word}
                  className="rounded-full border border-line px-2.5 py-1 text-xs text-ink"
                  title={`${f.family} · ${f.n.toLocaleString()} reviews · ${f.lift.toFixed(1)}× the average`}
                  style={{ fontSize: `${Math.min(16, 11 + f.lift)}px` }}
                >
                  {f.word}
                </span>
              ))}
            </div>
          </Figure>
        )}
      </div>

      {(data.benchmark || data.criticNotes.length > 0) && (
        <section>
          <SectionTitle title="What the critics say" hint="Wine Enthusiast reviews, matched by grape and producer." />
          <div className="grid gap-4 lg:grid-cols-3">
            {data.benchmark && (
              <div className="card flex flex-col gap-3 p-5">
                <p className="label">Price check</p>
                <p className="text-sm text-ink-2">
                  Across {compact(data.benchmark.n)} reviews of {wine.grapes[0]}, the middle price is{' '}
                  <strong className="text-ink">{money(data.benchmark.price_med)}</strong>, with most bottles between{' '}
                  {money(data.benchmark.price_p10)} and {money(data.benchmark.price_p90)}.
                </p>
                {data.benchmarkHere && (
                  <p className="text-sm text-ink-2">
                    From {wine.country} specifically: {num(data.benchmarkHere.points_avg, 1)} points on average,
                    typically {money(data.benchmarkHere.price_med)} ({compact(data.benchmarkHere.n)} reviews).
                  </p>
                )}
              </div>
            )}
            {data.criticNotes.slice(0, 2).map((note) => (
              <article key={note.id} className="card flex flex-col gap-2 p-5">
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-semibold tabular-nums text-ink">{note.points}</span>
                  <span className="text-xs text-muted">points</span>
                  {note.price && <span className="ml-auto text-sm text-ink-2">{money(note.price)}</span>}
                </div>
                <p className="text-sm font-medium text-ink">{note.title}</p>
                <p className="line-clamp-5 text-sm text-ink-2">{note.description}</p>
                {note.taster && <p className="text-xs text-muted">— {note.taster}</p>}
              </article>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionTitle title="Serve it with" hint="Food tags that ship with the wine in the dataset." />
        <div className="flex flex-wrap gap-2">
          {wine.pairings.map((p) => (
            <PairingChip key={p} name={p} />
          ))}
        </div>
      </section>

      {data.similar.taste.length > 0 && (
        <section>
          <SectionTitle title="Drinkers who loved this also loved" hint="From co-rating patterns across the ratings data." />
          <WineGrid wines={data.similar.taste.slice(0, 6)} />
        </section>
      )}

      {data.similar.profile.length > 0 && (
        <section>
          <SectionTitle title="Same style, different bottle" hint="Matched on grape, body, acidity, origin and food pairings." />
          <WineGrid wines={data.similar.profile.slice(0, 6)} />
        </section>
      )}
    </div>
  );
}

/* --------------------------------------------------- cellar interactions */

function CellarActions({ detail, onChange }: { detail: Detail; onChange: () => void }) {
  const [open, setOpen] = useState<'bottle' | 'note' | null>(null);
  const [busy, setBusy] = useState(false);
  const wineId = detail.wine.id;
  const owned = detail.cellar.bottles.reduce((s, b) => s + b.quantity, 0);

  const toggleWishlist = async () => {
    setBusy(true);
    try {
      await api(`/wishlist/${wineId}`, { method: detail.cellar.wishlisted ? 'DELETE' : 'PUT', body: JSON.stringify({}) });
      onChange();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-primary" onClick={() => setOpen(open === 'bottle' ? null : 'bottle')}>
          + Add to cellar
        </button>
        <button type="button" className="btn" onClick={() => setOpen(open === 'note' ? null : 'note')}>
          ✎ Log a tasting
        </button>
        <button type="button" className="btn" onClick={toggleWishlist} disabled={busy}>
          {detail.cellar.wishlisted ? '★ On your wishlist' : '☆ Add to wishlist'}
        </button>
        {owned > 0 && (
          <span className="text-sm text-ink-2">
            You have {owned} bottle{owned > 1 ? 's' : ''} in the cellar
          </span>
        )}
      </div>

      {open === 'bottle' && (
        <BottleForm
          wineId={wineId}
          vintages={detail.wine.vintages}
          onDone={() => {
            setOpen(null);
            onChange();
          }}
        />
      )}
      {open === 'note' && (
        <NoteForm
          wineId={wineId}
          vintages={detail.wine.vintages}
          onDone={() => {
            setOpen(null);
            onChange();
          }}
        />
      )}

      {detail.cellar.notes.length > 0 && (
        <ul className="flex flex-col gap-2 border-t border-line pt-3">
          {detail.cellar.notes.map((n) => (
            <li key={n.id} className="flex items-start gap-3 text-sm">
              <Stars value={n.rating} />
              <span className="flex-1 text-ink-2">{n.notes}</span>
              <span className="text-xs text-muted">{n.tasted_on}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BottleForm({ wineId, vintages, onDone }: { wineId: number; vintages: number[]; onDone: () => void }) {
  const [form, setForm] = useState({ vintage: String(vintages[0] ?? ''), quantity: 1, price_paid: '', location: '', drink_from: '', drink_to: '' });
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api('/cellar', {
        method: 'POST',
        body: JSON.stringify({
          wine_id: wineId,
          vintage: form.vintage ? Number(form.vintage) : null,
          quantity: Number(form.quantity) || 1,
          price_paid: form.price_paid ? Number(form.price_paid) : null,
          location: form.location || null,
          drink_from: form.drink_from ? Number(form.drink_from) : null,
          drink_to: form.drink_to ? Number(form.drink_to) : null,
        }),
      });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-3 border-t border-line pt-3 sm:grid-cols-3 lg:grid-cols-6">
      <label className="flex flex-col gap-1">
        <span className="label">Vintage</span>
        <select className="field" value={form.vintage} onChange={(e) => setForm({ ...form, vintage: e.target.value })}>
          <option value="">Non-vintage</option>
          {vintages.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="label">Bottles</span>
        <input type="number" min={1} className="field" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="label">Price each</span>
        <input type="number" step="0.01" className="field" value={form.price_paid} onChange={(e) => setForm({ ...form, price_paid: e.target.value })} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="label">Where</span>
        <input className="field" placeholder="Rack B" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="label">Drink from</span>
        <input type="number" className="field" placeholder="2026" value={form.drink_from} onChange={(e) => setForm({ ...form, drink_from: e.target.value })} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="label">Drink by</span>
        <input type="number" className="field" placeholder="2032" value={form.drink_to} onChange={(e) => setForm({ ...form, drink_to: e.target.value })} />
      </label>
      {error && <p className="col-span-full text-sm text-accent">{error}</p>}
      <div className="col-span-full">
        <button type="submit" className="btn btn-primary">
          Save bottle
        </button>
      </div>
    </form>
  );
}

function NoteForm({ wineId, vintages, onDone }: { wineId: number; vintages: number[]; onDone: () => void }) {
  const [form, setForm] = useState({ vintage: String(vintages[0] ?? ''), rating: 4, notes: '' });
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api('/notes', {
        method: 'POST',
        body: JSON.stringify({
          wine_id: wineId,
          vintage: form.vintage ? Number(form.vintage) : null,
          rating: Number(form.rating),
          notes: form.notes || null,
        }),
      });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-3 border-t border-line pt-3 sm:grid-cols-4">
      <label className="flex flex-col gap-1">
        <span className="label">Vintage</span>
        <select className="field" value={form.vintage} onChange={(e) => setForm({ ...form, vintage: e.target.value })}>
          <option value="">Non-vintage</option>
          {vintages.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="label">Your score: {form.rating}</span>
        <input
          type="range"
          min={1}
          max={5}
          step={0.5}
          value={form.rating}
          onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}
          className="mt-2 accent-[color:var(--accent)]"
        />
      </label>
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="label">Tasting note</span>
        <input
          className="field"
          placeholder="Dark cherry, tobacco, still tight — decant next time."
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </label>
      {error && <p className="col-span-full text-sm text-accent">{error}</p>}
      <div className="col-span-full">
        <button type="submit" className="btn btn-primary">
          Save note
        </button>
      </div>
    </form>
  );
}
