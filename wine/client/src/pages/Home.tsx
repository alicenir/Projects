import { Link } from 'react-router-dom';
import { useApi } from '../lib/api';
import type { WineCard } from '../lib/api';
import { EmptyState, ErrorState, Loading, PairingChip, SearchBox, SectionTitle, WineGrid } from '../components/ui';
import { StatTile } from '../components/charts';
import { compact, num } from '../lib/format';

type Summary = {
  wines: number;
  ratings: number;
  tasters: number;
  avg_rating: number;
  countries: number;
  regions: number;
  wineries: number;
  grapes: number;
  critic_reviews: number;
  critic_points: number;
  first_rating: string;
  last_rating: string;
  meta: Record<string, string>;
};

const QUICK_PAIRINGS = ['Beef', 'Poultry', 'Lamb', 'Shellfish', 'Pasta', 'Spicy Food', 'Hard Cheese', 'Vegetarian'];

export default function Home() {
  const summary = useApi<Summary>('/analytics/summary');
  const gems = useApi<{ items: WineCard[] }>('/wines?sort=score&minRatings=20&maxRatings=150&pageSize=6&facets=0');
  const tonight = useApi<WineCard[]>('/discover/tonight');

  if (summary.error) return <ErrorState error={summary.error} />;
  if (summary.loading || !summary.data) return <Loading label="Opening the cellar…" />;

  const s = summary.data;

  return (
    <div className="flex flex-col gap-10">
      <section className="card flex flex-col gap-5 px-5 py-8 sm:px-8 sm:py-10">
        <div className="max-w-2xl">
          <p className="label">An open wine atlas</p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
            {compact(s.ratings)} real tasting scores. {s.wines.toLocaleString()} wines. One place to find your next bottle.
          </h1>
          <p className="mt-3 text-sm text-ink-2 sm:text-base">
            Terroir reads two open datasets — drinkers&apos; 5-star ratings from X-Wines and {compact(s.critic_reviews)} Wine
            Enthusiast tasting notes — and turns them into something you can actually browse: grapes, regions, food
            pairings, price benchmarks and a cellar of your own.
          </p>
        </div>
        <div className="max-w-xl">
          <SearchBox />
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/taste" className="btn btn-primary">
            Take the taste test
          </Link>
          <Link to="/analytics" className="btn">
            See the analytics
          </Link>
          <Link to="/blind" className="btn">
            Play blind tasting
          </Link>
        </div>
      </section>

      <section>
        <SectionTitle title="The dataset at a glance" hint={`Ratings collected ${s.first_rating?.slice(0, 4)}–${s.last_rating?.slice(0, 4)}.`} />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatTile label="Wines" value={s.wines.toLocaleString()} note={`${s.wineries.toLocaleString()} producers`} />
          <StatTile label="Ratings" value={compact(s.ratings)} note={`${compact(s.tasters)} tasters`} />
          <StatTile label="Average score" value={num(s.avg_rating, 2)} note="out of 5 stars" />
          <StatTile label="Countries" value={String(s.countries)} note={`${s.regions} regions`} />
          <StatTile label="Grape varieties" value={String(s.grapes)} />
          <StatTile label="Critic reviews" value={compact(s.critic_reviews)} note={`avg ${num(s.critic_points, 1)} pts`} />
        </div>
      </section>

      <section>
        <SectionTitle
          title="What to drink tonight"
          hint="A fresh handful from the top of the ranking every time you look."
          action={
            <Link to="/explore?sort=score&minRatings=50" className="chip">
              Browse all
            </Link>
          }
        />
        {tonight.data ? <WineGrid wines={tonight.data.slice(0, 6)} /> : <Loading />}
      </section>

      <section>
        <SectionTitle title="Pick a dish, get a bottle" hint="Pairings come from the dataset's own food tags." />
        <div className="flex flex-wrap gap-2">
          {QUICK_PAIRINGS.map((p) => (
            <PairingChip key={p} name={p} />
          ))}
          <Link to="/pairings" className="chip">
            All pairings →
          </Link>
        </div>
      </section>

      <section>
        <SectionTitle
          title="Hidden gems"
          hint="Highly rated bottles that only a couple of hundred people have gotten around to reviewing."
        />
        {gems.data ? gems.data.items.length ? <WineGrid wines={gems.data.items} /> : <EmptyState title="No wines yet" /> : <Loading />}
      </section>
    </div>
  );
}
