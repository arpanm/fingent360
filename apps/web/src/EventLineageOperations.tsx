import { useEffect, useRef, useState } from 'react';
import {
  EventOperationsListSchema,
  EventOperationsSchema,
  EventLineageInputSchema,
  EventLineagePlanSchema,
  EventLineageOperationsSchema,
  EventLineageListSchema,
  EventLineageReceiptSchema,
  PublicationProposalSchema,
  type EventRevision,
} from '@fingent360/contracts';
import { json, RequestError } from './net';
import { useDraftGuard } from './useDraftGuard';
import { EventLineagePlanView } from './EventLineagePlanView';
import './event-lineage.css';
type Editorial = EventRevision['editorial'];
type Plan = ReturnType<typeof EventLineagePlanSchema.parse>;
export function EventLineageOperations({
  request,
  named,
}: {
  request: typeof json;
  named: boolean;
}) {
  const [items, setItems] = useState<ReturnType<
    typeof EventOperationsListSchema.parse
  > | null>(null);
  const [history, setHistory] = useState<ReturnType<
    typeof EventLineageListSchema.parse
  > | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [kind, setKind] = useState<'merge' | 'split'>('merge');
  const [originals, setOriginals] = useState<EventRevision[]>([]);
  const [outputs, setOutputs] = useState<
    { id: string; editorial: Editorial }[]
  >([]);
  const [reason, setReason] = useState('');
  const [review, setReview] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [proposalId, setProposalId] = useState<string | null>(null);
  const generation = useRef(0),
    live = useRef(false);
  useDraftGuard(
    outputs.length > 0 || busy,
    'Leave this event lineage draft? Unsaved changes will be lost.',
  );
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      generation.current++;
    };
  }, []);
  async function action(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (failure) {
      if (
        live.current &&
        failure instanceof RequestError &&
        [400, 409].includes(failure.status)
      )
        setRequestId(null);
      if (live.current)
        setError(
          failure instanceof Error
            ? failure.message
            : 'Unable to complete the lineage request. Retry or reload.',
        );
    } finally {
      if (live.current) setBusy(false);
    }
  }
  async function load(after = '') {
    const ticket = ++generation.current;
    const result = EventOperationsListSchema.parse(
      await request('/ops/events' + (after ? '?after=' + after : '')),
    );
    if (live.current && ticket === generation.current) setItems(result);
  }
  async function begin() {
    if (
      (kind === 'merge' && (selected.length < 2 || selected.length > 5)) ||
      (kind === 'split' && selected.length !== 1)
    )
      throw Error('Select 2–5 published events for a merge or 1 for a split.');
    const records: EventRevision[] = [];
    for (const id of selected) {
      const current = EventOperationsSchema.parse(
        await request('/ops/events/' + id),
      );
      if (
        current.state.status !== 'published' ||
        current.state.headVersion !== current.state.publishedVersion
      )
        throw Error(
          'Each input must be its current published head, without a pending draft.',
        );
      records.push(current.latest);
    }
    if (!live.current) return;
    setOriginals(records);
    setOutputs(
      Array.from({ length: kind === 'merge' ? 1 : 2 }, () => ({
        id: crypto.randomUUID(),
        editorial: { ...structuredClone(records[0]!.editorial), links: [] },
      })),
    );
    setReason('');
    setReview(false);
    setRequestId(null);
    setPlan(null);
    setMessage('');
  }
  function input() {
    return EventLineageInputSchema.parse({
      kind,
      inputs: originals.map((item) => ({ id: item.id, version: item.version })),
      outputs,
      reason,
    });
  }
  async function save() {
    const id = requestId ?? crypto.randomUUID();
    setRequestId(id);
    const result = EventLineagePlanSchema.parse(
      await request('/ops/event-lineage/' + id, input(), 'PUT'),
    );
    if (!live.current) return;
    setPlan(result);
    setOutputs([]);
    setReview(false);
    setRequestId(null);
    setProposalId(null);
    setMessage(
      'Immutable plan saved. Public events are unchanged. Submit it for independent review or review explicitly in bootstrap mode.',
    );
  }
  async function submit() {
    if (!plan) return;
    if (named) {
      const id = proposalId ?? crypto.randomUUID();
      setProposalId(id);
      const saved = PublicationProposalSchema.parse(
        await request(
          '/ops/proposals/' + id,
          {
            kind: 'event-lineage',
            target: plan.id,
            body: { fingerprint: plan.fingerprint },
          },
          'PUT',
        ),
      );
      if (live.current)
        setMessage(
          `Publication proposal ${saved.id}: ${saved.state}. Its saved decision is historical; use Named operators to inspect and decide it. A different named identity must approve.`,
        );
    } else {
      const receipt = EventLineageReceiptSchema.parse(
        await request(
          '/ops/event-lineage/' + plan.id + '/approve',
          { fingerprint: plan.fingerprint },
          'POST',
        ),
      );
      if (live.current)
        setMessage(
          `Applied ${receipt.kind} at ${new Date(receipt.reviewedAt).toLocaleString()}. This is the immutable application receipt, not a current-source guarantee.`,
        );
    }
  }
  const citations = [
    ...new Map(
      originals
        .flatMap((item) => item.editorial.citations)
        .map((item) => [JSON.stringify(item), item]),
    ).values(),
  ];
  const update = (index: number, patch: Partial<Editorial>) => {
    setReview(false);
    setRequestId(null);
    setOutputs(
      outputs.map((item, i) =>
        i === index
          ? { ...item, editorial: { ...item.editorial, ...patch } }
          : item,
      ),
    );
  };
  return (
    <section
      className="event-lineage"
      aria-label="Merge or split reviewed events"
    >
      <h2>Merge or split reviewed events</h2>
      <p>
        Restructure reviewed context without rewriting original revisions or
        private records. Outputs copy the first input as an editable starting
        point; inspect and revise every field. No causal effect is inferred.
      </p>
      {busy && <p role="status">Working on the lineage request…</p>}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {!outputs.length && (
        <>
          <button disabled={busy} onClick={() => void action(() => load())}>
            Load current published event choices
          </button>
          <label htmlFor="lineage-kind">Restructuring type</label>
          <select
            id="lineage-kind"
            disabled={busy}
            value={kind}
            onChange={(event) => {
              setKind(event.target.value as 'merge' | 'split');
              setSelected([]);
            }}
          >
            <option value="merge">Merge duplicates into one</option>
            <option value="split">Split broad context</option>
          </select>
          {items && (
            <fieldset disabled={busy}>
              <legend>Choose exact published inputs</legend>
              {items.items
                .filter(
                  (item) =>
                    item.status === 'published' &&
                    item.headVersion === item.publishedVersion,
                )
                .map((item) => (
                  <label key={item.id}>
                    <input
                      type="checkbox"
                      checked={selected.includes(item.id)}
                      onChange={(event) =>
                        setSelected(
                          event.target.checked
                            ? [...selected, item.id]
                            : selected.filter((id) => id !== item.id),
                        )
                      }
                    />
                    {item.title} · revision {item.headVersion}
                  </label>
                ))}
              {items.next && (
                <button onClick={() => void action(() => load(items.next!))}>
                  Next event choices
                </button>
              )}
            </fieldset>
          )}
          <button
            disabled={busy || !selected.length}
            onClick={() => void action(begin)}
          >
            Author replacement outputs
          </button>
        </>
      )}
      {requestId && !!outputs.length && (
        <p>
          The plan save is unconfirmed. Its input is locked until the same
          request is retried or definitively rejected.{' '}
          <button disabled={busy} onClick={() => void action(save)}>
            Retry same lineage save
          </button>
        </p>
      )}
      {!!outputs.length && (
        <fieldset disabled={busy || !!requestId}>
          <legend>
            {review
              ? 'Review complete before and after'
              : 'Author replacement outputs'}
          </legend>
          {originals.map((item) => (
            <article key={item.id}>
              <h3>Original: {item.editorial.title}</h3>
              <p>
                Exact revision {item.version}. {item.editorial.explanation}
              </p>
            </article>
          ))}
          {outputs.map((output, index) => (
            <article key={output.id}>
              <h3>Output {index + 1}</h3>
              <label htmlFor={`lineage-title-${index}`}>
                Output {index + 1} title
              </label>
              <input
                id={`lineage-title-${index}`}
                value={output.editorial.title}
                onChange={(event) =>
                  update(index, { title: event.target.value })
                }
              />
              <label htmlFor={`lineage-family-${index}`}>
                Output {index + 1} family
              </label>
              <input
                id={`lineage-family-${index}`}
                value={output.editorial.family}
                onChange={(event) =>
                  update(index, { family: event.target.value })
                }
              />
              <label htmlFor={`lineage-geography-${index}`}>
                Output {index + 1} geography, comma separated
              </label>
              <input
                id={`lineage-geography-${index}`}
                value={output.editorial.geography.join(', ')}
                onChange={(event) =>
                  update(index, {
                    geography: event.target.value
                      .split(',')
                      .map((value) => value.trim())
                      .filter(Boolean),
                  })
                }
              />
              <label htmlFor={`lineage-kind-${index}`}>
                Output {index + 1} claim type
              </label>
              <select
                id={`lineage-kind-${index}`}
                value={output.editorial.claimKind}
                onChange={(event) =>
                  update(index, {
                    claimKind: event.target.value as Editorial['claimKind'],
                  })
                }
              >
                {['fact', 'expectation', 'scenario', 'inference'].map(
                  (value) => (
                    <option key={value}>{value}</option>
                  ),
                )}
              </select>
              <label htmlFor={`lineage-explanation-${index}`}>
                Output {index + 1} explanation
              </label>
              <textarea
                id={`lineage-explanation-${index}`}
                value={output.editorial.explanation}
                onChange={(event) =>
                  update(index, { explanation: event.target.value })
                }
              />
              <label htmlFor={`lineage-announced-${index}`}>
                Output {index + 1} announced time (ISO or blank for unknown)
              </label>
              <input
                id={`lineage-announced-${index}`}
                value={output.editorial.announcedAt ?? ''}
                onChange={(event) =>
                  update(index, { announcedAt: event.target.value || null })
                }
              />
              <label htmlFor={`lineage-effective-${index}`}>
                Output {index + 1} effective time (ISO or blank for unknown)
              </label>
              <input
                id={`lineage-effective-${index}`}
                value={output.editorial.effectiveAt ?? ''}
                onChange={(event) =>
                  update(index, { effectiveAt: event.target.value || null })
                }
              />
              <fieldset>
                <legend>
                  Explicit supporting excerpts for output {index + 1}
                </legend>
                {citations.map((citation, citationIndex) => (
                  <label key={citationIndex}>
                    <input
                      type="checkbox"
                      checked={output.editorial.citations.some(
                        (item) =>
                          JSON.stringify(item) === JSON.stringify(citation),
                      )}
                      onChange={(event) =>
                        update(index, {
                          citations: event.target.checked
                            ? [...output.editorial.citations, citation]
                            : output.editorial.citations.filter(
                                (item) =>
                                  JSON.stringify(item) !==
                                  JSON.stringify(citation),
                              ),
                        })
                      }
                    />
                    {citation.quote} · source revision {citation.version}
                  </label>
                ))}
              </fieldset>
              <p>
                No instrument or sector link is automatically carried into a
                replacement. Author additional reviewed context through the
                normal event editor after application.
              </p>
              {kind === 'split' && outputs.length > 2 && (
                <button
                  onClick={() => {
                    setReview(false);
                    setOutputs(outputs.filter((_, i) => i !== index));
                  }}
                >
                  Remove output {index + 1}
                </button>
              )}
            </article>
          ))}
          {kind === 'split' && outputs.length < 5 && (
            <button
              onClick={() => {
                setReview(false);
                setOutputs([
                  ...outputs,
                  {
                    id: crypto.randomUUID(),
                    editorial: structuredClone(outputs[0]!.editorial),
                  },
                ]);
              }}
            >
              Add split output
            </button>
          )}
          <label htmlFor="lineage-reason">Public restructuring reason</label>
          <textarea
            id="lineage-reason"
            value={reason}
            onChange={(event) => {
              setReview(false);
              setReason(event.target.value);
            }}
          />
          {review ? (
            <>
              <button onClick={() => void action(save)}>
                Save immutable lineage plan
              </button>
              <button onClick={() => setReview(false)}>
                Back to output editing
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                try {
                  input();
                  setReview(true);
                  setError('');
                } catch {
                  setError(
                    'Complete the output fields, exact excerpts and a public reason of at least 10 characters.',
                  );
                }
              }}
            >
              Review lineage plan
            </button>
          )}
          <button
            onClick={() => {
              if (window.confirm('Discard this unsaved lineage draft?')) {
                setOutputs([]);
                setReview(false);
                setRequestId(null);
              }
            }}
          >
            Discard lineage draft
          </button>
        </fieldset>
      )}
      {plan && (
        <section aria-label="Saved lineage plan">
          <h3>Saved plan {plan.id}</h3>
          <p>{plan.input.reason}</p>
          <p>
            Saved {new Date(plan.createdAt).toLocaleString()}. Original heads
            and evidence are rechecked on application.
          </p>
          <EventLineagePlanView plan={plan} />
          <button disabled={busy} onClick={() => void action(submit)}>
            {named
              ? 'Submit lineage for independent approval'
              : 'Apply reviewed lineage in bootstrap mode'}
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void action(async () => {
                const result = EventLineageOperationsSchema.parse(
                  await request('/ops/event-lineage/' + plan.id),
                );
                if (live.current)
                  setMessage(
                    result.receipt
                      ? `Applied at ${new Date(result.receipt.reviewedAt).toLocaleString()}. Historical receipt retained.`
                      : 'This plan has not been applied. Publication proposal decisions are listed in Named operators; rejected plans require a new proposal request.',
                  );
              })
            }
          >
            Read application receipt
          </button>
        </section>
      )}
      <button
        disabled={busy}
        onClick={() =>
          void action(async () => {
            const result = EventLineageListSchema.parse(
              await request('/ops/event-lineage'),
            );
            if (live.current) setHistory(result);
          })
        }
      >
        Load saved lineage plans
      </button>
      {history?.plans.map((item) => (
        <article key={item.plan.id}>
          <p>
            {item.plan.input.kind}: {item.plan.input.reason} ·{' '}
            {item.receipt ? 'Applied' : 'Not applied'}
          </p>
          <button
            disabled={busy || !!outputs.length}
            onClick={() => {
              setPlan(item.plan);
              setProposalId(null);
              setMessage(
                'Historical saved plan opened. Read its current application receipt before proceeding.',
              );
            }}
          >
            Open plan {item.plan.id}
          </button>
        </article>
      ))}
      {history?.next && (
        <button
          disabled={busy}
          onClick={() =>
            void action(async () => {
              const result = EventLineageListSchema.parse(
                await request('/ops/event-lineage?after=' + history.next),
              );
              if (live.current) setHistory(result);
            })
          }
        >
          Next saved plans
        </button>
      )}
    </section>
  );
}
