import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import type { WineCard } from '../lib/api';
import { api } from '../lib/api';
import { Stars } from './charts';
import { compact, flag, num, pairingIcon, slug, typeColor, vintageRange } from '../lib/format';

/* --------------------------------------------------------------- chrome */

const NAV = [
  { to: '/identify', label: 'Identify a bottle' },
  { to: '/explore', label: 'Explore' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/grapes', label: 'Grapes' },
  { to: '/atlas', label: 'Atlas' },
  { to: '/pairings', label: 'Pairings' },
  { to: '/taste', label: 'Taste test' },
  { to: '/blind', label: 'Blind tasting' },
  { to: '/cellar', label: 'My cellar' },
];

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-[color:var(--plane)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-ink">
            <span aria-hidden>🍷</span> Terroir
          </Link>
          <nav className="order-3 -mx-1 w-full overflow-x-auto md:order-none md:mx-0 md:w-auto">
            <ul className="flex items-center gap-1">
              {NAV.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      `whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition-colors ${
                        isActive ? 'bg-accent text-[color:var(--accent-ink)]' : 'text-ink-2 hover:bg-raised hover:text-ink'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <SearchBox compact />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-10 border-t border-line py-6 text-xs text-muted">
      <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4">
        <p>
          Built on open data:{' '}
          <a className="underline hover:text-accent" href="https://github.com/rogerioxavier/X-Wines" target="_blank" rel="noreferrer">
            X-Wines
          </a>{' '}
          (100K wines, 21M ratings — CC BY 4.0) and Wine Enthusiast tasting notes via the{' '}
          <a
            className="underline hover:text-accent"
            href="https://github.com/rfordatascience/tidytuesday/tree/master/data/2019/2019-05-28"
            target="_blank"
            rel="noreferrer"
          >
            TidyTuesday archive
          </a>
          .
        </p>
        <p>Ratings are drinkers&apos; 1–5 stars; points and prices are Wine Enthusiast&apos;s, collected in 2017.</p>
      </div>
    </footer>
  );
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<string>(() => document.documentElement.dataset.theme ?? 'system');
  useEffect(() => {
    if (theme === 'system') {
      delete document.documentElement.dataset.theme;
      localStorage.removeItem('terroir-theme');
    } else {
      document.documentElement.dataset.theme = theme;
      localStorage.setItem('terroir-theme', theme);
    }
  }, [theme]);
  const next = theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark';
  const icon = theme === 'dark' ? '🌙' : theme === 'light' ? '☀️' : '🖥️';
  return (
    <button type="button" className="chip" onClick={() => setTheme(next)} title={`Theme: ${theme} — switch to ${next}`}>
      <span aria-hidden>{icon}</span>
      <span className="sr-only">Switch theme</span>
    </button>
  );
}

/* --------------------------------------------------------------- search */

type Suggestions = {
  wines: { id: number; name: string; winery: string; type: string; country: string }[];
  grapes: { name: string; wine_count: number }[];
  regions: { id: number; name: string; country: string }[];
  wineries: { id: number; name: string; country: string }[];
};

export function SearchBox({ compact: small }: { compact?: boolean }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Suggestions | null>(null);
  const navigate = useNavigate();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setData(null);
      return;
    }
    const t = setTimeout(() => {
      api<Suggestions>(`/suggest?q=${encodeURIComponent(q)}`)
        .then(setData)
        .catch(() => setData(null));
    }, 160);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  const go = (to: string) => {
    setOpen(false);
    setQ('');
    navigate(to);
  };

  return (
    <div ref={box} className={`relative ${small ? 'w-44 sm:w-64' : 'w-full'}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) go(`/explore?q=${encodeURIComponent(q.trim())}`);
        }}
      >
        <input
          className={`field ${small ? 'py-1.5' : 'py-3 text-base'}`}
          placeholder={small ? 'Search wines…' : 'Search a wine, grape, region or producer…'}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          aria-label="Search the catalogue"
        />
      </form>
      {open && data && (data.wines.length > 0 || data.grapes.length > 0 || data.regions.length > 0) && (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-xl border border-line bg-surface shadow-card">
          {data.wines.map((w) => (
            <button key={w.id} type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-raised" onClick={() => go(`/wine/${w.id}`)}>
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: typeColor(w.type) }} />
              <span className="truncate text-sm text-ink">{w.name}</span>
              <span className="ml-auto truncate text-xs text-muted">{w.winery}</span>
            </button>
          ))}
          {data.grapes.map((g) => (
            <button key={g.name} type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-raised" onClick={() => go(`/grapes/${slug(g.name)}`)}>
              <span aria-hidden>🍇</span>
              <span className="truncate text-sm text-ink">{g.name}</span>
              <span className="ml-auto text-xs text-muted">{g.wine_count} wines</span>
            </button>
          ))}
          {data.regions.map((r) => (
            <button key={r.id} type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-raised" onClick={() => go(`/region/${r.id}`)}>
              <span aria-hidden>📍</span>
              <span className="truncate text-sm text-ink">{r.name}</span>
              <span className="ml-auto text-xs text-muted">{r.country}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------- wine cards */

/** A generated bottle silhouette — the open datasets ship no label images. */
export function Bottle({ wine, size = 56 }: { wine: Pick<WineCard, 'type' | 'winery'>; size?: number }) {
  const initials = wine.winery
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <div
      className="relative flex shrink-0 items-center justify-center rounded-xl"
      style={{ width: size, height: size * 1.35, background: 'var(--surface-2)' }}
      aria-hidden
    >
      <svg width={size * 0.55} height={size * 1.1} viewBox="0 0 22 44">
        <path d="M9 2h4v9c0 2 5 5 5 10v19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V21c0-5 5-8 5-10V2z" fill={typeColor(wine.type)} opacity={0.9} />
        <rect x="4.5" y="24" width="13" height="10" rx="1.5" fill="var(--surface-1)" opacity={0.92} />
      </svg>
      <span className="absolute bottom-[26%] text-[9px] font-semibold tracking-wide text-ink-2">{initials}</span>
    </div>
  );
}

export function WineCardTile({ wine }: { wine: WineCard }) {
  return (
    <Link to={`/wine/${wine.id}`} className="card group flex gap-3 p-3 transition-colors hover:border-accent">
      <Bottle wine={wine} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <h3 className="line-clamp-2 flex-1 text-sm font-semibold leading-snug text-ink group-hover:text-accent">{wine.name}</h3>
          {wine.match !== undefined && (
            <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">{wine.match}%</span>
          )}
        </div>
        <p className="truncate text-xs text-ink-2">
          {wine.winery} · {flag(wine.country_code)} {wine.region || wine.country}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: typeColor(wine.type) }} />
            {wine.type}
          </span>
          {wine.abv !== null && <span>{wine.abv}%</span>}
          <span>{vintageRange(wine)}</span>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <Stars value={wine.rating_avg} />
          <span className="text-xs tabular-nums text-ink-2">{num(wine.rating_avg, 2)}</span>
          <span className="text-[11px] text-muted">({compact(wine.rating_count)})</span>
        </div>
        {wine.reasons && wine.reasons.length > 0 && (
          <p className="mt-1 line-clamp-2 text-[11px] italic text-ink-2">{wine.reasons.join(' · ')}</p>
        )}
        {!wine.reasons && wine.grapes.length > 0 && (
          <p className="mt-1 truncate text-[11px] text-muted">{wine.grapes.join(', ')}</p>
        )}
      </div>
    </Link>
  );
}

export function WineGrid({ wines }: { wines: WineCard[] }) {
  if (!wines.length) return <EmptyState title="No wines match" hint="Loosen a filter or clear the search." />;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {wines.map((w) => (
        <WineCardTile key={w.id} wine={w} />
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- states */

export function SectionTitle({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
        {hint && <p className="text-sm text-ink-2">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="card flex flex-col items-center gap-1 px-6 py-10 text-center">
      <span className="text-2xl" aria-hidden>
        🫙
      </span>
      <p className="font-medium text-ink">{title}</p>
      {hint && <p className="text-sm text-ink-2">{hint}</p>}
    </div>
  );
}

export function ErrorState({ error }: { error: string }) {
  const missing = /catalogue database/i.test(error);
  return (
    <div className="card flex flex-col gap-2 px-6 py-8">
      <p className="font-medium text-ink">{missing ? 'The catalogue has not been built yet' : 'Something went wrong'}</p>
      <p className="text-sm text-ink-2">{error}</p>
      {missing && (
        <pre className="mt-1 overflow-x-auto rounded-xl bg-raised p-3 text-xs text-ink-2">cd server && npm run ingest</pre>
      )}
    </div>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 px-1 py-8 text-sm text-muted">
      <span className="h-3 w-3 animate-pulse rounded-full bg-accent" />
      {label}
    </div>
  );
}

export function PairingChip({ name, onClick }: { name: string; onClick?: () => void }) {
  const content = (
    <>
      <span aria-hidden>{pairingIcon(name)}</span>
      {name}
    </>
  );
  return onClick ? (
    <button type="button" className="chip" onClick={onClick}>
      {content}
    </button>
  ) : (
    <Link to={`/pairings/${slug(name)}`} className="chip">
      {content}
    </Link>
  );
}
