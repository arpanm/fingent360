import { useEffect, useState } from 'react';
import { HealthSchema } from '@fingent360/contracts';
import { Journey } from './Journey';

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
        <span className="pill">Educational workspace</span>
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
        <p role="status" className="connection">
          {status}
        </p>
        <Journey />
      </main>
      <footer>
        <span>Research and education first.</span>
        <span>Indian equities → broader assets, one stage at a time.</span>
      </footer>
    </div>
  );
}
