import { useEffect, useState } from 'react';
import { FeedSchema, type FeedItem } from '@fingent360/contracts';
export function ResearchLinks({
  topic,
  title = 'Read real research',
  basis,
}: {
  topic: string;
  title?: string;
  basis: string;
}) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setItems([]);
    setError(false);
    setLoading(true);
    void fetch(
      `/api/v1/discovery/feed?topic=${encodeURIComponent(topic)}&view=explore`,
      {
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(15000),
        ]),
      },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return FeedSchema.parse(await response.json());
      })
      .then((feed) => {
        if (active)
          setItems(
            feed.items
              .filter((item) => item.status === 'published')
              .slice(0, 3),
          );
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [topic, retry]);
  return (
    <section className="panel" aria-label={title}>
      <h2>{title}</h2>
      <p className="muted">{basis}</p>
      {loading ? (
        <p role="status">Finding published reading…</p>
      ) : error ? (
        <p role="status">
          Reading could not be loaded.{' '}
          <button className="secondary" onClick={() => setRetry((v) => v + 1)}>
            Retry reading
          </button>
        </p>
      ) : items.length === 0 ? (
        <p>
          No published reading for this topic yet. Browse Explore for other
          sources.
        </p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <a href={`#read/${item.id}`}>{item.title}</a>
              <p className="muted">
                {item.source.name} · {item.effectiveLabel} · retrieved{' '}
                {new Date(item.source.retrievedAt).toLocaleDateString()}
              </p>
            </li>
          ))}
        </ul>
      )}
      <a
        className="button secondary"
        href={`#explore?topic=${encodeURIComponent(topic)}`}
      >
        Explore this topic
      </a>
    </section>
  );
}
