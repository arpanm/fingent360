import { useEffect, useRef, useState } from 'react';
import {
  FILING_WATCH_SOURCES,
  FilingWatchGateSchema,
  FilingWatchStatusSchema,
  EquityReviewSchema,
} from '@fingent360/contracts';
import { json, RequestError } from './net';
export function FilingWatchOperations({
  request = json,
  onDenied,
}: {
  request?: typeof json;
  onDenied: () => void;
}) {
  const [data, setData] = useState<ReturnType<
      typeof FilingWatchStatusSchema.parse
    > | null>(null),
    [selected, setSelected] = useState<string[]>([]),
    [rights, setRights] = useState(''),
    [enabled, setEnabled] = useState(false),
    [confirmed, setConfirmed] = useState(false),
    [reason, setReason] = useState(''),
    [reviewed, setReviewed] = useState(false),
    [raw, setRaw] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const alive = useRef(true),
    pending = useRef<{ key: string; id: string } | null>(null);
  function fail(e: unknown) {
    if (!alive.current) return;
    if (e instanceof RequestError && e.status === 401) {
      setData(null);
      setRaw('');
      onDenied();
    }
    setError(e instanceof Error ? e.message : 'Original watch failed.');
  }
  async function load(older = false) {
    setBusy(true);
    setError('');
    try {
      const value = FilingWatchStatusSchema.parse(
        await request(
          '/ops/filing-watch' +
            (older && data?.next ? '?after=' + data.next : ''),
        ),
      );
      if (alive.current) {
        setData((v) =>
          older && v
            ? { ...value, attempts: [...v.attempts, ...value.attempts] }
            : value,
        );
        if (!older) {
          setSelected(value.gate.sourceIds);
          setRights(value.gate.rightsEvidence);
          setEnabled(value.gate.enabled);
        }
      }
    } catch (e) {
      fail(e);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
    };
  }, []);
  async function configure() {
    setBusy(true);
    setError('');
    try {
      FilingWatchGateSchema.parse(
        await request(
          '/ops/filing-watch/gate',
          { enabled, sourceIds: selected, rightsEvidence: rights },
          'POST',
        ),
      );
      if (alive.current) {
        setConfirmed(false);
        setNotice(
          'Original watch permission saved. Enable its separate research schedule when ready.',
        );
        await load();
      }
    } catch (e) {
      fail(e);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function review(editionId: string, decision: 'publish' | 'withdraw') {
    setBusy(true);
    setError('');
    const key = JSON.stringify({ editionId, decision, reason });
    if (pending.current?.key !== key)
      pending.current = { key, id: crypto.randomUUID() };
    try {
      const input = EquityReviewSchema.parse({
        requestId: pending.current.id,
        editionId,
        decision,
        reason,
      });
      const response = EquityReviewSchema.parse(
        await request('/ops/equities/review', input, 'POST'),
      );
      if (JSON.stringify(response) !== JSON.stringify(input))
        throw Error('Review receipt does not match request.');
      if (alive.current) {
        pending.current = null;
        setReviewed(false);
        setNotice(
          decision === 'publish'
            ? 'Original filing published.'
            : 'Original filing withdrawn.',
        );
        await load();
      }
    } catch (e) {
      fail(e);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return (
    <section
      className="source-workflow"
      aria-label="Original financial filing watch"
    >
      <h2>Watch known original filings</h2>
      <p>
        This checks selected historical NSE filing URLs for changed bytes. It
        does not discover new releases or guarantee the latest accounts. Gate
        and research schedule start disabled; drafts never auto-publish.
      </p>
      <button disabled={busy} onClick={() => void load()}>
        Refresh filing watch
      </button>
      {data?.next && (
        <button disabled={busy} onClick={() => void load(true)}>
          Older filing attempts
        </button>
      )}
      {busy && <p role="status">Working on original filings…</p>}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <fieldset disabled={busy}>
        <legend>Permitted originals</legend>
        {FILING_WATCH_SOURCES.map((source) => (
          <label key={source.symbol}>
            <input
              type="checkbox"
              checked={selected.includes(source.symbol)}
              onChange={(e) => {
                setSelected((v) =>
                  e.target.checked
                    ? [...v, source.symbol]
                    : v.filter((id) => id !== source.symbol),
                );
                setConfirmed(false);
              }}
            />
            {source.symbol} · {source.isin}{' '}
            <a href={source.sourceUrl} target="_blank" rel="noreferrer">
              Original filing
            </a>
          </label>
        ))}
        <label>
          Filing source permission
          <textarea
            value={rights}
            onChange={(e) => {
              setRights(e.target.value);
              setConfirmed(false);
            }}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => {
              setEnabled(e.target.checked);
              setConfirmed(false);
            }}
          />
          Enable selected original watch
        </label>
        <label>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          I verified permitted retention, display and offline use of these
          originals.
        </label>
        <button
          disabled={
            !confirmed ||
            !FilingWatchGateSchema.safeParse({
              enabled,
              sourceIds: selected,
              rightsEvidence: rights,
            }).success
          }
          onClick={() => void configure()}
        >
          Save filing watch permission
        </button>
      </fieldset>
      <p>
        Configure the Original filing watch source in Operations automatic
        research; each due run checks at most three selected originals.
      </p>
      <label>
        Filing review reason
        <textarea
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setReviewed(false);
          }}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={reviewed}
          onChange={(e) => setReviewed(e.target.checked)}
        />
        I independently inspected original cells, issuer and source permission.
      </label>
      {data?.attempts.length === 0 && <p>No filing watch attempts yet.</p>}
      {data?.attempts.map((a) => (
        <article key={a.id}>
          <h3>
            {a.sourceId} · {a.status}
          </h3>
          <p>
            {a.message} · captured {a.createdAt}
          </p>
          <a href={a.sourceUrl} target="_blank" rel="noreferrer">
            Watched original
          </a>
          {a.bodyHash && (
            <button
              disabled={busy}
              onClick={() =>
                void request('/ops/filing-watch/' + a.id + '/evidence')
                  .then((v) => {
                    if (
                      !v ||
                      typeof v !== 'object' ||
                      !('body' in v) ||
                      typeof v.body !== 'string'
                    )
                      throw Error('Retained filing response is unreadable.');
                    if (alive.current) setRaw(v.body);
                  })
                  .catch(fail)
              }
            >
              Inspect retained filing
            </button>
          )}
          {a.edition && (
            <>
              <p>Current review state: {a.editionState}</p>
              <details>
                <summary>Parsed reported facts</summary>
                <ul>
                  {a.edition.observations.map((o, i) => (
                    <li key={i}>
                      {o.kind === 'fundamental'
                        ? `${o.isin} ${o.metric}: ${o.value} (${o.currency}, scale ${o.scale}) · ${o.periodStart} to ${o.periodEnd}`
                        : o.kind}
                    </li>
                  ))}
                </ul>
              </details>
              <a
                href={
                  '?equity=' + a.edition.observations[0]?.isin + '#equities'
                }
              >
                Open company
              </a>
              {(['publish', 'withdraw'] as const).map((decision) => (
                <button
                  key={decision}
                  disabled={
                    busy ||
                    reason.trim().length < 10 ||
                    (decision === 'publish' &&
                      (!reviewed || !data.gate.enabled))
                  }
                  onClick={() => void review(a.edition!.id, decision)}
                >
                  {decision === 'publish'
                    ? 'Publish watched filing'
                    : 'Withdraw watched filing'}
                </button>
              ))}
            </>
          )}
        </article>
      ))}
      {raw && (
        <details open>
          <summary>Retained original, untrusted source</summary>
          <pre>{raw}</pre>
          <button onClick={() => setRaw('')}>Close retained filing</button>
        </details>
      )}
    </section>
  );
}
