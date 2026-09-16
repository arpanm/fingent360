import { useEffect, useRef, useState } from 'react';
import {
  ActionTermsInputSchema,
  ActionTermsQueueSchema,
} from '@fingent360/contracts';
import { json, RequestError } from './net';
import { saveDownload } from './runtime';
import { ActionTermsView } from './EquityActionTerms';
export function ActionTermsOperations({
  request = json,
  onDenied,
}: {
  request?: typeof json;
  onDenied: () => void;
}) {
  const [fields, setFields] = useState({
      oldIsin: '',
      newIsin: '',
      oldUnits: '',
      newUnits: '',
      subscriptionPrice: '',
      exOn: '',
      recordOn: '',
      effectiveOn: '',
      priceOn: '',
      opensOn: '',
      closesOn: '',
      renunciationEndsOn: '',
      fractionTreatment: '',
    }),
    [kind, setKind] = useState<'rights' | 'stock-swap-merger'>('rights'),
    [original, setOriginal] = useState({
      url: '',
      publishedOn: '',
      mediaType: 'application/pdf' as 'application/pdf' | 'text/html',
      bytesBase64: '',
      section: '',
      transcription: '',
    }),
    [rights, setRights] = useState(''),
    [confirmed, setConfirmed] = useState(false),
    [reviewConfirmed, setReviewConfirmed] = useState(false),
    [reason, setReason] = useState(''),
    [queue, setQueue] = useState<
      ReturnType<typeof ActionTermsQueueSchema.parse>
    >({ items: [], next: null }),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState('');
  const live = useRef(true),
    epoch = useRef(0),
    pending = useRef<{ key: string; id: string } | null>(null);
  function fail(e: unknown) {
    if (!live.current) return;
    if (e instanceof RequestError && (e.status === 401 || e.status === 403)) {
      epoch.current++;
      setQueue({ items: [], next: null });
      setOriginal((v) => ({ ...v, bytesBase64: '', transcription: '' }));
      onDenied();
    }
    setError(e instanceof Error ? e.message : 'Action terms failed.');
  }
  async function load(older = false) {
    setLoading(true);
    try {
      const q = ActionTermsQueueSchema.parse(
        await request(
          '/ops/equity-action-terms' +
            (older && queue.next ? '?after=' + queue.next : ''),
        ),
      );
      if (live.current)
        setQueue((v) =>
          older
            ? {
                ...q,
                items: [
                  ...v.items,
                  ...q.items.filter(
                    (r) =>
                      !v.items.some((old) => old.receipt.id === r.receipt.id),
                  ),
                ],
              }
            : q,
        );
    } catch (e) {
      fail(e);
    } finally {
      if (live.current) setLoading(false);
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
  async function send(path: string, value: Record<string, unknown>) {
    setBusy(true);
    setError('');
    const key = JSON.stringify({ path, value });
    if (pending.current?.key !== key)
      pending.current = { key, id: crypto.randomUUID() };
    try {
      const reply = await request(
        '/ops/equity-action-terms/' + path,
        { ...value, requestId: pending.current.id },
        'POST',
      );
      if (
        !reply ||
        typeof reply !== 'object' ||
        !('id' in reply) ||
        reply.id !== (path === 'prepare' ? pending.current.id : value.id)
      )
        throw Error('Action receipt does not match this request.');
      if (live.current) {
        pending.current = null;
        setConfirmed(false);
        setReviewConfirmed(false);
        await load();
      }
    } catch (e) {
      fail(e);
    } finally {
      if (live.current) setBusy(false);
    }
  }
  const labels: Record<string, string> = {
    oldIsin: 'Original issuer ISIN',
    newIsin: 'Receiving issuer ISIN',
    oldUnits: 'Existing shares in ratio',
    newUnits: 'New shares in ratio',
    subscriptionPrice: 'Subscription price INR',
    exOn: 'Ex-date',
    recordOn: 'Record date',
    effectiveOn: 'Merger effective date',
    priceOn: 'Reference close date',
    opensOn: 'Rights opening date',
    closesOn: 'Rights closing date',
    renunciationEndsOn: 'On-market renunciation end',
    fractionTreatment: 'Fractional share treatment',
  };
  const input = {
    requestId: '00000000-0000-4000-8000-000000000000',
    terms: {
      ...fields,
      kind,
      newIsin: kind === 'rights' ? fields.oldIsin : fields.newIsin,
      subscriptionPrice: kind === 'rights' ? fields.subscriptionPrice : '0',
      fixedCashPerOldShare: '0',
      effectiveOn: kind === 'rights' ? fields.exOn : fields.effectiveOn,
      opensOn: kind === 'rights' ? fields.opensOn : null,
      closesOn: kind === 'rights' ? fields.closesOn : null,
      renunciationEndsOn: kind === 'rights' ? fields.renunciationEndsOn : null,
    },
    original,
    rightsEvidence: rights,
    rightsConfirmed: true,
    completeTermsConfirmed: true,
  };
  return (
    <section aria-label="Corporate action terms operations">
      <h2>Rights and merger source terms</h2>
      <p>
        Retain a full permitted original, transcribe exact terms, then ask a
        different named reviewer to publish. Only fully-paid rights or a pure
        stock swap with zero fixed cash consideration. Fractions require
        separate source treatment. No automatic holdings changes.
      </p>
      <button disabled={busy || loading} onClick={() => void load()}>
        Refresh action terms
      </button>
      {queue.next && (
        <button disabled={busy || loading} onClick={() => void load(true)}>
          Load older action terms
        </button>
      )}
      {loading && <p role="status">Loading action terms…</p>}
      {error && <p role="alert">{error}</p>}
      <fieldset disabled={busy}>
        <legend>Original action</legend>
        <label>
          Action family
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as typeof kind);
              setConfirmed(false);
            }}
          >
            <option value="rights">Rights issue</option>
            <option value="stock-swap-merger">Stock-swap merger</option>
          </select>
        </label>
        {Object.entries(fields)
          .filter(([key]) =>
            kind === 'rights'
              ? !['newIsin', 'effectiveOn'].includes(key)
              : ![
                  'subscriptionPrice',
                  'opensOn',
                  'closesOn',
                  'renunciationEndsOn',
                ].includes(key),
          )
          .map(([key, value]) => (
            <label key={key}>
              {labels[key]}
              <input
                type={key.endsWith('On') ? 'date' : 'text'}
                value={value}
                onChange={(e) => {
                  setFields((v) => ({ ...v, [key]: e.target.value }));
                  setConfirmed(false);
                }}
              />
            </label>
          ))}
        {(['url', 'publishedOn', 'section', 'transcription'] as const).map(
          (key) => (
            <label key={key}>
              Original {key}
              <input
                type={
                  key === 'publishedOn'
                    ? 'date'
                    : key === 'url'
                      ? 'url'
                      : 'text'
                }
                value={original[key]}
                onChange={(e) => {
                  setOriginal((v) => ({ ...v, [key]: e.target.value }));
                  setConfirmed(false);
                }}
              />
            </label>
          ),
        )}
        <label>
          Original source file
          <input
            type="file"
            accept=".pdf,.html,.htm"
            onChange={(e) => {
              const sequence = ++epoch.current,
                file = e.target.files?.[0];
              setConfirmed(false);
              setOriginal((v) => ({ ...v, bytesBase64: '' }));
              if (!file) return;
              if (file.size > 8000000) {
                setError('Maximum original file size is 8 MB.');
                return;
              }
              const reader = new FileReader();
              reader.onload = () => {
                if (live.current && sequence === epoch.current)
                  setOriginal((v) => ({
                    ...v,
                    bytesBase64: String(reader.result).split(',')[1] ?? '',
                    mediaType: file.name.toLowerCase().endsWith('.pdf')
                      ? 'application/pdf'
                      : 'text/html',
                  }));
              };
              reader.onerror = () =>
                fail(Error('Original file could not be read.'));
              reader.readAsDataURL(file);
            }}
          />
        </label>
        <label>
          Source permission evidence
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
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          I checked complete terms and storage, display and offline rights.
        </label>
        <button
          disabled={
            !confirmed || !ActionTermsInputSchema.safeParse(input).success
          }
          onClick={() => {
            const { requestId: _, ...value } = input;
            void _;
            void send('prepare', value);
          }}
        >
          Prepare action terms
        </button>
      </fieldset>
      <label>
        Independent review reason
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      <label>
        <input
          type="checkbox"
          checked={reviewConfirmed}
          onChange={(e) => setReviewConfirmed(e.target.checked)}
        />
        I independently verified original terms and exact source identities.
      </label>
      {busy && <p role="status">Saving action terms…</p>}
      {!loading && !queue.items.length && <p>No retained action terms yet.</p>}
      {queue.items.map(({ receipt, state }) => (
        <div key={receipt.id}>
          <ActionTermsView receipt={receipt} />
          <p>State: {state}</p>
          <button
            disabled={busy}
            onClick={() =>
              void request(`/ops/equity-action-terms/${receipt.id}/evidence`)
                .then((v) =>
                  saveDownload(
                    new Blob(
                      [JSON.stringify(ActionTermsInputSchema.parse(v))],
                      { type: 'application/json' },
                    ),
                    'action-original-' + receipt.id + '.json',
                  ),
                )
                .catch(fail)
            }
          >
            Download original bundle
          </button>
          {(['publish', 'withdraw'] as const).map((decision) => (
            <button
              key={decision}
              disabled={
                busy ||
                reason.trim().length < 20 ||
                (decision === 'publish' && !reviewConfirmed)
              }
              onClick={() =>
                void send('review', {
                  id: receipt.id,
                  decision,
                  reason,
                  originalsAndTermsConfirmed: reviewConfirmed,
                })
              }
            >
              {decision === 'publish'
                ? 'Publish action terms'
                : 'Withdraw action terms'}
            </button>
          ))}
        </div>
      ))}
    </section>
  );
}
