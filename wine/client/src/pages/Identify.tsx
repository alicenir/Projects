import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, useApi } from '../lib/api';
import type { WineCard } from '../lib/api';
import { BarList, Figure, StatTile } from '../components/charts';
import { Loading, PairingChip, SectionTitle, WineGrid } from '../components/ui';
import { compact, flag, money, num, slug, typeColor } from '../lib/format';

type Match = {
  kind: 'wine' | 'label';
  ref: number;
  confidence: number;
  why: string[];
  title: string;
  subtitle: string;
  vintage: number | null;
};

type Identity = {
  producer: string;
  name: string | null;
  vintage: number | null;
  requestedVintage?: number | null;
  exactVintage?: boolean;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  grapes: string[];
  type?: string;
  abv?: number | null;
  body?: string;
  acidity?: string;
  vintages: number[];
};

type Dossier = {
  kind: 'wine' | 'label';
  wineId?: number;
  labelId?: number;
  identity: Identity;
  community?: {
    average: number | null;
    count: number;
    weighted: number | null;
    histogram: { bucket: number; n: number }[];
    byVintage: { vintage: number; n: number; avg: number }[];
    thisVintage: { n: number; avg: number | null } | null;
  };
  critics?: {
    reviews: number;
    pointsAverage: number | null;
    pointsBest: number | null;
    priceMedian: number | null;
    priceRange: [number | null, number | null];
    vintages: { vintage: number; points: number | null; price: number | null }[];
    review: { title: string; points: number; price: number | null; description: string; taster: string | null; vintage: number | null } | null;
  };
  pairings?: string[];
  flavours: { word: string; family: string; n: number; lift: number }[];
  ownDescriptors?: { word: string; family: string; n: number }[];
  benchmark: { grape: { n: number; points_avg: number; price_med: number; price_p10: number; price_p90: number } | null; here: { n: number; points_avg: number; price_med: number } | null };
  criticLabels?: { id: number; winery: string; designation: string | null; variety: string | null; points_avg: number | null; price_med: number | null; n: number }[];
  catalogue?: WineCard[];
  similar?: WineCard[];
};

type Prices = {
  live: { provider: string; fetchedAt: string; quotes: { merchant: string | null; name: string | null; price: number | null; currency: string | null; url: string | null; inStock: boolean | null }[] } | null;
  benchmark: { n: number; points_avg: number; price_med: number; price_p10: number; price_p90: number } | null;
  benchmarkNote: string;
  providerConfigured: boolean;
};

type LookupResult = {
  query: { text: string; vintage: number | null; tokens: string[]; source: 'text' | 'photo' };
  matches: Match[];
  dossier: Dossier | null;
  prices: Prices | null;
  reading?: { text: string; lines: string[]; confidence: number };
  hint?: string;
};

const EXAMPLES = [
  { text: 'Penfolds Grange', vintage: '2015' },
  { text: 'Cloudy Bay Sauvignon Blanc Marlborough', vintage: '2016' },
  { text: 'Château Lafite Rothschild Pauillac', vintage: '2010' },
  { text: 'Ponzi Reserve Pinot Noir Willamette', vintage: '2013' },
];

export default function Identify() {
  const capabilities = useApi<{ photo: boolean; priceProvider: string | null }>('/lookup/capabilities');
  const [text, setText] = useState('');
  const [vintage, setVintage] = useState('');
  const [result, setResult] = useState<LookupResult | null>(null);
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [busy, setBusy] = useState<false | 'text' | 'photo'>(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const runText = async (query = text, year = vintage) => {
    if (query.trim().length < 2) return;
    setBusy('text');
    setError(null);
    try {
      const body = JSON.stringify({ text: query.trim(), vintage: year ? Number(year) : null });
      const res = await api<LookupResult>('/lookup', { method: 'POST', body });
      setResult(res);
      setDossier(res.dossier);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const runPhoto = async (file: File) => {
    setBusy('photo');
    setError(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    try {
      // The label's own year wins over whatever is left in the form; the user
      // can still override it afterwards by editing the year and re-running.
      const form = new FormData();
      form.append('photo', file);
      const res = await fetch('/api/lookup/photo', { method: 'POST', body: form });
      const payload = (await res.json()) as LookupResult & { error?: string };
      if (!res.ok) throw new Error(payload.error || 'could not read the label');
      setResult(payload);
      setDossier(payload.dossier);
      if (payload.query.text) setText(payload.query.text);
      if (payload.query.vintage) setVintage(String(payload.query.vintage));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const chooseMatch = async (match: Match) => {
    setBusy('text');
    try {
      const next = await api<Dossier>(`/lookup/${match.kind}/${match.ref}${match.vintage ? `?vintage=${match.vintage}` : ''}`);
      setDossier(next);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <SectionTitle
        title="What is this bottle?"
        hint="Type what the label says — or photograph it — and Terroir will tell you what it knows: who rated it, what the critics scored it, what it usually costs and what it tastes like."
      />

      <div className="card flex flex-col gap-4 p-5">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void runText();
          }}
        >
          <label className="flex min-w-[16rem] flex-1 flex-col gap-1">
            <span className="label">Producer and wine</span>
            <input
              className="field"
              placeholder="Château Lafite Rothschild Pauillac"
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="flex w-28 flex-col gap-1">
            <span className="label">Year</span>
            <input
              className="field"
              placeholder="2016"
              inputMode="numeric"
              value={vintage}
              onChange={(e) => setVintage(e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={busy !== false || text.trim().length < 2}>
            {busy === 'text' ? 'Looking…' : 'Identify'}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => fileInput.current?.click()}
            disabled={busy !== false || capabilities.data?.photo === false}
            title={capabilities.data?.photo === false ? 'Run "npm run ocr:setup" in server/ to enable label reading' : undefined}
          >
            {busy === 'photo' ? 'Reading label…' : '📷 Photograph the label'}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void runPhoto(file);
              e.target.value = '';
            }}
          />
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">Try:</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex.text}
              type="button"
              className="chip"
              onClick={() => {
                setText(ex.text);
                setVintage(ex.vintage);
                void runText(ex.text, ex.vintage);
              }}
            >
              {ex.text} {ex.vintage}
            </button>
          ))}
        </div>

        {capabilities.data?.photo === false && (
          <p className="text-xs text-muted">
            Label reading is off until the Tesseract language file is installed — run <code>npm run ocr:setup</code> in{' '}
            <code>server/</code>. Photos are read on your own machine and never uploaded anywhere else.
          </p>
        )}
        {error && <p className="text-sm text-accent">{error}</p>}
      </div>

      {preview && result?.query.source === 'photo' && (
        <div className="card flex flex-wrap items-start gap-4 p-4">
          <img src={preview} alt="The bottle you photographed" className="h-32 w-auto rounded-xl border border-line object-cover" />
          <div className="min-w-[14rem] flex-1">
            <p className="label">What the label read</p>
            <p className="mt-1 text-sm text-ink-2">
              {result.reading?.lines.slice(0, 6).join(' · ') || '—'}
            </p>
            <p className="mt-1 text-xs text-muted">OCR confidence {result.reading?.confidence ?? 0}%. Edit the text above and re-run if it misread something.</p>
          </div>
        </div>
      )}

      {busy && !result && <Loading label="Checking the cellar…" />}

      {result && result.matches.length === 0 && (
        <div className="card px-6 py-8">
          <p className="font-medium text-ink">No match</p>
          <p className="mt-1 text-sm text-ink-2">
            {result.hint ?? 'Nothing in either dataset looks like that bottle. Try the producer name on its own, or drop the vintage.'}
          </p>
        </div>
      )}

      {result && result.matches.length > 0 && (
        <section>
          <SectionTitle title="Best matches" hint="Confidence blends how much of your text is explained, the producer, and whether that vintage exists." />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {result.matches.map((m) => {
              const active = dossier
                ? (m.kind === 'wine' && dossier.wineId === m.ref) || (m.kind === 'label' && dossier.labelId === m.ref)
                : false;
              return (
                <button
                  key={`${m.kind}-${m.ref}`}
                  type="button"
                  onClick={() => void chooseMatch(m)}
                  className={`card flex flex-col gap-1 p-4 text-left transition-colors hover:border-accent ${active ? 'border-accent' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="flex-1 text-sm font-semibold leading-snug text-ink">{m.title}</span>
                    <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">{m.confidence}%</span>
                  </div>
                  <span className="text-xs text-ink-2">{m.subtitle}</span>
                  <span className="text-[11px] text-muted">
                    {m.kind === 'wine' ? 'in the ratings catalogue' : 'from the critic archive'}
                    {m.why.length ? ` · ${m.why[0]}` : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {dossier && <DossierView dossier={dossier} prices={result?.prices ?? null} query={result?.query.text ?? ''} />}
    </div>
  );
}

/* ------------------------------------------------------------------ dossier */

function DossierView({ dossier, prices, query }: { dossier: Dossier; prices: Prices | null; query: string }) {
  const id = dossier.identity;
  const [livePrices, setLivePrices] = useState<Prices | null>(prices);
  const [refreshing, setRefreshing] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);

  useEffect(() => setLivePrices(prices), [prices]);

  const refresh = async () => {
    setRefreshing(true);
    setPriceError(null);
    try {
      const body = JSON.stringify({ text: query, vintage: id.vintage, kind: dossier.kind, ref: dossier.wineId ?? dossier.labelId });
      setLivePrices(await api<Prices>('/prices/refresh', { method: 'POST', body }));
    } catch (err) {
      setPriceError((err as Error).message);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="card flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-2">
          {id.type && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: typeColor(id.type) }} />
              {id.type}
            </span>
          )}
          <span>{dossier.kind === 'wine' ? 'Community catalogue' : 'Critic archive'}</span>
          {id.grapes.length > 0 && <span>· {id.grapes.join(', ')}</span>}
          {id.abv != null && <span>· {id.abv}% ABV</span>}
        </div>

        <h2 className="text-2xl font-semibold leading-tight tracking-tight text-ink sm:text-3xl">
          {id.producer} {id.name ?? ''} {id.vintage ?? ''}
        </h2>

        <p className="text-sm text-ink-2">
          {[id.region, id.country].filter(Boolean).join(' · ')}
          {id.countryCode ? ` ${flag(id.countryCode)}` : ''}
        </p>

        {dossier.kind === 'label' && id.requestedVintage && !id.exactVintage && (
          <p className="text-sm text-accent">
            No critic review of the {id.requestedVintage}. Showing the closest vintage on file, {id.vintage}.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {id.grapes.map((g) => (
            <Link key={g} to={`/grapes/${slug(g)}`} className="chip">
              🍇 {g}
            </Link>
          ))}
          {dossier.wineId && (
            <Link to={`/wine/${dossier.wineId}`} className="chip">
              Open the full wine page →
            </Link>
          )}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {dossier.community && (
          <>
            <StatTile
              label="Drinkers"
              value={num(dossier.community.average, 2)}
              note={`${compact(dossier.community.count)} ratings`}
              hero
            />
            <StatTile
              label={id.vintage ? `The ${id.vintage}` : 'This vintage'}
              value={dossier.community.thisVintage ? num(dossier.community.thisVintage.avg, 2) : '—'}
              note={dossier.community.thisVintage ? `${dossier.community.thisVintage.n} ratings` : 'not rated separately'}
            />
          </>
        )}
        {dossier.critics && (
          <>
            <StatTile
              label="Critics"
              value={dossier.critics.pointsAverage ? num(dossier.critics.pointsAverage, 1) : '—'}
              note={`${dossier.critics.reviews} review${dossier.critics.reviews === 1 ? '' : 's'} · best ${dossier.critics.pointsBest ?? '—'}`}
              hero={!dossier.community}
            />
            <StatTile
              label="Usual price"
              value={money(dossier.critics.priceMedian)}
              note={
                dossier.critics.priceRange[0] != null
                  ? `${money(dossier.critics.priceRange[0])}–${money(dossier.critics.priceRange[1])} across vintages`
                  : 'no price on file'
              }
            />
          </>
        )}
        {dossier.benchmark.grape && (
          <StatTile
            label="Typical for the grape"
            value={money(dossier.benchmark.grape.price_med)}
            note={`${num(dossier.benchmark.grape.points_avg, 1)} pts across ${compact(dossier.benchmark.grape.n)} reviews`}
          />
        )}
      </div>

      <div className="card flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-baseline gap-3">
          <h3 className="text-sm font-semibold text-ink">What it costs</h3>
          <button type="button" className="chip ml-auto" onClick={() => void refresh()} disabled={refreshing}>
            {refreshing ? 'Checking…' : '↻ Check live prices'}
          </button>
        </div>

        {livePrices?.live ? (
          <>
            <p className="text-xs text-muted">
              {livePrices.live.provider} · fetched {new Date(livePrices.live.fetchedAt).toLocaleString()}
            </p>
            <ul className="flex flex-col gap-2">
              {livePrices.live.quotes.map((q, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2 border-b border-line pb-2 last:border-0">
                  <span className="text-sm text-ink">{q.name ?? q.merchant}</span>
                  <span className="text-xs text-muted">{q.merchant}</span>
                  {q.inStock === false && <span className="text-xs text-accent">out of stock</span>}
                  <span className="ml-auto font-semibold tabular-nums text-ink">
                    {q.price != null ? `${q.price} ${q.currency ?? ''}`.trim() : '—'}
                  </span>
                  {q.url && (
                    <a href={q.url} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline">
                      open
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-ink-2">
            {livePrices?.providerConfigured
              ? 'No live quotes cached yet — hit “Check live prices”.'
              : 'No live price feed is configured, so the figures above are the critic benchmark.'}
          </p>
        )}

        {priceError && <p className="text-sm text-accent">{priceError}</p>}
        <p className="text-xs text-muted">{livePrices?.benchmarkNote}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {dossier.critics?.review && (
          <Figure title="What the critic wrote" subtitle={dossier.critics.review.title}>
            <div className="flex flex-col gap-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold tabular-nums text-ink">{dossier.critics.review.points}</span>
                <span className="text-xs text-muted">points</span>
                {dossier.critics.review.price != null && (
                  <span className="ml-auto text-sm font-medium text-accent">{money(dossier.critics.review.price)}</span>
                )}
              </div>
              <p className="text-sm italic text-ink-2">“{dossier.critics.review.description}”</p>
              {dossier.critics.review.taster && <p className="text-xs text-muted">— {dossier.critics.review.taster}</p>}
            </div>
          </Figure>
        )}

        {dossier.critics && dossier.critics.vintages.length > 1 && (
          <Figure
            title="Vintage by vintage"
            subtitle="Critic points for every vintage of this label on file"
            table={{
              columns: ['Vintage', 'Points', 'Price'],
              rows: dossier.critics.vintages.map((v) => [v.vintage, v.points ?? '—', money(v.price)]),
            }}
          >
            <BarList
              rows={dossier.critics.vintages.slice(0, 12).map((v) => ({
                label: String(v.vintage),
                value: v.points ?? 0,
                note: money(v.price),
              }))}
              max={100}
              format={(v) => `${Math.round(v)} pts`}
            />
          </Figure>
        )}

        {dossier.community && dossier.community.histogram.length > 0 && (
          <Figure
            title="How drinkers scored it"
            subtitle={`${compact(dossier.community.count)} ratings`}
            table={{ columns: ['Stars', 'Ratings'], rows: dossier.community.histogram.map((h) => [h.bucket, h.n]) }}
          >
            <BarList
              rows={dossier.community.histogram.map((h) => ({
                label: `${h.bucket} stars`,
                value: h.n,
                color: id.type ? typeColor(id.type) : undefined,
              }))}
              format={(v) => compact(v)}
            />
          </Figure>
        )}

        {dossier.community && dossier.community.byVintage.length > 0 && (
          <Figure
            title="Which vintage to buy"
            subtitle="Average rating per vintage"
            table={{ columns: ['Vintage', 'Ratings', 'Average'], rows: dossier.community.byVintage.map((v) => [v.vintage, v.n, num(v.avg, 2)]) }}
          >
            <BarList
              rows={dossier.community.byVintage.slice(0, 12).map((v) => ({
                label: String(v.vintage),
                value: v.avg,
                note: `(${v.n})`,
                color: id.type ? typeColor(id.type) : undefined,
              }))}
              max={5}
              format={(v) => num(v, 2)}
            />
          </Figure>
        )}

        {dossier.ownDescriptors && dossier.ownDescriptors.length > 0 && (
          <Figure title="How this label gets described" subtitle="Words the critics used across its vintages">
            <div className="flex flex-wrap gap-2 py-1">
              {dossier.ownDescriptors.map((d) => (
                <span key={d.word} className="chip" title={`${d.family} · ${d.n} reviews`}>
                  {d.word}
                </span>
              ))}
            </div>
          </Figure>
        )}

        {dossier.flavours.length > 0 && (
          <Figure
            title={`What ${id.grapes[0] ?? 'this grape'} usually tastes like`}
            subtitle="Descriptors used far more for this grape than for wine in general"
            footnote="Lift compares each word against all 130K reviews."
            table={{ columns: ['Descriptor', 'Family', 'Lift'], rows: dossier.flavours.map((f) => [f.word, f.family, `${f.lift.toFixed(1)}×`]) }}
          >
            <BarList
              rows={dossier.flavours.slice(0, 10).map((f) => ({ label: f.word, value: f.lift, note: compact(f.n) }))}
              format={(v) => `${v.toFixed(1)}×`}
            />
          </Figure>
        )}
      </div>

      {dossier.pairings && dossier.pairings.length > 0 && (
        <section>
          <SectionTitle title="Serve it with" />
          <div className="flex flex-wrap gap-2">
            {dossier.pairings.map((p) => (
              <PairingChip key={p} name={p} />
            ))}
          </div>
        </section>
      )}

      {dossier.similar && dossier.similar.length > 0 && (
        <section>
          <SectionTitle title="Drinkers who loved this also loved" />
          <WineGrid wines={dossier.similar} />
        </section>
      )}

      {dossier.catalogue && dossier.catalogue.length > 0 && (
        <section>
          <SectionTitle title="Related bottles we have ratings for" hint="Same producer, or the same grape from the same country." />
          <WineGrid wines={dossier.catalogue} />
        </section>
      )}

      {dossier.criticLabels && dossier.criticLabels.length > 0 && (
        <section>
          <SectionTitle title="Other wines this producer makes" hint="From the critic archive." />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {dossier.criticLabels.map((l) => (
              <div key={l.id} className="card flex flex-col gap-1 p-4">
                <p className="text-sm font-semibold text-ink">{[l.designation, l.variety].filter(Boolean).join(' ')}</p>
                <p className="text-xs text-muted">{l.n} reviews</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-lg font-semibold tabular-nums text-ink">{num(l.points_avg, 1)}</span>
                  <span className="text-xs text-muted">pts</span>
                  <span className="ml-auto text-sm text-accent">{money(l.price_med)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
