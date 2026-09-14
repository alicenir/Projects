import { useEffect, useState } from 'react';
import { api, useApi } from '../lib/api';
import type { Facets, WineCard } from '../lib/api';
import { ErrorState, Loading, SectionTitle, WineGrid } from '../components/ui';
import { pairingIcon, typeColor, TYPE_ORDER } from '../lib/format';

type Profile = {
  types: string[];
  bodies: string[];
  acidities: string[];
  grapes: string[];
  countries: string[];
  pairings: string[];
  adventurous: number;
};

const EMPTY: Profile = { types: [], bodies: [], acidities: [], grapes: [], countries: [], pairings: [], adventurous: 0.3 };

const STEPS = [
  { key: 'types', title: 'What do you usually pour?', hint: 'Pick as many as you like.' },
  { key: 'bodies', title: 'How much weight do you want in the glass?', hint: 'Body is how heavy the wine feels.' },
  { key: 'grapes', title: 'Any grapes you already love?', hint: 'Skip it if you are still figuring that out.' },
  { key: 'countries', title: 'Where should it come from?', hint: 'Leave empty to roam.' },
  { key: 'pairings', title: 'What are you eating?', hint: 'We match against the dataset’s own food tags.' },
  { key: 'adventurous', title: 'Classics or curiosities?', hint: 'Push right for bottles nobody has rated yet.' },
] as const;

export default function TasteTest() {
  const facets = useApi<Facets>('/facets');
  const stored = useApi<{ profile: Profile | null }>('/profile');
  const [profile, setProfile] = useState<Profile>(EMPTY);
  const [step, setStep] = useState(0);
  const [results, setResults] = useState<WineCard[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (stored.data?.profile) setProfile({ ...EMPTY, ...stored.data.profile });
  }, [stored.data]);

  if (facets.error) return <ErrorState error={facets.error} />;
  if (!facets.data) return <Loading />;

  const toggle = (key: keyof Profile, value: string) =>
    setProfile((p) => {
      const list = new Set(p[key] as string[]);
      if (list.has(value)) list.delete(value);
      else list.add(value);
      return { ...p, [key]: [...list] };
    });

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const [recs] = await Promise.all([
        api<{ items: WineCard[] }>('/recommend', { method: 'POST', body: JSON.stringify({ ...profile, limit: 12 }) }),
        api('/profile', { method: 'PUT', body: JSON.stringify(profile) }),
      ]);
      setResults(recs.items);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const current = STEPS[step];
  const options = {
    types: TYPE_ORDER.filter((t) => (facets.data!.types ?? []).some((f) => f.value === t)),
    bodies: (facets.data.bodies ?? []).map((f) => f.value),
    grapes: (facets.data.grapes ?? []).slice(0, 28).map((f) => f.value),
    countries: (facets.data.countries ?? []).slice(0, 20),
    pairings: (facets.data.pairings ?? []).slice(0, 24).map((f) => f.value),
  };

  return (
    <div className="flex flex-col gap-6">
      <SectionTitle
        title="Find your wine"
        hint="Six quick questions. Every recommendation comes back with the reason it was picked."
      />

      <div className="card flex flex-col gap-5 p-5">
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <span key={s.key} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-accent' : 'bg-[color:var(--grid)]'}`} />
          ))}
        </div>

        <div>
          <h2 className="text-xl font-semibold text-ink">{current.title}</h2>
          <p className="text-sm text-ink-2">{current.hint}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {current.key === 'types' &&
            options.types.map((t) => (
              <button key={t} type="button" className={`chip ${profile.types.includes(t) ? 'chip-active' : ''}`} onClick={() => toggle('types', t)}>
                <span className="h-2 w-2 rounded-full" style={{ background: typeColor(t) }} />
                {t}
              </button>
            ))}

          {current.key === 'bodies' && (
            <div className="flex w-full flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                {options.bodies.map((b) => (
                  <button key={b} type="button" className={`chip ${profile.bodies.includes(b) ? 'chip-active' : ''}`} onClick={() => toggle('bodies', b)}>
                    {b}
                  </button>
                ))}
              </div>
              <div>
                <p className="label mb-1.5">Acidity — how fresh and mouth-watering</p>
                <div className="flex flex-wrap gap-2">
                  {['Low', 'Medium', 'High'].map((a) => (
                    <button key={a} type="button" className={`chip ${profile.acidities.includes(a) ? 'chip-active' : ''}`} onClick={() => toggle('acidities', a)}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {current.key === 'grapes' &&
            options.grapes.map((g) => (
              <button key={g} type="button" className={`chip ${profile.grapes.includes(g) ? 'chip-active' : ''}`} onClick={() => toggle('grapes', g)}>
                🍇 {g}
              </button>
            ))}

          {current.key === 'countries' &&
            options.countries.map((c) => (
              <button
                key={c.value}
                type="button"
                className={`chip ${profile.countries.includes(c.value) ? 'chip-active' : ''}`}
                onClick={() => toggle('countries', c.value)}
              >
                {c.label ?? c.value}
              </button>
            ))}

          {current.key === 'pairings' &&
            options.pairings.map((p) => (
              <button key={p} type="button" className={`chip ${profile.pairings.includes(p) ? 'chip-active' : ''}`} onClick={() => toggle('pairings', p)}>
                <span aria-hidden>{pairingIcon(p)}</span>
                {p}
              </button>
            ))}

          {current.key === 'adventurous' && (
            <div className="w-full max-w-lg">
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={profile.adventurous}
                onChange={(e) => setProfile({ ...profile, adventurous: Number(e.target.value) })}
                className="w-full accent-[color:var(--accent)]"
                aria-label="How adventurous"
              />
              <div className="mt-1 flex justify-between text-xs text-muted">
                <span>Give me the classics</span>
                <span>Surprise me</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            Back
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn btn-primary" onClick={() => setStep((s) => s + 1)}>
              Next
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>
              {busy ? 'Pouring…' : 'Show me the wines'}
            </button>
          )}
          <button type="button" className="btn" onClick={() => { setProfile(EMPTY); setResults(null); setStep(0); }}>
            Start over
          </button>
        </div>
        {error && <p className="text-sm text-accent">{error}</p>}
      </div>

      {results && (
        <section>
          <SectionTitle title="Your dozen" hint="Match score blends the crowd's rating with how closely the bottle fits your answers." />
          <WineGrid wines={results} />
        </section>
      )}
    </div>
  );
}
