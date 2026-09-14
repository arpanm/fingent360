import { useEffect, useRef, useState } from 'react';
import {
  OIL_BENCHMARK_SOURCE,
  OilBenchmarkOperationsSchema,
  OilBenchmarkReviewSchema,
  OilBenchmarkReviewReceiptSchema,
  OilBenchmarkRunSchema,
  OilBenchmarkRunsSchema,
  OilBenchmarkRetainedSchema,
  OilBenchmarkReviewsSchema,
  type PublicationProposalInput,
} from '@fingent360/contracts';
import { json, RequestError } from './net';
import { OilEdition } from './OilBenchmarks';
import { useDraftGuard } from './useDraftGuard';
type Overview = ReturnType<typeof OilBenchmarkOperationsSchema.parse>;
type Intent =
  | { kind: 'refresh'; body: { requestId: string } }
  | { kind: 'review'; body: ReturnType<typeof OilBenchmarkReviewSchema.parse> };
export function OilBenchmarkOperations({
  request,
  onDenied,
  onPropose,
}: {
  request: typeof json;
  onDenied: () => void;
  onPropose?:
    ((input: PublicationProposalInput) => Promise<unknown>) | undefined;
}) {
  const [data, setData] = useState<Overview | null>(null),
    [runs, setRuns] = useState<ReturnType<
      typeof OilBenchmarkRunsSchema.parse
    > | null>(null);
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(true);
  const [reviews, setReviews] = useState<ReturnType<
    typeof OilBenchmarkReviewsSchema.parse
  > | null>(null);
  const [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [reason, setReason] = useState(''),
    [status, setStatus] = useState<'published' | 'withdrawn'>('published');
  const [pending, setPending] = useState<Intent | null>(null),
    [receipt, setReceipt] = useState<ReturnType<
      typeof OilBenchmarkReviewReceiptSchema.parse
    > | null>(null);
  const [raw, setRaw] = useState<ReturnType<
      typeof OilBenchmarkRetainedSchema.parse
    > | null>(null),
    [rawPending, setRawPending] = useState(false);
  const live = useRef(false),
    denied = useRef(false),
    generation = useRef(0),
    detailGeneration = useRef(0);
  const requestRef = useRef(request),
    deniedRef = useRef(onDenied);
  requestRef.current = request;
  deniedRef.current = onDenied;
  useDraftGuard(
    !!reason || !!pending,
    'Leave and discard the unsaved oil-benchmark review?',
  );
  function failure(cause: unknown) {
    if (!live.current) return;
    if (cause instanceof RequestError && cause.status === 401) {
      denied.current = true;
      generation.current++;
      detailGeneration.current++;
      setData(null);
      setRuns(null);
      setReviews(null);
      setRaw(null);
      setPending(null);
      setReceipt(null);
      setReason('');
      setNotice('');
      setError('');
      setReady(false);
      deniedRef.current();
    } else if (!denied.current)
      setError(
        cause instanceof Error
          ? cause.message
          : 'Oil-benchmark operation unavailable. Retry.',
      );
  }
  async function load() {
    const ticket = ++generation.current;
    setBusy(true);
    setReady(false);
    setData(null);
    setRuns(null);
    setReviews(null);
    setError('');
    try {
      const [overview, history, savedReviews] = await Promise.all([
        requestRef
          .current('/ops/oil-benchmarks')
          .then(OilBenchmarkOperationsSchema.parse),
        requestRef
          .current('/ops/oil-benchmarks/runs')
          .then(OilBenchmarkRunsSchema.parse),
        requestRef
          .current('/ops/oil-benchmarks/reviews')
          .then(OilBenchmarkReviewsSchema.parse),
      ]);
      if (live.current && !denied.current && ticket === generation.current) {
        setData(overview);
        setRuns(history);
        setReviews(savedReviews);
        setReady(true);
      }
    } catch (cause) {
      if (
        ticket === generation.current ||
        (cause instanceof RequestError && cause.status === 401)
      )
        failure(cause);
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
      detailGeneration.current++;
    };
  }, []);
  async function submit(intent: Intent) {
    if (busy || denied.current) return;
    setPending(intent);
    setBusy(true);
    setError('');
    setReady(false);
    const ticket = ++generation.current;
    try {
      if (intent.kind === 'refresh') {
        const result = OilBenchmarkRunSchema.parse(
          await requestRef.current(
            '/ops/oil-benchmarks/refresh',
            intent.body,
            'POST',
          ),
        );
        if (!live.current || denied.current || ticket !== generation.current)
          return;
        setNotice(
          `Refresh receipt: ${result.status} · ${result.category}. ${result.observationCount} observations. Publication is a separate review.`,
        );
      } else if (onPropose) {
        await onPropose({
          kind: 'oil-benchmarks',
          target: OIL_BENCHMARK_SOURCE,
          body: intent.body,
        });
        if (!live.current || denied.current || ticket !== generation.current)
          return;
        setNotice(
          'Oil-benchmark proposal saved. A different named approver must review it in Named operators and proposals.',
        );
      } else {
        const result = OilBenchmarkReviewReceiptSchema.parse(
          await requestRef.current(
            '/ops/oil-benchmarks/review',
            intent.body,
            'PUT',
          ),
        );
        if (!live.current || denied.current || ticket !== generation.current)
          return;
        setReceipt(result);
        setNotice(
          'Review receipt saved. This dated receipt does not establish the current source state.',
        );
      }
      setPending(null);
      setReason('');
      setStatus('published');
      await load();
    } catch (cause) {
      if (live.current && ticket === generation.current) {
        if (
          cause instanceof RequestError &&
          [400, 403, 404, 409, 410].includes(cause.status)
        )
          setPending(null);
        failure(cause);
      }
    } finally {
      if (live.current && ticket === generation.current) setBusy(false);
    }
  }
  return (
    <section
      className="panel oil-benchmarks"
      aria-label="Oil benchmark operations"
      data-feedback-private
    >
      <h2>Oil benchmarks</h2>
      <p>
        World Bank monthly Brent and WTI in nominal USD per barrel. Refresh
        captures a draft; publishing and withdrawal require explicit review. No
        daily or Indian landed-cost quote is implied.
      </p>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {busy && <p role="status">Reading or saving oil-benchmark state…</p>}
      <button disabled={busy || !!pending} onClick={() => void load()}>
        {error ? 'Retry oil-benchmark state' : 'Reload oil-benchmark state'}
      </button>
      <button
        disabled={busy || !ready || !!pending}
        onClick={() =>
          void submit({
            kind: 'refresh',
            body: { requestId: crypto.randomUUID() },
          })
        }
      >
        Capture fixed World Bank workbook
      </button>
      {pending && (
        <>
          <p>
            A reply is still uncertain. Retry the same request to read its
            durable outcome.
          </p>
          <button disabled={busy} onClick={() => void submit(pending)}>
            Retry same oil-benchmark request
          </button>
          <button
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  'Discard this pending request reference? Its operation may already have committed. Reload state before making another change.',
                )
              ) {
                setPending(null);
                void load();
              }
            }}
          >
            Discard pending request reference
          </button>
        </>
      )}
      {data && ready && (
        <>
          <p>
            Current head {data.head.version} · {data.head.status}. Latest
            capture {data.head.latestEdition ?? 'none'}; published edition{' '}
            {data.head.publishedEdition ?? 'none'}.
          </p>
          {!data.latest ? (
            <p>
              No accepted numerical edition. Refresh the fixed source first.
            </p>
          ) : (
            <>
              <OilEdition edition={data.latest} sourceDetails />
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  try {
                    const body = OilBenchmarkReviewSchema.parse({
                      requestId: crypto.randomUUID(),
                      expectedVersion: data.head.version,
                      status,
                      correctionNote: reason,
                    });
                    void submit({ kind: 'review', body });
                  } catch {
                    setError('Enter a review reason of 1–2,000 characters.');
                  }
                }}
              >
                <fieldset disabled={busy || !!pending || !ready}>
                  <legend>Review the exact current head</legend>
                  <label htmlFor="oil-review-status">
                    Oil-benchmark publication action
                  </label>
                  <select
                    id="oil-review-status"
                    value={status}
                    onChange={(event) =>
                      setStatus(event.target.value as typeof status)
                    }
                  >
                    <option value="published">
                      Publish latest captured edition
                    </option>
                    <option
                      value="withdrawn"
                      disabled={data.head.status !== 'published'}
                    >
                      Withdraw all public values, history and evidence
                    </option>
                  </select>
                  <label htmlFor="oil-review-reason">
                    Oil-benchmark review reason
                  </label>
                  <textarea
                    id="oil-review-reason"
                    required
                    maxLength={2000}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                  <button>
                    {onPropose
                      ? 'Propose oil-benchmark review'
                      : 'Confirm oil-benchmark review'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReason('');
                      setStatus('published');
                      setError('');
                    }}
                  >
                    Cancel review draft
                  </button>
                </fieldset>
              </form>
            </>
          )}
        </>
      )}
      {receipt && (
        <section aria-label="Historical oil-benchmark review receipt">
          <h3>Saved historical receipt</h3>
          <p>
            {receipt.status} · head {receipt.headVersion} · edition{' '}
            {receipt.edition} · {receipt.reviewedAt}
          </p>
          <p>{receipt.correctionNote}</p>
        </section>
      )}
      {reviews && (
        <section aria-label="Oil-benchmark review history">
          <h3>Review history</h3>
          <p>
            Dated decisions; these receipts do not establish the current source
            state.
          </p>
          {!reviews.reviews.length && <p>No saved reviews.</p>}
          <ol>
            {reviews.reviews.map((value) => (
              <li key={value.requestId}>
                <button disabled={busy} onClick={() => setReceipt(value)}>
                  Open {value.status} receipt for head {value.headVersion}
                </button>{' '}
                · {value.reviewedAt}
              </li>
            ))}
          </ol>
          {reviews.nextBefore && (
            <button
              disabled={busy}
              onClick={() => {
                const ticket = ++generation.current;
                setBusy(true);
                void requestRef
                  .current(
                    `/ops/oil-benchmarks/reviews?before=${reviews.nextBefore}`,
                  )
                  .then(OilBenchmarkReviewsSchema.parse)
                  .then((next) => {
                    if (
                      live.current &&
                      !denied.current &&
                      ticket === generation.current
                    )
                      setReviews({
                        reviews: [...reviews.reviews, ...next.reviews],
                        nextBefore: next.nextBefore,
                      });
                  })
                  .catch((cause) => {
                    if (
                      ticket === generation.current ||
                      (cause instanceof RequestError && cause.status === 401)
                    )
                      failure(cause);
                  })
                  .finally(() => {
                    if (live.current && ticket === generation.current)
                      setBusy(false);
                  });
              }}
            >
              More review receipts
            </button>
          )}
        </section>
      )}
      {runs && (
        <section aria-label="Oil-benchmark refresh history">
          <h3>Refresh history</h3>
          {runs.moreAvailable && (
            <p>
              Showing the latest 50 runs; older durable receipts remain stored.
            </p>
          )}
          {!runs.runs.length && <p>No refresh runs.</p>}
          <ol>
            {runs.runs.map((item) => (
              <li key={item.requestId}>
                {item.startedAt}: {item.status} · {item.category} ·{' '}
                {item.observationCount} observations
                {item.sourceHash && (
                  <button
                    disabled={busy || rawPending}
                    onClick={() => {
                      const ticket = ++detailGeneration.current;
                      setRaw(null);
                      setRawPending(true);
                      setError('');
                      void requestRef
                        .current(
                          `/ops/oil-benchmarks/retained/${item.requestId}`,
                        )
                        .then(OilBenchmarkRetainedSchema.parse)
                        .then((value) => {
                          if (
                            live.current &&
                            !denied.current &&
                            ticket === detailGeneration.current
                          )
                            setRaw(value);
                        })
                        .catch((cause) => {
                          if (
                            ticket === detailGeneration.current ||
                            (cause instanceof RequestError &&
                              cause.status === 401)
                          )
                            failure(cause);
                        })
                        .finally(() => {
                          if (
                            live.current &&
                            ticket === detailGeneration.current
                          )
                            setRawPending(false);
                        });
                    }}
                  >
                    Inspect retained response for {item.requestId}
                  </button>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
      {(raw || rawPending) && (
        <section aria-label="Retained oil-benchmark response">
          <button
            onClick={() => {
              detailGeneration.current++;
              setRaw(null);
              setRawPending(false);
            }}
          >
            Close retained response
          </button>
          {rawPending && <p role="status">Reading retained response…</p>}
          {raw && (
            <>
              <p>
                Operator-only original workbook · {raw.retrievedAt} ·{' '}
                {raw.sourceHash}
              </p>
              <p>
                Fingent360 reads saved cells; workbook connections and formulas
                are never run.
              </p>
              <a
                href={`data:application/octet-stream;base64,${raw.body}`}
                download={`world-bank-oil-receipt-${raw.requestId}.xlsx`}
              >
                Download retained workbook
              </a>
            </>
          )}
        </section>
      )}
    </section>
  );
}
