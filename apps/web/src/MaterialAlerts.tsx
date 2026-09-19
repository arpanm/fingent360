import { useEffect, useRef, useState } from 'react';
import {
  MaterialViewSchema,
  MaterialWriteSchema,
  MaterialReceiptSchema,
  MaterialExportSchema,
  freshMaterial,
  type MaterialReceipt,
  type MaterialWrite,
  type MacroIndicator,
} from '@fingent360/contracts';
import {
  AccountRequestError,
  StaleAccountRead,
  type AccountRequest,
} from './account-request';
import './material-alerts.css';
type View = ReturnType<typeof MaterialViewSchema.parse>;
type Page = ReturnType<typeof MaterialExportSchema.parse>;
type Draft = {
  indicator: MacroIndicator;
  enabled: boolean;
  thresholdPoints: string;
}[];
const name = (indicator: MacroIndicator) =>
  indicator === 'NY.GDP.MKTP.KD.ZG' ? 'GDP growth' : 'Consumer inflation';
const date = (at: string) => new Date(at).toLocaleString();
const percent = (value: string | null) =>
  value === null ? 'Unavailable' : `${value}%`;
const outcomeLabels = {
  baseline: 'Baseline saved; no backlog',
  material: 'Threshold reached',
  'below-threshold': 'Below your threshold',
  unchanged: 'Unchanged value; no new notice',
  revision: 'Same-year correction; no material notice',
  missing: 'Value unavailable; baseline preserved',
  stale: 'Source check overdue; baseline preserved',
  muted: 'Muted; baseline paused',
  'older-period': 'Older annual period; baseline preserved',
  'future-data':
    'Future-dated evidence unavailable for comparison; baseline preserved',
};
function Receipt({ value }: { value: MaterialReceipt }) {
  return (
    <div className="material-receipt">
      <p>
        Recorded {date(value.at)} · {value.action} · saved state version{' '}
        {value.state.version}. This is a historical receipt.
      </p>
      {value.sources
        .filter((source) =>
          value.state.policies.some(
            (policy) => policy.indicator === source.indicator,
          ),
        )
        .map((source) => (
          <p key={source.indicator}>
            {name(source.indicator)} successful source check at this request:{' '}
            {source.lastSuccessAt ? date(source.lastSuccessAt) : 'Unavailable'}.
          </p>
        ))}
      {value.outcomes.map((result) => (
        <article key={result.indicator}>
          <h5>
            {name(result.indicator)}: {outcomeLabels[result.outcome]}
          </h5>
          <p>
            Before:{' '}
            {result.before
              ? `${result.before.year}: ${percent(result.before.value)} (revision ${result.before.revision})`
              : 'No baseline'}
            . After:{' '}
            {result.after
              ? `${result.after.year}: ${percent(result.after.value)} (revision ${result.after.revision})`
              : 'No observation'}
            .
            {result.differencePoints !== null &&
              ` Difference: ${result.differencePoints} percentage points.`}
          </p>
          {result.after && (
            <p>
              Provider updated {result.after.providerUpdatedAt}; retrieved{' '}
              {date(result.after.retrievedAt)}.{' '}
              <a href={result.after.sourceUrl} target="_blank" rel="noreferrer">
                Recorded source
              </a>
            </p>
          )}
          <details>
            <summary>Exact comparison provenance</summary>
            {[result.before, result.after].map(
              (observation, index) =>
                observation && (
                  <p key={index}>
                    {index === 0 ? 'Before' : 'After'}: observation{' '}
                    {observation.id}, revision {observation.revision}, annual
                    period {observation.year}; provider updated{' '}
                    {observation.providerUpdatedAt}, retrieved{' '}
                    {date(observation.retrievedAt)}; retained source hash{' '}
                    {observation.sourceHash}.{' '}
                    <a
                      href={observation.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {index === 0 ? 'Before' : 'After'} source
                    </a>
                  </p>
                ),
            )}
          </details>
        </article>
      ))}
    </div>
  );
}
export function MaterialAlerts({
  request,
  refreshKey,
}: {
  request: AccountRequest;
  refreshKey: number;
}) {
  const [view, setView] = useState<View | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<MaterialReceipt | null>(null);
  const [pending, setPending] = useState<MaterialWrite | null>(null);
  const [editing, setEditing] = useState(false);
  const [review, setReview] = useState(false);
  const [consent, setConsent] = useState(false);
  const [automaticReview, setAutomaticReview] = useState(false);
  const [backgroundConsent, setBackgroundConsent] = useState(false);
  const [draft, setDraft] = useState<Draft>([]);
  const [history, setHistory] = useState<Page | null>(null);
  const [historyError, setHistoryError] = useState('');
  const [historyBusy, setHistoryBusy] = useState(false);
  const mounted = useRef(false),
    reads = useRef(0),
    historyReads = useRef(0),
    writing = useRef(false);
  const historyRetry = useRef('');
  function failure(error: unknown) {
    if (!mounted.current || error instanceof StaleAccountRead) return;
    if (error instanceof AccountRequestError && error.status === 401) {
      setView(null);
      setReceipt(null);
      setHistory(null);
      setDraft([]);
      setPending(null);
      setEditing(false);
      setReview(false);
      setAutomaticReview(false);
      setBackgroundConsent(false);
      return;
    }
    setError(
      error instanceof Error
        ? error.message
        : 'Material changes are unavailable. Retry shortly.',
    );
  }
  async function load() {
    const ticket = ++reads.current;
    setLoading(true);
    setError('');
    setView(null);
    try {
      const result = MaterialViewSchema.parse(await request('/inbox/material'));
      if (mounted.current && ticket === reads.current) setView(result);
    } catch (error) {
      if (ticket === reads.current) failure(error);
    } finally {
      if (mounted.current && ticket === reads.current) setLoading(false);
    }
  }
  useEffect(() => {
    mounted.current = true;
    setHistoryBusy(false);
    void load();
    return () => {
      mounted.current = false;
      reads.current++;
      historyReads.current++;
    };
  }, [request, refreshKey]);
  async function save(input: MaterialWrite) {
    if (writing.current) return;
    writing.current = true;
    setBusy(true);
    setError('');
    setPending(input);
    reads.current++;
    setLoading(false);
    setView(null);
    try {
      const saved = MaterialReceiptSchema.parse(
        await request('/inbox/material', input),
      );
      if (!mounted.current) return;
      if (saved.requestId !== input.requestId || saved.action !== input.action)
        throw Error(
          'The returned material receipt does not match this request. Retry the same request.',
        );
      setReceipt(saved);
      setPending(null);
      if (input.action === 'automatic-settings') {
        setAutomaticReview(false);
        setBackgroundConsent(false);
      }
      if (input.action === 'configure') {
        setEditing(false);
        setReview(false);
        setConsent(false);
      }
      // A replay can return an older immutable receipt. Only GET establishes current context.
      await load();
    } catch (error) {
      if (
        mounted.current &&
        error instanceof AccountRequestError &&
        (error.status === 400 || error.status === 409)
      )
        setPending(null);
      failure(error);
    } finally {
      writing.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function loadHistory(path = '') {
    const ticket = ++historyReads.current;
    historyRetry.current = path;
    setHistoryBusy(true);
    setHistoryError('');
    try {
      const result = MaterialExportSchema.parse(
        await request(`/inbox/material/history${path}`),
      );
      if (!mounted.current || ticket !== historyReads.current) return;
      if (
        path &&
        history &&
        (result.ownerId !== history.ownerId ||
          result.upper !== history.upper ||
          result.events.some(
            (e) =>
              BigInt(e.sequence) <=
              BigInt(history.events.at(-1)?.sequence ?? '0'),
          ))
      )
        throw Error('History changed. Start again from the first page.');
      setHistory(
        path && history
          ? { ...result, events: [...history.events, ...result.events] }
          : result,
      );
    } catch (error) {
      if (
        !mounted.current ||
        ticket !== historyReads.current ||
        error instanceof StaleAccountRead
      )
        return;
      if (error instanceof AccountRequestError && error.status === 401)
        failure(error);
      else
        setHistoryError(
          error instanceof Error ? error.message : 'History is unavailable.',
        );
    } finally {
      if (mounted.current && ticket === historyReads.current)
        setHistoryBusy(false);
    }
  }
  function edit() {
    if (!view) return;
    setDraft(
      view.state.followed.map((indicator) => ({
        indicator,
        enabled: view.state.policies.some((p) => p.indicator === indicator),
        thresholdPoints:
          view.state.policies.find((p) => p.indicator === indicator)
            ?.thresholdPoints ?? '',
      })),
    );
    setEditing(true);
    setReview(false);
    setConsent(false);
    setError('');
  }
  function configured() {
    return MaterialWriteSchema.parse({
      action: 'configure',
      requestId: crypto.randomUUID(),
      expectedVersion: view?.state.version,
      policies: draft
        .filter((p) => p.enabled)
        .map(({ indicator, thresholdPoints }) => ({
          indicator,
          thresholdPoints,
        })),
      storageConsent: consent,
    });
  }
  return (
    <section className="material-alerts" aria-labelledby="material-title">
      <h4 id="material-title">Material changes</h4>
      <p>
        Choose an absolute change in percentage points for stored annual India
        observations. Each check compares one observation transition. This is
        historical source monitoring, with no expected value, release-time
        surprise or investment action.
      </p>
      <p>
        Checks use only your two followed indicators. Automatic checks are
        optional; they never refresh providers or send email or push
        notifications.
      </p>
      <div className="material-actions">
        <button disabled={busy || loading} onClick={() => void load()}>
          Refresh material changes
        </button>
        <button
          disabled={busy || !view || !view.state.followed.length || !!pending}
          onClick={edit}
        >
          Edit material thresholds
        </button>
        <button
          disabled={busy || !view || !view.state.policies.length || !!pending}
          onClick={() =>
            view &&
            void save(
              MaterialWriteSchema.parse({
                action: 'check',
                requestId: crypto.randomUUID(),
                expectedVersion: view.state.version,
              }),
            )
          }
        >
          Check stored observations
        </button>
      </div>
      {(loading || busy) && (
        <p role="status" aria-label="Material progress">
          {busy
            ? 'Saving material-change request…'
            : 'Loading material changes…'}
        </p>
      )}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <p>
            Your draft and any saved receipt remain available. Refresh current
            context before starting a new request.
          </p>
        </div>
      )}
      {pending && (
        <div className="material-recovery">
          <p>
            The outcome of this request is unconfirmed. Retry sends the same
            request ID and input.
          </p>
          <button disabled={busy} onClick={() => void save(pending)}>
            Retry same material request
          </button>
        </div>
      )}
      {!view && !loading && (
        <p>
          Current material context is unavailable. A saved receipt does not
          establish current settings or observations.
        </p>
      )}
      {view && (
        <>
          {view.bundleGeneratedAt && (
            <p>
              On-device evidence bundle: {date(view.bundleGeneratedAt)}. Later
              provider changes are unavailable here.
            </p>
          )}
          <p>
            Current context loaded {date(view.evaluatedAt)} · settings version{' '}
            {view.state.version}.
          </p>
          <section aria-label="Automatic material checks">
            <h5>Automatic stored-observation checks</h5>
            <p>
              {view.state.automatic.enabled
                ? view.automaticPermissionCurrent
                  ? 'Enabled: once every 24 hours.'
                  : 'Automatic checks blocked: purpose permission changed or expired. Review consent, then explicitly resume with a fresh baseline.'
                : 'Manual mode: automatic checks are off.'}
            </p>
            {view.state.automatic.nextCheckAt && (
              <p>
                Next eligible check: {date(view.state.automatic.nextCheckAt)}.
                Actual completion depends on the worker being available.
              </p>
            )}
            {view.state.automatic.lastCheckAt && (
              <p>
                Last completed automatic check:{' '}
                {date(view.state.automatic.lastCheckAt)}. Read its dated receipt
                in material history.
              </p>
            )}
            {!view.state.automatic.enabled &&
              view.state.automatic.lastResult === 'consent-unavailable' && (
                <p>
                  Automatic checks stopped because background permission expired
                  or was revoked. Review Purpose consent in Privacy, then
                  explicitly enable again.
                </p>
              )}
            {view.bundleGeneratedAt && (
              <p>
                On this device, due checks run only while the app is open and
                signed in. They use this installed bundle, not live provider
                data.
              </p>
            )}
            {view.state.automatic.enabled ? (
              <button
                disabled={busy || !!pending || editing}
                onClick={() =>
                  void save(
                    MaterialWriteSchema.parse({
                      action: 'automatic-settings',
                      requestId: crypto.randomUUID(),
                      expectedVersion: view.state.version,
                      enabled: false,
                      backgroundConsent: false,
                    }),
                  )
                }
              >
                Disable automatic checks
              </button>
            ) : (
              <button
                disabled={
                  busy || !!pending || editing || !view.state.policies.length
                }
                onClick={() => {
                  setAutomaticReview(true);
                  setBackgroundConsent(false);
                }}
              >
                Set up automatic checks
              </button>
            )}
            {view.state.automatic.enabled &&
              !view.automaticPermissionCurrent && (
                <button
                  disabled={busy || !!pending || editing}
                  onClick={() => {
                    setAutomaticReview(true);
                    setBackgroundConsent(false);
                  }}
                >
                  Review resuming automatic checks
                </button>
              )}
            {automaticReview && (
              <fieldset disabled={busy || !!pending}>
                <legend>Review automatic checks</legend>
                <p>
                  Start a fresh baseline now, with the first stored-data check
                  eligible in 24 hours. Missed days are not replayed. Existing
                  notices are cleared from the current view but their immutable
                  history remains. Thresholds, values and financial records are
                  not changed.
                </p>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={backgroundConsent}
                    onChange={(event) =>
                      setBackgroundConsent(event.target.checked)
                    }
                  />
                  I permit automatic use of my followed indicators and saved
                  material thresholds for these stored-data checks.
                </label>
                <div className="page-actions unobscured-actions">
                  <button
                    disabled={!backgroundConsent}
                    onClick={() =>
                      void save(
                        MaterialWriteSchema.parse({
                          action: 'automatic-settings',
                          requestId: crypto.randomUUID(),
                          expectedVersion: view.state.version,
                          enabled: true,
                          backgroundConsent,
                        }),
                      )
                    }
                  >
                    Enable automatic checks
                  </button>
                  <button
                    onClick={() => {
                      setAutomaticReview(false);
                      setBackgroundConsent(false);
                    }}
                  >
                    Back without enabling
                  </button>
                  <a href="#privacy">Review or revoke purpose consent</a>
                </div>
              </fieldset>
            )}
          </section>
          {!view.state.followed.length && (
            <p>
              Save a followed indicator in your watchlist to enable a threshold.
            </p>
          )}
          {!view.state.policies.length && (
            <p>
              No material-change rules enabled. Existing observation cards
              remain available below.
            </p>
          )}
          {view.state.policies.map((policy) => {
            const source = view.sources.find(
                (s) => s.indicator === policy.indicator,
              ),
              baseline = view.state.baselines.find(
                (b) => b.indicator === policy.indicator,
              );
            const notice = view.state.notices.find(
                (n) => n.indicator === policy.indicator,
              ),
              muted = view.state.muted.includes(policy.indicator);
            return (
              <article className="card" key={policy.indicator}>
                <h5>{name(policy.indicator)}</h5>
                <p>
                  Threshold: {policy.thresholdPoints} percentage points ·{' '}
                  {muted ? 'Muted; evaluation paused' : 'Enabled'}.
                </p>
                <p>
                  Baseline:{' '}
                  {baseline?.observation
                    ? `${baseline.observation.year}: ${percent(baseline.observation.value)} · revision ${baseline.observation.revision}`
                    : 'Unavailable'}
                  {baseline?.pendingReset
                    ? ' · waiting for a fresh baseline; no backlog'
                    : ''}
                  .
                </p>
                <p>
                  Latest stored:{' '}
                  {source?.latest
                    ? `${source.latest.year}: ${percent(source.latest.value)} · revision ${source.latest.revision}`
                    : 'Unavailable'}
                  . Last successful source check:{' '}
                  {source?.lastSuccessAt
                    ? date(source.lastSuccessAt)
                    : 'Unavailable'}
                  .
                </p>
                {!freshMaterial(source, view.evaluatedAt) && (
                  <p>
                    Fresh comparison unavailable: the stored source check is
                    overdue or its dates are ahead of this check.
                  </p>
                )}
                {notice && !muted && (
                  <div aria-label={`${name(policy.indicator)} material notice`}>
                    <p>
                      Recorded change: {notice.before.year} (
                      {notice.before.value}%) → {notice.after.year} (
                      {notice.after.value}%), {notice.differencePoints}{' '}
                      percentage points. Checked {date(notice.checkedAt)} ·
                      notice version {notice.version} ·{' '}
                      {notice.read ? 'Acknowledged' : 'Unread'}.
                    </p>
                    {source?.latest?.id !== notice.after.id && (
                      <p>
                        Newer or revised source context is available. This
                        notice retains its original dated comparison.
                      </p>
                    )}
                    <button
                      disabled={busy || !!pending}
                      onClick={() =>
                        void save(
                          MaterialWriteSchema.parse({
                            action: 'acknowledge',
                            requestId: crypto.randomUUID(),
                            expectedVersion: view.state.version,
                            indicator: policy.indicator,
                            noticeVersion: notice.version,
                            read: !notice.read,
                          }),
                        )
                      }
                    >
                      {notice.read ? 'Reopen' : 'Acknowledge'}{' '}
                      {name(policy.indicator)} material notice
                    </button>
                  </div>
                )}
                <a href="#macro">Read source evidence and revision history</a>
              </article>
            );
          })}
        </>
      )}
      {editing && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            try {
              configured();
              setReview(true);
              setError('');
            } catch {
              setError(
                'Choose a positive threshold up to 100 percentage points, with at most six decimal places, and consent to storage.',
              );
            }
          }}
        >
          <fieldset disabled={busy || !!pending}>
            <legend>Material-change settings</legend>
            {draft.map((item, index) => (
              <div className="material-setting" key={item.indicator}>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    onChange={(e) => {
                      setReview(false);
                      setDraft(
                        draft.map((p, i) =>
                          i === index ? { ...p, enabled: e.target.checked } : p,
                        ),
                      );
                    }}
                  />
                  Enable {name(item.indicator)} threshold
                </label>
                <label htmlFor={`material-threshold-${index}`}>
                  {name(item.indicator)} threshold (percentage points)
                </label>
                <input
                  id={`material-threshold-${index}`}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={item.thresholdPoints}
                  disabled={!item.enabled}
                  required={item.enabled}
                  maxLength={10}
                  onChange={(e) => {
                    setReview(false);
                    setDraft(
                      draft.map((p, i) =>
                        i === index
                          ? { ...p, thresholdPoints: e.target.value }
                          : p,
                      ),
                    );
                  }}
                />
              </div>
            ))}
            <p>
              Enabling or changing a threshold starts a fresh baseline. Muting
              pauses checks; unmuting starts fresh without backlog. Unfollowing
              removes the rule. Dated receipts remain until account deletion.
            </p>
            <label className="check-label">
              <input
                type="checkbox"
                checked={consent}
                required
                onChange={(e) => {
                  setConsent(e.target.checked);
                  setReview(false);
                }}
              />
              I agree to store material thresholds, observation snapshots and
              check history in my account.
            </label>
            {!review && (
              <button type="submit" disabled={!view}>
                Review material settings
              </button>
            )}
            {review && (
              <section aria-label="Review material settings">
                <h5>Review material settings</h5>
                {draft
                  .filter((p) => p.enabled)
                  .map((p) => (
                    <p key={p.indicator}>
                      {name(p.indicator)}: {p.thresholdPoints} percentage
                      points.
                    </p>
                  ))}
                {!draft.some((p) => p.enabled) && (
                  <p>
                    Disable all material-change rules. Retained history remains
                    available.
                  </p>
                )}
                <p>
                  Both annual values must exist and the source check must be
                  within seven days. Same-year corrections do not create
                  material notices.
                </p>
                <button
                  type="button"
                  disabled={!view}
                  onClick={() => {
                    try {
                      void save(configured());
                    } catch {
                      setError(
                        'Refresh current context and review valid settings before saving.',
                      );
                    }
                  }}
                >
                  Save material settings
                </button>
                <button type="button" onClick={() => setReview(false)}>
                  Back to material settings
                </button>
              </section>
            )}
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setReview(false);
                setConsent(false);
              }}
            >
              Cancel material settings
            </button>
          </fieldset>
        </form>
      )}
      {receipt && (
        <section role="status" aria-label="Saved material receipt">
          <h5>Saved material receipt</h5>
          <Receipt value={receipt} />
        </section>
      )}
      <div className="material-actions">
        <button disabled={historyBusy} onClick={() => void loadHistory()}>
          Read material history
        </button>
        {history && (
          <button
            onClick={() => {
              historyReads.current++;
              setHistoryBusy(false);
              setHistory(null);
              setHistoryError('');
            }}
          >
            Close material history
          </button>
        )}
      </div>
      {historyBusy && (
        <p role="status" aria-label="Material history progress">
          Loading material history…
        </p>
      )}
      {historyError && (
        <div role="alert">
          <p>{historyError}</p>
          <button
            disabled={historyBusy}
            onClick={() => void loadHistory(historyRetry.current)}
          >
            Retry material history page
          </button>
        </div>
      )}
      {history && (
        <section aria-label="Material-change history">
          <p>
            Retained receipts through sequence {history.upper}. These records do
            not claim current source context.
          </p>
          {!history.events.length && <p>No material-change history yet.</p>}
          {history.events.map((event) => (
            <details key={event.sequence}>
              <summary>
                Receipt {event.sequence} · {event.receipt.action} ·{' '}
                {date(event.receipt.at)}
              </summary>
              <Receipt value={event.receipt} />
            </details>
          ))}
          {history.next && (
            <button
              disabled={historyBusy}
              onClick={() =>
                void loadHistory(
                  '?' +
                    new URLSearchParams({
                      after: history.next!,
                      upper: history.upper,
                    }),
                )
              }
            >
              Load more material receipts
            </button>
          )}
          <a href="#privacy">Download complete history in Privacy</a>
        </section>
      )}
    </section>
  );
}
