import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { ErrorState, Loading, SectionTitle } from '../components/ui';
import { StatTile } from '../components/charts';
import { money } from '../lib/format';

type Round = {
  mode: 'grape' | 'country';
  note: string;
  points: number;
  price: number | null;
  vintage: number | null;
  options: string[];
  answer: string;
};

export default function BlindTasting() {
  const [mode, setMode] = useState<'grape' | 'country'>('grape');
  const [round, setRound] = useState<Round | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState({ right: 0, played: 0, streak: 0, best: 0 });
  const [error, setError] = useState<string | null>(null);

  const deal = useCallback(async () => {
    setPicked(null);
    setRound(null);
    try {
      setRound(await api<Round>(`/game/blind?mode=${mode}`));
    } catch (err) {
      setError((err as Error).message);
    }
  }, [mode]);

  useEffect(() => {
    void deal();
  }, [deal]);

  const choose = (option: string) => {
    if (picked || !round) return;
    setPicked(option);
    const right = option === round.answer;
    setScore((s) => {
      const streak = right ? s.streak + 1 : 0;
      return { right: s.right + (right ? 1 : 0), played: s.played + 1, streak, best: Math.max(s.best, streak) };
    });
  };

  if (error) return <ErrorState error={error} />;

  return (
    <div className="flex flex-col gap-5">
      <SectionTitle
        title="Blind tasting"
        hint="A real critic's note with the giveaway words removed. Name the grape — or the country — from the description alone."
      />

      <div className="card flex flex-wrap items-center gap-3 p-3">
        <span className="label">Guess the</span>
        <div className="flex gap-2">
          {(['grape', 'country'] as const).map((m) => (
            <button key={m} type="button" className={`chip ${mode === m ? 'chip-active' : ''}`} onClick={() => setMode(m)}>
              {m}
            </button>
          ))}
        </div>
        <span className="ml-auto text-sm text-ink-2">
          {score.right}/{score.played} correct · streak {score.streak} (best {score.best})
        </span>
      </div>

      {!round ? (
        <Loading label="Pouring a mystery glass…" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <article className="card flex flex-col gap-4 p-6">
            <p className="label">The note</p>
            <blockquote className="text-lg leading-relaxed text-ink">“{round.note}”</blockquote>
            <p className="text-xs text-muted">
              Scored {round.points} points{round.vintage ? ` · ${round.vintage}` : ''}
              {round.price ? ` · ${money(round.price)}` : ''} · Wine Enthusiast
            </p>

            <div className="grid gap-2 sm:grid-cols-2">
              {round.options.map((option) => {
                const isAnswer = option === round.answer;
                const state = !picked ? 'idle' : isAnswer ? 'right' : option === picked ? 'wrong' : 'idle';
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => choose(option)}
                    disabled={Boolean(picked)}
                    className={`rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                      state === 'right'
                        ? 'border-transparent bg-[color:var(--wine-sparkling)] text-white'
                        : state === 'wrong'
                          ? 'border-transparent bg-[color:var(--wine-red)] text-white'
                          : 'border-line text-ink hover:border-accent'
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>

            {picked && (
              <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
                <p className="text-sm text-ink">
                  {picked === round.answer ? '🎉 Correct — ' : '🙈 Not quite — '}
                  it was <strong>{round.answer}</strong>.
                </p>
                <button type="button" className="btn btn-primary ml-auto" onClick={() => void deal()}>
                  Next glass →
                </button>
              </div>
            )}
          </article>

          <aside className="flex flex-col gap-3">
            <StatTile label="Correct" value={`${score.right}`} note={`of ${score.played} played`} />
            <StatTile label="Current streak" value={`${score.streak}`} note={`best ${score.best}`} />
            <div className="card p-4 text-sm text-ink-2">
              <p className="font-medium text-ink">How to read a note</p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                <li>Cranberry, pomegranate and silky texture point to Pinot Noir.</li>
                <li>Cassis, graphite and firm tannins say Cabernet.</li>
                <li>Petrol and lime mean Riesling, almost every time.</li>
                <li>Oak, vanilla and butter usually mean the barrel, not the grape.</li>
              </ul>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
