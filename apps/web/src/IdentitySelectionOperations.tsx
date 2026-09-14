import { useEffect, useRef, useState } from 'react';
import {
  SecurityDirectorySchema,
  IdentitySelectionInputSchema,
  IdentitySelectionPlanSchema,
  IdentitySelectionPublicSchema,
  IdentitySelectionReceiptSchema,
  IdentitySelectionPlansSchema,
  SecurityEvidenceSchema,
  selectionMatchesProvider,
  PublicationProposalSchema,
} from '@fingent360/contracts';
import { json, RequestError } from './net';
import { useDraftGuard } from './useDraftGuard';
import './event-lineage.css';
type Plan = ReturnType<typeof IdentitySelectionPlanSchema.parse>;
export function IdentitySelectionOperations({
  request,
  named,
}: {
  request: typeof json;
  named: boolean;
}) {
  const [items, setItems] = useState<
    ReturnType<typeof SecurityDirectorySchema.parse>['items']
  >([]);
  const [isin, setIsin] = useState(''),
    [figi, setFigi] = useState(''),
    [rationale, setRationale] = useState('');
  const [current, setCurrent] = useState<ReturnType<
    typeof IdentitySelectionPublicSchema.parse
  > | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null),
    [plans, setPlans] = useState<ReturnType<
      typeof IdentitySelectionPlansSchema.parse
    > | null>(null);
  const [contextReady, setContextReady] = useState(false);
  const [review, setReview] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [status, setStatus] = useState('');
  const [evidence, setEvidence] = useState<ReturnType<
    typeof SecurityEvidenceSchema.parse
  > | null>(null);
  const [action, setAction] = useState<'select' | 'withdraw'>('select');
  const pending = useRef<{
    id: string;
    input: ReturnType<typeof IdentitySelectionInputSchema.parse>;
  } | null>(null);
  const proposal = useRef<string | null>(null),
    live = useRef(false);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  useDraftGuard(
    !!rationale || busy,
    'Leave this identity selection draft? Unsaved changes will be lost.',
  );
  async function run(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (failure) {
      if (live.current) {
        if (
          failure instanceof RequestError &&
          [400, 409].includes(failure.status)
        )
          pending.current = null;
        if (failure instanceof RequestError && failure.status === 409) {
          setContextReady(false);
          setReview(false);
        }
        setError(
          (failure instanceof Error
            ? failure.message
            : 'Selection request unavailable. Retry.') +
            (failure instanceof RequestError && failure.status === 409
              ? ' Discard the edited draft, then reload current selection before authoring a new plan.'
              : ''),
        );
      }
    } finally {
      if (live.current) setBusy(false);
    }
  }
  async function load() {
    const value = SecurityDirectorySchema.parse(await request('/securities'));
    if (live.current) setItems(value.items);
  }
  async function choose(value: string) {
    setContextReady(false);
    if (!value) {
      setIsin('');
      setCurrent(null);
      setFigi('');
      setReview(false);
      return;
    }
    const [directoryBody, selectionBody] = await Promise.all([
      request('/securities'),
      request('/securities/' + value + '/selection'),
    ]);
    const directory = SecurityDirectorySchema.parse(directoryBody);
    const selected = IdentitySelectionPublicSchema.parse(selectionBody);
    const provider = directory.items.find((item) => item.isin === value);
    if (
      !provider ||
      selected.isin !== value ||
      (selected.state === 'current' &&
        (!selected.receipt ||
          !selectionMatchesProvider(selected.receipt, provider)))
    )
      throw Error(
        'Provider and reviewed selection could not be read together. Reload current selection.',
      );
    if (!live.current) return;
    setItems(directory.items);
    setIsin(value);
    setCurrent(selected);
    setContextReady(true);
    setFigi('');
    setRationale('');
    setReview(false);
    setPlan(null);
    setAction('select');
    setEvidence(null);
  }
  const identity = items.find((item) => item.isin === isin);
  function draft() {
    if (!contextReady)
      throw Error('Reload the current selection before authoring.');
    const retained = action === 'withdraw' ? current?.receipt : null;
    return IdentitySelectionInputSchema.parse({
      isin,
      action,
      expectedVersion: current?.receipt?.version ?? 0,
      providerVersion: retained?.providerVersion ?? identity?.version,
      providerHash: retained?.providerHash ?? identity?.sourceHash,
      figi: retained?.candidate.figi ?? figi,
      rationale,
    });
  }
  async function save() {
    const intent = pending.current ?? {
      id: crypto.randomUUID(),
      input: draft(),
    };
    pending.current = intent;
    const result = IdentitySelectionPlanSchema.parse(
      await request(
        '/ops/identity-selections/' + intent.id,
        intent.input,
        'PUT',
      ),
    );
    if (!live.current) return;
    pending.current = null;
    proposal.current = null;
    setPlan(result);
    setRationale('');
    setReview(false);
    setStatus(
      'Immutable selection plan saved. Provider and public selection remain unchanged.',
    );
  }
  async function decide() {
    if (!plan) return;
    const body = {
      fingerprint: plan.fingerprint,
      status: plan.input.action === 'select' ? 'approved' : 'withdrawn',
    };
    if (named) {
      const id = proposal.current ?? crypto.randomUUID();
      proposal.current = id;
      const result = PublicationProposalSchema.parse(
        await request(
          '/ops/proposals/' + id,
          { kind: 'identity-selection', target: plan.id, body },
          'PUT',
        ),
      );
      if (live.current)
        setStatus(
          `Saved proposal ${result.id}: ${result.state}. A different named identity reviews it in Named operators. Rejected proposals require a new request.`,
        );
    } else {
      const receipt = IdentitySelectionReceiptSchema.parse(
        await request(
          '/ops/identity-selections/' + plan.id + '/review',
          body,
          'POST',
        ),
      );
      if (live.current) {
        setStatus(
          `Saved historical selection receipt: ${receipt.status}, revision ${receipt.version}. Reload current selection before further edits.`,
        );
        setCurrent(null);
        setContextReady(false);
      }
    }
  }
  return (
    <section className="event-lineage" aria-label="Identity selection review">
      <h2>Review candidate identity selections</h2>
      <p>
        Choose only an actual stored candidate. This is editorial judgement, not
        verified corporate identity. No provider result, holding or valuation is
        rewritten.
      </p>
      {error && <p role="alert">{error}</p>}
      {status && <p role="status">{status}</p>}
      {busy && <p role="status">Working on selection…</p>}
      <button
        disabled={busy || !!pending.current || !!rationale}
        onClick={() => void run(load)}
      >
        Load stored candidate identities
      </button>
      <label htmlFor="selection-isin">Stored ISIN</label>
      <select
        id="selection-isin"
        disabled={busy || !!pending.current || !!rationale}
        value={isin}
        onChange={(event) => void run(() => choose(event.target.value))}
      >
        <option value="">Choose an identity</option>
        {items.map((item) => (
          <option key={item.isin} value={item.isin}>
            {item.isin} · provider {item.resolution}
          </option>
        ))}
      </select>
      {isin && (
        <button
          disabled={busy || !!pending.current || !!rationale}
          onClick={() => void run(() => choose(isin))}
        >
          Reload current selection
        </button>
      )}
      {identity && current && (
        <fieldset disabled={busy || !!pending.current}>
          <legend>Compare actual retained candidates</legend>
          <p>
            Provider revision {identity.version}: {identity.resolution}.{' '}
            {identity.candidates.length} candidates.
          </p>
          {identity.candidates.map((candidate) => (
            <label key={candidate.figi}>
              <input
                type="radio"
                name="selection-candidate"
                value={candidate.figi}
                checked={figi === candidate.figi && action === 'select'}
                onChange={() => {
                  setFigi(candidate.figi);
                  setAction('select');
                  setReview(false);
                }}
              />
              {candidate.name} · {candidate.figi} · {candidate.ticker} ·{' '}
              {candidate.exchCode}
            </label>
          ))}
          {!identity.candidates.length && (
            <p>No candidate can be invented for this unresolved edition.</p>
          )}
          <button
            onClick={() =>
              void run(async () => {
                const raw = SecurityEvidenceSchema.parse(
                  await request(
                    '/securities/' +
                      identity.isin +
                      '/evidence/' +
                      identity.sourceHash,
                  ),
                );
                if (live.current) setEvidence(raw);
              })
            }
          >
            Read retained provider response
          </button>
          {evidence && (
            <details open>
              <summary>Actual retained provider response</summary>
              <pre>{evidence.body}</pre>
            </details>
          )}
          <details>
            <summary>
              Complete retained provider candidates and provenance
            </summary>
            <pre>{JSON.stringify(identity, null, 2)}</pre>
          </details>
          {current.receipt?.status === 'approved' && (
            <button
              onClick={() => {
                setAction('withdraw');
                setReview(false);
              }}
            >
              Prepare withdrawal of current selection
            </button>
          )}
          <p>
            Action: {action}. Current selection: {current.state}.
          </p>
          <label htmlFor="selection-rationale">
            Editorial selection rationale
          </label>
          <textarea
            id="selection-rationale"
            value={rationale}
            onChange={(event) => {
              setRationale(event.target.value);
              setReview(false);
            }}
          />
          {review ? (
            <>
              <p>
                Review exact provider revision, chosen candidate and judgement
                above. Nothing is externally verified.
              </p>
              <button disabled={!contextReady} onClick={() => void run(save)}>
                Save selection plan
              </button>
              <button onClick={() => setReview(false)}>
                Back to candidate review
              </button>
            </>
          ) : (
            <button
              disabled={!contextReady}
              onClick={() => {
                try {
                  draft();
                  setReview(true);
                } catch {
                  setError(
                    'Choose an actual candidate and enter at least 20 characters explaining the editorial judgement.',
                  );
                }
              }}
            >
              Review selection plan
            </button>
          )}
          <button
            onClick={() => {
              if (
                !rationale ||
                window.confirm('Discard this unsaved selection draft?')
              ) {
                setRationale('');
                setReview(false);
              }
            }}
          >
            Discard selection draft
          </button>
        </fieldset>
      )}
      {pending.current && (
        <button disabled={busy} onClick={() => void run(save)}>
          Retry same selection save
        </button>
      )}
      {plan && (
        <section aria-label="Saved identity selection plan">
          <h3>
            {plan.candidate.name} · {plan.input.action}
          </h3>
          <p>{plan.input.rationale}</p>
          <p>
            Provider revision {plan.provider.version},{' '}
            {plan.provider.resolution}; selection base{' '}
            {plan.input.expectedVersion}.
          </p>
          <pre>{JSON.stringify(plan, null, 2)}</pre>
          <button disabled={busy} onClick={() => void run(decide)}>
            {named
              ? 'Submit selection for independent approval'
              : 'Apply selection in bootstrap mode'}
          </button>
        </section>
      )}
      <button
        disabled={busy || !!rationale || !!pending.current}
        onClick={() =>
          void run(async () => {
            const result = IdentitySelectionPlansSchema.parse(
              await request('/ops/identity-selections'),
            );
            if (live.current) setPlans(result);
          })
        }
      >
        Load selection plans
      </button>
      {plans?.plans.map((item) => (
        <button
          key={item.id}
          disabled={busy || !!rationale}
          onClick={() => {
            setPlan(item);
            proposal.current = null;
            setStatus(
              'Historical plan opened. A new proposal request is explicit; applying rechecks current provider and selection.',
            );
          }}
        >
          Open selection plan {item.id}
        </button>
      ))}
      {plans?.next && (
        <button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const value = IdentitySelectionPlansSchema.parse(
                await request('/ops/identity-selections?after=' + plans.next),
              );
              if (live.current) setPlans(value);
            })
          }
        >
          Older selection plans
        </button>
      )}
    </section>
  );
}
