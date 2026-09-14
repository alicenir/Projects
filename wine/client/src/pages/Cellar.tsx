import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, useApi } from '../lib/api';
import type { WineCard } from '../lib/api';
import { BarList, Figure, Stars, StatTile } from '../components/charts';
import { EmptyState, ErrorState, Loading, SectionTitle, WineGrid } from '../components/ui';
import { compact, flag, money, num, typeColor } from '../lib/format';

type Bottle = {
  id: number; wine_id: number; vintage: number | null; quantity: number; price_paid: number | null; currency: string;
  location: string | null; drink_from: number | null; drink_to: number | null; notes: string | null;
  name: string; winery: string; type: string; country: string; country_code: string; region: string;
  grapes: string[]; rating_avg: number | null; rating_count: number;
};

type CellarPayload = {
  bottles: Bottle[];
  summary: { entries: number; bottles: number; spend: number; countries: number };
  byType: { type: string; bottles: number }[];
  byCountry: { country: string; country_code: string; bottles: number }[];
};

type NotesPayload = {
  notes: { id: number; wine_id: number; rating: number | null; notes: string | null; tasted_on: string; name: string; winery: string; type: string; grapes: string[] }[];
  summary: { tastings: number; avg_rating: number | null; wines: number };
  byGrape: { name: string; tastings: number; avg_rating: number | null }[];
};

type WishlistRow = { wine_id: number; note: string | null; name: string; winery: string; type: string; country: string; rating_avg: number | null; rating_count: number };

const TABS = ['Bottles', 'Journal', 'Wishlist', 'For you'] as const;

export default function Cellar() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Bottles');
  const cellar = useApi<CellarPayload>('/cellar');
  const notes = useApi<NotesPayload>('/notes');
  const wishlist = useApi<WishlistRow[]>('/wishlist');
  const recs = useApi<{ basis: string; items: WineCard[] }>('/recommend/for-me');

  if (cellar.error) return <ErrorState error={cellar.error} />;
  if (!cellar.data) return <Loading label="Counting bottles…" />;

  const s = cellar.data.summary;

  return (
    <div className="flex flex-col gap-5">
      <SectionTitle
        title="My cellar"
        hint="Your bottles, your tasting notes, your wishlist — stored locally in the app's own database."
        action={
          <a href="/api/cellar/export.csv" className="chip">
            ⤓ Export CSV
          </a>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Bottles" value={String(s.bottles)} note={`${s.entries} entries`} hero />
        <StatTile label="Spent" value={s.spend ? money(s.spend) : '—'} note="on bottles with a price" />
        <StatTile label="Countries" value={String(s.countries)} />
        <StatTile label="Tastings logged" value={String(notes.data?.summary.tastings ?? 0)} note={notes.data?.summary.avg_rating ? `you average ${num(notes.data.summary.avg_rating, 2)}` : undefined} />
      </div>

      <div className="flex flex-wrap gap-2" role="tablist">
        {TABS.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={`chip ${tab === t ? 'chip-active' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Bottles' && (
        <div className="flex flex-col gap-4">
          {cellar.data.bottles.length === 0 ? (
            <EmptyState title="No bottles yet" hint="Open any wine and hit “Add to cellar”." />
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                <Figure
                  title="What is on the rack"
                  subtitle="Bottles by style"
                  legend={cellar.data.byType.map((t) => ({ label: t.type, color: typeColor(t.type) }))}
                  table={{ columns: ['Style', 'Bottles'], rows: cellar.data.byType.map((t) => [t.type, t.bottles]) }}
                >
                  <BarList rows={cellar.data.byType.map((t) => ({ label: t.type, value: t.bottles, color: typeColor(t.type) }))} format={(v) => `${v}`} />
                </Figure>
                <Figure
                  title="Where it came from"
                  subtitle="Bottles by country"
                  table={{ columns: ['Country', 'Bottles'], rows: cellar.data.byCountry.map((c) => [c.country, c.bottles]) }}
                >
                  <BarList
                    rows={cellar.data.byCountry.map((c) => ({ label: `${flag(c.country_code)} ${c.country}`, value: c.bottles }))}
                    format={(v) => `${v}`}
                  />
                </Figure>
              </div>

              <div className="card overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line text-xs text-muted">
                    <tr>
                      <th className="px-4 py-2 font-semibold">Wine</th>
                      <th className="px-4 py-2 font-semibold">Vintage</th>
                      <th className="px-4 py-2 font-semibold">Bottles</th>
                      <th className="px-4 py-2 font-semibold">Paid</th>
                      <th className="px-4 py-2 font-semibold">Drink</th>
                      <th className="px-4 py-2 font-semibold">Where</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {cellar.data.bottles.map((b) => (
                      <tr key={b.id} className="border-b border-line last:border-0">
                        <td className="px-4 py-2">
                          <Link to={`/wine/${b.wine_id}`} className="font-medium text-ink hover:text-accent">
                            {b.name}
                          </Link>
                          <span className="block text-xs text-muted">
                            {b.winery} · {flag(b.country_code)} {b.region || b.country}
                          </span>
                        </td>
                        <td className="px-4 py-2 tabular-nums text-ink-2">{b.vintage ?? 'NV'}</td>
                        <td className="px-4 py-2 tabular-nums text-ink-2">{b.quantity}</td>
                        <td className="px-4 py-2 tabular-nums text-ink-2">{b.price_paid ? `${b.price_paid} ${b.currency}` : '—'}</td>
                        <td className="px-4 py-2 tabular-nums text-ink-2">
                          {b.drink_from || b.drink_to ? `${b.drink_from ?? '…'}–${b.drink_to ?? '…'}` : '—'}
                        </td>
                        <td className="px-4 py-2 text-ink-2">{b.location ?? '—'}</td>
                        <td className="px-4 py-2 text-right">
                          <button
                            type="button"
                            className="text-xs text-muted hover:text-accent"
                            onClick={async () => {
                              await api(`/cellar/${b.id}`, { method: 'DELETE' });
                              cellar.reload();
                            }}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'Journal' && (
        <div className="flex flex-col gap-4">
          {!notes.data || notes.data.notes.length === 0 ? (
            <EmptyState title="No tastings logged" hint="Open a wine and use “Log a tasting” to start your journal." />
          ) : (
            <>
              {notes.data.byGrape.length > 0 && (
                <Figure
                  title="What you drink"
                  subtitle="Your tastings by grape"
                  table={{ columns: ['Grape', 'Tastings', 'Your average'], rows: notes.data.byGrape.map((g) => [g.name, g.tastings, num(g.avg_rating, 2)]) }}
                >
                  <BarList
                    rows={notes.data.byGrape.map((g) => ({ label: g.name, value: g.tastings, note: `avg ${num(g.avg_rating, 2)}` }))}
                    format={(v) => `${v}`}
                  />
                </Figure>
              )}
              <ul className="flex flex-col gap-3">
                {notes.data.notes.map((n) => (
                  <li key={n.id} className="card flex flex-col gap-2 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: typeColor(n.type) }} />
                      <Link to={`/wine/${n.wine_id}`} className="font-medium text-ink hover:text-accent">
                        {n.name}
                      </Link>
                      <span className="text-xs text-muted">{n.winery}</span>
                      <Stars value={n.rating} />
                      <span className="ml-auto text-xs text-muted">{n.tasted_on}</span>
                      <button
                        type="button"
                        className="text-xs text-muted hover:text-accent"
                        onClick={async () => {
                          await api(`/notes/${n.id}`, { method: 'DELETE' });
                          notes.reload();
                        }}
                      >
                        Delete
                      </button>
                    </div>
                    {n.notes && <p className="text-sm text-ink-2">{n.notes}</p>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {tab === 'Wishlist' && (
        <div className="flex flex-col gap-3">
          {!wishlist.data || wishlist.data.length === 0 ? (
            <EmptyState title="Nothing on the wishlist" hint="Star a wine from its page to keep track of it." />
          ) : (
            wishlist.data.map((w) => (
              <div key={w.wine_id} className="card flex flex-wrap items-center gap-3 p-4">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: typeColor(w.type) }} />
                <Link to={`/wine/${w.wine_id}`} className="font-medium text-ink hover:text-accent">
                  {w.name}
                </Link>
                <span className="text-xs text-muted">
                  {w.winery} · {w.country}
                </span>
                <span className="ml-auto flex items-center gap-2">
                  <Stars value={w.rating_avg} />
                  <span className="text-xs text-muted">({compact(w.rating_count)})</span>
                </span>
                <button
                  type="button"
                  className="text-xs text-muted hover:text-accent"
                  onClick={async () => {
                    await api(`/wishlist/${w.wine_id}`, { method: 'DELETE' });
                    wishlist.reload();
                  }}
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'For you' && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-2">
            {recs.data?.basis === 'cellar'
              ? 'Built from the wines you own and rated highly, using co-rating patterns across 150K ratings.'
              : 'Built from your taste-test answers — log a few bottles and this list learns from them instead.'}
          </p>
          {recs.data ? <WineGrid wines={recs.data.items} /> : <Loading />}
        </div>
      )}
    </div>
  );
}
