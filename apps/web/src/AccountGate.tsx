export type AccountDestination =
  | 'overview'
  | 'my-goals'
  | 'holdings'
  | 'privacy'
  | 'saved'
  | 'reading-follow'
  | 'today'
  | 'explore'
  | 'learning'
  | 'connections'
  | `connections?${string}`
  | 'comparisons'
  | 'connection-reviews'
  | 'allocations'
  | 'report-schedules'
  | 'reports'
  | 'report-compare'
  | `report-compare?${string}`
  | `read/${string}`;
export function accountDestination(hash: string): AccountDestination | null {
  const query = hash.split('?')[1] ?? '';
  const next = new URLSearchParams(query).get('next');
  return next === 'overview' ||
    next === 'my-goals' ||
    next === 'holdings' ||
    next === 'privacy' ||
    next === 'saved' ||
    next === 'reading-follow' ||
    next === 'today' ||
    next === 'explore' ||
    next === 'learning' ||
    next === 'allocations' ||
    next === 'connections' ||
    (next !== null &&
      /^connections\?itemId=[a-z0-9-]{1,100}&sourceVersion=[1-9][0-9]*&sourceHash=[a-f0-9]{64}$/.test(
        next,
      )) ||
    next === 'comparisons' ||
    next === 'connection-reviews' ||
    next === 'report-schedules' ||
    next === 'reports' ||
    next === 'report-compare' ||
    (next !== null &&
      /^report-compare\?first=[a-f0-9-]{36}&second=[a-f0-9-]{36}$/.test(
        next,
      )) ||
    (next !== null && /^read\/[a-z0-9-]{1,100}$/.test(next))
    ? (next as AccountDestination)
    : null;
}
export function AccountGate({
  next,
  title = 'Make this space yours',
  description = 'Sign in to save your progress and return to it whenever you need.',
}: {
  next: AccountDestination;
  title?: string;
  description?: string;
}) {
  return (
    <section className="empty-state panel">
      <p className="page-kicker">Your private workspace</p>
      <h2>{title}</h2>
      <p>{description}</p>
      <div className="page-actions">
        <a
          className="button-link"
          href={`#account?next=${next.includes('?') ? encodeURIComponent(next) : next}`}
        >
          Sign in or create an account
        </a>
        <a href="#overview">Explore the overview</a>
      </div>
    </section>
  );
}
