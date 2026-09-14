import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="card mx-auto max-w-lg px-6 py-12 text-center">
      <p className="text-4xl" aria-hidden>🍷</p>
      <h1 className="mt-2 text-xl font-semibold text-ink">This cellar shelf is empty</h1>
      <p className="mt-1 text-sm text-ink-2">The page you were looking for does not exist.</p>
      <Link to="/" className="btn btn-primary mt-4">Back to the tasting room</Link>
    </div>
  );
}
