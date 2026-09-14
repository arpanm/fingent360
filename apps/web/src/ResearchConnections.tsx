import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ResearchConnectionsSchema,
  ResearchConnectionHistorySchema,
  ResearchConnectionRevisionSchema,
  ResearchConnectionWriteSchema,
  type ResearchConnections as ConnectionState,
  type ResearchConnectionRevision,
  type ResearchConnectionView,
  type ResearchConnectionWrite,
  type ConnectionSourceReceipt,
  type ConnectionTarget,
} from '@fingent360/contracts';
import { AccountGate, type AccountDestination } from './AccountGate';
import { useDraftGuard } from './useDraftGuard';
import { returnTo } from './navigation';
import './research-connections.css';

class SignedOut extends Error {}
async function request(path = '', body?: ResearchConnectionWrite) {
  const response = await fetch(`/api/v1/account/research-connections${path}`, {
    credentials: 'same-origin',
    signal: AbortSignal.timeout(15000),
    method: body ? 'PUT' : 'GET',
    ...(body
      ? {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : {}),
  });
  if (response.status === 401) throw new SignedOut();
  const value: unknown = await response.json().catch(() => {
    throw Error(
      'The connection service returned an unreadable response. Retry your request.',
    );
  });
  if (!response.ok)
    throw Error(
      value && typeof value === 'object' && 'message' in value
        ? String(value.message)
        : 'Could not load or save your connections.',
    );
  return value;
}
function SourceReceipt({ source }: { source: ConnectionSourceReceipt }) {
  return (
    <div>
      <dl className="connection-receipt">
        <dt>Source</dt>
        <dd>
          {source.name} · edition {source.version}
        </dd>
        <dt>Effective period</dt>
        <dd>{source.effectiveLabel}</dd>
        <dt>Published</dt>
        <dd>{new Date(source.publishedAt).toLocaleString()}</dd>
        <dt>Retrieved</dt>
        <dd>{new Date(source.retrievedAt).toLocaleString()}</dd>
      </dl>
      <details className="connection-verification">
        <summary>Verify source receipt</summary>
        <dl className="connection-receipt">
          <dt>Item</dt>
          <dd>{source.itemId}</dd>
          <dt>Evidence hash</dt>
          <dd className="connection-hash">{source.sourceHash}</dd>
        </dl>
      </details>
    </div>
  );
}

type Editor = {
  id: string;
  action: ResearchConnectionWrite['action'];
  previous: ResearchConnectionRevision | null;
  source: ConnectionSourceReceipt;
  target: ConnectionTarget | null;
};
export function ResearchConnections() {
  const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
  const itemId = params.get('itemId');
  const initialVersion = params.get('sourceVersion');
  const initialHash = params.get('sourceHash');
  const [data, setData] = useState<ConnectionState | null>(null),
    [guest, setGuest] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(''),
    [editor, setEditor] = useState<Editor | null>(null),
    [targetKey, setTargetKey] = useState(''),
    [note, setNote] = useState(''),
    [consent, setConsent] = useState(false),
    [review, setReview] = useState<ResearchConnectionWrite | null>(null),
    [history, setHistory] = useState<ResearchConnectionRevision[] | null>(null);
  const [contextReady, setContextReady] = useState(true);
  const editorRef = useRef<HTMLElement>(null);
  const dirty =
    !!editor &&
    (note !== (editor.previous?.note ?? '') || !!targetKey || consent);
  useDraftGuard(
    dirty,
    'Leave and discard unsaved research connection changes?',
  );
  useLayoutEffect(() => {
    if (editor) editorRef.current?.querySelector<HTMLElement>('h2')?.focus();
  }, [editor, review]);
  function failure(e: unknown) {
    if (e instanceof SignedOut) {
      setGuest(true);
      setData(null);
      setEditor(null);
      setReview(null);
      setHistory(null);
    } else
      setError(e instanceof Error ? e.message : 'Connection request failed.');
  }
  async function load(afterSave = false) {
    setBusy(true);
    setContextReady(false);
    setError('');
    try {
      const value = ResearchConnectionsSchema.parse(
        await request(itemId ? `?itemId=${encodeURIComponent(itemId)}` : ''),
      );
      setData(value);
      setContextReady(true);
      setGuest(false);
    } catch (e) {
      if (afterSave && !(e instanceof SignedOut))
        setError(
          `Your saved change is shown below, but current connections could not refresh. ${e instanceof Error ? e.message : 'Retry loading connections.'}`,
        );
      else failure(e);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let active = true;
    void request(itemId ? `?itemId=${encodeURIComponent(itemId)}` : '')
      .then((v) => {
        if (active) {
          setData(ResearchConnectionsSchema.parse(v));
          setContextReady(true);
        }
      })
      .catch((e) => {
        if (active) failure(e);
      });
    return () => {
      active = false;
    };
  }, [itemId]);
  function open(action: Editor['action'], connection?: ResearchConnectionView) {
    if (!data) return;
    if (!contextReady && (action === 'create' || action === 'reaffirm')) {
      setError(
        'Reload connections before choosing current source and record editions.',
      );
      return;
    }
    const previous = connection?.revision ?? null;
    const source =
      action === 'reaffirm'
        ? connection?.currentSource
        : (previous?.source ?? data.selectedSource);
    if (!source) return;
    setEditor({
      id: previous?.id ?? crypto.randomUUID(),
      action,
      previous,
      source,
      target:
        action === 'reaffirm'
          ? (connection?.currentTarget ?? null)
          : (previous?.target ?? null),
    });
    setNote(previous?.note ?? '');
    setTargetKey('');
    setConsent(false);
    setReview(null);
    setError('');
    setNotice('');
  }
  function cancel() {
    if (dirty && !confirm('Discard unsaved research connection changes?'))
      return;
    setEditor(null);
    setReview(null);
    setError('');
  }
  function prepare() {
    if (!editor || !data) return;
    setError('');
    try {
      const common = {
        requestId: crypto.randomUUID(),
        expectedVersion: editor.previous?.version ?? 0,
      };
      const target =
        editor.target ??
        data.targets.find(
          (t) => `${t.binding.kind}:${t.binding.id}` === targetKey,
        );
      let input: unknown;
      if (editor.action === 'remove') input = { ...common, action: 'remove' };
      else if (editor.action === 'edit')
        input = { ...common, action: 'edit', note, storageConsent: consent };
      else {
        if (!target) throw Error('Choose one of your saved holdings or goals.');
        input = {
          ...common,
          action: editor.action,
          source: {
            itemId: editor.source.itemId,
            version: editor.source.version,
            sourceHash: editor.source.sourceHash,
          },
          target: target.binding,
          note,
          storageConsent: consent,
        };
      }
      setReview(ResearchConnectionWriteSchema.parse(input));
    } catch (e) {
      setError(
        e instanceof Error && e.name === 'ZodError'
          ? 'Add a personal reason of 1–1000 characters and agree to store it before reviewing.'
          : e instanceof Error
            ? e.message
            : 'Review your choices.',
      );
    }
  }
  async function save() {
    if (!editor || !review) return;
    setBusy(true);
    setError('');
    try {
      const saved = ResearchConnectionRevisionSchema.parse(
        await request(`/${editor.id}`, review),
      );
      // A PUT may replay an older immutable receipt. It proves that revision
      // was saved, not that its source/target editions are current now.
      setContextReady(false);
      setData((current) => {
        if (!current) return current;
        const existing = current.connections.find(
          (value) => value.revision.id === saved.id,
        );
        if (existing && existing.revision.version > saved.version)
          return current;
        const others = current.connections.filter(
          (value) => value.revision.id !== saved.id,
        );
        const updated: ResearchConnectionView | null = saved.removed
          ? null
          : {
              revision: saved,
              reviewReasons: existing?.reviewReasons ?? [],
              currentSource: null,
              currentTarget: null,
            };
        return {
          ...current,
          connections: updated ? [updated, ...others] : others,
        };
      });
      setEditor(null);
      setReview(null);
      setHistory(null);
      setNotice(
        saved.removed
          ? 'Research connection removed. Its private history is retained until account deletion.'
          : saved.action === 'reaffirm'
            ? 'Research connection reaffirmed with the reviewed editions.'
            : 'Research connection saved.',
      );
      await load(true);
    } catch (e) {
      failure(e);
    } finally {
      setBusy(false);
    }
  }
  async function showHistory(id?: string) {
    setBusy(true);
    setError('');
    try {
      setHistory(
        ResearchConnectionHistorySchema.parse(
          await request(id ? `/${id}/history` : '/history'),
        ).revisions,
      );
    } catch (e) {
      failure(e);
    } finally {
      setBusy(false);
    }
  }
  const signInDestination: AccountDestination =
    itemId && initialVersion && initialHash
      ? `connections?itemId=${itemId}&sourceVersion=${initialVersion}&sourceHash=${initialHash}`
      : 'connections';
  if (guest)
    return (
      <AccountGate
        next={signInDestination}
        title="Keep your own research connections"
        description="Sign in to connect published reading to a holding or goal that you have saved."
      />
    );
  const sourceChanged =
    !!itemId &&
    !!data?.selectedSource &&
    ((!!initialVersion &&
      Number(initialVersion) !== data.selectedSource.version) ||
      (!!initialHash && initialHash !== data.selectedSource.sourceHash));
  const selectedTarget =
    editor?.target ??
    data?.targets.find(
      (t) => `${t.binding.kind}:${t.binding.id}` === targetKey,
    );
  return (
    <section className="research-connections" aria-label="Research connections">
      <header className="page-header">
        <button className="text-link" onClick={() => returnTo('holdings')}>
          Back
        </button>
        <p className="page-kicker">MY MONEY · MY RESEARCH</p>
        <h1>Your research connections</h1>
        <p className="page-description">
          Record why a piece of reading matters to your own thinking about a
          holding or goal. Your note records your interpretation. It does not
          establish a financial impact or an investment recommendation.
        </p>
        <p>
          <a href="#holdings">My holdings</a> · <a href="#my-goals">My goals</a>{' '}
          · <a href="#explore">Explore published reading</a> ·{' '}
          <a href="#connection-reviews">Review inbox</a>
        </p>
      </header>
      {error && (
        <p role="alert">
          {error}{' '}
          {!editor && (
            <button disabled={busy} onClick={() => void load()}>
              Retry connections
            </button>
          )}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {data && !contextReady && (
        <p className="data-note" aria-label="Current connection context">
          Saved receipts are shown below. Current source and record status are
          unavailable until connections refresh. Reload connections before
          treating a saved edition as current.
        </p>
      )}
      {!data && !error && (
        <p role="status">Loading your connections and owned records…</p>
      )}
      {data?.bundleGeneratedAt && (
        <p className="connection-dated">
          On this device · public reading snapshot saved{' '}
          {new Date(data.bundleGeneratedAt).toLocaleString()}. This dated bundle
          does not refresh automatically. Your private connections stay on this
          device.
        </p>
      )}
      {data && (
        <>
          {itemId && !editor && (
            <section className="panel" aria-label="Selected research edition">
              <h2>Connect this reading to your records</h2>
              {!contextReady ? (
                <p>
                  Reload connections to check the current published source and
                  your saved records.
                </p>
              ) : data.selectedSource ? (
                <>
                  <SourceReceipt source={data.selectedSource} />
                  {sourceChanged ? (
                    <p role="alert">
                      This source edition changed after you opened the reader.{' '}
                      <a href={`#read/${itemId}`}>
                        Read the current published edition
                      </a>
                      , then choose Connect to my records again.
                    </p>
                  ) : (
                    <button
                      disabled={busy || !data.targets.length}
                      onClick={() => open('create')}
                    >
                      Choose a holding or goal
                    </button>
                  )}
                </>
              ) : (
                <p>
                  This source is unavailable for a new connection. It may have
                  been withdrawn, or it is outside the permitted source
                  collection. <a href="#explore">Choose published reading</a>.
                </p>
              )}
              {!data.targets.length && (
                <p>
                  Save a holding or goal first, then return to this reading.{' '}
                  <a href="#holdings">Add holdings</a> ·{' '}
                  <a href="#my-goals">Add a goal</a>.
                </p>
              )}
            </section>
          )}
          {editor && (
            <section
              ref={editorRef}
              className="panel connection-editor"
              aria-label="Connection editor"
            >
              <h2 tabIndex={-1}>
                {review
                  ? 'Review your research connection'
                  : editor.action === 'remove'
                    ? 'Remove this research connection'
                    : editor.action === 'reaffirm'
                      ? 'Reaffirm with current editions'
                      : editor.action === 'edit'
                        ? 'Edit your personal reason'
                        : 'Your research connection'}
              </h2>
              <SourceReceipt source={editor.source} />
              {review ? (
                <section aria-label="Connection review">
                  <p>
                    {selectedTarget?.binding.kind === 'holding'
                      ? 'Holding'
                      : 'Goal'}
                    : {selectedTarget?.label} · record version{' '}
                    {selectedTarget?.binding.version}
                  </p>
                  <p className="connection-note">{note.trim()}</p>
                  <p>
                    {editor.action === 'remove'
                      ? 'Remove this connection from your active list. Earlier revisions and this removal receipt remain in your private history until account deletion.'
                      : editor.action === 'edit'
                        ? 'This changes your personal reason. The original source and record editions remain bound, including any review warning.'
                        : 'These exact source and record editions will be saved with your personal reason. Your financial records remain unchanged.'}
                  </p>
                  <div className="page-actions">
                    <button disabled={busy} onClick={() => void save()}>
                      {busy
                        ? 'Saving connection…'
                        : editor.action === 'remove'
                          ? 'Confirm removal'
                          : editor.action === 'reaffirm'
                            ? 'Save reaffirmed connection'
                            : 'Save research connection'}
                    </button>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => {
                        setReview(null);
                        setConsent(false);
                      }}
                    >
                      Back to connection
                    </button>
                  </div>
                </section>
              ) : (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    prepare();
                  }}
                >
                  {editor.action === 'create' ? (
                    <div className="field">
                      <label htmlFor="research-connection-target">
                        Connect to
                      </label>
                      <select
                        id="research-connection-target"
                        required
                        value={targetKey}
                        onChange={(event) => setTargetKey(event.target.value)}
                      >
                        <option value="">
                          Choose your saved holding or goal
                        </option>
                        {data.targets.map((target) => (
                          <option
                            key={`${target.binding.kind}:${target.binding.id}`}
                            value={`${target.binding.kind}:${target.binding.id}`}
                          >
                            {target.binding.kind === 'holding'
                              ? 'Holding'
                              : 'Goal'}
                            : {target.label} · version {target.binding.version}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <p>
                      {selectedTarget?.binding.kind === 'holding'
                        ? 'Holding'
                        : 'Goal'}
                      : {selectedTarget?.label} · record version{' '}
                      {selectedTarget?.binding.version}
                    </p>
                  )}
                  {editor.action === 'remove' ? (
                    <p>
                      Your private connection history remains until you delete
                      this account.
                    </p>
                  ) : (
                    <>
                      <div className="field">
                        <label htmlFor="research-connection-note">
                          My personal reason
                        </label>
                        <textarea
                          id="research-connection-note"
                          required
                          maxLength={1000}
                          rows={5}
                          value={note}
                          onChange={(event) => setNote(event.target.value)}
                          aria-describedby="connection-note-help"
                        />
                      </div>
                      <p id="connection-note-help">
                        {note.length}/1000 characters. Write your own reason for
                        keeping this connection; the app makes no price, sector
                        or causal claim.
                      </p>
                      <label className="check-label">
                        <input
                          type="checkbox"
                          checked={consent}
                          required
                          onChange={(event) => setConsent(event.target.checked)}
                        />
                        I agree to store this personal connection and its
                        revision history.
                      </label>
                    </>
                  )}
                  <button type="submit" disabled={busy}>
                    {editor.action === 'remove'
                      ? 'Review removal'
                      : 'Review connection'}
                  </button>
                </form>
              )}
              <button className="secondary" disabled={busy} onClick={cancel}>
                Cancel connection
              </button>
              <p className="muted">
                A failed save keeps this review and its request receipt ready to
                retry. For changed records, cancel, reload connections, and
                review the current editions.
              </p>
            </section>
          )}
          <section aria-label="Saved research connections">
            <h2>Saved connections</h2>
            {!data.connections.length ? (
              <p>
                No research connections saved yet. Open a published source in{' '}
                <a href="#explore">Explore</a>, then choose Connect to my
                records.
              </p>
            ) : (
              <div className="connection-list">
                {data.connections.map((connection) => (
                  <article
                    className="panel"
                    key={connection.revision.id}
                    aria-label={`Connection to ${connection.revision.target.label}`}
                  >
                    <p className="eyebrow">Your research connection</p>
                    <h3>{connection.revision.target.label}</h3>
                    <p>
                      {connection.revision.target.binding.kind === 'holding'
                        ? 'Holding'
                        : 'Goal'}{' '}
                      · record version{' '}
                      {connection.revision.target.binding.version}
                    </p>
                    <p className="connection-note">
                      {connection.revision.note}
                    </p>
                    <p>
                      {connection.revision.source.name} · source edition{' '}
                      {connection.revision.source.version} · connection revision{' '}
                      {connection.revision.version}
                    </p>
                    {!!connection.reviewReasons.length && (
                      <div role="alert">
                        <strong>Review your connection</strong>
                        {connection.reviewReasons.map((reason) => (
                          <p key={reason}>{reason}</p>
                        ))}
                      </div>
                    )}
                    <details>
                      <summary>
                        Connection details and dated source receipt
                      </summary>
                      <SourceReceipt source={connection.revision.source} />
                      <p>
                        Saved{' '}
                        {new Date(connection.revision.savedAt).toLocaleString()}{' '}
                        · consent recorded{' '}
                        {new Date(
                          connection.revision.consentedAt,
                        ).toLocaleString()}
                      </p>
                      {contextReady && connection.currentSource && (
                        <p>
                          <a href={`#read/${connection.currentSource.itemId}`}>
                            Read current published source
                          </a>{' '}
                          ·{' '}
                          <a
                            href={connection.currentSource.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Original source website
                          </a>
                        </p>
                      )}
                      {!contextReady ? (
                        <p>
                          Only the saved dated receipt is shown. Current
                          publication status has not been refreshed.
                        </p>
                      ) : (
                        !connection.currentSource && (
                          <p>
                            Only the minimal dated receipt is retained here.
                            Withdrawn source text is unavailable.
                          </p>
                        )
                      )}
                    </details>
                    <div className="page-actions">
                      <button
                        className="secondary"
                        disabled={busy || !!editor}
                        onClick={() => open('edit', connection)}
                      >
                        Edit reason
                      </button>
                      {contextReady &&
                        !!connection.reviewReasons.length &&
                        connection.currentSource &&
                        connection.currentTarget && (
                          <button
                            disabled={busy || !!editor}
                            onClick={() => open('reaffirm', connection)}
                          >
                            Review and reaffirm
                          </button>
                        )}
                      <button
                        className="secondary"
                        disabled={busy || !!editor}
                        onClick={() => void showHistory(connection.revision.id)}
                      >
                        Connection history
                      </button>
                      <button
                        className="secondary"
                        disabled={busy || !!editor}
                        onClick={() => open('remove', connection)}
                      >
                        Remove connection
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
          {!editor && (
            <div className="page-actions">
              <button
                className="secondary"
                disabled={busy}
                onClick={() => void load()}
              >
                Reload connections
              </button>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => void showHistory()}
              >
                All connection history
              </button>
            </div>
          )}
          {history && (
            <section className="panel" aria-label="Research connection history">
              <h2>Private connection history</h2>
              {history.length ? (
                history.map((revision) => (
                  <details key={`${revision.id}:${revision.version}`}>
                    <summary>
                      {revision.target.label} · revision {revision.version} ·{' '}
                      {revision.action} ·{' '}
                      {new Date(revision.savedAt).toLocaleString()}
                    </summary>
                    <SourceReceipt source={revision.source} />
                    <p>
                      {revision.target.binding.kind} ·{' '}
                      {revision.target.binding.id} · record version{' '}
                      {revision.target.binding.version}
                    </p>
                    <p className="connection-note">{revision.note}</p>
                    {revision.removed && (
                      <p>Removed from active connections.</p>
                    )}
                  </details>
                ))
              ) : (
                <p>No saved connection history.</p>
              )}
              <p>
                History keeps a minimal dated receipt and your notes. Account
                deletion removes this private history.
              </p>
            </section>
          )}
        </>
      )}
    </section>
  );
}
