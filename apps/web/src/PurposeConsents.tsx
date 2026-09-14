import { useEffect, useId, useRef, useState } from 'react';
import {
  ConsentListSchema,
  ConsentExportSchema,
  ConsentReceiptSchema,
  ConsentWriteSchema,
  consentDescriptions,
  type ConsentPurpose,
  type ConsentWrite,
  type ConsentReceipt,
} from '@fingent360/contracts';
import type { z } from 'zod';
import './purpose-consents.css';
type Current = z.infer<typeof ConsentListSchema>;
type History = z.infer<typeof ConsentExportSchema>;
type Draft = {
  purpose: ConsentPurpose;
  action: ConsentWrite['action'];
  expiry: string;
  noExpiry: boolean;
  reviewed: boolean;
};
function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Purpose consent could not be read. Retry.';
}
const date = (value: string | null) =>
  value ? new Date(value).toLocaleString() : 'Not recorded';
export function PurposeConsents({
  request,
}: {
  request: (path: string, body?: unknown) => Promise<unknown>;
}) {
  const [current, setCurrent] = useState<Current | null>(null),
    [history, setHistory] = useState<History | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null),
    [pending, setPending] = useState<ConsentWrite | null>(null);
  const [receipt, setReceipt] = useState<ConsentReceipt | null>(null),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [error, setError] = useState(''),
    [historyError, setHistoryError] = useState(''),
    [historyBusy, setHistoryBusy] = useState(false);
  const [notice, setNotice] = useState(''),
    [conflict, setConflict] = useState(false);
  const live = useRef(false),
    ticket = useRef(0),
    historyTicket = useRef(0),
    api = useRef(request),
    owner = useRef<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null),
    formHeading = useRef<HTMLHeadingElement>(null),
    id = useId();
  api.current = request;
  async function load() {
    const turn = ++ticket.current;
    setLoading(true);
    setCurrent(null);
    setError('');
    try {
      const value = ConsentListSchema.parse(await api.current('/consents'));
      if (!live.current || turn !== ticket.current) return;
      if (owner.current && value.ownerId !== owner.current)
        throw Error('Account changed. Reopen Privacy before continuing.');
      owner.current = value.ownerId;
      setCurrent(value);
    } catch (cause) {
      if (live.current && turn === ticket.current) setError(message(cause));
    } finally {
      if (live.current && turn === ticket.current) setLoading(false);
    }
  }
  async function loadHistory(more = false) {
    if (historyBusy) return;
    const turn = ++historyTicket.current;
    setHistoryBusy(true);
    setHistoryError('');
    try {
      const prior = more ? history : null;
      const path = prior?.next
        ? '/consents/history?' +
          new URLSearchParams({ after: prior.next, upper: prior.upper })
        : '/consents/history';
      const value = ConsentExportSchema.parse(await api.current(path));
      if (!live.current || turn !== historyTicket.current) return;
      if (owner.current && value.ownerId !== owner.current)
        throw Error('Account changed. Reopen Privacy before continuing.');
      if (
        prior &&
        (value.upper !== prior.upper ||
          value.ownerId !== prior.ownerId ||
          value.events.some((e) => BigInt(e.sequence) <= BigInt(prior.next!)))
      )
        throw Error('Consent history boundary changed. Refresh history.');
      setHistory(
        prior
          ? { ...value, events: [...prior.events, ...value.events] }
          : value,
      );
    } catch (cause) {
      if (live.current && turn === historyTicket.current)
        setHistoryError(message(cause));
    } finally {
      if (live.current && turn === historyTicket.current) setHistoryBusy(false);
    }
  }
  useEffect(() => {
    live.current = true;
    void load();
    return () => {
      live.current = false;
      ticket.current++;
      historyTicket.current++;
    };
  }, []);
  useEffect(() => {
    if (draft) formHeading.current?.focus();
  }, [draft?.purpose, draft?.action]);
  function cancel() {
    setDraft(null);
    setPending(null);
    setConflict(false);
    setError('');
    heading.current?.focus();
  }
  function prepare() {
    if (!draft || !current) return;
    try {
      const head = current.purposes.find(
        (p) => p.record.purpose === draft.purpose,
      )!.record;
      const action =
        draft.action === 'revoke'
          ? 'revoke'
          : head.decision === 'not-granted'
            ? 'grant'
            : 'renew';
      const input = ConsentWriteSchema.parse({
        requestId: crypto.randomUUID(),
        expectedVersion: head.version,
        policyVersion: 'purpose-consent-v1',
        action,
        reviewed: true,
        ...(draft.action === 'revoke'
          ? {}
          : {
              expiresAt: draft.noExpiry
                ? null
                : new Date(draft.expiry).toISOString(),
            }),
      });
      if (
        input.expiresAt &&
        (Date.parse(input.expiresAt) <= Date.now() ||
          Date.parse(input.expiresAt) > Date.now() + 366 * 86400000)
      )
        throw Error('Choose a future expiry within 366 days.');
      setDraft({ ...draft, action, reviewed: false });
      setPending(input);
      setConflict(false);
      setError('');
    } catch (cause) {
      setError(
        cause instanceof RangeError
          ? 'Choose a valid expiry date and time.'
          : message(cause),
      );
    }
  }
  async function save() {
    if (busy || !draft || !pending || !draft.reviewed || conflict) return;
    setBusy(true);
    setError('');
    setNotice('');
    const selectedPurpose = draft.purpose;
    try {
      const saved = ConsentReceiptSchema.parse(
        await api.current(`/consents/${selectedPurpose}`, pending),
      );
      if (!live.current) return;
      if (
        saved.requestId !== pending.requestId ||
        saved.state.purpose !== selectedPurpose
      )
        throw Error(
          'Consent receipt did not match this request. Retry the same decision.',
        );
      setReceipt(saved);
      setCurrent(null);
      setDraft(null);
      setPending(null);
      setNotice('Decision receipt saved. Refreshing current permission…');
      await load();
      if (!live.current) return;
      setNotice(
        'Decision receipt saved. Only the current permission cards confirm what is permitted now.',
      );
      heading.current?.focus();
    } catch (cause) {
      if (!live.current) return;
      setError(message(cause));
      if (
        cause &&
        typeof cause === 'object' &&
        'status' in cause &&
        cause.status === 409
      ) {
        setConflict(true);
        await load();
        if (live.current)
          setError(
            'Consent changed. Review the current version and expiry again before saving.',
          );
      }
    } finally {
      if (live.current) setBusy(false);
    }
  }
  return (
    <section
      className="card purpose-consents"
      aria-labelledby={`${id}-heading`}
    >
      <h2 id={`${id}-heading`} tabIndex={-1} ref={heading}>
        Purpose consent
      </h2>
      <p>
        Choose which optional uses are permitted. Revocation stops future use;
        it does not erase your records or issued reports. Download or delete
        your account separately.
      </p>
      <p>
        On-device mode keeps these choices on this device and never sends
        requests to an AI provider. Times below use your device timezone.
      </p>
      <button
        className="secondary"
        disabled={busy || loading}
        onClick={() => void load()}
      >
        Refresh current permissions
      </button>
      {loading && <p role="status">Loading current permissions…</p>}
      {notice && <p role="status">{notice}</p>}
      {error && <div role="alert">{error}</div>}
      {!loading && !current && (
        <p>
          Current permission is unavailable. Refresh before relying on a saved
          receipt.
        </p>
      )}
      {current && (
        <div aria-label="Current permissions" className="purpose-consent-grid">
          {current.purposes.map(({ record, status }) => (
            <article
              className="panel"
              key={record.purpose}
              aria-label={consentDescriptions[record.purpose].title}
            >
              <h3>{consentDescriptions[record.purpose].title}</h3>
              <p>{consentDescriptions[record.purpose].use}</p>
              <p>
                <strong>Current status: {status.replaceAll('-', ' ')}</strong> ·
                version {record.version}
              </p>
              <p>
                Expiry:{' '}
                {record.expiresAt
                  ? date(record.expiresAt)
                  : record.decision === 'granted'
                    ? 'No expiry chosen'
                    : 'No active grant'}
              </p>
              {record.basis && (
                <p>
                  Basis: {record.basis.kind.replaceAll('-', ' ')}. Recorded:{' '}
                  {date(record.basis.recordedAt)}.
                </p>
              )}
              {status === 'legacy-active' && (
                <p>
                  An existing explicit opt-in supports this use. No new grant
                  has been invented by opening this page. Review a renewal to
                  record a dated decision and optional expiry.
                </p>
              )}
              {status === 'unavailable' && (
                <p>
                  A recorded date is ahead of the current clock. This purpose is
                  unavailable until its dates can be evaluated.
                </p>
              )}
              <p>{consentDescriptions[record.purpose].preserved}</p>
              <div className="page-actions">
                <button
                  disabled={busy || !!draft}
                  onClick={() => {
                    setDraft({
                      purpose: record.purpose,
                      action:
                        record.decision === 'not-granted' ? 'grant' : 'renew',
                      expiry: '',
                      noExpiry: true,
                      reviewed: false,
                    });
                    setPending(null);
                    setError('');
                  }}
                >
                  {record.decision === 'not-granted'
                    ? 'Review grant'
                    : 'Review renewal'}
                </button>
                {record.decision !== 'revoked' && (
                  <button
                    className="secondary"
                    disabled={busy || !!draft}
                    onClick={() => {
                      setDraft({
                        purpose: record.purpose,
                        action: 'revoke',
                        expiry: '',
                        noExpiry: true,
                        reviewed: false,
                      });
                      setPending(null);
                      setError('');
                    }}
                  >
                    Review revocation
                  </button>
                )}
              </div>
            </article>
          ))}
          <p>
            Evaluated {date(current.evaluatedAt)}. Permission is checked again
            when it is used.
          </p>
        </div>
      )}
      {draft && (
        <form
          className="panel"
          aria-label="Review purpose consent"
          onSubmit={(event) => {
            event.preventDefault();
            if (pending && !conflict) void save();
            else prepare();
          }}
        >
          <h3 tabIndex={-1} ref={formHeading}>
            Review {draft.action}: {consentDescriptions[draft.purpose].title}
          </h3>
          <p>{consentDescriptions[draft.purpose].use}</p>
          <p>{consentDescriptions[draft.purpose].preserved}</p>
          {draft.action === 'revoke' ? (
            <p>
              This stops future use after revocation is saved. A request already
              dispatched to an external provider cannot be recalled.
            </p>
          ) : (
            <fieldset disabled={busy || (!!pending && !conflict)}>
              <legend>Expiry choice</legend>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={draft.noExpiry}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      noExpiry: e.target.checked,
                      reviewed: false,
                    })
                  }
                />
                No expiry; I can revoke this purpose later
              </label>
              {!draft.noExpiry && (
                <>
                  <label htmlFor={`${id}-expiry`}>
                    Expiry date and time (device timezone)
                  </label>
                  <input
                    id={`${id}-expiry`}
                    type="datetime-local"
                    value={draft.expiry}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        expiry: e.target.value,
                        reviewed: false,
                      })
                    }
                    required
                  />
                </>
              )}
            </fieldset>
          )}
          {pending && !conflict && (
            <>
              <p>
                Policy purpose-consent-v1 · expected version{' '}
                {pending.expectedVersion}.{' '}
                {pending.action === 'revoke'
                  ? 'Revoke future use.'
                  : pending.expiresAt
                    ? `Expires ${date(pending.expiresAt)}.`
                    : 'No expiry.'}
              </p>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={draft.reviewed}
                  disabled={busy}
                  onChange={(e) =>
                    setDraft({ ...draft, reviewed: e.target.checked })
                  }
                />
                I reviewed this purpose, the data used and this decision
              </label>
            </>
          )}
          <div className="page-actions">
            <button
              disabled={
                busy || !current || (!!pending && !conflict && !draft.reviewed)
              }
            >
              {busy
                ? 'Saving decision…'
                : pending && !conflict
                  ? 'Save consent decision'
                  : 'Review decision'}
            </button>
            {pending && (
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => {
                  setPending(null);
                  setDraft({ ...draft, reviewed: false });
                  setConflict(false);
                }}
              >
                Edit decision
              </button>
            )}
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={cancel}
            >
              Cancel consent review
            </button>
          </div>
        </form>
      )}
      {receipt && (
        <section className="panel" aria-label="Saved consent receipt">
          <h3>Saved decision receipt</h3>
          <p>
            {consentDescriptions[receipt.state.purpose].title}: {receipt.action}{' '}
            · version {receipt.state.version} · {date(receipt.at)}.
          </p>
          <p>
            This is immutable history. It does not establish current permission.
          </p>
          {receipt.scheduleEffects.map((effect) => (
            <p key={effect.scheduleId}>
              Schedule {effect.scheduleId.slice(0, 8)} next occurrence:{' '}
              {date(effect.nextDueAt)}. No lapse catch-up.
            </p>
          ))}
        </section>
      )}
      <details>
        <summary>Consent decision history</summary>
        <p>
          History preserves your recorded choices until account deletion.
          Existing legacy opt-ins have no ledger event until you make a recorded
          decision.
        </p>
        <button
          type="button"
          disabled={historyBusy || busy}
          onClick={() => void loadHistory()}
        >
          Refresh consent history
        </button>
        {historyBusy && <p role="status">Loading consent history…</p>}
        {historyError && <p role="alert">{historyError}</p>}
        {history?.events.length === 0 && (
          <p>No consent decisions recorded yet.</p>
        )}
        <ol>
          {history?.events.map(({ sequence, receipt: item }) => (
            <li key={sequence}>
              {consentDescriptions[item.state.purpose].title} · {item.action} ·
              version {item.state.version} · {date(item.at)} ·{' '}
              {item.state.expiresAt
                ? `expiry ${date(item.state.expiresAt)}`
                : 'no expiry recorded'}
              .
            </li>
          ))}
        </ol>
        {history?.next && (
          <button disabled={historyBusy} onClick={() => void loadHistory(true)}>
            Load more consent history
          </button>
        )}
      </details>
    </section>
  );
}
