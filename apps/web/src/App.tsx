import { useEffect, useState } from 'react';
import { HealthSchema } from '@fingent360/contracts';

export function App() {
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
        <span className="pill">Development foundation</span>
      </header>
      <main>
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
        <section className="notice" aria-labelledby="foundation-title">
          <div className="dot" />
          <div>
            <h2 id="foundation-title">
              The foundation is ready for development
            </h2>
            <p>
              Market feeds, portfolios and goal planning are not connected yet.
              This starter displays no live market data or investment
              recommendations.
            </p>
            <p role="status" className="connection">
              {status}
            </p>
          </div>
        </section>
        <section className="features" aria-label="Planned experience">
          <article>
            <span>01 / UNDERSTAND</span>
            <h2>What changed?</h2>
            <p>
              Five or six verified developments, with simple explanations and
              links to the original evidence.
            </p>
          </article>
          <article>
            <span>02 / CONNECT</span>
            <h2>Why does it matter?</h2>
            <p>
              Follow an event through sectors and companies to understand its
              relationship to your holdings.
            </p>
          </article>
          <article>
            <span>03 / REFLECT</span>
            <h2>What about my goals?</h2>
            <p>
              Put risk, time horizon and portfolio context first. Sometimes no
              action is the right outcome.
            </p>
          </article>
        </section>
      </main>
      <footer>
        <span>Research and education first.</span>
        <span>Indian equities → broader assets, one stage at a time.</span>
      </footer>
    </div>
  );
}
