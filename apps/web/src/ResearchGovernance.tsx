import { TRANSMISSION_CATALOG, transmissionFor } from '@fingent360/contracts';
import { useEffect, useRef, useState } from 'react';
import {
  EventListSchema,
  ResearchGovernanceDraftSchema,
  ResearchGovernanceRevisionSchema,
  ResearchGovernanceListSchema,
  ResearchGovernanceHistorySchema,
  ResearchSimulationSchema,
  ResearchReviewSchema,
  type ResearchGovernanceRevision,
} from '@fingent360/contracts';
import type { json } from './net';
export function ResearchGovernance({ request }: { request: typeof json }) {
  const [events, setEvents] = useState<ReturnType<
      typeof EventListSchema.parse
    > | null>(null),
    [list, setList] = useState<ReturnType<
      typeof ResearchGovernanceListSchema.parse
    > | null>(null),
    [selected, setSelected] = useState<ResearchGovernanceRevision | null>(null),
    [history, setHistory] = useState<ReturnType<
      typeof ResearchGovernanceHistorySchema.parse
    > | null>(null),
    [simulation, setSimulation] = useState<ReturnType<
      typeof ResearchSimulationSchema.parse
    > | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [fields, setFields] = useState<Record<string, string>>({
      kind: 'causal-context',
    }),
    [citations, setCitations] = useState<number[]>([]),
    [reason, setReason] = useState('');
  const pending = useRef<{
    id: string;
    input: ReturnType<typeof ResearchGovernanceDraftSchema.parse>;
  } | null>(null);
  const live = useRef(true);
  const event =
    events?.items.find((item) => item.id === fields.eventId) ??
    (selected && selected.event.id === fields.eventId
      ? selected.event
      : undefined);
  function edit(name: string, value: string) {
    setFields((old) => ({ ...old, [name]: value }));
    pending.current = null;
    setNotice('');
  }
  async function load(after?: string) {
    setBusy(true);
    setError('');
    try {
      const [a, b] = await Promise.all([
        request('/ops/research-governance' + (after ? '?after=' + after : '')),
        request('/events'),
      ]);
      if (live.current) {
        setList(ResearchGovernanceListSchema.parse(a));
        setEvents(EventListSchema.parse(b));
      }
    } catch (e) {
      if (live.current)
        setError(
          e instanceof Error ? e.message : 'Research governance unavailable.',
        );
    } finally {
      if (live.current) setBusy(false);
    }
  }
  useEffect(() => {
    live.current = true;
    void load();
    return () => {
      live.current = false;
    };
  }, []);
  async function save() {
    if (!event?.event) return;
    setBusy(true);
    setError('');
    try {
      if (!pending.current) {
        const content =
          fields.kind === 'educational-policy'
            ? {
                kind: 'educational-policy',
                rules: {
                  maximumConcentrationBps: Number(fields.concentration),
                  turnoverBudgetBps: Number(fields.turnover),
                  minimumCooldownDays: Number(fields.cooldown),
                  minimumDownsideStressBps: Number(fields.downside),
                },
                adviceEnabled: false,
                tradeExecution: false,
              }
            : {
                kind: 'causal-context',
                ...(fields.transmission
                  ? { transmission: transmissionFor(fields.transmission) }
                  : {}),
                sector: fields.sector,
                isin: fields.isin || null,
                direction: fields.direction ?? 'unknown',
                horizon: fields.horizon,
                limitations: fields.limitations,
                quantifiedImpact: null,
              };
        pending.current = {
          id: selected?.id ?? crypto.randomUUID(),
          input: ResearchGovernanceDraftSchema.parse({
            requestId: crypto.randomUUID(),
            expectedVersion: selected?.version ?? 0,
            eventId: event.id,
            eventVersion: event.event.version,
            title: fields.title,
            reviewBy: fields.reviewBy,
            rationale: fields.rationale,
            citations,
            content,
          }),
        };
      }
      const saved = ResearchGovernanceRevisionSchema.parse(
        await request(
          '/ops/research-governance/' + pending.current.id,
          pending.current.input,
          'PUT',
        ),
      );
      if (!live.current) return;
      setSelected(saved);
      setSimulation(null);
      setHistory(null);
      pending.current = null;
      setNotice(
        'Draft saved. Simulate this version before independent review.',
      );
      await load();
    } catch (e) {
      if (live.current)
        setError(
          e instanceof Error
            ? e.message
            : 'Draft not saved. Retry the same input.',
        );
    } finally {
      if (live.current) setBusy(false);
    }
  }
  function open(revision: ResearchGovernanceRevision) {
    setSelected(revision);
    setSimulation(null);
    setHistory(null);
    setError('');
    setNotice('');
    setReason('');
    pending.current = null;
    const input = revision.input,
      content = input.content;
    setCitations(input.citations);
    setFields({
      kind: content.kind,
      eventId: input.eventId,
      title: input.title,
      reviewBy: input.reviewBy,
      rationale: input.rationale,
      ...(content.kind === 'causal-context'
        ? {
            transmission: content.transmission?.family ?? '',
            sector: content.sector,
            isin: content.isin ?? '',
            direction: content.direction,
            horizon: content.horizon,
            limitations: content.limitations,
          }
        : {
            concentration: String(content.rules.maximumConcentrationBps),
            turnover: String(content.rules.turnoverBudgetBps),
            cooldown: String(content.rules.minimumCooldownDays),
            downside: String(content.rules.minimumDownsideStressBps),
          }),
    });
  }
  async function simulate() {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      const value = ResearchSimulationSchema.parse(
        await request(
          `/ops/research-governance/${selected.id}/simulations`,
          { requestId: crypto.randomUUID(), expectedVersion: selected.version },
          'POST',
        ),
      );
      if (live.current) {
        setSimulation(value);
        setNotice(
          'Simulation stored. It checks deterministic invariants, not economic causality.',
        );
      }
    } catch (e) {
      if (live.current)
        setError(e instanceof Error ? e.message : 'Simulation unavailable.');
    } finally {
      if (live.current) setBusy(false);
    }
  }
  async function review(decision: 'release' | 'withdraw') {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      const receipt = ResearchReviewSchema.parse(
        await request(
          `/ops/research-governance/${selected.id}/reviews`,
          {
            requestId: crypto.randomUUID(),
            expectedVersion: selected.version,
            decision,
            simulationId: simulation?.id ?? null,
            reason,
          },
          'POST',
        ),
      );
      if (live.current) {
        setNotice(
          receipt.decision === 'release'
            ? 'Research version released.'
            : 'Research version withdrawn.',
        );
        await load();
      }
    } catch (e) {
      if (live.current)
        setError(
          e instanceof Error ? e.message : 'Independent review unavailable.',
        );
    } finally {
      if (live.current) setBusy(false);
    }
  }
  return (
    <section aria-label="Research governance" className="panel">
      <h2>Review context and educational policies</h2>
      <p>
        Release explicit source-bound interpretations and guardrails. A
        different named reviewer must approve material changes. Released policy
        rationale and its evidence become public. No release enables advice,
        trading or quantified causal effects.
      </p>
      <button disabled={busy} onClick={() => void load()}>
        Refresh governance queue
      </button>
      <button
        disabled={busy}
        onClick={() => {
          setSelected(null);
          setFields({ kind: 'causal-context' });
          setCitations([]);
          setSimulation(null);
          setHistory(null);
          pending.current = null;
        }}
      >
        New research draft
      </button>
      {busy && <p role="status">Updating research governance…</p>}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {list && (
        <>
          <h3>Review queue</h3>
          {list.items.length === 0 ? (
            <p>No research governance drafts.</p>
          ) : (
            <ul>
              {list.items.map((item) => (
                <li key={item.revision.id}>
                  <button
                    disabled={busy}
                    onClick={() => {
                      open(item.revision);
                      setSimulation(item.simulation);
                    }}
                  >
                    {item.revision.input.title}
                  </button>{' '}
                  · version {item.revision.version} · {item.state}
                  {item.reviewReasons.map((text) => (
                    <p key={text}>{text}</p>
                  ))}
                </li>
              ))}
            </ul>
          )}
          {list.next && (
            <button disabled={busy} onClick={() => void load(list.next!)}>
              Next governance page
            </button>
          )}
        </>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <fieldset disabled={busy}>
          <legend>Source-bound draft</legend>
          <label>
            Governance kind
            <select
              value={fields.kind}
              onChange={(e) => edit('kind', e.target.value)}
            >
              <option value="causal-context">Qualitative causal context</option>
              <option value="educational-policy">
                Educational policy limits
              </option>
            </select>
          </label>
          <label>
            Reviewed event
            <select
              required
              value={fields.eventId ?? ''}
              onChange={(e) => {
                edit('eventId', e.target.value);
                setCitations([]);
              }}
            >
              <option value="">Choose reviewed event</option>
              {events?.items
                .filter((item) => item.event)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.event!.editorial.title}
                  </option>
                ))}
            </select>
          </label>
          {events?.next && (
            <button
              type="button"
              onClick={() =>
                void request('/events?after=' + events.next)
                  .then((value) => {
                    if (!live.current) return;
                    const next = EventListSchema.parse(value);
                    setEvents((previous) => ({
                      ...next,
                      items: [
                        ...(previous?.items ?? []),
                        ...next.items.filter(
                          (item) =>
                            !previous?.items.some((old) => old.id === item.id),
                        ),
                      ],
                    }));
                  })
                  .catch((e) =>
                    setError(
                      e instanceof Error
                        ? e.message
                        : 'More events unavailable.',
                    ),
                  )
              }
            >
              Next reviewed events
            </button>
          )}
          {event?.event && (
            <>
              <a href={'#events/' + event.id}>
                Inspect reviewed event and sources
              </a>
              {event.event.editorial.citations.map((citation, index) => (
                <label key={index}>
                  <input
                    type="checkbox"
                    checked={citations.includes(index)}
                    onChange={(e) => {
                      setCitations((old) =>
                        e.target.checked
                          ? [...old, index]
                          : old.filter((i) => i !== index),
                      );
                      pending.current = null;
                    }}
                  />
                  Citation {index + 1}: {citation.quote}
                </label>
              ))}
            </>
          )}
          <label>
            Research title
            <input
              required
              minLength={5}
              maxLength={160}
              value={fields.title ?? ''}
              onChange={(e) => edit('title', e.target.value)}
            />
          </label>
          <label>
            Review by
            <input
              required
              type="date"
              value={fields.reviewBy ?? ''}
              onChange={(e) => edit('reviewBy', e.target.value)}
            />
          </label>
          <label>
            Evidence and policy rationale
            <textarea
              required
              minLength={20}
              maxLength={2000}
              value={fields.rationale ?? ''}
              onChange={(e) => edit('rationale', e.target.value)}
            />
          </label>
          {fields.kind === 'educational-policy' ? (
            <>
              <p>
                Enter explicit editorial limits. These are not regulatory limits
                or investment recommendations; one basis point is 0.01%.
              </p>
              {[
                [
                  'concentration',
                  'Maximum concentration (basis points)',
                  10000,
                ],
                ['turnover', 'Turnover budget (basis points)', 10000],
                ['cooldown', 'Minimum cooldown (days)', 3650],
                ['downside', 'Minimum downside stress (basis points)', 10000],
              ].map(([key, label, max]) => (
                <label key={String(key)}>
                  {label}
                  <input
                    required
                    type="number"
                    min={0}
                    max={Number(max)}
                    step={1}
                    value={fields[String(key)] ?? ''}
                    onChange={(e) => edit(String(key), e.target.value)}
                  />
                </label>
              ))}
            </>
          ) : (
            <>
              <label>
                Transmission mechanism
                <select
                  value={fields.transmission ?? ''}
                  onChange={(e) => edit('transmission', e.target.value)}
                >
                  <option value="">No catalog mechanism bound</option>
                  {TRANSMISSION_CATALOG.map((entry) => (
                    <option
                      key={entry.family}
                      value={entry.family}
                      disabled={entry.family !== event?.event?.editorial.family}
                    >
                      {entry.family}: {entry.title}
                    </option>
                  ))}
                </select>
              </label>
              {fields.transmission && transmissionFor(fields.transmission) && (
                <p>
                  {transmissionFor(fields.transmission)!.mechanism}{' '}
                  <a
                    href={transmissionFor(fields.transmission)!.reference}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Primary mechanism reference
                  </a>
                  . This does not automatically verify issuer exposure or
                  release the policy.
                </p>
              )}
              <label>
                Reviewed sector
                <select
                  required
                  value={fields.sector ?? ''}
                  onChange={(e) => edit('sector', e.target.value)}
                >
                  <option value="">Choose actual event sector</option>
                  {event?.event?.editorial.links
                    .filter((link) => link.kind === 'sector')
                    .map((link, index) => (
                      <option
                        key={index}
                        value={link.kind === 'sector' ? link.label : ''}
                      >
                        {link.kind === 'sector' ? link.label : ''}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Reviewed company
                <select
                  value={fields.isin ?? ''}
                  onChange={(e) => edit('isin', e.target.value)}
                >
                  <option value="">Sector context only</option>
                  {event?.event?.editorial.links
                    .filter((link) => link.kind === 'instrument')
                    .map((link, index) => (
                      <option
                        key={index}
                        value={link.kind === 'instrument' ? link.isin : ''}
                      >
                        {link.kind === 'instrument' ? link.isin : ''}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Qualitative direction
                <select
                  value={fields.direction ?? 'unknown'}
                  onChange={(e) => edit('direction', e.target.value)}
                >
                  {['unknown', 'mixed', 'positive', 'negative'].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                Context horizon
                <input
                  required
                  minLength={3}
                  value={fields.horizon ?? ''}
                  onChange={(e) => edit('horizon', e.target.value)}
                />
              </label>
              <label>
                Uncertainty and limitations
                <textarea
                  required
                  minLength={20}
                  value={fields.limitations ?? ''}
                  onChange={(e) => edit('limitations', e.target.value)}
                />
              </label>
            </>
          )}
          <button disabled={!event?.event || citations.length === 0}>
            Save research draft
          </button>
        </fieldset>
      </form>
      {selected && (
        <>
          <h3>
            Simulation and independent review — version {selected.version}
          </h3>
          <button disabled={busy} onClick={() => void simulate()}>
            Simulate saved revision
          </button>
          {simulation && (
            <>
              <p>
                {simulation.passed ? 'Simulation passed' : 'Simulation failed'}{' '}
                · {simulation.basis}
              </p>
              <ul>
                {simulation.checks.map((check) => (
                  <li key={check.id}>
                    {check.passed ? 'Pass' : 'Fail'}: {check.detail}
                  </li>
                ))}
              </ul>
            </>
          )}
          <label>
            Independent review reason
            <textarea
              minLength={10}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button
            disabled={busy || !simulation?.passed || reason.trim().length < 10}
            onClick={() => void review('release')}
          >
            Release research version
          </button>
          <button
            disabled={busy || reason.trim().length < 10}
            onClick={() => void review('withdraw')}
          >
            Withdraw research version
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void request(`/ops/research-governance/${selected.id}/history`)
                .then((value) => {
                  if (live.current)
                    setHistory(ResearchGovernanceHistorySchema.parse(value));
                })
                .catch((e) =>
                  setError(
                    e instanceof Error ? e.message : 'History unavailable.',
                  ),
                )
            }
          >
            Open governance history
          </button>
          {history && (
            <div>
              <p>Latest 100 revisions and reviews.</p>
              {history.reviews.map((item, index) => (
                <p key={index}>
                  Version {item.version} · {item.decision} · {item.reason}
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
