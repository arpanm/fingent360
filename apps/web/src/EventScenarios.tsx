import { useEffect, useRef, useState } from 'react';
import {
  EventScenarioPublicSchema,
  EventScenarioListSchema,
  EventScenarioHistorySchema,
  type EventScenarioReceipt,
} from '@fingent360/contracts';
import './event-scenarios.css';
export async function scenarioRequest(
  path: string,
  method = 'GET',
  body?: unknown,
) {
  const response = await fetch('/api/v1/' + path, {
    method,
    credentials: 'same-origin',
    signal: AbortSignal.timeout(15000),
    ...(body
      ? {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const value: unknown = await response.json().catch(() => {
    throw Error('Scenario response is unreadable. Retry.');
  });
  if (!response.ok)
    throw Error(
      value && typeof value === 'object' && 'message' in value
        ? String(value.message)
        : 'Scenario request failed.',
    );
  return value;
}
export function EventScenarioBody({
  receipt,
}: {
  receipt: EventScenarioReceipt;
}) {
  const model = receipt.input.model;
  return (
    <div>
      <p>
        {model.family} · scenario edition {receipt.version} ·{' '}
        {receipt.result.comparison}
      </p>
      <h2>{receipt.event.event!.editorial.title}</h2>
      {'observed' in model && (
        <p>
          Reported value {model.observed.value} {model.unit} for{' '}
          {model.observed.period}.
          {model.reference && (
            <>
              {' '}
              Reference {model.reference.value} {model.unit} for{' '}
              {model.reference.period} ({model.reference.kind}).
            </>
          )}
        </p>
      )}
      {model.family === 'regulatory' && (
        <p>Editorial interpretation: {model.interpretation}</p>
      )}
      <p>
        <strong>
          {receipt.result.delta === null
            ? 'No numerical difference inferred'
            : `${receipt.result.delta} ${receipt.result.unit} · ${receipt.result.direction}`}
        </strong>
      </p>
      <p>{receipt.result.meaning}</p>
      <p>{receipt.result.noAction}</p>
      <a href={'#events/' + receipt.input.eventId}>
        Open reviewed event and context
      </a>
      <details>
        <summary>Source excerpts and versions</summary>
        {receipt.event.event!.editorial.citations.map((citation, index) => {
          const source = receipt.event.event!.sources.find(
            (item) => item.id === citation.sourceId,
          )!;
          return (
            <div key={index}>
              <blockquote>{citation.quote}</blockquote>
              <a href={source.source.url} target="_blank" rel="noreferrer">
                {source.source.name}
              </a>
              <p>
                Edition {citation.version} · published {source.publishedAt} ·
                retrieved {source.source.retrievedAt} · {citation.hash}
              </p>
            </div>
          );
        })}
      </details>
      <ul>
        {receipt.result.warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
    </div>
  );
}
export function EventScenarios({
  route = 'event-scenarios',
}: {
  route?: string;
}) {
  const id = route.split('?')[0]!.split('/')[1];
  const [items, setItems] = useState<ReturnType<
      typeof EventScenarioListSchema.parse
    > | null>(null),
    [detail, setDetail] = useState<ReturnType<
      typeof EventScenarioPublicSchema.parse
    > | null>(null),
    [history, setHistory] = useState<ReturnType<
      typeof EventScenarioHistorySchema.parse
    > | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const load = async (after?: string) => {
    const token = ++generation.current;
    setBusy(true);
    setError('');
    try {
      if (id) {
        const [a, b] = await Promise.all([
          scenarioRequest('event-scenarios/' + id),
          scenarioRequest('event-scenarios/' + id + '/history'),
        ]);
        if (token === generation.current) {
          setDetail(EventScenarioPublicSchema.parse(a));
          setHistory(EventScenarioHistorySchema.parse(b));
        }
      } else {
        const query = new URLSearchParams(route.split('?')[1]);
        if (after) query.set('after', after);
        const result = EventScenarioListSchema.parse(
          await scenarioRequest('event-scenarios?' + query),
        );
        if (token === generation.current) setItems(result);
      }
    } catch (e) {
      if (token === generation.current)
        setError(e instanceof Error ? e.message : 'Could not load scenarios.');
    } finally {
      if (token === generation.current) setBusy(false);
    }
  };
  useEffect(() => {
    setItems(null);
    setDetail(null);
    setHistory(null);
    void load();
    return () => {
      generation.current++;
    };
  }, [route]);
  return (
    <section className="event-scenarios" aria-label="Reviewed event scenarios">
      <a href={id ? '#event-scenarios' : '#explore'}>
        Back to {id ? 'scenarios' : 'Explore'}
      </a>
      <h1>Read the change in context</h1>
      <p>
        Source-bound differences with explicit periods, units and reference
        types. No invented consensus or portfolio impact.
      </p>
      {busy && <p role="status">Loading scenarios…</p>}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button onClick={() => void load()}>Retry scenarios</button>
        </div>
      )}
      {items && (
        <>
          {!items.items.length && (
            <p>
              No reviewed scenario in this page. Published event evidence must
              be prepared and independently reviewed first.
            </p>
          )}
          {items.items.map((item) => (
            <article key={item.id}>
              {item.receipt ? (
                <>
                  <h2>{item.receipt.event.event!.editorial.title}</h2>
                  <p>
                    {item.receipt.input.model.family} ·{' '}
                    {item.receipt.result.comparison}
                  </p>
                  <a href={'#event-scenarios/' + item.id}>Open scenario</a>
                </>
              ) : (
                <p>Scenario {item.state}. Source content is unavailable.</p>
              )}
            </article>
          ))}
          {items.next && (
            <button onClick={() => void load(items.next!)}>
              Next scenarios
            </button>
          )}
        </>
      )}
      {detail && (
        <>
          {detail.receipt ? (
            <>
              <EventScenarioBody receipt={detail.receipt} />
              {detail.reviewReasons.map((reason) => (
                <p role="note" key={reason}>
                  {reason}
                </p>
              ))}
            </>
          ) : (
            <p>
              This scenario is {detail.state}. Its evidence cannot currently be
              admitted.
            </p>
          )}
          {history && (
            <details>
              <summary>Publication history</summary>
              <ul>
                {history.versions.map((version) => (
                  <li key={version.version}>
                    Edition {version.version} · {version.createdAt}
                  </li>
                ))}
              </ul>
              {history.nextBefore && (
                <button
                  onClick={() => {
                    const token = generation.current;
                    void scenarioRequest(
                      `event-scenarios/${id}/history?before=${history.nextBefore}`,
                    )
                      .then((value) => {
                        if (token === generation.current)
                          setHistory(EventScenarioHistorySchema.parse(value));
                      })
                      .catch((e: unknown) => {
                        if (token === generation.current)
                          setError(
                            e instanceof Error
                              ? e.message
                              : 'History unavailable.',
                          );
                      });
                  }}
                >
                  Older published editions
                </button>
              )}
              <p>
                Older content is not silently presented as current. Exact
                published edition identifiers remain available for review.
              </p>
            </details>
          )}
        </>
      )}
    </section>
  );
}
