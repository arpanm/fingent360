import { useEffect, useState } from 'react';
import { SourceListSchema, type SourceRecord } from '@fingent360/contracts';
import { json } from './net';
export function Sources() {
  const [items, setItems] = useState<SourceRecord[]>([]),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void json('/sources')
      .then((v) => {
        if (active) setItems(SourceListSchema.parse(v));
      })
      .catch((e: unknown) => {
        if (active)
          setError(e instanceof Error ? e.message : 'Sources unavailable.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [retry]);
  return (
    <section>
      <div className="page-header">
        <div>
          <p className="page-kicker">THE BASIS BEHIND THE BRIEF</p>
          <h1>Our sources</h1>
          <p className="page-description">
            Know where the information comes from. Every published item links to
            its own source and date.
          </p>
        </div>
      </div>
      <article className="panel">
        <h2>Original evidence, clearly identified.</h2>
        <p>
          Annual India macro observations come from World Bank Open Data.
          Official news items identify their publisher; explanations identify
          their educational source. Dates distinguish the reported period from
          the time a source was checked.
        </p>
        <a href="#macro">Explore the annual data</a>
      </article>
      {loading && <p role="status">Loading source information…</p>}
      {error && (
        <div className="error" role="alert">
          {error}
          <button onClick={() => setRetry((n) => n + 1)}>Try again</button>
        </div>
      )}
      <div className="source-directory">
        {items.map((s) => (
          <article className="panel" key={s.id}>
            <span className="eyebrow">{s.data.category}</span>
            <h2>{s.data.name}</h2>
            <p>{s.data.constraints}</p>
            <div className="page-actions">
              <a href={s.data.sourceUrl} target="_blank" rel="noreferrer">
                Original source
              </a>
              <a href={s.data.termsUrl} target="_blank" rel="noreferrer">
                Usage terms
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
