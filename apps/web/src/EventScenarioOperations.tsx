import { useEffect, useRef, useState } from 'react';
import {
  EventListSchema,
  EventScenarioInputSchema,
  EventScenarioQueueSchema,
  EventScenarioReceiptSchema,
  type EventScenarioReceipt,
} from '@fingent360/contracts';
import { EventScenarioBody, scenarioRequest } from './EventScenarios';
import './event-scenarios.css';
import type { json } from './net';
const definitions: Record<
  string,
  { label: string; fields: [string, string, string[]][] }
> = {
  'policy-rate': {
    label: 'RBI / Federal Reserve decision',
    fields: [
      ['authority', 'Monetary authority', ['RBI', 'Federal Reserve']],
      [
        'measure',
        'Rate measure',
        [
          'policy-rate',
          'target-lower-bound',
          'target-upper-bound',
          'primary-credit-rate',
        ],
      ],
    ],
  },
  inflation: {
    label: 'CPI observation / expectation',
    fields: [
      ['index', 'Price index', ['headline-CPI', 'core-CPI']],
      [
        'basis',
        'Inflation comparison basis',
        ['year-on-year', 'month-on-month'],
      ],
      [
        'adjustment',
        'Seasonal adjustment',
        ['not-seasonally-adjusted', 'seasonally-adjusted'],
      ],
    ],
  },
  gdp: {
    label: 'GDP release / vintage',
    fields: [
      [
        'basis',
        'GDP measurement basis',
        [
          'real-year-on-year',
          'real-quarter-on-quarter',
          'real-quarter-annualized',
          'nominal-year-on-year',
        ],
      ],
      ['vintage', 'Release vintage', ['advance', 'second', 'third', 'revised']],
    ],
  },
  earnings: {
    label: 'Company reported earnings',
    fields: [
      ['metric', 'Reported metric', ['revenue', 'profit-after-tax', 'eps']],
      ['basis', 'Company reporting basis', ['consolidated', 'standalone']],
    ],
  },
  guidance: {
    label: 'Company forward guidance',
    fields: [
      ['measure', 'Guidance measure', ['revenue-growth', 'margin', 'revenue']],
    ],
  },
  regulatory: {
    label: 'Governance / regulatory change',
    fields: [
      [
        'authority',
        'Issuing authority',
        [
          'SEBI',
          'RBI',
          'exchange',
          'court',
          'company-board',
          'other-regulator',
        ],
      ],
      [
        'category',
        'Change category',
        ['enforcement', 'rule-change', 'governance-disclosure'],
      ],
    ],
  },
  flows: {
    label: 'FPI / liquidity flows',
    fields: [
      ['participant', 'Participant', ['FPI', 'FII', 'DII']],
      [
        'segment',
        'Flow coverage',
        ['cash-equity-provisional', 'equity-total', 'debt', 'derivatives'],
      ],
    ],
  },
};
export function EventScenarioOperations({
  request,
}: { request?: typeof json } = {}) {
  const wire = (path: string, method = 'GET', body?: unknown) =>
    request
      ? request('/' + path, body, method)
      : scenarioRequest(path, method, body);
  const [queue, setQueue] = useState<ReturnType<
      typeof EventScenarioQueueSchema.parse
    > | null>(null),
    [events, setEvents] = useState<ReturnType<
      typeof EventListSchema.parse
    > | null>(null);
  const [selected, setSelected] = useState(''),
    [family, setFamily] = useState('policy-rate'),
    [fields, setFields] = useState<Record<string, string>>({}),
    [referenceKind, setReferenceKind] = useState('none'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  const [saved, setSaved] = useState<EventScenarioReceipt | null>(null),
    [reviewReason, setReviewReason] = useState('');
  const pending = useRef<{
      id: string;
      input: ReturnType<typeof EventScenarioInputSchema.parse>;
    } | null>(null),
    reviews = useRef<Record<string, string>>({});
  const load = async (after?: string) => {
    setBusy(true);
    setError('');
    try {
      const [a, b] = await Promise.all([
        wire('ops/event-scenarios' + (after ? '?after=' + after : '')),
        wire('events'),
      ]);
      setQueue(EventScenarioQueueSchema.parse(a));
      setEvents(EventListSchema.parse(b));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Unable to load scenario preparation.',
      );
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const event =
    events?.items.find((item) => item.id === selected) ??
    (saved?.event.id === selected ? saved.event : undefined);
  const edit = (key: string, value: string) => {
    setFields((old) => ({ ...old, [key]: value }));
    pending.current = null;
    setNotice('');
  };
  const choicesFor = (key: string, options: string[]) =>
    family === 'policy-rate' && key === 'measure'
      ? (fields.authority ?? 'RBI') === 'RBI'
        ? ['policy-rate']
        : options.filter((option) => option !== 'policy-rate')
      : options;
  const selectedFor = (key: string, options: string[]) => {
    const available = choicesFor(key, options);
    return available.includes(fields[key] ?? '') ? fields[key]! : available[0]!;
  };
  const save = async () => {
    if (!event?.event) return;
    setBusy(true);
    setError('');
    try {
      if (!pending.current) {
        const metadata = Object.fromEntries(
          definitions[family]!.fields.map(([key, , options]) => [
            key,
            selectedFor(key, options),
          ]),
        );
        const unit =
          family === 'earnings'
            ? (fields.unit ?? 'INR-crore')
            : family === 'guidance'
              ? (fields.unit ?? 'percent')
              : family === 'flows'
                ? 'INR-crore'
                : 'percent';
        const model =
          family === 'regulatory'
            ? {
                family,
                ...metadata,
                citation: Number(fields.observedCitation ?? '0'),
                interpretation: fields.interpretation,
              }
            : {
                family,
                ...metadata,
                ...(['earnings', 'guidance'].includes(family)
                  ? { isin: fields.isin }
                  : {}),
                unit,
                observed: {
                  value: fields.observed,
                  period: fields.period,
                  citation: Number(fields.observedCitation ?? '0'),
                },
                reference:
                  referenceKind === 'none'
                    ? null
                    : {
                        value: fields.reference,
                        period: fields.referencePeriod,
                        kind: referenceKind,
                        citation:
                          referenceKind === 'scenario-assumption'
                            ? null
                            : Number(fields.referenceCitation ?? '0'),
                      },
              };
        const input = EventScenarioInputSchema.parse({
          requestId: crypto.randomUUID(),
          expectedVersion: saved?.version ?? 0,
          eventId: event.id,
          eventVersion: event.event.version,
          revisionReason: fields.reason,
          model,
        });
        pending.current = { id: saved?.id ?? crypto.randomUUID(), input };
      }
      const result = EventScenarioReceiptSchema.parse(
        await wire(
          'ops/event-scenarios/' + pending.current.id,
          'PUT',
          pending.current.input,
        ),
      );
      setSaved(result);
      pending.current = null;
      setNotice('Scenario draft saved for independent review.');
      await load();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Could not prepare scenario. Retry retains the request ID.',
      );
    } finally {
      setBusy(false);
    }
  };
  const review = async (
    receipt: EventScenarioReceipt,
    decision: 'publish' | 'withdraw',
  ) => {
    setBusy(true);
    setError('');
    try {
      const key = `${receipt.id}:${receipt.version}:${decision}:${reviewReason}`,
        requestId = reviews.current[key] ?? crypto.randomUUID();
      reviews.current[key] = requestId;
      await wire('ops/event-scenarios/' + receipt.id + '/review', 'POST', {
        requestId,
        expectedVersion: receipt.version,
        decision,
        reason: reviewReason,
      });
      setNotice(
        `Scenario ${decision === 'publish' ? 'published' : 'withdrawn'}.`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Review failed.');
    } finally {
      setBusy(false);
    }
  };
  const open = (receipt: EventScenarioReceipt) => {
    setSaved(receipt);
    setSelected(receipt.event.id);
    setFamily(receipt.input.model.family);
    const model = receipt.input.model;
    const values: Record<string, string> = { reason: '' };
    for (const [key, value] of Object.entries(model))
      if (typeof value === 'string') values[key] = value;
    if ('observed' in model) {
      values.observed = model.observed.value;
      values.period = model.observed.period;
      values.observedCitation = String(model.observed.citation);
      values.reference = model.reference?.value ?? '';
      values.referencePeriod = model.reference?.period ?? '';
      values.referenceCitation = String(model.reference?.citation ?? 0);
      setReferenceKind(model.reference?.kind ?? 'none');
    } else values.observedCitation = String(model.citation);
    setFields(values);
    pending.current = null;
  };
  return (
    <section
      className="event-scenarios"
      aria-label="Event scenario preparation"
    >
      <h2>Prepare a source-bound event comparison</h2>
      <p>
        Use existing reviewed event excerpts. Publication requires a different
        named reviewer. No expectation or market reaction is inferred.
      </p>
      {busy && <p role="status">Working on scenario…</p>}
      {notice && <p role="status">{notice}</p>}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button disabled={busy} onClick={() => void load()}>
            Reload scenario workspace
          </button>
        </div>
      )}
      <button
        disabled={busy}
        onClick={() => {
          setSaved(null);
          setSelected('');
          setFields({});
          setReferenceKind('none');
          pending.current = null;
        }}
      >
        New scenario
      </button>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <fieldset disabled={busy}>
          <legend>Reviewed source and family</legend>
          <label>
            Reviewed source event
            <select
              required
              value={selected}
              onChange={(e) => {
                setSelected(e.target.value);
                pending.current = null;
              }}
            >
              <option value="">Choose event</option>
              {events?.items
                .filter((item) => item.event)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.event!.editorial.title}
                  </option>
                ))}
              {saved &&
                !events?.items.some((item) => item.id === saved.event.id) && (
                  <option value={saved.event.id}>
                    {saved.event.event!.editorial.title}
                  </option>
                )}
            </select>
          </label>
          {events?.next && (
            <button
              type="button"
              onClick={() => {
                void wire('events?after=' + events.next)
                  .then((value) => setEvents(EventListSchema.parse(value)))
                  .catch((e: unknown) =>
                    setError(
                      e instanceof Error
                        ? e.message
                        : 'Next event page unavailable.',
                    ),
                  );
              }}
            >
              Next source events
            </button>
          )}
          <label>
            Scenario family
            <select
              value={family}
              onChange={(e) => {
                setFamily(e.target.value);
                setFields({});
                pending.current = null;
              }}
            >
              {Object.entries(definitions).map(([key, definition]) => (
                <option value={key} key={key}>
                  {definition.label}
                </option>
              ))}
            </select>
          </label>
          {definitions[family]!.fields.map(([key, label, options]) => (
            <label key={key}>
              {label}
              <select
                value={selectedFor(key, options)}
                onChange={(e) => edit(key, e.target.value)}
              >
                {choicesFor(key, options).map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
          ))}
          {['earnings', 'guidance'].includes(family) && (
            <>
              <label>
                Reviewed company ISIN
                <select
                  required
                  value={fields.isin ?? ''}
                  onChange={(e) => edit('isin', e.target.value)}
                >
                  <option value="">Choose reviewed identity</option>
                  {event?.event?.editorial.links
                    .filter((link) => link.kind === 'instrument')
                    .map(
                      (link) =>
                        link.kind === 'instrument' && (
                          <option key={link.isin}>{link.isin}</option>
                        ),
                    )}
                </select>
              </label>
              <label>
                Reported unit
                <select
                  value={
                    fields.unit ??
                    (family === 'earnings' ? 'INR-crore' : 'percent')
                  }
                  onChange={(e) => edit('unit', e.target.value)}
                >
                  {(family === 'earnings'
                    ? ['INR', 'INR-lakh', 'INR-crore', 'INR-per-share']
                    : ['percent', 'INR', 'INR-lakh', 'INR-crore']
                  ).map((unit) => (
                    <option key={unit}>{unit}</option>
                  ))}
                </select>
              </label>
            </>
          )}
          <label>
            Observed source excerpt
            <select
              value={fields.observedCitation ?? '0'}
              onChange={(e) => edit('observedCitation', e.target.value)}
            >
              {event?.event?.editorial.citations.map((citation, index) => (
                <option key={index} value={index}>
                  {index + 1}. {citation.quote}
                </option>
              ))}
            </select>
          </label>
          {family === 'regulatory' ? (
            <label>
              Editorial regulatory interpretation
              <textarea
                required
                minLength={8}
                value={fields.interpretation ?? ''}
                onChange={(e) => edit('interpretation', e.target.value)}
              />
            </label>
          ) : (
            <>
              <label>
                Exact observed numeric token
                <input
                  required
                  value={fields.observed ?? ''}
                  onChange={(e) => edit('observed', e.target.value)}
                />
              </label>
              <label>
                Observed period
                <input
                  required
                  value={fields.period ?? ''}
                  onChange={(e) => edit('period', e.target.value)}
                />
              </label>
              <label>
                Reference type
                <select
                  value={referenceKind}
                  onChange={(e) => {
                    setReferenceKind(e.target.value);
                    pending.current = null;
                  }}
                >
                  <option value="none">
                    No reference — no surprise inferred
                  </option>
                  <option value="prior-observation">
                    Sourced prior observation
                  </option>
                  <option value="published-expectation">
                    Earlier published expectation
                  </option>
                  <option value="scenario-assumption">
                    Explicit hypothetical reference
                  </option>
                </select>
              </label>
              {referenceKind !== 'none' && (
                <>
                  <label>
                    Exact reference numeric token
                    <input
                      required
                      value={fields.reference ?? ''}
                      onChange={(e) => edit('reference', e.target.value)}
                    />
                  </label>
                  <label>
                    Reference period
                    <input
                      required
                      value={fields.referencePeriod ?? ''}
                      onChange={(e) => edit('referencePeriod', e.target.value)}
                    />
                  </label>
                  {referenceKind !== 'scenario-assumption' && (
                    <label>
                      Reference source excerpt
                      <select
                        value={fields.referenceCitation ?? '0'}
                        onChange={(e) =>
                          edit('referenceCitation', e.target.value)
                        }
                      >
                        {event?.event?.editorial.citations.map(
                          (citation, index) => (
                            <option key={index} value={index}>
                              {index + 1}. {citation.quote}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                  )}
                </>
              )}
            </>
          )}
          <label>
            Scenario revision reason
            <textarea
              required
              minLength={5}
              value={fields.reason ?? ''}
              onChange={(e) => edit('reason', e.target.value)}
            />
          </label>
          <button disabled={!event?.event}>Save scenario draft</button>
        </fieldset>
      </form>
      {saved && (
        <details open>
          <summary>Prepared scenario receipt</summary>
          <EventScenarioBody receipt={saved} />
        </details>
      )}
      <h3>Independent review queue</h3>
      <label>
        Publication review reason
        <textarea
          minLength={5}
          value={reviewReason}
          onChange={(e) => setReviewReason(e.target.value)}
        />
      </label>
      {queue?.items.map((item) => (
        <article key={item.receipt.id}>
          <h3>{item.receipt.event.event!.editorial.title}</h3>
          <p>
            Edition {item.receipt.version} · {item.state}
          </p>
          <details>
            <summary>Inspect scenario before review</summary>
            <EventScenarioBody receipt={item.receipt} />
          </details>
          <button disabled={busy} onClick={() => open(item.receipt)}>
            Revise scenario
          </button>
          <button
            disabled={busy || reviewReason.trim().length < 5}
            onClick={() => void review(item.receipt, 'publish')}
          >
            Publish scenario
          </button>
          <button
            disabled={busy || reviewReason.trim().length < 5}
            onClick={() => void review(item.receipt, 'withdraw')}
          >
            Withdraw scenario
          </button>
          <a href={'#event-scenarios/' + item.receipt.id}>
            Open public scenario
          </a>
        </article>
      ))}
      {queue?.next && (
        <button disabled={busy} onClick={() => void load(queue.next!)}>
          Next review page
        </button>
      )}
    </section>
  );
}
