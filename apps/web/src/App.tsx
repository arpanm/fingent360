import { EiaSpot } from './EiaSpot';
import { CommodityBenchmarks } from './CommodityBenchmarks';
import { RegulatorySourcesReader } from './RegulatorySources';
import { WhatsappChannel } from './WhatsappChannel';
import { IntelligenceBrief } from './IntelligenceBrief';
import { IndiaMacro } from './IndiaMacro';
import { GlobalMacroCoverage } from './GlobalMacroCoverage';
import { ParticipantPositioning } from './ParticipantPositioning';
import { InstitutionalFlows } from './InstitutionalFlows';
import { EventScenarios } from './EventScenarios';
import { ActionCentre } from './ActionCentre';
import { FundsBonds } from './FundsBonds';
import { ResearchCalendar } from './ResearchAutomation';
import { ImpactTrace } from './ImpactTrace';
import { EquityCoverage } from './EquityCoverage';
import { Events } from './Events';
import { ReadingFollow } from './ReadingFollow';
import { onOtherTabSessionChange } from './session';
import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { HealthSchema } from '@fingent360/contracts';
import { Journey } from './Journey';
import { Macro } from './Macro';
import { EcbRates } from './EcbRates';
import { OilBenchmarks } from './OilBenchmarks';
import { EcbFx } from './EcbFx';
import { Account } from './Account';
import { Goals } from './Goals';
import { Privacy } from './Privacy';
import { Sources } from './Sources';
import { PwaStatus } from './PwaStatus';
import { Holdings } from './Holdings';
import { OverviewPage } from './Overview';
import { Saved } from './Saved';
import { Learning } from './Learning';
import { Discovery, Reader } from './Discovery';
import { Icon } from './ui';
import { AppSettings, DeviceStatus } from './AppSettings';
import { runtime } from './runtime';
import { FeedbackPage, FeedbackWidget } from './Feedback';
import { ResearchConnections } from './ResearchConnections';
import { GoalScenarios } from './GoalScenarios';
import { ConnectionReviews } from './ConnectionReviews';
import { GoalAllocations } from './GoalAllocations';
import { Recovery } from './Recovery';
import { ReportSchedules } from './ReportSchedules';
import { Reports } from './Reports';
import { ReportComparison } from './ReportComparison';
import { Securities } from './Securities';
import { OfflineOperationsNotice } from './RetentionOperations';
import { startFeedbackSync } from './feedback-sync';
import {
  canNavigate,
  currentRoute,
  go,
  prepareRestore,
  rememberFocus,
  rememberPosition,
  restorePosition,
  sectionFor,
  tabRoute,
} from './navigation';
const Operations = lazy(() =>
  import('./Operations').then((module) => ({ default: module.Operations })),
);
const destinations = [
  ['today', 'Today', 'sun'],
  ['explore', 'Explore', 'search'],
  ['money', 'My money', 'holdings'],
  ['saved', 'Saved', 'bookmark'],
  ['more', 'More', 'more'],
];
const moreLinks = [
  [
    'daily-oil',
    'Daily oil observations',
    'Reviewed WTI and Brent daily closing observations',
    'market',
  ],
  [
    'commodities',
    'Monthly commodities',
    'Gold, silver and copper source history with exact units',
    'market',
  ],
  [
    'regulatory-sources',
    'Rules and original notices',
    'Reviewed original documents, revisions and effective-date precision',
    'market',
  ],
  [
    'india-macro',
    'India release history',
    'Original CPI releases, revisions and release dates',
    'market',
  ],
  [
    'global-macro',
    'Global economic coverage',
    'Published releases, numerical editions and calendars',
    'market',
  ],
  [
    'positioning',
    'Market positioning',
    'Dated participant open contracts and source evidence',
    'market',
  ],
  [
    'whatsapp',
    'WhatsApp summaries',
    'Verified recipient, requested public summaries and delivery controls',
    'market',
  ],
  [
    'intelligence-briefs',
    'Intelligence briefs',
    'Five or six reviewed points, with their sources and connections',
    'market',
  ],
  [
    'institutional-flows',
    'Institutional activity',
    'Cash investment, derivatives activity and their distinct dates',
    'market',
  ],
  [
    'event-scenarios',
    'Understand a release',
    'Reviewed observations, expectations and scenario comparisons',
    'market',
  ],
  [
    'action-centre',
    'Explore a change',
    'Compare your assumptions with taking no action',
    'overview',
  ],
  [
    'funds-bonds',
    'Funds and bonds',
    'Retained fund NAVs and cash-flow comparisons',
    'holdings',
  ],
  [
    'research-calendar',
    'Release calendar',
    'Official scheduled releases and saved calendar editions',
    'market',
  ],
  [
    'impact-traces',
    'Evidence and my plans',
    'Trace reviewed context to your holdings and goals',
    'sources',
  ],
  [
    'equities',
    'Indian companies',
    'Prices, company facts and source history',
    'search',
  ],
  [
    'reading-follow',
    'Reading updates',
    'Check reviewed sources and topics when you choose',
    'bookmark',
  ],
  [
    'report-compare',
    'Compare issued reports',
    'Review changes in your captured records',
    'overview',
  ],
  [
    'connection-reviews',
    'Connection review inbox',
    'Check changes to your own research connections',
    'goals',
  ],
  [
    'comparisons',
    'Compare contribution plans',
    'Explore monthly contributions and time horizons',
    'goals',
  ],
  [
    'connections',
    'Research connections',
    'Your own reasons for linking reading to records',
    'sources',
  ],
  [
    'allocations',
    'Goal allocations',
    'Connect owned holdings to your plans',
    'goals',
  ],
  [
    'reports',
    'Saved record reviews',
    'Keep an immutable version of your plan',
    'overview',
  ],
  [
    'report-schedules',
    'Report schedules',
    'Choose recurring saved-record captures',
    'overview',
  ],
  [
    'securities',
    'Security directory',
    'Source-backed names and identifiers',
    'search',
  ],
  ['overview', 'My overview', 'Your saved plans at a glance', 'overview'],
  [
    'account',
    'Account & watchlist',
    'Your profile, followed indicators and inbox',
    'settings',
  ],
  [
    'holdings',
    'My holdings',
    'What you own and what you entered paying',
    'holdings',
  ],
  ['my-goals', 'My goals', 'Your goals, timelines and contributions', 'goals'],
  [
    'learning',
    'A little learning',
    'Quick questions and thoughtful perspectives',
    'learn',
  ],
  ['macro', 'India macro', 'Growth, inflation and the source record', 'market'],
  [
    'events',
    'Reviewed events',
    'Source-bound editorial events and connected context',
    'market',
  ],
  [
    'policy-rates',
    'ECB policy rates',
    'Reviewed effective rates and retrieval history',
    'market',
  ],
  [
    'oil-benchmarks',
    'Oil benchmarks',
    'Reviewed monthly Brent and WTI history',
    'market',
  ],
  [
    'reference-fx',
    'Reference exchange rates',
    'ECB references and an explicitly derived INR/USD ratio',
    'market',
  ],
  ['sources', 'Our sources', 'Where information comes from', 'sources'],
  ['feedback', 'Your feedback', 'Ideas, issues and delivery status', 'inbox'],
  [
    'privacy',
    'Privacy & security',
    'Your data, downloads and active sessions',
    'shield',
  ],
  ['brief', 'Learning lab', 'A clearly fictional practice portfolio', 'learn'],
  [
    'app-settings',
    'App settings',
    'Device storage, connection and feedback',
    'settings',
  ],
];
const lab = new Set([
  'brief',
  'event',
  'sectors',
  'companies',
  'company',
  'import',
  'portfolio',
  'goals',
  'review',
  'reviews',
]);
export function App() {
  useEffect(() => startFeedbackSync(), []);
  const [sessionEpoch, setSessionEpoch] = useState(0);
  useEffect(
    () => onOtherTabSessionChange(() => setSessionEpoch((n) => n + 1)),
    [],
  );
  const [route, setRoute] = useState(currentRoute);
  const main = useRef<HTMLElement>(null);
  const routeRef = useRef(route);
  const historyIndex = useRef<number>(window.history.state?.f360Index ?? 0);
  const rollback = useRef<{ route: string; index: number } | null>(null);
  const previousState = useRef(window.history.state);
  const focusedRoute = useRef(route);
  const selected = sectionFor(route);
  const base = route.split('?')[0]!;
  const inLab =
    lab.has(base) ||
    ['company/', 'event/', 'source/'].some((p) => base.startsWith(p));
  const title = base.startsWith('read/')
    ? 'Reading'
    : base.startsWith('policy-rates/')
      ? 'ECB policy rates'
      : base.startsWith('oil-benchmarks/')
        ? 'Oil benchmarks'
        : base.startsWith('reference-fx/')
          ? 'Reference exchange rates'
          : base.startsWith('macro/')
            ? 'Evidence'
            : (moreLinks.find((l) => l[0] === base)?.[1] ??
              destinations.find((l) => l[0] === base)?.[1] ??
              'Fingent360');
  useEffect(() => {
    const changed = (event: Event) => {
      const next = currentRoute();
      const rawIndex = window.history.state?.f360Index;
      const index = typeof rawIndex === 'number' ? rawIndex : null;
      if (rollback.current) {
        if (next === rollback.current.route && index === rollback.current.index)
          rollback.current = null;
        return;
      }
      if (next === routeRef.current) return;
      const approved = 'f360Approved' in event && event.f360Approved === true;
      if (!approved && !canNavigate()) {
        if (index !== null && historyIndex.current !== index) {
          rollback.current = {
            route: routeRef.current,
            index: historyIndex.current,
          };
          window.history.go(historyIndex.current - index);
        } else
          window.history.replaceState(
            previousState.current,
            '',
            `#${routeRef.current}`,
          );
        return;
      }
      rememberPosition(routeRef.current);
      const acceptedIndex = index ?? historyIndex.current + 1;
      if (index === null)
        window.history.replaceState(
          { ...window.history.state, f360Index: acceptedIndex },
          '',
        );
      historyIndex.current = acceptedIndex;
      previousState.current = window.history.state;
      routeRef.current = next;
      prepareRestore(next);
      setRoute(next);
    };
    const scroll = () => {
      if (!rollback.current) rememberPosition(routeRef.current);
    };
    const focus = () => rememberFocus(routeRef.current);
    window.addEventListener('hashchange', changed);
    window.addEventListener('popstate', changed);
    window.addEventListener('scroll', scroll, { passive: true });
    window.addEventListener('focusin', focus);
    return () => {
      window.removeEventListener('hashchange', changed);
      window.removeEventListener('popstate', changed);
      window.removeEventListener('scroll', scroll);
      window.removeEventListener('focusin', focus);
    };
  }, []);
  useLayoutEffect(() => {
    document.title = `${title} · Fingent360`;
    if (focusedRoute.current !== route) {
      focusedRoute.current = route;
      main.current?.focus({ preventScroll: true });
      restorePosition(route, false);
    }
  }, [route, title]);
  const [connection, setConnection] = useState('Connecting…');
  useEffect(() => {
    let active = true;
    if (runtime.mode === 'offline') {
      setConnection('On this device');
      return;
    }
    void fetch('/api/v1/health', { signal: AbortSignal.timeout(5000) })
      .then(async (r) => {
        if (!r.ok) throw Error();
        HealthSchema.parse(await r.json());
        if (active) setConnection('Connected');
      })
      .catch(() => {
        if (active) setConnection('Connection unavailable');
      });
    return () => {
      active = false;
    };
  }, []);
  const nav = (mobile = false) => (
    <nav
      className={mobile ? 'bottom-nav' : 'rail-nav'}
      aria-label={mobile ? 'Mobile navigation' : 'Product areas'}
    >
      {destinations.map(([id, label, icon]) => (
        <a
          href={`#${tabRoute(id!, selected)}`}
          key={id}
          aria-current={selected === id ? 'page' : undefined}
        >
          <Icon name={icon!} />
          <span>{label}</span>
        </a>
      ))}
    </nav>
  );
  if (base === 'ops' && runtime.mode !== 'offline')
    return (
      <>
        <Suspense
          fallback={<p className="loading-panel">Opening operations…</p>}
        >
          <Operations />
        </Suspense>
        <FeedbackWidget />
      </>
    );
  return (
    <div
      className={`experience-layout ${base.startsWith('read/') ? 'reading-layout' : ''}`}
      onClick={(e) => {
        const a = (e.target as HTMLElement).closest('a[href^="#"]');
        if (
          !a ||
          e.defaultPrevented ||
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey ||
          e.button !== 0
        )
          return;
        const href = a.getAttribute('href')?.slice(1);
        if (href && href !== 'main-content') {
          e.preventDefault();
          go(href);
        }
      }}
    >
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          main.current?.focus({ preventScroll: true });
        }}
      >
        Skip to content
      </a>
      <aside className="experience-rail">
        <a className="brand" href="#today" aria-label="fingent360">
          <span className="brand-mark">f</span>fingent<span>360</span>
        </a>
        {nav()}
        <div className="rail-end">
          <p>
            A little context.
            <br />A clearer plan.
          </p>
          <a href="#privacy">
            Your privacy matters <Icon name="arrow" size={14} />
          </a>
        </div>
      </aside>
      <div className="experience-workspace">
        <header className="experience-topbar">
          <a className="mobile-wordmark" href="#today" aria-label="fingent360">
            fingent<span>360</span>
          </a>
          <span className="desktop-location">
            {selected === 'today' ? 'A daily dose of perspective' : title}
          </span>
          <a className="account-link" href="#account" aria-label="Account">
            <Icon name="settings" />
          </a>
        </header>
        <main key={sessionEpoch} ref={main} id="main-content" tabIndex={-1}>
          <PwaStatus />
          <DeviceStatus />
          {base === 'today' ? (
            <Discovery key="today" />
          ) : base === 'explore' ? (
            <Discovery key="explore" explore />
          ) : base.startsWith('read/') ? (
            <Reader key={base} id={base.slice(5)} />
          ) : base === 'research-calendar' ? (
            <ResearchCalendar />
          ) : base === 'india-macro' ? (
            <IndiaMacro />
          ) : base === 'global-macro' ? (
            <GlobalMacroCoverage />
          ) : base === 'positioning' ? (
            <ParticipantPositioning />
          ) : base === 'daily-oil' ? (
            <EiaSpot />
          ) : base === 'commodities' ? (
            <CommodityBenchmarks />
          ) : base === 'regulatory-sources' ? (
            <RegulatorySourcesReader />
          ) : base === 'whatsapp' ? (
            <WhatsappChannel />
          ) : base === 'intelligence-briefs' ||
            base.startsWith('intelligence-briefs/') ? (
            <IntelligenceBrief route={route} />
          ) : base === 'institutional-flows' ? (
            <InstitutionalFlows />
          ) : base === 'funds-bonds' ? (
            <FundsBonds />
          ) : base === 'equities' ? (
            <EquityCoverage />
          ) : base === 'event-scenarios' ||
            base.startsWith('event-scenarios/') ? (
            <EventScenarios route={route} />
          ) : base === 'events' || base.startsWith('events/') ? (
            <Events key={route} route={route} />
          ) : base === 'policy-rates' || base.startsWith('policy-rates/') ? (
            <EcbRates key={base} route={base} />
          ) : base === 'oil-benchmarks' ||
            base.startsWith('oil-benchmarks/') ? (
            <OilBenchmarks key={base} route={base} />
          ) : base === 'reference-fx' || base.startsWith('reference-fx/') ? (
            <EcbFx key={base} route={base} />
          ) : base === 'macro' || base.startsWith('macro/') ? (
            <Macro key={base} route={base} />
          ) : base === 'saved' ? (
            <Saved />
          ) : base === 'learning' ? (
            <Learning />
          ) : base === 'feedback' ? (
            <FeedbackPage />
          ) : base === 'ops' && runtime.mode === 'offline' ? (
            <OfflineOperationsNotice />
          ) : base === 'app-settings' ? (
            <AppSettings />
          ) : base === 'account' ? (
            <Account key={route} />
          ) : base === 'recovery' ? (
            <Recovery />
          ) : base === 'action-centre' ? (
            <ActionCentre />
          ) : base === 'impact-traces' ? (
            <ImpactTrace />
          ) : base === 'connections' ? (
            <ResearchConnections key={route} />
          ) : base === 'comparisons' ? (
            <GoalScenarios />
          ) : base === 'reading-follow' ? (
            <ReadingFollow key={route} />
          ) : base === 'connection-reviews' ? (
            <ConnectionReviews />
          ) : base === 'allocations' ? (
            <GoalAllocations />
          ) : base === 'report-schedules' ? (
            <ReportSchedules />
          ) : base === 'report-compare' ? (
            <ReportComparison key={route} />
          ) : base === 'reports' ? (
            <Reports key={route} />
          ) : base === 'securities' || base.startsWith('securities/') ? (
            <Securities
              key={base}
              isin={base.startsWith('securities/') ? base.slice(11) : undefined}
            />
          ) : base === 'privacy' ? (
            <Privacy />
          ) : base === 'sources' ? (
            <Sources />
          ) : base === 'overview' ? (
            <OverviewPage />
          ) : ['money', 'holdings', 'my-goals'].includes(base) ? (
            <>
              <div className="money-tabs" aria-label="My money views">
                <a
                  href="#holdings"
                  aria-current={base !== 'my-goals' ? 'page' : undefined}
                >
                  Holdings
                </a>
                <a
                  href="#my-goals"
                  aria-current={base === 'my-goals' ? 'page' : undefined}
                >
                  Goals
                </a>
                <a href="#overview">Overview</a>
              </div>
              {base === 'my-goals' ? <Goals /> : <Holdings />}
            </>
          ) : base === 'more' ? (
            <section className="more-page">
              <p className="page-kicker">YOUR WHOLE WORKSPACE</p>
              <h1>A place for everything.</h1>
              <p>Reading, plans and the controls that keep them yours.</p>
              <div className="more-links">
                {moreLinks
                  .filter(
                    ([href]) =>
                      href !== 'app-settings' ||
                      runtime.native ||
                      runtime.mode === 'offline',
                  )
                  .map(([href, label, description, icon]) => (
                    <a href={`#${href}`} key={href}>
                      <Icon name={icon!} />
                      <span>
                        <strong>{label}</strong>
                        <small>{description}</small>
                      </span>
                      <Icon name="arrow" />
                    </a>
                  ))}
              </div>
            </section>
          ) : inLab ? (
            <>
              <div className="page-header">
                <p className="page-kicker">LEARNING LAB</p>
                <h1>Understand the market.</h1>
                <p>
                  Practice a complete review with a clearly fictional portfolio.
                </p>
              </div>
              <Journey />
            </>
          ) : (
            <section className="empty-state">
              <h1>We couldn’t find that page.</h1>
              <a className="button" href="#today">
                Back to Today
              </a>
            </section>
          )}
        </main>
        <footer className="experience-footer">
          <span>Research & education · No trade execution</span>
          <span role="status">{connection}</span>
        </footer>
      </div>
      {nav(true)}
      <FeedbackWidget />
    </div>
  );
}
