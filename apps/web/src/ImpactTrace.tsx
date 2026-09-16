import { oilEducationSource } from '@fingent360/contracts';
import { ImpactCalibration } from './ImpactCalibration';
import { useEffect, useRef, useState } from 'react';
import {
  EquityCompanySchema,
  impactEquityBindings,
  ImpactTraceChoicesSchema,
  ImpactTraceListSchema,
  ImpactTraceReceiptSchema,
  buildImpactTrace,
  goalMinorToRupees,
  type ImpactTraceChoices,
  type ImpactTraceInput,
  type ImpactTraceReceipt,
} from '@fingent360/contracts';
import './impact-trace.css';
class SignedOut extends Error {}
async function api(path: string, method = 'GET', body?: unknown) {
  const response = await fetch('/api/v1/account/impact-traces' + path, {
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
  if (response.status === 401)
    throw new SignedOut('Sign in to open your private impact traces.');
  const value: unknown = await response.json().catch(() => {
    throw new Error('Unreadable response. Retry your request.');
  });
  if (!response.ok)
    throw new Error(
      value && typeof value === 'object' && 'message' in value
        ? String(value.message)
        : 'Trace service unavailable. Retry.',
    );
  return value;
}
function Receipt({ value }: { value: ImpactTraceReceipt }) {
  return (
    <div className="impact-receipt">
      {value.oilEducation && (
        <section aria-label="Oil cost educational conclusion">
          <h2>Fuel costs, through to your goal</h2>
          <p>{value.oilEducation.mechanism}</p>
          <p>
            Issuer report date {value.oilEducation.sourceDate}; exact
            publication time unknown.
          </p>
          <p>{value.oilEducation.noAction}</p>
          <ul>
            {value.oilEducation.limitations.map((limit) => (
              <li key={limit}>{limit}</li>
            ))}
          </ul>
          <a href="#action-centre">Compare an explicit no-action plan</a>
        </section>
      )}
      {value.transmission && (
        <section aria-label="Reviewed transmission conclusion">
          <h2>{value.transmission.binding.title}</h2>
          <p>{value.transmission.binding.mechanism}</p>
          <p>
            {value.transmission.outcome === 'review-before-interpretation'
              ? 'Review uncertainties before interpreting this context.'
              : 'Qualitative context only.'}
          </p>
          <p>
            Holding unchanged. Goal unchanged. No numerical impact is
            calculated.
          </p>
          <ul>
            {value.transmission.reasons.map((reason, index) => (
              <li key={index}>{reason}</li>
            ))}
          </ul>
          <a
            href={value.transmission.binding.reference}
            target="_blank"
            rel="noreferrer"
          >
            Primary mechanism reference
          </a>
          <p>
            Released context {value.transmission.reviewId}, version{' '}
            {value.transmission.reviewVersion} ·{' '}
            {value.transmission.binding.version}
          </p>
        </section>
      )}
      <ol aria-label="Evidence to goal trace">
        {value.chain.map((step) => (
          <li key={step.kind}>
            <small>
              {step.kind} · {step.claimKind}
            </small>
            <h3>{step.label}</h3>
            <p>{step.explanation}</p>
          </li>
        ))}
      </ol>
      <details>
        <summary>Exact source receipts</summary>
        {value.event.event!.sources.map((source) => (
          <div key={source.id}>
            <a href={source.source.url} target="_blank" rel="noreferrer">
              {source.title}
            </a>
            <p>
              Edition {source.version} · published {source.publishedAt} ·
              retrieved {source.source.retrievedAt}
            </p>
            <code>{source.sourceHash}</code>
          </div>
        ))}
      </details>
      {value.equity && (
        <details>
          <summary>Company evidence retained with this trace</summary>
          <p>
            {value.equity.name} · {value.equity.records.length} records
          </p>
          {value.equity.records.map((record, index) => (
            <p key={index}>
              {record.observation.kind} · {record.observation.effectiveOn} ·{' '}
              <a href={record.sourceUrl} target="_blank" rel="noreferrer">
                Source
              </a>{' '}
              · {record.hash}
            </p>
          ))}
        </details>
      )}
      <h3>If you make no change</h3>
      <p>
        Saved holding cost ₹{goalMinorToRupees(value.noAction.holdingCostMinor)}
        . Goal projection ₹{goalMinorToRupees(value.noAction.projectedMinor)};
        gap ₹{goalMinorToRupees(value.noAction.gapMinor)}.
      </p>
      <p>No estimated gain or loss. No trade or goal allocation is created.</p>
      <details open>
        <summary>Limits and uncertainty</summary>
        <ul>
          {[...value.warnings, ...value.uncertainties].map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
export function ImpactTrace() {
  const [contextId, setContextId] = useState('');
  const [oilWalkthrough, setOilWalkthrough] = useState(false);
  const [choices, setChoices] = useState<ImpactTraceChoices | null>(null);
  const [saved, setSaved] = useState<
    ReturnType<typeof ImpactTraceListSchema.parse>['traces']
  >([]);
  const [eventId, setEventId] = useState(''),
    [sector, setSector] = useState(''),
    [isin, setIsin] = useState(''),
    [goalId, setGoalId] = useState('');
  const [consent, setConsent] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ImpactTraceReceipt | null>(null);
  const pending = useRef<{ id: string; input: ImpactTraceInput } | null>(null);
  const alive = useRef(true);
  const failure = (error: unknown, fallback: string) => {
    if (error instanceof SignedOut) {
      setChoices(null);
      setSaved([]);
      setPreview(null);
      pending.current = null;
      setConsent(false);
      setNotice('');
    }
    setError(error instanceof Error ? error.message : fallback);
  };
  const load = async () => {
    setBusy(true);
    setError('');
    try {
      const [a, b] = await Promise.all([api('/choices'), api('')]);
      if (alive.current) {
        setChoices(ImpactTraceChoicesSchema.parse(a));
        setSaved(ImpactTraceListSchema.parse(b).traces);
      }
    } catch (e) {
      if (alive.current) failure(e, 'Could not load traces.');
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
    };
  }, []);
  const selected = choices?.events.find((item) => item.id === eventId);
  const event = selected?.event;
  const clear = () => {
    setPreview(null);
    pending.current = null;
    setNotice('');
    setConsent(false);
  };
  const review = async () => {
    if (!choices || !selected || !event) return;
    setBusy(true);
    try {
      const response = await fetch('/api/v1/equities/' + isin, {
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok && response.status !== 404)
        throw new Error(
          'Company evidence unavailable. Retry before reviewing.',
        );
      const equity =
        response.status === 404
          ? null
          : EquityCompanySchema.parse(await response.json());
      const goal = choices.goals.find((item) => item.id === goalId);
      if (!goal) throw new Error('Choose one of your saved goals.');
      const context = choices.contexts.find((item) => item.id === contextId);
      if (contextId && !context)
        throw new Error('Released context changed. Reload choices.');
      const input: ImpactTraceInput = {
        ...(oilWalkthrough
          ? { educationalPack: 'indigo-atf-context-2026-v1' as const }
          : {}),
        ...(context
          ? { causalContext: { id: context.id, version: context.version } }
          : {}),
        eventId,
        eventVersion: event.version,
        sector,
        isin,
        holdingsVersion: choices.holdings.version,
        goalId,
        goalVersion: goal.version,
        acknowledgedLimits: true,
        storageConsent: true,
        equityBindings: impactEquityBindings(equity),
      };
      const id = crypto.randomUUID();
      setPreview(
        buildImpactTrace(
          id,
          input,
          selected,
          choices.holdings,
          choices.goals,
          new Date().toISOString(),
          equity,
          context,
        ),
      );
      pending.current = { id, input };
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Review current selections.');
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    const request = pending.current;
    if (!request || !consent) return;
    setBusy(true);
    setError('');
    try {
      const receipt = ImpactTraceReceiptSchema.parse(
        await api('/' + request.id, 'PUT', request.input),
      );
      setPreview(receipt);
      setNotice('Impact trace saved.');
      await load();
    } catch (e) {
      failure(e, 'Save failed. Retry uses the same receipt ID.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-label="Impact traces" className="impact-traces">
      <a href="#overview">Back to my overview</a>
      <h1>Why it may matter to you</h1>
      <p>
        Follow a reviewed source through its economic context to your holding
        and a goal. No predicted returns or automated advice.
      </p>
      <nav aria-label="Trace prerequisites">
        <a href="#holdings">Your holdings</a> <a href="#my-goals">Your goals</a>{' '}
        <a href="#events">Reviewed events</a>
      </nav>
      {error && (
        <div role="alert">
          <p>{error}</p>
          <a href="#account?next=impact-traces">Sign in</a>{' '}
          <button onClick={() => void load()} disabled={busy}>
            Reload current records
          </button>
        </div>
      )}
      {busy && <p role="status">Loading or saving your trace…</p>}
      {notice && <p role="status">{notice}</p>}
      {choices && (
        <ImpactCalibration
          isins={choices.holdings.holdings.map((item) => item.isin)}
        />
      )}
      {choices && (
        <>
          {choices.bundleGeneratedAt && (
            <p>
              On this device · source snapshot {choices.bundleGeneratedAt}. Your
              traces stay on this device.
            </p>
          )}
          <label>
            <input
              type="checkbox"
              checked={oilWalkthrough}
              onChange={(e) => {
                setOilWalkthrough(e.target.checked);
                clear();
              }}
            />
            Use the verified IndiGo oil-cost educational walkthrough
          </label>
          {oilWalkthrough && (
            <p role="status">
              Choose the reviewed 1-Apr-2026 IndiGo source event, Airlines
              sector, your actual INE646L01027 holding, a saved goal and its
              independently released company context.{' '}
              {selected && oilEducationSource(selected)
                ? 'The selected event contains the supported issuer report.'
                : 'The selected event does not yet contain the supported issuer report.'}{' '}
              No price impact or financial action is predicted.
            </p>
          )}
          <label>
            Independently released causal context
            <select
              value={contextId}
              onChange={(e) => {
                setContextId(e.target.value);
                clear();
              }}
            >
              <option value="">Reviewed event associations only</option>
              {choices.contexts
                .filter(
                  (item) =>
                    item.input.eventId === eventId &&
                    item.input.content.kind === 'causal-context' &&
                    item.input.content.sector === sector &&
                    item.input.content.isin === isin,
                )
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.input.title} · version {item.version}
                  </option>
                ))}
            </select>
          </label>
          {new Set(
            choices.contexts
              .filter(
                (item) =>
                  item.input.eventId === eventId &&
                  item.input.content.kind === 'causal-context' &&
                  item.input.content.sector === sector &&
                  item.input.content.isin === isin,
              )
              .map((item) =>
                item.input.content.kind === 'causal-context'
                  ? item.input.content.direction
                  : '',
              ),
          ).size > 1 && (
            <p role="alert">
              Released contexts disagree on direction. Review each source-bound
              interpretation; no direction has been selected automatically.
            </p>
          )}
          <p>
            Released direction remains uncertain interpretation; no numerical
            holding or goal impact is inferred. Compare differing released
            contexts before drawing conclusions.
          </p>
          {!choices.events.length && (
            <p>
              No admitted reviewed events in this page. Add and publish evidence
              with sector and company context in Operations.
            </p>
          )}
          {!choices.holdings.holdings.length && (
            <p>Add a holding before connecting evidence to your portfolio.</p>
          )}
          {!choices.goals.length && (
            <p>Create a goal before tracing its context.</p>
          )}
          <fieldset disabled={busy}>
            <legend>Choose your context</legend>
            <label>
              Reviewed event
              <select
                value={eventId}
                onChange={(e) => {
                  setEventId(e.target.value);
                  setContextId('');
                  setSector('');
                  setIsin('');
                  clear();
                }}
              >
                <option value="">Choose an event</option>
                {choices.events.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.event?.editorial.title}
                  </option>
                ))}
              </select>
            </label>
            {choices.next && (
              <button
                onClick={() => {
                  setBusy(true);
                  void api('/choices?after=' + choices.next)
                    .then((value) => {
                      const next = ImpactTraceChoicesSchema.parse(value);
                      setChoices(next);
                      setEventId('');
                      setSector('');
                      setIsin('');
                      clear();
                    })
                    .catch((e: unknown) =>
                      failure(e, 'Could not load next events.'),
                    )
                    .finally(() => setBusy(false));
                }}
              >
                Next events
              </button>
            )}
            <label>
              Reviewed sector
              <select
                value={sector}
                onChange={(e) => {
                  setSector(e.target.value);
                  setContextId('');
                  clear();
                }}
              >
                <option value="">Choose sector</option>
                {[
                  ...new Set(
                    event?.editorial.links
                      .filter((link) => link.kind === 'sector')
                      .map((link) => link.label) ?? [],
                  ),
                ].map((label) => (
                  <option key={label}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              Company in your holdings
              <select
                value={isin}
                onChange={(e) => {
                  setIsin(e.target.value);
                  setContextId('');
                  clear();
                }}
              >
                <option value="">Choose company</option>
                {event?.editorial.links
                  .filter(
                    (link) =>
                      link.kind === 'instrument' &&
                      choices.holdings.holdings.some(
                        (item) => item.isin === link.isin,
                      ),
                  )
                  .map(
                    (link) =>
                      link.kind === 'instrument' && (
                        <option key={link.isin}>{link.isin}</option>
                      ),
                  )}
              </select>
            </label>
            <label>
              Your goal
              <select
                value={goalId}
                onChange={(e) => {
                  setGoalId(e.target.value);
                  clear();
                }}
              >
                <option value="">Choose goal</option>
                {choices.goals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              disabled={!event || !sector || !isin || !goalId}
              onClick={() => void review()}
            >
              Review impact trace
            </button>
          </fieldset>
        </>
      )}
      {preview && (
        <section aria-label="Impact trace review">
          <h2>Review before saving</h2>
          <Receipt value={preview} />
          <label>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            I understand these limits and agree to store this private trace.
          </label>
          <button disabled={busy || !consent} onClick={() => void save()}>
            Save impact trace
          </button>
        </section>
      )}
      <h2>Saved traces</h2>
      {!saved.length && <p>No saved traces yet.</p>}
      {saved.map(({ receipt, reviewReasons }) => (
        <article key={receipt.id}>
          <h3>
            {receipt.goal.name} · {receipt.createdAt}
          </h3>
          {reviewReasons.length > 0 && (
            <div role="note">
              <strong>Review needed</strong>
              <ul>
                {reviewReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
          <details>
            <summary>Open saved trace</summary>
            <Receipt value={receipt} />
          </details>
          <button
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void api('/' + receipt.id, 'DELETE')
                .then(() => {
                  if (preview?.id === receipt.id) clear();
                  return load();
                })
                .catch((e: unknown) => failure(e, 'Deletion failed.'))
                .finally(() => setBusy(false));
            }}
          >
            Delete trace for {receipt.goal.name}
          </button>
        </article>
      ))}
    </section>
  );
}
