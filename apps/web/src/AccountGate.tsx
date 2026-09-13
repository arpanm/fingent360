export type AccountDestination =
  | 'overview'
  | 'my-goals'
  | 'holdings'
  | 'privacy'
  | 'saved'
  | 'today'
  | 'explore'
  | 'learning'
  | 'allocations'
  | 'reports'
  | `read/${string}`;
export function accountDestination(hash: string): AccountDestination | null {
  const query = hash.split('?')[1] ?? '';
  const next = new URLSearchParams(query).get('next');
  return next === 'overview' ||
    next === 'my-goals' ||
    next === 'holdings' ||
    next === 'privacy' ||
    next === 'saved' ||
    next === 'today' ||
    next === 'explore' ||
    next === 'learning' ||
    next === 'allocations' ||
    next === 'reports' ||
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
        <a className="button-link" href={`#account?next=${next}`}>
          Sign in or create an account
        </a>
        <a href="#overview">Explore the overview</a>
      </div>
    </section>
  );
}
