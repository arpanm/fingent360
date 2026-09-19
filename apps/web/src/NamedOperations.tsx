import { ProposalInspection } from './ProposalInspection';
import { useEffect, useRef, useState } from 'react';
import {
  OperatorRosterSchema,
  OperatorIdentitySchema,
  PublicationProposalPageSchema,
  PublicationProposalSchema,
  type OperatorRole,
} from '@fingent360/contracts';
import { json } from './net';
type Identity = typeof OperatorIdentitySchema._output;
type Proposal = typeof PublicationProposalSchema._output;
export function NamedOperations({
  request,
  identity,
}: {
  request: typeof json;
  identity: Identity;
}) {
  const [rows, setRows] = useState<Proposal[]>([]),
    [next, setNext] = useState<string | null>(null);
  const [selected, setSelected] = useState<Proposal | null>(null),
    [operators, setOperators] = useState<Identity[]>([]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [username, setUsername] = useState(''),
    [password, setPassword] = useState('');
  const [role, setRole] = useState<OperatorRole>('viewer'),
    [note, setNote] = useState('');
  const errorFocus = useRef<HTMLParagraphElement>(null);
  const reloadFocus = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (error && !busy) errorFocus.current?.focus();
  }, [error, busy]);
  const live = useRef(false),
    generation = useRef(0);
  async function load(after?: string) {
    const ticket = ++generation.current;
    setBusy(true);
    setError('');
    try {
      const page = PublicationProposalPageSchema.parse(
        await request('/ops/proposals' + (after ? '?after=' + after : '')),
      );
      let roster: Identity[] = [];
      if (identity.role === 'admin')
        roster = OperatorRosterSchema.parse(
          await request('/ops/operators'),
        ).operators;
      if (!live.current || ticket !== generation.current) return;
      setRows((old) =>
        after
          ? [
              ...old,
              ...page.proposals.filter(
                (row) => !old.some((item) => item.id === row.id),
              ),
            ]
          : page.proposals,
      );
      setNext(page.next);
      setOperators(roster);
      if (!after)
        setSelected((old) =>
          old
            ? (page.proposals.find((row) => row.id === old.id) ?? null)
            : null,
        );
    } catch (e) {
      if (live.current && ticket === generation.current)
        setError(
          e instanceof Error ? e.message : 'Named operations unavailable.',
        );
    } finally {
      if (live.current && ticket === generation.current) setBusy(false);
    }
  }
  useEffect(() => {
    live.current = true;
    void load();
    return () => {
      live.current = false;
      generation.current++;
    };
  }, []);
  async function action(work: () => Promise<void>) {
    setBusy(true);
    setError('');
    const ticket = ++generation.current;
    try {
      await work();
    } catch (e) {
      if (live.current && ticket === generation.current)
        setError(e instanceof Error ? e.message : 'Operation failed. Retry.');
    } finally {
      if (live.current && ticket === generation.current) setBusy(false);
    }
  }
  return (
    <section
      className="panel"
      aria-label="Named operators and publication proposals"
      data-feedback-private
    >
      <h2>Independent publication review</h2>
      <p>
        Signed in as {identity.username} · {identity.role}. A different named
        publisher or administrator must approve every proposed public-content
        change. Fixed numerical ingestion is separately permission-controlled.
      </p>
      {error && (
        <p role="alert" tabIndex={-1} ref={errorFocus}>
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <button ref={reloadFocus} disabled={busy} onClick={() => void load()}>
        Reload proposals and operators
      </button>
      {!rows.length && !busy && (
        <p>
          No proposals on this page. Create one from Publishing, visual review
          or Source registry.
        </p>
      )}
      <ul>
        {rows.map((row) => (
          <li key={row.id}>
            <button
              style={{
                minWidth: 0,
                maxWidth: '100%',
                whiteSpace: 'normal',
                overflowWrap: 'anywhere',
              }}
              disabled={busy}
              onClick={() => {
                setSelected(row);
                setNote('');
                setNotice('');
              }}
            >
              {row.input.kind} · {row.input.target} · {row.state} · proposed by{' '}
              {row.proposer.username}
            </button>
          </li>
        ))}
      </ul>
      {next && (
        <button disabled={busy} onClick={() => void load(next)}>
          More publication proposals
        </button>
      )}
      {selected && (
        <section className="panel" aria-label="Publication proposal details">
          <h3>Review exact proposed changes</h3>
          <p>
            Proposed {selected.createdAt} by {selected.proposer.username};{' '}
            {selected.state}.
          </p>
          <p>
            Target: {selected.input.target}. Changes remain unpublished until an
            independent approval commits. A stale source or asset must be
            reviewed in a new proposal.
          </p>
          <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {JSON.stringify(selected.input.body, null, 2)}
          </pre>
          <ProposalInspection
            key={selected.id}
            input={selected.input}
            request={request}
          />
          {selected.actionResult && (
            <p>
              Created source record: {selected.actionResult.sourceId}, revision{' '}
              {selected.actionResult.revision}. Read it in Source registry.
            </p>
          )}
          {selected.reviewer && (
            <p>
              Historical {selected.state} receipt: {selected.reviewedAt} by{' '}
              {selected.reviewer.username}. {selected.note}
            </p>
          )}
          {selected.state === 'pending' && (
            <>
              <label htmlFor="proposal-decision-note">Decision note</label>
              <textarea
                id="proposal-decision-note"
                value={note}
                disabled={busy}
                maxLength={1000}
                onChange={(e) => setNote(e.target.value)}
              />
              {selected.proposer.id === identity.id && (
                <p>
                  You cannot approve or reject your own proposal. Ask another
                  named reviewer.
                </p>
              )}
              <div className="page-actions">
                {(['approve', 'reject'] as const).map((decision) => (
                  <button
                    key={decision}
                    disabled={
                      busy ||
                      !note.trim() ||
                      selected.proposer.id === identity.id ||
                      !['publisher', 'admin'].includes(identity.role)
                    }
                    onClick={() =>
                      void action(async () => {
                        const saved = PublicationProposalSchema.parse(
                          await request(
                            `/ops/proposals/${selected.id}/${decision}`,
                            { note: note.trim() },
                            'POST',
                          ),
                        );
                        if (!live.current) return;
                        setSelected(saved);
                        setRows((old) =>
                          old.map((row) => (row.id === saved.id ? saved : row)),
                        );
                        setNotice(
                          `Saved ${saved.state} receipt. Reopen Publishing or Source registry to read its current state.`,
                        );
                      })
                    }
                  >
                    {decision === 'approve'
                      ? 'Approve exact publication'
                      : 'Reject proposed changes'}
                  </button>
                ))}
              </div>
            </>
          )}
          <button
            disabled={busy}
            onClick={() => {
              setSelected(null);
              reloadFocus.current?.focus();
            }}
          >
            Close proposal
          </button>
        </section>
      )}
      {identity.role === 'admin' && (
        <section aria-label="Named operator administration">
          <h2>Named operators</h2>
          <p>
            Up to 50 retained identities. Disabled identities can be re-enabled.
            Changing a role invalidates its sessions; another administrator must
            change your own identity. Owner recovery is a separate explicit
            local command.
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void action(async () => {
                const saved = OperatorIdentitySchema.parse(
                  await request(
                    '/ops/operators',
                    { username, password, role },
                    'POST',
                  ),
                );
                if (!live.current) return;
                setOperators((old) => [...old, saved]);
                setUsername('');
                setPassword('');
                setNotice(
                  'Named operator created. Share credentials through your own secure channel.',
                );
              });
            }}
          >
            <label htmlFor="new-operator-name">New operator username</label>
            <input
              id="new-operator-name"
              value={username}
              required
              pattern="[a-z][a-z0-9_]{2,39}"
              disabled={busy}
              onChange={(e) => setUsername(e.target.value)}
            />
            <label htmlFor="new-operator-password">New operator password</label>
            <input
              id="new-operator-password"
              type="password"
              autoComplete="new-password"
              value={password}
              required
              minLength={12}
              maxLength={128}
              disabled={busy}
              onChange={(e) => setPassword(e.target.value)}
            />
            <label htmlFor="new-operator-role">New operator role</label>
            <select
              id="new-operator-role"
              value={role}
              disabled={busy}
              onChange={(e) => setRole(e.target.value as OperatorRole)}
            >
              {['viewer', 'researcher', 'publisher', 'admin'].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <button disabled={busy}>Create named operator</button>
          </form>
          {operators.map((operator) => (
            <article className="panel" key={operator.id}>
              <h3>{operator.username}</h3>
              <p>
                {operator.role} · revision {operator.version} ·{' '}
                {operator.enabled ? 'enabled' : 'disabled'}
              </p>
              <label htmlFor={'operator-role-' + operator.id}>
                Role for {operator.username}
              </label>
              <select
                id={'operator-role-' + operator.id}
                value={operator.role}
                disabled={busy || operator.id === identity.id}
                onChange={(event) => {
                  const chosen = event.target.value;
                  if (
                    !window.confirm(
                      `Change ${operator.username} to ${chosen} and revoke existing sessions?`,
                    )
                  )
                    return;
                  void action(async () => {
                    const saved = OperatorIdentitySchema.parse(
                      await request(
                        '/ops/operators/' + operator.id,
                        {
                          expectedVersion: operator.version,
                          role: chosen,
                          enabled: operator.enabled,
                        },
                        'PUT',
                      ),
                    );
                    if (live.current)
                      setOperators((old) =>
                        old.map((row) => (row.id === saved.id ? saved : row)),
                      );
                  });
                }}
              >
                {['viewer', 'researcher', 'publisher', 'admin'].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
              <button
                disabled={busy || operator.id === identity.id}
                onClick={() => {
                  if (
                    !window.confirm(
                      `${operator.enabled ? 'Disable' : 'Enable'} ${operator.username} and revoke existing sessions?`,
                    )
                  )
                    return;
                  void action(async () => {
                    const saved = OperatorIdentitySchema.parse(
                      await request(
                        '/ops/operators/' + operator.id,
                        {
                          expectedVersion: operator.version,
                          role: operator.role,
                          enabled: !operator.enabled,
                        },
                        'PUT',
                      ),
                    );
                    if (live.current)
                      setOperators((old) =>
                        old.map((row) => (row.id === saved.id ? saved : row)),
                      );
                  });
                }}
              >
                {operator.enabled ? 'Disable' : 'Enable'} {operator.username}
              </button>
            </article>
          ))}
        </section>
      )}
    </section>
  );
}
