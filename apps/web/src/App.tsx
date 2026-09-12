import { useEffect, useRef, useState } from 'react';
import { HealthSchema } from '@fingent360/contracts';
import { Journey } from './Journey';
import { Macro } from './Macro';
import { Account } from './Account';
import { Goals } from './Goals';
import { Privacy } from './Privacy';
import { Sources } from './Sources';
import { PwaStatus } from './PwaStatus';
import { Holdings } from './Holdings';
import { OverviewPage } from './Overview';
import { Icon } from './ui';

const primary = [
  ['overview', 'Overview', 'overview'],
  ['macro', 'Market context', 'market'],
  ['holdings', 'My holdings', 'holdings'],
  ['my-goals', 'My goals', 'goals'],
  ['account', 'Watchlist & inbox', 'inbox'],
];
const secondary = [
  ['privacy', 'Privacy & security', 'settings'],
  ['sources', 'Data sources', 'sources'],
  ['brief', 'Learning lab', 'learn'],
];
const learning = new Set([
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
  const [hash, setHash] = useState(window.location.hash);
  const [menu, setMenu] = useState(false);
  const main = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const route = hash.slice(1).split('?')[0] || 'overview';
  const inLab =
    learning.has(route) ||
    route.startsWith('company/') ||
    route.startsWith('event/') ||
    route.startsWith('source/');
  const selected = inLab ? 'brief' : route;
  const title =
    [...primary, ...secondary].find((item) => item[0] === selected)?.[1] ??
    'Page not found';
  useEffect(() => {
    const changed = () => {
      setHash(window.location.hash);
      setMenu(false);
      window.scrollTo(0, 0);
      requestAnimationFrame(() => main.current?.focus({ preventScroll: true }));
    };
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);
  useEffect(() => {
    document.title = `${title} · Fingent360`;
  }, [title]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && menu) {
        setMenu(false);
        menuButton.current?.focus();
      }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [menu]);
  const [status, setStatus] = useState('Checking connection…');
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    let active = true;
    void fetch('/api/v1/health', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return HealthSchema.parse(await response.json());
      })
      .then(() => {
        if (active) setStatus('API connected');
      })
      .catch(() => {
        if (active) setStatus('API unavailable');
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);
  const navigation = (items: string[][]) =>
    items.map(([id, label, icon]) => (
      <a
        key={id}
        href={`#${id}`}
        aria-current={selected === id ? 'page' : undefined}
      >
        <Icon name={icon!} />
        <span>{label}</span>
        {selected === id && <span className="nav-active-dot" />}
      </a>
    ));
  return (
    <div className="app-layout">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          main.current?.focus({ preventScroll: true });
        }}
      >
        Skip to content
      </a>
      <aside className={`sidebar ${menu ? 'is-open' : ''}`}>
        <a className="brand" href="#overview" aria-label="fingent360">
          <span className="brand-mark">f</span>fingent<span>360</span>
        </a>
        <p className="nav-label">YOUR WORKSPACE</p>
        <nav
          id="workspace-navigation"
          className="product-nav"
          aria-label="Product areas"
        >
          {navigation(primary)}
        </nav>
        <div className="sidebar-bottom">
          <nav
            className="product-nav secondary-nav"
            aria-label="Tools and settings"
          >
            {navigation(secondary)}
          </nav>
          <div className="sidebar-note">
            <span className="status-dot" />
            Research & education<span>Clarity before action.</span>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            className="menu-button secondary"
            ref={menuButton}
            aria-label={menu ? 'Close navigation' : 'Open navigation'}
            aria-controls="workspace-navigation"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            <Icon name={menu ? 'close' : 'menu'} />
          </button>
          <div className="breadcrumb">
            Workspace <span>/</span> <strong>{title}</strong>
          </div>
          <div className="topbar-actions">
            <span className="region-label">
              India <span>INR</span>
            </span>
            <a href="#account" className="account-link" aria-label="Account">
              <Icon name="settings" />
            </a>
          </div>
        </header>
        <main id="main-content" ref={main} tabIndex={-1}>
          <PwaStatus />
          {route === 'overview' ? (
            <OverviewPage />
          ) : route === 'macro' ? (
            <Macro />
          ) : route === 'account' ? (
            <Account key={hash} />
          ) : route === 'my-goals' ? (
            <Goals />
          ) : route === 'holdings' ? (
            <Holdings />
          ) : route === 'privacy' ? (
            <Privacy />
          ) : route === 'sources' ? (
            <Sources />
          ) : inLab ? (
            <>
              <div className="page-header">
                <p className="page-kicker">LEARNING LAB</p>
                <h1>Understand the market.</h1>
                <p className="page-description">
                  Practice a complete review with a clearly fictional portfolio.
                </p>
              </div>
              <Journey />
            </>
          ) : (
            <section className="empty-state">
              <h1>We couldn’t find that page.</h1>
              <a className="button" href="#overview">
                Back to overview
              </a>
            </section>
          )}
        </main>
        <footer>
          <span>Fingent360 · Research and education. No trade execution.</span>
          <span
            role="status"
            className={`connection ${status === 'API connected' ? 'connected' : ''}`}
          >
            {status}
          </span>
        </footer>
      </div>
    </div>
  );
}
