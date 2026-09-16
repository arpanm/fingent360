import { useEffect, useRef, useState } from 'react';
import {
  EquityCompanySchema,
  ClassificationCrosswalkDraftSchema,
  ClassificationCrosswalkRevisionSchema,
  ClassificationCrosswalkListSchema,
  ClassificationCrosswalkHistorySchema,
  ClassificationCrosswalkPublicSchema,
} from '@fingent360/contracts';
import { json } from './net';
import './source-workflows.css';
type Source = ReturnType<typeof EquityCompanySchema.parse>['records'][number];
export function ClassificationCrosswalk({ request }: { request: typeof json }) {
  const [list, setList] = useState<ReturnType<
      typeof ClassificationCrosswalkListSchema.parse
    > | null>(null),
    [company, setCompany] = useState<ReturnType<
      typeof EquityCompanySchema.parse
    > | null>(null),
    [source, setSource] = useState<Source | null>(null),
    [selected, setSelected] = useState<ReturnType<
      typeof ClassificationCrosswalkRevisionSchema.parse
    > | null>(null),
    [history, setHistory] = useState<ReturnType<
      typeof ClassificationCrosswalkHistorySchema.parse
    > | null>(null),
    [isin, setIsin] = useState(''),
    [sector, setSector] = useState(''),
    [rationale, setRationale] = useState(''),
    [reviewBy, setReviewBy] = useState(''),
    [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const pending = useRef<{
    id: string;
    input: ReturnType<typeof ClassificationCrosswalkDraftSchema.parse>;
  } | null>(null);
  async function load(after?: string) {
    setList(
      ClassificationCrosswalkListSchema.parse(
        await request(
          '/ops/classification-crosswalks' + (after ? '?after=' + after : ''),
        ),
      ),
    );
  }
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Crosswalk request failed.');
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void run(() => load());
  }, []);
  async function save() {
    if (!source || source.observation.kind !== 'classification') return;
    const o = source.observation;
    if (!pending.current)
      pending.current = {
        id: selected?.id ?? crypto.randomUUID(),
        input: ClassificationCrosswalkDraftSchema.parse({
          requestId: crypto.randomUUID(),
          expectedVersion: selected?.version ?? 0,
          isin: o.isin,
          editionId: source.editionId,
          hash: source.hash,
          providerLabel: o.sector,
          effectiveOn: o.effectiveOn,
          applicationSector: sector,
          rationale,
          reviewBy,
        }),
      };
    const value = ClassificationCrosswalkRevisionSchema.parse(
      await request(
        '/ops/classification-crosswalks/' + pending.current.id,
        pending.current.input,
        'PUT',
      ),
    );
    pending.current = null;
    setSelected(value);
    setNotice(
      'Crosswalk draft saved. A different named reviewer must publish it.',
    );
    await load();
  }
  function changed() {
    pending.current = null;
    setNotice('');
  }
  return (
    <section
      className="panel source-workflow"
      aria-label="Classification crosswalk operations"
      aria-busy={busy}
    >
      <h2>Review application sector mappings</h2>
      <p>
        Preserve the source classification label. An application mapping is not
        an official four-tier NSE assignment. Saving a new version pauses its
        current publication until independent review.
      </p>
      {busy && <p role="status">Loading or saving crosswalk evidence…</p>}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <button disabled={busy} onClick={() => void run(() => load())}>
        Refresh crosswalk queue
      </button>
      <button
        disabled={busy}
        onClick={() => {
          setSelected(null);
          setSource(null);
          setCompany(null);
          setIsin('');
          setReason('');
          setSector('');
          setRationale('');
          setReviewBy('');
          setHistory(null);
          changed();
        }}
      >
        New crosswalk
      </button>
      {list && !list.items.length && <p>No crosswalks on this page.</p>}
      {list?.items.map((item) => (
        <article key={item.revision.id}>
          <button
            disabled={busy}
            onClick={() => {
              setSelected(item.revision);
              setCompany(null);
              setReason('');
              setSource(item.revision.source);
              setIsin(item.revision.input.isin);
              setSector(item.revision.input.applicationSector);
              setRationale(item.revision.input.rationale);
              setReviewBy(item.revision.input.reviewBy);
              setHistory(null);
              changed();
            }}
          >
            {item.revision.input.isin} → {item.revision.input.applicationSector}{' '}
            · version {item.revision.version}
          </button>
          <p>
            {item.state} · {item.reviewReasons.join(' ')}
          </p>
        </article>
      ))}
      {list?.next && (
        <button
          disabled={busy}
          onClick={() => void run(() => load(list.next!))}
        >
          Next crosswalk page
        </button>
      )}
      <label>
        Classification company ISIN
        <input
          disabled={busy}
          value={isin}
          onChange={(e) => {
            setIsin(e.target.value);
            setCompany(null);
            setSource(null);
            setSelected(null);
            setHistory(null);
            changed();
          }}
        />
      </label>
      <button
        disabled={busy}
        onClick={() =>
          void run(async () => {
            setCompany(
              EquityCompanySchema.parse(
                await request(
                  '/equities/' +
                    ClassificationCrosswalkDraftSchema.shape.isin.parse(isin),
                ),
              ),
            );
            setSource(null);
            changed();
          })
        }
      >
        Load admitted classifications
      </button>
      {company && (
        <label>
          Exact provider classification
          <select
            disabled={busy}
            value={
              source
                ? source.editionId + ':' + source.observation.sourceRow
                : ''
            }
            onChange={(e) => {
              setSource(
                company.records.find(
                  (r) =>
                    r.editionId + ':' + r.observation.sourceRow ===
                    e.target.value,
                ) ?? null,
              );
              changed();
            }}
          >
            <option value="">Choose retained classification</option>
            {company.records
              .filter((r) => r.observation.kind === 'classification')
              .map((r) => (
                <option
                  key={r.editionId + ':' + r.observation.sourceRow}
                  value={r.editionId + ':' + r.observation.sourceRow}
                >
                  {r.observation.kind === 'classification'
                    ? r.observation.sector
                    : ''}{' '}
                  · {r.observation.effectiveOn}
                </option>
              ))}
          </select>
        </label>
      )}
      {source && (
        <p>
          Source label{' '}
          {source.observation.kind === 'classification'
            ? source.observation.sector
            : ''}{' '}
          ·{' '}
          <a href={source.sourceUrl} target="_blank" rel="noreferrer">
            Official source
          </a>{' '}
          · retained hash {source.hash}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(save);
        }}
      >
        <fieldset disabled={busy}>
          <label>
            Application sector
            <input
              required
              maxLength={120}
              value={sector}
              onChange={(e) => {
                setSector(e.target.value);
                changed();
              }}
            />
          </label>
          <label>
            Mapping rationale
            <textarea
              required
              minLength={20}
              value={rationale}
              onChange={(e) => {
                setRationale(e.target.value);
                changed();
              }}
            />
          </label>
          <label>
            Crosswalk review by
            <input
              type="date"
              required
              value={reviewBy}
              onChange={(e) => {
                setReviewBy(e.target.value);
                changed();
              }}
            />
          </label>
          <button disabled={!source}>Save crosswalk draft</button>
        </fieldset>
      </form>
      {selected && (
        <>
          <label>
            Crosswalk independent review reason
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          {(['publish', 'withdraw'] as const).map((decision) => (
            <button
              key={decision}
              disabled={busy || reason.trim().length < 10}
              onClick={() =>
                void run(async () => {
                  await request(
                    `/ops/classification-crosswalks/${selected.id}/reviews`,
                    {
                      requestId: crypto.randomUUID(),
                      expectedVersion: selected.version,
                      decision,
                      reason,
                    },
                    'POST',
                  );
                  setNotice(
                    decision === 'publish'
                      ? 'Crosswalk published.'
                      : 'Crosswalk withdrawn.',
                  );
                  await load();
                })
              }
            >
              {decision === 'publish'
                ? 'Publish crosswalk'
                : 'Withdraw crosswalk'}
            </button>
          ))}
          <button
            disabled={busy}
            onClick={() =>
              void run(async () =>
                setHistory(
                  ClassificationCrosswalkHistorySchema.parse(
                    await request(
                      `/ops/classification-crosswalks/${selected.id}/history`,
                    ),
                  ),
                ),
              )
            }
          >
            Open crosswalk history
          </button>
          {history?.reviews.map((r, i) => (
            <p key={i}>
              Version {r.version} · {r.decision} · {r.reason}
            </p>
          ))}
        </>
      )}
    </section>
  );
}
export function CompanyClassification({ isin }: { isin: string }) {
  const [value, setValue] = useState<ReturnType<
      typeof ClassificationCrosswalkPublicSchema.parse
    > | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const generation = useRef(0);
  async function load() {
    const ticket = ++generation.current;
    setError('');
    setBusy(true);
    try {
      const result = ClassificationCrosswalkPublicSchema.parse(
        await json('/classifications/' + isin),
      );
      if (ticket === generation.current) setValue(result);
    } catch (e) {
      if (ticket === generation.current)
        setError(
          e instanceof Error ? e.message : 'Classifications unavailable.',
        );
    } finally {
      if (ticket === generation.current) setBusy(false);
    }
  }
  useEffect(() => {
    setValue(null);
    void load();
    return () => {
      generation.current++;
    };
  }, [isin]);
  return (
    <section
      className="source-workflow"
      aria-label="Reviewed application sectors"
      aria-busy={busy}
    >
      <h3>Reviewed application sectors</h3>
      {busy && <p role="status">Loading reviewed application sectors…</p>}
      {error && <p role="alert">{error}</p>}
      <button disabled={busy} onClick={() => void load()}>
        Refresh application sectors
      </button>
      {value?.conflict && (
        <p role="alert">
          Reviewed mappings disagree. No sector was selected automatically.
        </p>
      )}
      {value && !value.mappings.length && (
        <p>No currently admitted application mapping for this company.</p>
      )}
      {value?.mappings.map((r) => (
        <article key={r.id}>
          <p>
            {r.input.providerLabel} → {r.input.applicationSector}
          </p>
          <p>
            {r.input.rationale} · effective source {r.input.effectiveOn} ·
            review by {r.input.reviewBy}
          </p>
          <p>
            Application interpretation; original provider classification remains
            unchanged.
          </p>
          <a href={r.source.sourceUrl} target="_blank" rel="noreferrer">
            Classification source
          </a>
        </article>
      ))}
    </section>
  );
}
