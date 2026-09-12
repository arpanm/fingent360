import { useEffect, useState } from 'react';
import { HealthSchema } from '@fingent360/contracts';
import { Journey } from './Journey';
import { Macro } from './Macro';
import { Account } from './Account';
import { Goals } from './Goals';
import { Privacy } from './Privacy';
import { Sources } from './Sources';
import { PwaStatus } from './PwaStatus';
import { Holdings } from './Holdings';

export function App() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const changed = () => setHash(window.location.hash);
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);
  const [status, setStatus] = useState('Checking connection…');
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    let active = true;
    void fetch('/api/v1/health', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('API unavailable');
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
  return (
    <div className="shell">
      <header>
        <a className="brand" href="/">
          fingent<span>360</span>
        </a>
        <span className="pill">Educational workspace</span>
      </header>
      <main>
        <PwaStatus />
        <p className="eyebrow">CLARITY BEFORE ACTION</p>
        <h1>
          Understand the market.
          <br />
          <span>Keep your goals in view.</span>
        </h1>
        <p className="intro">
          A clearer way to understand what changed, why it matters, and how it
          relates to your investments.
        </p>
        <p role="status" className="connection">
          {status}
        </p>
        <nav className="product-nav" aria-label="Product areas">
          <a href="#macro">Real economic data</a>
          <a href="#account">My watchlist / sign in</a>
          <a href="#my-goals">My goals</a>
          <a href="#holdings">My holdings</a>
          <a href="#privacy">Privacy and sessions</a>
          <a href="#sources">Source registry</a>
          <a href="#brief">Virtual portfolio exercise</a>
        </nav>
        {!hash || hash === '#macro' ? (
          <Macro />
        ) : hash === '#account' ? (
          <Account />
        ) : hash === '#my-goals' ? (
          <Goals />
        ) : hash === '#holdings' ? (
          <Holdings />
        ) : hash === '#privacy' ? (
          <Privacy />
        ) : hash === '#sources' ? (
          <Sources />
        ) : (
          <Journey />
        )}
      </main>
      <footer>
        <span>Research and education first.</span>
        <span>Indian equities → broader assets, one stage at a time.</span>
      </footer>
    </div>
  );
}
