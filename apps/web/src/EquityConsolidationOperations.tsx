import { useEffect, useRef, useState } from 'react';
import {
  ConsolidationInputSchema,
  ConsolidationQueueSchema,
} from '@fingent360/contracts';
import { json, RequestError } from './net';
import { ConsolidationView } from './EquityConsolidations';
import { saveDownload } from './runtime';
type Document = ReturnType<
  typeof ConsolidationInputSchema.parse
>['documents'][number];
const roles = ['suspension', 'resumption', 'issuer-terms'] as const;
export function EquityConsolidationOperations({
  request,
  onDenied,
}: {
  request: typeof json;
  onDenied: () => void;
}) {
  const [fields, setFields] = useState({
      oldIsin: '',
      newIsin: '',
      lastOldTradeOn: '',
      suspendedOn: '',
      recordOn: '',
      resumedOn: '',
      oldFaceValue: '',
      newFaceValue: '',
      coverageEvidence: '',
      rightsEvidence: '',
    }),
    [documents, setDocuments] = useState<Document[]>(
      roles.map((role) => ({
        role,
        url: '',
        publishedOn: '',
        pdfBase64: '',
        page: 1,
        transcription: '',
      })),
    ),
    [confirmed, setConfirmed] = useState(false),
    [reviewConfirmed, setReviewConfirmed] = useState(false),
    [reason, setReason] = useState(''),
    [rows, setRows] = useState<
      ReturnType<typeof ConsolidationQueueSchema.parse>['items']
    >([]),
    [next, setNext] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState('');
  const live = useRef(true),
    fileEpoch = useRef([0, 0, 0]),
    pending = useRef<{ key: string; id: string } | null>(null);
  function fail(cause: unknown) {
    if (!live.current) return;
    if (cause instanceof RequestError && cause.status === 401) {
      live.current = false;
      fileEpoch.current = fileEpoch.current.map((v) => v + 1);
      setRows([]);
      setDocuments([]);
      onDenied();
    } else
      setError(
        cause instanceof Error
          ? cause.message
          : 'Consolidation request failed.',
      );
  }
  async function load(older = false) {
    setLoading(true);
    try {
      const value = ConsolidationQueueSchema.parse(
        await request(
          '/ops/equity-consolidations' +
            (older && next ? '?after=' + encodeURIComponent(next) : ''),
        ),
      );
      if (live.current) {
        setRows((old) =>
          older
            ? [
                ...old,
                ...value.items.filter(
                  (row) =>
                    !old.some((saved) => saved.receipt.id === row.receipt.id),
                ),
              ]
            : value.items,
        );
        setNext(value.next);
      }
    } catch (cause) {
      fail(cause);
    } finally {
      if (live.current) setLoading(false);
    }
  }
  useEffect(() => {
    live.current = true;
    void load();
    return () => {
      live.current = false;
      fileEpoch.current = fileEpoch.current.map((v) => v + 1);
    };
  }, []);
  async function send(path: string, value: Record<string, unknown>) {
    setBusy(true);
    setError('');
    const key = JSON.stringify({ path, value });
    if (pending.current?.key !== key)
      pending.current = { key, id: crypto.randomUUID() };
    try {
      await request(
        `/ops/equity-consolidations/${path}`,
        { ...value, requestId: pending.current.id },
        'POST',
      );
      if (live.current) {
        setConfirmed(false);
        setReviewConfirmed(false);
        await load();
      }
    } catch (cause) {
      fail(cause);
    } finally {
      if (live.current) setBusy(false);
    }
  }
  function editDocument(index: number, patch: Partial<Document>) {
    setConfirmed(false);
    setDocuments((old) =>
      old.map((d, i) => (i === index ? { ...d, ...patch } : d)),
    );
  }
  async function attach(index: number, file: File | undefined) {
    const token = (fileEpoch.current[index] ?? 0) + 1;
    fileEpoch.current[index] = token;
    editDocument(index, { pdfBase64: '' });
    if (!file) return;
    if (file.size > 2000000) {
      setError('Each original PDF must be at most 2 MB.');
      return;
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let encoded = '';
      for (let i = 0; i < bytes.length; i += 8192)
        encoded += String.fromCharCode(...bytes.subarray(i, i + 8192));
      if (live.current && token === fileEpoch.current[index])
        editDocument(index, { pdfBase64: btoa(encoded) });
    } catch (cause) {
      fail(cause);
    }
  }
  async function evidence(id: string) {
    setBusy(true);
    setError('');
    try {
      const value = ConsolidationInputSchema.parse(
        await request(`/ops/equity-consolidations/${id}/evidence`),
      );
      if (!live.current) return;
      await saveDownload(
        new Blob([JSON.stringify(value, null, 2)], {
          type: 'application/json',
        }),
        `consolidation-${id}-originals.json`,
      );
    } catch (cause) {
      fail(cause);
    } finally {
      if (live.current) setBusy(false);
    }
  }
  return (
    <section
      className="source-workflow"
      aria-label="Consolidation review"
      aria-busy={busy || loading}
    >
      <h2>Review a pure share consolidation</h2>
      <p>
        Retain the exchange suspension/resumption and issuer terms PDFs.
        Transcribe exact terms; a different named reviewer must inspect
        originals and source permissions. This creates a nominal comparison,
        never portfolio changes or a daily-return bridge.
      </p>
      {loading && <p role="status">Loading consolidations…</p>}
      {error && <p role="alert">{error}</p>}
      <button
        disabled={busy || loading}
        onClick={() => {
          setError('');
          void load();
        }}
      >
        Refresh consolidation queue
      </button>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send('prepare', {
            ...fields,
            documents,
            pureConsolidationConfirmed: confirmed,
            rightsConfirmed: confirmed,
          });
        }}
      >
        <fieldset disabled={busy}>
          <legend>Original terms and admitted securities</legend>
          {Object.entries(fields).map(([key, value]) => (
            <label key={key}>
              {
                (
                  {
                    oldIsin: 'Old ISIN',
                    newIsin: 'New ISIN',
                    lastOldTradeOn: 'Last old trading date',
                    suspendedOn: 'Suspension date',
                    recordOn: 'Record date',
                    resumedOn: 'Resumption date',
                    oldFaceValue: 'Old face value',
                    newFaceValue: 'New face value',
                    coverageEvidence: 'Full transition coverage evidence',
                    rightsEvidence: 'Source permission evidence',
                  } as Record<string, string>
                )[key]
              }
              <input
                required
                type={key.endsWith('On') ? 'date' : 'text'}
                value={value}
                onChange={(e) => {
                  setFields((old) => ({ ...old, [key]: e.target.value }));
                  setConfirmed(false);
                }}
              />
            </label>
          ))}
          {documents.map((d, i) => (
            <fieldset key={d.role}>
              <legend>{d.role} notice</legend>
              <label>
                {d.role} source URL
                <input
                  required
                  type="url"
                  value={d.url}
                  onChange={(e) => editDocument(i, { url: e.target.value })}
                />
              </label>
              <label>
                {d.role} publication date
                <input
                  required
                  type="date"
                  value={d.publishedOn}
                  onChange={(e) =>
                    editDocument(i, { publishedOn: e.target.value })
                  }
                />
              </label>
              <label>
                {d.role} original PDF
                <input
                  required
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(e) => void attach(i, e.target.files?.[0])}
                />
              </label>
              <label>
                {d.role} page
                <input
                  required
                  type="number"
                  min={1}
                  max={1000}
                  value={d.page}
                  onChange={(e) =>
                    editDocument(i, { page: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                {d.role} exact terms
                <textarea
                  required
                  minLength={30}
                  value={d.transcription}
                  onChange={(e) =>
                    editDocument(i, { transcription: e.target.value })
                  }
                />
              </label>
            </fieldset>
          ))}
          <label>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I verified a pure fully-paid consolidation, complete transition
            coverage, no additional consideration and display/retention/offline
            permission.
          </label>
          <button disabled={!confirmed || documents.some((d) => !d.pdfBase64)}>
            Prepare consolidation bridge
          </button>
        </fieldset>
      </form>
      <label>
        Consolidation independent review reason
        <textarea
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setReviewConfirmed(false);
          }}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={reviewConfirmed}
          onChange={(e) => setReviewConfirmed(e.target.checked)}
        />
        I independently inspected all original notices, exact terms, both
        security identities and usage permission.
      </label>
      {!loading && rows.length === 0 && (
        <p>No consolidation bridges retained.</p>
      )}
      {rows.map((row) => (
        <section key={row.receipt.id}>
          <p>Consolidation status: {row.state}</p>
          <ConsolidationView receipt={row.receipt} />
          <button disabled={busy} onClick={() => void evidence(row.receipt.id)}>
            Download original evidence bundle
          </button>
          <button
            disabled={busy || !reviewConfirmed || reason.trim().length < 20}
            onClick={() =>
              void send('review', {
                id: row.receipt.id,
                decision: 'publish',
                reason,
                originalsAndTermsConfirmed: reviewConfirmed,
              })
            }
          >
            Publish consolidation bridge
          </button>
          <button
            disabled={busy || reason.trim().length < 20}
            onClick={() =>
              void send('review', {
                id: row.receipt.id,
                decision: 'withdraw',
                reason,
                originalsAndTermsConfirmed: reviewConfirmed,
              })
            }
          >
            Withdraw consolidation bridge
          </button>
        </section>
      ))}
      {next && (
        <button disabled={busy || loading} onClick={() => void load(true)}>
          Load older consolidation bridges
        </button>
      )}
    </section>
  );
}
