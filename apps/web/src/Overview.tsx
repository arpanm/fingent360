import { useEffect, useState } from 'react';
import {
  MacroDashboardSchema,
  OverviewSchema,
  type MacroDashboard,
  type MacroObservation,
  type Overview,
} from '@fingent360/contracts';
import { Icon, money, shortDate } from './ui';

export function Trend({ observations }: { observations: MacroObservation[] }) {
  const points = [...observations].sort((a, b) => a.year - b.year).slice(-12);
  const values = points
    .filter((point) => point.value !== null)
    .map((point) => Number(point.value));
  if (values.length < 2) return null;
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const span = max - min || 1;
  const first = points[0]!.year;
  const years = points.at(-1)!.year - first || 1;
  let gap = true;
  const path = points
    .map((point) => {
      if (point.value === null) {
        gap = true;
        return '';
      }
      const command = gap ? 'M' : 'L';
      gap = false;
      return `${command}${8 + ((point.year - first) / years) * 304},${72 - ((Number(point.value) - min) / span) * 60}`;
    })
    .join(' ');
  return (
    <svg
      className="trend-chart"
      viewBox="0 0 320 88"
      role="img"
      aria-label={`Annual reported values from ${first} to ${points.at(-1)!.year}; open market context for exact observations`}
    >
      <path
        d={`M8 ${72 - ((0 - min) / span) * 60}H312`}
        className="chart-baseline"
      />
      <path d={path} className="chart-line" />
    </svg>
  );
}

export function OverviewPage() {
  const [account, setAccount] = useState<Overview | null>(null);
  const [anonymous, setAnonymous] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [market, setMarket] = useState<MacroDashboard | null>(null);
  const [marketError, setMarketError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let active = true;
    setLoading(true);
    setError('');
    setMarketError('');
    setAccount(null);
    setAnonymous(false);
    void fetch('/api/v1/account/overview', {
      signal: controller.signal,
      credentials: 'same-origin',
    })
      .then(async (response) => {
        if (response.status === 401) {
          if (active) setAnonymous(true);
          return;
        }
        if (!response.ok) throw new Error();
        const data = OverviewSchema.parse(await response.json());
        if (active) setAccount(data);
      })
      .catch(() => {
        if (active)
          setError('Your workspace could not be loaded. Please try again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    void fetch('/api/v1/macro', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const data = MacroDashboardSchema.parse(await response.json());
        if (active) setMarket(data);
      })
      .catch(() => {
        if (active)
          setMarketError(
            'Market context is unavailable. Your saved plans are separate.',
          );
      });
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [revision]);
  const steps = [
    {
      label: 'Create your private workspace',
      detail: 'One place for your plans and records.',
      href: '#account?next=overview',
      done: !!account,
      icon: 'settings',
    },
    {
      label: 'Set a goal that matters',
      detail: 'Choose an amount and a timeline.',
      href: '#my-goals',
      done: !!account?.goals.length,
      icon: 'goals',
    },
    {
      label: 'Add the holdings you own',
      detail: 'Enter quantities and what you paid.',
      href: '#holdings',
      done: !!account?.holdings.holdings.length,
      icon: 'holdings',
    },
    {
      label: 'Choose what to follow',
      detail: 'Keep useful economic context in your inbox.',
      href: '#account',
      done: !!account?.watchlist.indicators.length,
      icon: 'inbox',
    },
  ];
  const completed = steps.filter((step) => step.done).length;
  const next = steps.find((step) => !step.done);
  const unread = account?.inbox.items.filter((item) => !item.read).length ?? 0;
  return (
    <section className="overview" aria-labelledby="overview-title">
      <div className="page-header">
        <div>
          <p className="page-kicker">THE BIG PICTURE</p>
          <h1 id="overview-title">
            {account
              ? `Your overview, ${account.user.username}.`
              : 'A little context. A clearer plan.'}
          </h1>
          <p className="page-description">
            Understand what’s changing. Keep sight of what you’re working
            toward.
          </p>
        </div>
        <a className="button secondary" href="#macro">
          Explore market context <Icon name="arrow" size={16} />
        </a>
      </div>
      {loading && (
        <div className="loading-panel" aria-live="polite">
          Loading your workspace…
        </div>
      )}
      {error && (
        <div className="error" role="alert">
          {error}{' '}
          <button
            className="secondary"
            onClick={() => setRevision(revision + 1)}
          >
            Try again
          </button>
        </div>
      )}
      {(account || anonymous) && (
        <>
          {anonymous ? (
            <div className="welcome-grid">
              <section className="welcome-panel">
                <span className="badge">YOUR MONEY, WITH PERSPECTIVE</span>
                <h2>
                  Start with what
                  <br />
                  matters to you.
                </h2>
                <p>
                  A home for your goals, your holdings, and the context behind
                  the numbers. Build your picture, one step at a time.
                </p>
                <a
                  className="button light"
                  href="#account?next=overview&mode=create"
                >
                  Create your workspace <Icon name="arrow" size={18} />
                </a>
                <a className="welcome-signin" href="#account?next=overview">
                  Already have an account? Sign in
                </a>
                <div className="welcome-bottom">
                  <Icon name="goals" size={18} />
                  Your plans stay private. You stay in control.
                </div>
              </section>
              <section
                className="panel setup-panel"
                aria-label="Workspace setup"
              >
                <div className="section-heading">
                  <h2>A clear place to begin</h2>
                  <span className="muted">4 steps</span>
                </div>
                <ol className="setup-list">
                  {steps.map((step, index) => (
                    <li key={step.label}>
                      <span className="step-number">{index + 1}</span>
                      <div>
                        <h3>{step.label}</h3>
                        <p>{step.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                <a className="text-link" href="#macro">
                  Just looking? Explore the data <Icon name="arrow" size={16} />
                </a>
              </section>
            </div>
          ) : (
            account && (
              <>
                <div className="metric-grid overview-metrics">
                  <a href="#holdings" className="metric-card">
                    <span className="metric-label">
                      Recorded acquisition cost <Icon name="holdings" />
                    </span>
                    <strong>{money(account.holdings.totalCostMinor)}</strong>
                    <span className="muted">
                      {account.holdings.holdings.length} holdings · entered by
                      you
                    </span>
                  </a>
                  <a href="#my-goals" className="metric-card">
                    <span className="metric-label">
                      Goals you’re working toward <Icon name="goals" />
                    </span>
                    <strong>
                      {account.goals.length.toString().padStart(2, '0')}
                    </strong>
                    <span className="muted">
                      Your amounts, timelines and contributions
                    </span>
                  </a>
                  <a href="#account" className="metric-card">
                    <span className="metric-label">
                      Observations to review <Icon name="inbox" />
                    </span>
                    <strong>{unread.toString().padStart(2, '0')}</strong>
                    <span className="muted">
                      From {account.watchlist.indicators.length} followed
                      indicators
                    </span>
                  </a>
                </div>
                <p className="data-note">
                  Acquisition cost is what you recorded paying, not today’s
                  market value. Goals are separate plans; holdings are not
                  allocated to them.
                </p>
                <div className="planning-grid">
                  <section className="panel" aria-label="Your saved goals">
                    <div className="section-heading">
                      <div>
                        <p className="page-kicker">
                          WHAT YOU’RE WORKING TOWARD
                        </p>
                        <h2>Your goals</h2>
                      </div>
                      <a className="text-link" href="#my-goals">
                        View goals <Icon name="arrow" size={16} />
                      </a>
                    </div>
                    {account.goals.length ? (
                      account.goals.slice(0, 3).map((goal) => (
                        <a
                          className="goal-summary"
                          href="#my-goals"
                          key={goal.id}
                        >
                          <span className="feature-icon">
                            <Icon name="goals" />
                          </span>
                          <div>
                            <h3>{goal.name}</h3>
                            <p>
                              {money(goal.savedMinor)} saved of{' '}
                              {money(goal.targetMinor)}
                            </p>
                            <progress
                              aria-label={`${goal.name} saved progress`}
                              max={100}
                              value={Math.min(
                                100,
                                Number(
                                  (BigInt(goal.savedMinor) * 100n) /
                                    BigInt(goal.targetMinor),
                                ),
                              )}
                            />
                            <span className="muted">
                              {goal.horizonMonths} months ·{' '}
                              {money(goal.monthlyMinor)} monthly plan
                            </span>
                          </div>
                          <Icon name="arrow" size={16} />
                        </a>
                      ))
                    ) : (
                      <div className="empty-state compact">
                        <Icon name="goals" size={32} />
                        <h3>Give your money a purpose.</h3>
                        <p>
                          A goal starts with a name, an amount, and a timeline.
                        </p>
                        <a className="button" href="#my-goals">
                          Set your first goal
                        </a>
                      </div>
                    )}
                  </section>
                  <section
                    className="panel setup-panel"
                    aria-label="Workspace setup"
                  >
                    <div className="section-heading">
                      <h2>
                        {next ? 'Your next step' : 'Your workspace is ready'}
                      </h2>
                      <span className="badge">{completed} / 4</span>
                    </div>
                    {next && <p className="muted">{next.detail}</p>}
                    <ol className="setup-list small">
                      {steps.map((step) => (
                        <li
                          key={step.label}
                          className={step.done ? 'complete' : ''}
                        >
                          <span className="step-number">
                            {step.done ? (
                              <Icon name="check" size={16} />
                            ) : (
                              <Icon name={step.icon} size={16} />
                            )}
                          </span>
                          <a href={step.href}>{step.label}</a>
                        </li>
                      ))}
                    </ol>
                    <a className="button" href={next?.href ?? '#account'}>
                      {next ? next.label : 'Review your inbox'}
                      <Icon name="arrow" size={16} />
                    </a>
                  </section>
                </div>
              </>
            )
          )}
        </>
      )}
      <section className="market-section" aria-label="Market snapshot">
        <div className="section-heading">
          <div>
            <p className="page-kicker">BEYOND THE HEADLINES</p>
            <h2>India, in perspective</h2>
            <p className="muted">
              Reported annual indicators from the World Bank.
            </p>
          </div>
          <a className="text-link" href="#macro">
            Sources & history <Icon name="arrow" size={16} />
          </a>
        </div>
        {marketError ? (
          <p className="error" role="alert">
            {marketError}{' '}
            <button
              className="secondary"
              onClick={() => setRevision(revision + 1)}
            >
              Retry data
            </button>
          </p>
        ) : !market ? (
          <p className="muted">Loading reported data…</p>
        ) : (
          <div className="market-snapshot-grid">
            {market.sources.map((source) => {
              const latest = source.observations[0];
              return (
                <article className="market-summary" key={source.indicator}>
                  <div className="section-heading">
                    <span className="badge">ANNUAL · INDIA</span>
                    <span
                      className={`freshness ${source.freshness === 'refresh_due' ? 'due' : ''}`}
                    >
                      {source.freshness === 'never_synced'
                        ? 'Awaiting data'
                        : source.freshness === 'refresh_due'
                          ? 'Source check due'
                          : 'Source checked'}
                    </span>
                  </div>
                  <h3>{source.title}</h3>
                  <div className="market-value-row">
                    <strong>
                      {latest?.value != null
                        ? `${Number(latest.value).toFixed(2)}%`
                        : 'Unavailable'}
                    </strong>
                    <span>
                      {latest
                        ? `${latest.year} observation`
                        : 'No saved observations'}
                    </span>
                  </div>
                  <Trend observations={source.observations} />
                  <p>{source.explanation}</p>
                  <div className="market-meta">
                    <span>Checked {shortDate(source.lastSuccessAt)}</span>
                    <a
                      href="#macro"
                      aria-label={`View ${source.title} evidence`}
                    >
                      <Icon name="arrow" size={18} />
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        <p className="data-note">
          Annual data provides context; it is not a live market quote or an
          investment forecast. Source revisions and exact values are available
          in Market context.
        </p>
      </section>
      <aside className="learning-strip">
        <Icon name="learn" size={26} />
        <div>
          <h3>Build confidence before making decisions.</h3>
          <p>Explore a separate, fictional portfolio in the learning lab.</p>
        </div>
        <a className="button secondary" href="#brief">
          Open learning lab <Icon name="arrow" size={16} />
        </a>
      </aside>
    </section>
  );
}
