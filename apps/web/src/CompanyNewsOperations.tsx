import './source-workflows.css';
import { useEffect, useRef, useState } from 'react';
import {
  CompanyNewsInputSchema,
  CompanyNewsQueueSchema,
  CompanyNewsReviewSchema,
} from '@fingent360/contracts';
import { json, RequestError } from './net';
type Input = ReturnType<typeof CompanyNewsInputSchema.parse>;
type Citation = Input['citations'][number];
const citation = (): Citation => ({
  name: '',
  url: '',
  originator: '',
  primary: false,
  publishedAt: '',
  retrievedAt: '',
  rightsMode: 'link-only',
  termsUrl: '',
  permissionReference: '',
  linkingAllowed: true,
  offlineAllowed: true,
  noExpiryConfirmed: true,
  independentReporting: false,
});
const fresh = (): Input => ({
  requestId: crypto.randomUUID(),
  isin: '',
  title: '',
  summary: '',
  copiedText: '',
  copiedFrom: null,
  citations: [citation(), citation()],
  verification: '',
  conflicts: 'unresolved',
  originalEditorialConfirmed: true,
});
export function CompanyNewsOperations({
  request,
  onDenied,
}: {
  request: typeof json;
  onDenied: () => void;
}) {
  const [input, setInput] = useState(fresh),
    [queue, setQueue] = useState<ReturnType<
      typeof CompanyNewsQueueSchema.parse
    > | null>(null),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [confirmed, setConfirmed] = useState(false);
  const live = useRef(true),
    epoch = useRef(0);
  const fail = (cause: unknown) => {
    if (!live.current) return;
    if (cause instanceof RequestError && cause.status === 401) {
      live.current = false;
      epoch.current++;
      setQueue(null);
      setInput(fresh());
      setConfirmed(false);
      onDenied();
    } else
      setError(
        cause instanceof Error
          ? cause.message
          : 'Request failed. Retry the same action.',
      );
  };
  async function load() {
    const generation = epoch.current;
    setLoading(true);
    try {
      const value = CompanyNewsQueueSchema.parse(
        await request('/ops/company-news'),
      );
      if (live.current && generation === epoch.current) setQueue(value);
    } catch (cause) {
      fail(cause);
    } finally {
      if (live.current && generation === epoch.current) setLoading(false);
    }
  }
  useEffect(() => {
    live.current = true;
    void load();
    return () => {
      live.current = false;
      epoch.current++;
    };
  }, []);
  function change(next: Partial<Input>) {
    setConfirmed(false);
    setInput((old) => ({ ...old, ...next, requestId: crypto.randomUUID() }));
  }
  function source(index: number, next: Partial<Citation>) {
    change({
      citations: input.citations.map((value, i) =>
        i === index ? { ...value, ...next } : value,
      ),
    });
    setConfirmed(false);
  }
  async function prepare() {
    setBusy(true);
    setError('');
    try {
      if (!confirmed)
        throw new Error(
          'Confirm the source-specific permissions and original editorial writing.',
        );
      const parsed = CompanyNewsInputSchema.safeParse(input);
      if (!parsed.success)
        throw new Error(
          parsed.error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('; '),
        );
      await request('/ops/company-news/prepare', parsed.data, 'POST');
      if (live.current) {
        setNotice(
          'Draft retained. A reviewer must verify it before readers can see it.',
        );
        setInput(fresh());
        setConfirmed(false);
        await load();
      }
    } catch (cause) {
      fail(cause);
    } finally {
      if (live.current) setBusy(false);
    }
  }
  return (
    <section
      className="source-workflow"
      aria-label="Company news onboarding"
      aria-busy={busy || loading}
    >
      <h2>Company news</h2>
      <p>
        Write your own summary, link a reviewed NSE identity and document at
        least two independent originators, including a primary filing or
        release. Mirrored releases count once. Rights are source-specific;
        public access is not permission.
      </p>
      {loading && <p role="status">Loading company report queue…</p>}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <details>
        <summary>Prepare a company report</summary>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void prepare();
          }}
        >
          <fieldset disabled={busy}>
            <legend>Company and original editorial</legend>
            {(['isin', 'title', 'summary', 'verification'] as const).map(
              (key) => (
                <label key={key}>
                  {
                    {
                      isin: 'Company ISIN',
                      title: 'Report title',
                      summary: 'Original summary',
                      verification:
                        'What did the independent evidence confirm?',
                    }[key]
                  }
                  <textarea
                    required
                    value={input[key]}
                    onChange={(event) => change({ [key]: event.target.value })}
                  />
                </label>
              ),
            )}
            <label>
              Conflicting evidence
              <select
                value={input.conflicts}
                onChange={(event) =>
                  change({
                    conflicts: event.target.value as Input['conflicts'],
                  })
                }
              >
                <option value="unresolved">Unresolved or not checked</option>
                <option value="none-found">Checked: none found</option>
              </select>
            </label>
            {input.citations.map((row, index) => (
              <fieldset key={index}>
                <legend>Source {index + 1}</legend>
                {(
                  [
                    'name',
                    'url',
                    'originator',
                    'termsUrl',
                    'permissionReference',
                  ] as const
                ).map((key) => (
                  <label key={key}>
                    {
                      {
                        name: 'Source name',
                        url: 'Original source URL',
                        originator: 'Original reporting organisation',
                        termsUrl: 'Rights terms URL',
                        permissionReference: 'Permission evidence and scope',
                      }[key]
                    }
                    <input
                      required
                      value={row[key]}
                      onChange={(event) =>
                        source(index, { [key]: event.target.value })
                      }
                    />
                  </label>
                ))}
                {(['publishedAt', 'retrievedAt'] as const).map((key) => (
                  <label key={key}>
                    {key === 'publishedAt'
                      ? 'Publication time (UTC)'
                      : 'Retrieved time (UTC)'}
                    <input
                      required
                      type="datetime-local"
                      value={row[key].slice(0, 16)}
                      onChange={(event) =>
                        source(index, {
                          [key]: event.target.value
                            ? `${event.target.value}:00.000Z`
                            : '',
                        })
                      }
                    />
                  </label>
                ))}
                <label>
                  <input
                    type="checkbox"
                    checked={row.primary}
                    onChange={(event) =>
                      source(index, { primary: event.target.checked })
                    }
                  />
                  Primary filing or release
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={row.independentReporting}
                    onChange={(event) =>
                      source(index, {
                        independentReporting: event.target.checked,
                      })
                    }
                  />
                  Independent reporting, not a mirror or syndication
                </label>
                <label>
                  Allowed use
                  <select
                    value={row.rightsMode}
                    onChange={(event) =>
                      source(index, {
                        rightsMode: event.target
                          .value as Citation['rightsMode'],
                      })
                    }
                  >
                    <option value="link-only">Link and our own summary</option>
                    <option value="full-text">
                      Explicit full-text permission
                    </option>
                  </select>
                </label>
                {input.citations.length > 2 && (
                  <button
                    type="button"
                    onClick={() =>
                      change({
                        citations: input.citations.filter(
                          (_, i) => i !== index,
                        ),
                        copiedFrom: null,
                        copiedText: '',
                      })
                    }
                  >
                    Remove source {index + 1}
                  </button>
                )}
              </fieldset>
            ))}
            {input.citations.length < 6 && (
              <button
                type="button"
                onClick={() =>
                  change({ citations: [...input.citations, citation()] })
                }
              >
                Add source
              </button>
            )}
            <label>
              Optional licensed text
              <textarea
                value={input.copiedText}
                onChange={(event) =>
                  change({
                    copiedText: event.target.value,
                    copiedFrom: event.target.value ? input.copiedFrom : null,
                  })
                }
              />
            </label>
            {input.copiedText && (
              <label>
                Exact copied source
                <select
                  value={input.copiedFrom ?? ''}
                  onChange={(event) =>
                    change({
                      copiedFrom:
                        event.target.value === ''
                          ? null
                          : Number(event.target.value),
                    })
                  }
                >
                  <option value="">Choose licensed source</option>
                  {input.citations.map(
                    (row, i) =>
                      row.rightsMode === 'full-text' && (
                        <option key={i} value={i}>
                          Source {i + 1}: {row.name}
                        </option>
                      ),
                  )}
                </select>
              </label>
            )}
            <label>
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              I checked every source permits linking and the selected use,
              including offline storage without expiry, and the title and
              summary are original editorial writing. Permission evidence is
              recorded above.
            </label>
            <button disabled={!confirmed}>Retain draft for verification</button>
          </fieldset>
        </form>
      </details>
      <button
        disabled={busy || loading}
        onClick={() => {
          setError('');
          void load();
        }}
      >
        Refresh company reports
      </button>
      {!queue ? (
        <p>{loading ? '' : 'Load the company review queue using Refresh.'}</p>
      ) : (
        <>
          <p>
            {queue.items.length === 0 ? 'No company reports retained yet.' : ''}
            {queue.truncated
              ? 'Latest 100 reports shown. Older reports remain retained.'
              : ''}
          </p>
          {queue.items.map((item) => (
            <Review
              key={`${item.id}:${item.version}`}
              item={item}
              request={request}
              changed={load}
              failed={fail}
            />
          ))}
        </>
      )}
    </section>
  );
}
function Review({
  item,
  request,
  changed,
  failed,
}: {
  item: ReturnType<typeof CompanyNewsQueueSchema.parse>['items'][number];
  request: typeof json;
  changed: () => Promise<void>;
  failed: (cause: unknown) => void;
}) {
  const [reason, setReason] = useState(''),
    [rights, setRights] = useState(false),
    [corroboration, setCorroboration] = useState(false),
    [busy, setBusy] = useState(false);
  const intent = useRef<{ key: string; id: string } | null>(null);
  async function submit(decision: 'publish' | 'withdraw') {
    setBusy(true);
    try {
      const key = JSON.stringify({ reason, rights, corroboration, decision });
      if (intent.current?.key !== key)
        intent.current = { key, id: crypto.randomUUID() };
      const body = CompanyNewsReviewSchema.parse({
        requestId: intent.current.id,
        id: item.id,
        expectedVersion: item.version,
        decision,
        reason,
        rightsConfirmed: rights,
        corroborationConfirmed: corroboration,
      });
      await request('/ops/company-news/review', body, 'POST');
      await changed();
    } catch (cause) {
      failed(cause);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details>
      <summary>
        {item.input.title} · {item.state} · version {item.version}
      </summary>
      <p>
        {item.companyName} · {item.input.isin}
      </p>
      <p>{item.input.summary}</p>
      <p>{item.input.verification}</p>
      <p>Conflicts: {item.input.conflicts}</p>
      {item.input.citations.map((source) => (
        <section key={source.url}>
          <a href={source.url} target="_blank" rel="noreferrer">
            {source.name}
          </a>
          <p>
            {source.originator} · {source.primary ? 'Primary' : 'Supporting'} ·{' '}
            {source.independentReporting
              ? 'Independent originator recorded'
              : 'Related reporting'}{' '}
            · {source.rightsMode}
          </p>
          <p>
            {source.publishedAt} · retrieved {source.retrievedAt}
          </p>
          <a href={source.termsUrl} target="_blank" rel="noreferrer">
            Permission terms
          </a>
          <p>{source.permissionReference}</p>
        </section>
      ))}
      {item.input.copiedText && (
        <blockquote>{item.input.copiedText}</blockquote>
      )}
      <fieldset disabled={busy}>
        <legend>Publication review</legend>
        <p>
          Publishing requires named operators and a different reviewer from the
          preparer. Withdraw before preparing corrected evidence; the previous
          editions remain retained.
        </p>
        <label>
          Review reason
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={rights}
            onChange={(event) => setRights(event.target.checked)}
          />
          I independently checked all linking, reproduction and offline
          permissions
        </label>
        <label>
          <input
            type="checkbox"
            checked={corroboration}
            onChange={(event) => setCorroboration(event.target.checked)}
          />
          Two independent originators corroborate the material claim, including
          a primary source
        </label>
        <button
          disabled={!rights || !corroboration || reason.trim().length < 12}
          onClick={() => void submit('publish')}
        >
          Publish verified report
        </button>
        <button
          disabled={reason.trim().length < 12}
          onClick={() => void submit('withdraw')}
        >
          Withdraw report
        </button>
      </fieldset>
    </details>
  );
}
