import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApi, queryString } from '../lib/api';
import type { Facets, WineList } from '../lib/api';
import { ErrorState, Loading, SectionTitle, WineGrid } from '../components/ui';
import { useDebounced } from '../components/charts';
import { compact, flag, typeColor } from '../lib/format';

const MULTI = ['type', 'country', 'grape', 'pairing', 'body', 'acidity'] as const;
type MultiKey = (typeof MULTI)[number];

const SORTS = [
  { value: 'score', label: 'Best rated' },
  { value: 'popular', label: 'Most rated' },
  { value: 'rating', label: 'Highest average' },
  { value: 'name', label: 'Name A–Z' },
  { value: 'abv_desc', label: 'Strongest' },
  { value: 'abv_asc', label: 'Lightest' },
  { value: 'oldest', label: 'Oldest vintage' },
  { value: 'random', label: 'Surprise me' },
];

const FACET_LABELS: Record<MultiKey, string> = {
  type: 'Style',
  country: 'Country',
  grape: 'Grape',
  pairing: 'Goes with',
  body: 'Body',
  acidity: 'Acidity',
};

export default function Explore() {
  const [params, setParams] = useSearchParams();
  const [text, setText] = useState(params.get('q') ?? '');
  const q = useDebounced(text, 300);

  const selected = useMemo(() => {
    const out = {} as Record<MultiKey, string[]>;
    for (const key of MULTI) out[key] = params.get(key)?.split(',').filter(Boolean) ?? [];
    return out;
  }, [params]);

  const page = Number(params.get('page') ?? 1);
  const sort = params.get('sort') ?? 'score';
  const minRatings = params.get('minRatings') ?? '';
  const region = params.get('region') ?? '';
  const winery = params.get('winery') ?? '';
  const abvMin = params.get('abvMin') ?? '';
  const abvMax = params.get('abvMax') ?? '';

  const url = `/wines${queryString({
    q,
    ...selected,
    sort,
    page,
    minRatings,
    abvMin,
    abvMax,
    region,
    winery,
    pageSize: 24,
  })}`;
  const { data, error, loading, refetching } = useApi<WineList>(url);

  const update = (mutate: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(params);
    mutate(next);
    next.delete('page');
    setParams(next, { replace: true });
  };

  const toggle = (key: MultiKey, value: string) =>
    update((next) => {
      const current = new Set(next.get(key)?.split(',').filter(Boolean) ?? []);
      if (current.has(value)) current.delete(value);
      else current.add(value);
      if (current.size) next.set(key, [...current].join(','));
      else next.delete(key);
    });

  const activeCount = MULTI.reduce((n, key) => n + selected[key].length, 0) + (minRatings ? 1 : 0) + (abvMin || abvMax ? 1 : 0);

  if (error) return <ErrorState error={error} />;

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <aside className="w-full shrink-0 lg:w-72">
        <div className="card sticky top-20 flex max-h-[calc(100vh-6rem)] flex-col gap-4 overflow-y-auto p-4">
          <div>
            <label className="label" htmlFor="explore-q">
              Search
            </label>
            <input
              id="explore-q"
              className="field mt-1"
              placeholder="Wine, producer, region…"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                update((next) => (e.target.value ? next.set('q', e.target.value) : next.delete('q')));
              }}
            />
          </div>

          <div>
            <label className="label" htmlFor="explore-sort">
              Sort
            </label>
            <select
              id="explore-sort"
              className="field mt-1"
              value={sort}
              onChange={(e) => update((next) => next.set('sort', e.target.value))}
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="abv-min">
                ABV min
              </label>
              <input
                id="abv-min"
                type="number"
                step="0.5"
                className="field mt-1"
                value={abvMin}
                onChange={(e) => update((next) => (e.target.value ? next.set('abvMin', e.target.value) : next.delete('abvMin')))}
              />
            </div>
            <div>
              <label className="label" htmlFor="abv-max">
                ABV max
              </label>
              <input
                id="abv-max"
                type="number"
                step="0.5"
                className="field mt-1"
                value={abvMax}
                onChange={(e) => update((next) => (e.target.value ? next.set('abvMax', e.target.value) : next.delete('abvMax')))}
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="min-ratings">
              Minimum ratings
            </label>
            <select
              id="min-ratings"
              className="field mt-1"
              value={minRatings}
              onChange={(e) => update((next) => (e.target.value ? next.set('minRatings', e.target.value) : next.delete('minRatings')))}
            >
              <option value="">Any</option>
              <option value="10">10+</option>
              <option value="50">50+</option>
              <option value="200">200+</option>
            </select>
          </div>

          {data?.facets &&
            MULTI.map((key) => (
              <FacetGroup
                key={key}
                title={FACET_LABELS[key]}
                facetKey={key}
                facets={data.facets!}
                selected={selected[key]}
                onToggle={(value) => toggle(key, value)}
              />
            ))}

          {activeCount > 0 && (
            <button type="button" className="btn" onClick={() => { setText(''); setParams({}, { replace: true }); }}>
              Clear {activeCount} filter{activeCount > 1 ? 's' : ''}
            </button>
          )}
        </div>
      </aside>

      <section className="min-w-0 flex-1">
        <SectionTitle
          title="Explore the catalogue"
          hint={data ? `${data.total.toLocaleString()} wines match` : 'Filtering…'}
          action={
            (region || winery) && (
              <button
                type="button"
                className="chip chip-active"
                onClick={() =>
                  setParams((p) => {
                    const next = new URLSearchParams(p);
                    next.delete('region');
                    next.delete('winery');
                    return next;
                  }, { replace: true })
                }
              >
                {region ? 'Scoped to one region' : 'Scoped to one producer'} ✕
              </button>
            )
          }
        />
        {loading && !data ? (
          <Loading />
        ) : (
          <div className={refetching ? 'is-refetching' : undefined}>
            <WineGrid wines={data?.items ?? []} />
            {data && data.total > data.pageSize && (
              <nav className="mt-5 flex items-center justify-between gap-2">
                <button
                  type="button"
                  className="btn"
                  disabled={page <= 1}
                  onClick={() => setParams((p) => {
                    const next = new URLSearchParams(p);
                    next.set('page', String(page - 1));
                    return next;
                  })}
                >
                  ← Previous
                </button>
                <span className="text-sm text-ink-2">
                  Page {page} of {Math.ceil(data.total / data.pageSize).toLocaleString()}
                </span>
                <button
                  type="button"
                  className="btn"
                  disabled={page >= Math.ceil(data.total / data.pageSize)}
                  onClick={() => setParams((p) => {
                    const next = new URLSearchParams(p);
                    next.set('page', String(page + 1));
                    return next;
                  })}
                >
                  Next →
                </button>
              </nav>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function FacetGroup({
  title,
  facetKey,
  facets,
  selected,
  onToggle,
}: {
  title: string;
  facetKey: MultiKey;
  facets: Facets;
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const rows = facets[facetKey] ?? [];
  if (!rows.length) return null;
  const visible = expanded ? rows : rows.slice(0, 8);

  return (
    <div>
      <p className="label mb-1.5">{title}</p>
      <ul className="flex flex-col gap-1">
        {visible.map((row) => {
          const active = selected.includes(row.value);
          return (
            <li key={row.value}>
              <button
                type="button"
                onClick={() => onToggle(row.value)}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-sm transition-colors ${
                  active ? 'bg-accent-soft text-accent' : 'text-ink-2 hover:bg-raised'
                }`}
              >
                {facetKey === 'type' && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: typeColor(row.value) }} />}
                {facetKey === 'country' && <span aria-hidden>{flag(row.value)}</span>}
                <span className="truncate">{row.label ?? row.value}</span>
                <span className="ml-auto shrink-0 text-xs tabular-nums text-muted">{compact(row.count)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {rows.length > 8 && (
        <button type="button" className="mt-1 text-xs text-accent hover:underline" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Show fewer' : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  );
}
