import { useEffect, useState, useRef } from 'react';
import {
  RegulatoryAuthoritySchema,
  RegulatoryMetadataSchema,
  RegulatoryEditionSchema,
  RegulatoryListSchema,
  RegulatoryEvidenceSchema,
  type RegulatoryEdition,
} from '@fingent360/contracts';
import { json, RequestError } from './net';
import { saveDownload, runtime } from './runtime';
const date = (value: RegulatoryEdition['metadata']['publication']) =>
  value.precision === 'unknown'
    ? 'Not established'
    : `${value.value} (${value.precision} precision)`;
function SourceDetails({ edition }: { edition: RegulatoryEdition }) {
  const m = edition.metadata;
  return (
    <>
      <p>{m.summary}</p>
      <dl>
        <dt>Document kind</dt>
        <dd>
          {m.kind}
          {m.kind === 'bill' ? ' · Proposal; not evidence of enactment' : ''}
        </dd>
        <dt>Scope</dt>
        <dd>
          {m.jurisdiction} · {m.scope}
        </dd>
        <dt>Publication</dt>
        <dd>{date(m.publication)}</dd>
        <dt>Effective</dt>
        <dd>{date(m.effective)}</dd>
        <dt>Editorial date evidence</dt>
        <dd>{m.dateEvidence}</dd>
        <dt>Review by</dt>
        <dd>{m.reviewBy}</dd>
        <dt>Original retrieved</dt>
        <dd>
          {new Date(edition.retrievedAt).toLocaleString()} ·{' '}
          {edition.acquisition}
        </dd>
        <dt>Revision</dt>
        <dd>
          {edition.id}
          {m.supersedes ? ` · Replaces ${m.supersedes}` : ''}
        </dd>
        <dt>SHA256</dt>
        <dd>
          <code style={{ overflowWrap: 'anywhere' }}>{edition.hash}</code>
        </dd>
      </dl>
      <a href={m.sourceUrl} target="_blank" rel="noreferrer">
        Open original authority document
      </a>
      <p>
        Editorial source review only. Legal applicability has not been assessed;
        this does not enable personalised advice.
      </p>
    </>
  );
}
export function RegulatorySourcesReader() {
  const [data, setData] = useState<ReturnType<
      typeof RegulatoryListSchema.parse
    > | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [authority, setAuthority] = useState('all'),
    [query, setQuery] = useState(''),
    [history, setHistory] = useState(false);
  const requestSequence = useRef(0);
  async function load(after?: string, includeHistory = history) {
    const sequence = ++requestSequence.current;
    setBusy(true);
    setError('');
    try {
      const value = RegulatoryListSchema.parse(
        await json(
          '/regulatory-sources?history=' +
            includeHistory +
            (after ? '&after=' + encodeURIComponent(after) : ''),
        ),
      );
      if (sequence !== requestSequence.current) return;
      setData((previous) =>
        after && previous
          ? { ...value, editions: [...previous.editions, ...value.editions] }
          : value,
      );
    } catch {
      if (sequence !== requestSequence.current) return;
      setData(null);
      setError(
        'Source library unavailable. Retry without treating an older record as current.',
      );
    } finally {
      if (sequence === requestSequence.current) setBusy(false);
    }
  }
  useEffect(() => {
    void load();
    return () => {
      requestSequence.current++;
    };
  }, []);
  const rows =
    data?.editions.filter(
      (e) =>
        (authority === 'all' || e.metadata.authority === authority) &&
        `${e.metadata.title} ${e.metadata.scope}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    ) ?? [];
  return (
    <section aria-label="Regulatory source library">
      <h2>Rules and tax source library</h2>
      <p>
        Original-source references and reviewed annotations, not a legal opinion
        or personal tax calculation.
      </p>
      {runtime.mode === 'offline' && (
        <p>
          Downloaded history only. Reconnect for later corrections and
          withdrawals; dates do not prove current legal applicability.
        </p>
      )}
      <label>
        <input
          type="checkbox"
          checked={history}
          onChange={(e) => {
            setHistory(e.target.checked);
            void load(undefined, e.target.checked);
          }}
        />
        Include previously published history
      </label>
      <p>Filters apply to loaded pages.</p>
      <label>
        Source authority
        <select
          value={authority}
          onChange={(e) => setAuthority(e.target.value)}
        >
          <option value="all">All authorities</option>
          {RegulatoryAuthoritySchema.options.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
      </label>
      <label>
        Search rule sources
        <input
          value={query}
          maxLength={100}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <button disabled={busy} onClick={() => void load()}>
        {busy ? 'Loading source library…' : 'Refresh source library'}
      </button>
      {error && <p role="alert">{error}</p>}
      {data && !data.enabled && (
        <p>This deployment has not activated regulatory source distribution.</p>
      )}
      {data?.enabled && !rows.length && (
        <p>
          No reviewed sources match. No legal conclusion can be drawn from an
          empty library.
        </p>
      )}
      {data?.nextCursor && (
        <button disabled={busy} onClick={() => void load(data.nextCursor!)}>
          Load more source records
        </button>
      )}
      {rows.map((e) => (
        <details key={e.id}>
          <summary>
            {e.metadata.title} · {e.state}
          </summary>
          {e.state !== 'published' && (
            <p role="status">
              Historical or overdue review: do not treat this revision as a
              current rule.
            </p>
          )}
          <SourceDetails edition={e} />
        </details>
      ))}
    </section>
  );
}
const defaults = {
  documentKey: '',
  authority: 'sebi' as const,
  title: '',
  kind: 'regulation' as const,
  sourceUrl: '',
  jurisdiction: 'India' as const,
  scope: '',
  summary: '',
  publication: { precision: 'unknown' as const, value: null },
  effective: { precision: 'unknown' as const, value: null },
  dateEvidence: '',
  supersedes: null,
  reviewBy: '',
};
export function RegulatorySourcesOperations({
  request = json,
  onDenied,
}: {
  request?: typeof json;
  onDenied?: () => void;
}) {
  const [queue, setQueue] = useState<ReturnType<
      typeof RegulatoryListSchema.parse
    > | null>(null),
    [metadata, setMetadata] =
      useState<ReturnType<typeof RegulatoryMetadataSchema.parse>>(defaults),
    [rights, setRights] = useState(''),
    [mime, setMime] = useState<'text/html' | 'application/pdf'>(
      'application/pdf',
    ),
    [retrieval, setRetrieval] = useState(''),
    [file, setFile] = useState<File | null>(null),
    [reason, setReason] = useState(''),
    [ack, setAck] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [inspected, setInspected] = useState<{ id: string; rights: string } | null>(
      null,
    );
  const live = useRef(true),
    operation = useRef(0),
    capturePending = useRef<{ key: string; id: string } | null>(null),
    reviewPending = useRef<{ key: string; id: string } | null>(null);
  const load = async (after?: string) => {
    const epoch = operation.current;
    const value = RegulatoryListSchema.parse(
      await request(
        '/ops/regulatory-sources' +
          (after ? '?after=' + encodeURIComponent(after) : ''),
      ),
    );
    if (!live.current || epoch !== operation.current) return;
    setQueue((previous) =>
      after && previous
        ? { ...value, editions: [...previous.editions, ...value.editions] }
        : value,
    );
  };
  async function action(work: () => Promise<void>) {
    const epoch = ++operation.current;
    setBusy(true);
    setMessage('');
    try {
      await work();
    } catch (error) {
      if (!live.current || epoch !== operation.current) return;
      if (
        error instanceof RequestError &&
        (error.status === 401 || error.status === 403)
      ) {
        operation.current++;
        setQueue(null);
        setInspected(null);
        setFile(null);
        setRights('');
        setAck(false);
        onDenied?.();
      }
      setMessage(
        error instanceof Error
          ? error.message
          : 'Source operation unavailable. Retry.',
      );
    } finally {
      if (live.current) setBusy(false);
    }
  }
  useEffect(() => {
    let active = true;
    live.current = true;
    const epoch = operation.current;
    request('/ops/regulatory-sources')
      .then((value) => {
        if (active && live.current && epoch === operation.current)
          setQueue(RegulatoryListSchema.parse(value));
      })
      .catch((error) => {
        if (active && live.current && epoch === operation.current) {
          setMessage('Source registry could not load. Retry.');
          if (
            error instanceof RequestError &&
            (error.status === 401 || error.status === 403)
          )
            onDenied?.();
        }
      });
    return () => {
      active = false;
      live.current = false;
      operation.current++;
    };
  }, [request, onDenied]);
  async function retain(fetchOriginal: boolean) {
    const epoch = operation.current;
    const fields = RegulatoryMetadataSchema.parse(metadata);
    let bodyBase64: string | undefined;
    if (!fetchOriginal) {
      if (!file || file.size > 1500000)
        throw Error('Choose an unchanged original under1.5MB.');
      bodyBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]!);
        reader.onerror = () => reject(Error('Original file unavailable.'));
        reader.readAsDataURL(file);
      });
    }
    if (!live.current || epoch !== operation.current) return;
    const payload = {
        metadata: fields,
        rightsReference: rights,
        mime,
        ...(fetchOriginal
          ? {}
          : { bodyBase64, retrievedAt: new Date(retrieval).toISOString() }),
      },
      key = JSON.stringify({ fetchOriginal, payload });
    if (capturePending.current?.key !== key)
      capturePending.current = { key, id: crypto.randomUUID() };
    RegulatoryEditionSchema.parse(
      await request(
        `/ops/regulatory-sources/${fetchOriginal ? 'fetch' : 'import'}`,
        { ...payload, requestId: capturePending.current.id },
        'POST',
      ),
    );
    if (!live.current || epoch !== operation.current) return;
    setMessage(
      'Original retained for independent review. No advice activation.',
    );
    await load();
  }
  return (
    <section aria-label="Regulatory source Operations">
      <h3>Regulatory and tax originals</h3>
      <p>
        Annotate exact source evidence. Unknown dates stay unknown. A different
        named reviewer must inspect the original and document-specific
        permission before publication.
      </p>
      {queue && !queue.enabled && (
        <p>
          Retention disabled. Configure actual deployment permission; retained
          history remains inspectable and withdrawable.
        </p>
      )}
      <fieldset disabled={busy}>
        <legend>Original source metadata</legend>
        <label>
          Authority
          <select
            value={metadata.authority}
            onChange={(e) =>
              setMetadata({
                ...metadata,
                authority: RegulatoryAuthoritySchema.parse(e.target.value),
              })
            }
          >
            {RegulatoryAuthoritySchema.options.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <label>
          Document key
          <input
            value={metadata.documentKey}
            onChange={(e) =>
              setMetadata({ ...metadata, documentKey: e.target.value })
            }
          />
        </label>
        <label>
          Source title
          <input
            value={metadata.title}
            onChange={(e) =>
              setMetadata({ ...metadata, title: e.target.value })
            }
          />
        </label>
        <label>
          Document kind
          <select
            value={metadata.kind}
            onChange={(e) =>
              setMetadata({
                ...metadata,
                kind: e.target.value as typeof metadata.kind,
              })
            }
          >
            {['regulation', 'circular', 'act', 'bill', 'faq', 'notice'].map(
              (k) => (
                <option key={k}>{k}</option>
              ),
            )}
          </select>
        </label>
        <label>
          Original authority URL
          <input
            type="url"
            value={metadata.sourceUrl}
            onChange={(e) =>
              setMetadata({ ...metadata, sourceUrl: e.target.value })
            }
          />
        </label>
        <label>
          Indian jurisdiction and scope
          <textarea
            value={metadata.scope}
            onChange={(e) =>
              setMetadata({ ...metadata, scope: e.target.value })
            }
          />
        </label>
        <label>
          Editorial summary
          <textarea
            value={metadata.summary}
            onChange={(e) =>
              setMetadata({ ...metadata, summary: e.target.value })
            }
          />
        </label>
        {(['publication', 'effective'] as const).map((field) => (
          <fieldset key={field}>
            <legend>
              {field === 'publication' ? 'Publication date' : 'Effective date'}
            </legend>
            <label>
              {field} precision
              <select
                value={metadata[field].precision}
                onChange={(e) => {
                  const precision = e.target.value as
                    'unknown' | 'year' | 'month' | 'day';
                  setMetadata({
                    ...metadata,
                    [field]:
                      precision === 'unknown'
                        ? { precision, value: null }
                        : { precision, value: '' },
                  });
                }}
              >
                {['unknown', 'year', 'month', 'day'].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            {metadata[field].precision !== 'unknown' && (
              <label>
                {field} value
                <input
                  value={metadata[field].value ?? ''}
                  placeholder="YYYY, YYYY-MM or YYYY-MM-DD"
                  onChange={(e) =>
                    setMetadata({
                      ...metadata,
                      [field]: {
                        ...metadata[field],
                        value: e.target.value,
                      } as (typeof metadata)[typeof field],
                    })
                  }
                />
              </label>
            )}
          </fieldset>
        ))}
        <label>
          Date evidence and page/paragraph locator
          <textarea
            value={metadata.dateEvidence}
            onChange={(e) =>
              setMetadata({ ...metadata, dateEvidence: e.target.value })
            }
          />
        </label>
        <label>
          Replaces revision ID
          <input
            value={metadata.supersedes ?? ''}
            onChange={(e) =>
              setMetadata({ ...metadata, supersedes: e.target.value || null })
            }
          />
        </label>
        <label>
          Editorial review by
          <input
            type="date"
            value={metadata.reviewBy}
            onChange={(e) =>
              setMetadata({ ...metadata, reviewBy: e.target.value })
            }
          />
        </label>
        <label>
          Document-specific retention and display permission
          <textarea
            value={rights}
            onChange={(e) => setRights(e.target.value)}
          />
        </label>
        <label>
          Original format
          <select
            value={mime}
            onChange={(e) => setMime(e.target.value as typeof mime)}
          >
            <option value="application/pdf">PDF</option>
            <option value="text/html">HTML</option>
          </select>
        </label>
        <button
          disabled={!queue?.enabled}
          onClick={() => void action(() => retain(true))}
        >
          Fetch unchanged authority original
        </button>
        <label>
          Unchanged original file
          <input
            type="file"
            accept=".html,.pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <label>
          Original retrieved at
          <input
            type="datetime-local"
            value={retrieval}
            onChange={(e) => setRetrieval(e.target.value)}
          />
        </label>
        <button
          disabled={!queue?.enabled || !file || !retrieval}
          onClick={() => void action(() => retain(false))}
        >
          Retain original upload
        </button>
      </fieldset>
      <button disabled={busy} onClick={() => void action(() => load())}>
        Refresh regulatory queue
      </button>
      <label>
        Source review reason
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      <label>
        <input
          type="checkbox"
          checked={ack}
          onChange={(e) => setAck(e.target.checked)}
        />
        I inspected this original, rights and date annotations; this is
        editorial review only.
      </label>
      {message && <p role="status">{message}</p>}
      {inspected && (
        <p role="status">
          Inspected revision {inspected.id}. Rights: {inspected.rights}
        </p>
      )}
      {queue?.nextCursor && (
        <button
          disabled={busy}
          onClick={() => void action(() => load(queue.nextCursor!))}
        >
          Load more regulatory queue
        </button>
      )}
      {queue?.editions.map((e) => (
        <article key={e.id}>
          <h4>
            {e.metadata.title} · {e.state}
          </h4>
          <SourceDetails edition={e} />
          {e.error && <p role="alert">{e.error}</p>}
          <button
            disabled={busy}
            onClick={() =>
              void action(async () => {
                const epoch = operation.current;
                const raw = RegulatoryEvidenceSchema.parse(
                  await request(`/ops/regulatory-sources/${e.id}/evidence`),
                );
                if (!live.current || epoch !== operation.current) return;
                if (raw.id !== e.id || raw.hash !== e.hash)
                  throw Error('Source identity changed. Refresh.');
                setAck(false);
                await saveDownload(
                  new Blob(
                    [
                      Uint8Array.from(atob(raw.bodyBase64), (v) =>
                        v.charCodeAt(0),
                      ),
                    ],
                    {
                      type: raw.mime === 'text/html' ? 'text/plain' : raw.mime,
                    },
                  ),
                  `regulatory-${e.id}.${raw.mime === 'text/html' ? 'txt' : 'pdf'}`,
                );
                if (live.current && epoch === operation.current)
                  setInspected({ id: e.id, rights: raw.rightsReference });
              })
            }
          >
            Inspect retained original
          </button>
          {(['publish', 'withdraw'] as const).map((decision) => (
            <button
              key={decision}
              disabled={
                busy ||
                reason.trim().length < 20 ||
                (decision === 'publish' &&
                  (!queue.enabled ||
                    !ack ||
                    inspected?.id !== e.id ||
                    e.state !== 'draft'))
              }
              onClick={() =>
                void action(async () => {
                  const epoch = operation.current,
                    payload = { decision, reason, originalReviewed: ack },
                    key = JSON.stringify({ id: e.id, payload });
                  if (reviewPending.current?.key !== key)
                    reviewPending.current = { key, id: crypto.randomUUID() };
                  RegulatoryEditionSchema.parse(
                    await request(
                      `/ops/regulatory-sources/${e.id}/review`,
                      { ...payload, requestId: reviewPending.current.id },
                      'POST',
                    ),
                  );
                  if (!live.current || epoch !== operation.current) return;
                  setAck(false);
                  await load();
                })
              }
            >
              {decision === 'publish'
                ? 'Publish reviewed source'
                : 'Withdraw source'}
            </button>
          ))}
        </article>
      ))}
    </section>
  );
}
