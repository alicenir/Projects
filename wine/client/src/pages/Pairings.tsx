import { Link } from 'react-router-dom';
import { useApi } from '../lib/api';
import { ErrorState, Loading, SectionTitle } from '../components/ui';
import { compact, num, pairingIcon, slug } from '../lib/format';

type Pairing = { name: string; wines: number; score: number | null };

export default function Pairings() {
  const { data, error, loading } = useApi<Pairing[]>('/pairings');
  if (error) return <ErrorState error={error} />;
  if (loading || !data) return <Loading label="Setting the table…" />;

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle
        title="Food pairings"
        hint="Every wine in the dataset carries its own food tags — pick a dish and see what the ratings say."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {data.map((p) => (
          <Link key={p.name} to={`/pairings/${slug(p.name)}`} className="card flex items-center gap-3 p-4 transition-colors hover:border-accent">
            <span className="text-2xl" aria-hidden>{pairingIcon(p.name)}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink">{p.name}</span>
              <span className="block text-xs text-muted">{compact(p.wines)} wines · avg {num(p.score, 2)}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
