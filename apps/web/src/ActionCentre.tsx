import { useEffect, useRef, useState } from 'react';
import {
  ActionCentreInputSchema,
  ActionCentreReceiptSchema,
  ActionCentreChoicesSchema,
  ActionCentreListSchema,
  EquityCompanySchema,
  calculateActionCentre,
  equityTraceWarnings,
  rupeesToGoalMinor,
  goalMinorToRupees,
  type ActionCentreInput,
  type ActionCentreReceipt,
} from '@fingent360/contracts';
import './action-centre.css';
class SignedOut extends Error {}
async function api(path: string, method = 'GET', body?: unknown) {
  const response = await fetch('/api/v1/account/action-centre' + path, {
    method,
    credentials: 'same-origin',
    signal: AbortSignal.timeout(15000),
    ...(body
      ? {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : {}),
  });
  if (response.status === 401)
    throw new SignedOut('Sign in to review your private comparisons.');
  const value: unknown = await response.json().catch(() => {
    throw Error('Unreadable response. Retry.');
  });
  if (!response.ok)
    throw Error(
      value && typeof value === 'object' && 'message' in value
        ? String(value.message)
        : 'Comparison unavailable.',
    );
  return value;
}
const money = (value: string) =>
  value.startsWith('-')
    ? '-₹' + goalMinorToRupees(value.slice(1))
    : '₹' + goalMinorToRupees(value);
function Comparison({ receipt }: { receipt: ActionCentreReceipt }) {
  const { result } = receipt;
  const rows = [
    [
      'Holding units',
      result.baseline.holdingQuantity,
      result.proposal.remainingQuantity,
    ],
    [
      'Holding acquisition cost',
      money(result.baseline.holdingCostMinor),
      money(result.proposal.remainingHoldingCostMinor),
    ],
    [
      'Available cash',
      money(result.baseline.availableCashMinor),
      money(result.proposal.afterCashMinor),
    ],
    [
      'Projected goal amount',
      money(result.baseline.projectedGoalMinor),
      money(result.proposal.projectedGoalMinor),
    ],
    [
      'Goal gap',
      money(result.baseline.goalGapMinor),
      money(result.proposal.goalGapMinor),
    ],
  ];
  return (
    <div>
      <p>
        <strong>{result.classification.replaceAll('-', ' ')}</strong> ·
        educational comparison only
      </p>
      <div className="action-table">
        <table>
          <caption>No action compared with your proposal</caption>
          <thead>
            <tr>
              <th>Measure</th>
              <th>No action</th>
              <th>Your proposal</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, before, after]) => (
              <tr key={label}>
                <th>{label}</th>
                <td>{before}</td>
                <td>{after}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Gross proceeds {money(result.proposal.grossProceedsMinor)} − fees{' '}
        {money(result.proposal.feeMinor)} − assumed tax{' '}
        {money(result.proposal.taxMinor)}. Net available proceeds{' '}
        {money(result.proposal.netProceedsMinor)}.
      </p>
      <p>
        Cost-based concentration: {result.proposal.concentrationBps} basis
        points. Proposed cost turnover: {result.proposal.turnoverBps} basis
        points. Stressed loss: {money(result.proposal.stressedLossMinor)}.
      </p>
      <ul aria-label="Policy constraints">
        {result.constraints.map((constraint) => (
          <li key={constraint.id}>
            <strong>
              {constraint.id}: {constraint.status.replaceAll('-', ' ')}
            </strong>
            <p>{constraint.description}</p>
          </li>
        ))}
      </ul>
      <details>
        <summary>Assumptions, sources and reconstruction</summary>
        <p>
          Price {receipt.input.price.rupees} INR · {receipt.input.price.asOf} ·{' '}
          {receipt.input.price.basis}. Tax/fee basis: {receipt.input.costs.note}
          .
        </p>
        <p>
          Policy {receipt.policy}; holdings edition {receipt.holdings.version},
          goal edition {receipt.goal.version}.
        </p>
        {receipt.equity?.records
          .filter(
            (record) => record.editionId === receipt.input.price.editionId,
          )
          .slice(0, 1)
          .map((record) => (
            <p key={record.editionId}>
              <a href={record.sourceUrl} target="_blank" rel="noreferrer">
                Published price source
              </a>{' '}
              · {record.hash}
            </p>
          ))}
        <ul>
          {result.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
const fields = [
  ['quantity', 'Proposed units to dispose'],
  ['price', 'Assumed price per unit (INR)'],
  ['fee', 'Total assumed fees (INR)'],
  ['tax', 'Total assumed tax (INR)'],
  ['cash', 'Available cash (INR)'],
  ['reserve', 'Emergency reserve (INR)'],
  ['capacity', 'Loss capacity (INR)'],
  ['needDays', 'Cash needed within days'],
  ['liquid', 'Assumed executable units'],
  ['settlement', 'Assumed settlement days'],
  ['concentration', 'Maximum concentration (basis points)'],
  ['turnover', 'Turnover budget (basis points)'],
  ['priorTurnover', 'Prior disposed acquisition cost (INR)'],
  ['cooldown', 'Cooldown days'],
  ['stress', 'Downside stress (basis points)'],
] as const;
export function ActionCentre() {
  const [choices, setChoices] = useState<ReturnType<
      typeof ActionCentreChoicesSchema.parse
    > | null>(null),
    [saved, setSaved] = useState<
      ReturnType<typeof ActionCentreListSchema.parse>['assessments']
    >([]);
  const [form, setForm] = useState<Record<string, string>>({
    asOf: new Date().toISOString().slice(0, 10),
    lastDisposal: '',
  });
  const [isin, setIsin] = useState(''),
    [goalId, setGoalId] = useState(''),
    [traceId, setTraceId] = useState('');
  const [priceChoice, setPriceChoice] = useState('manual'),
    [equity, setEquity] = useState<ReturnType<
      typeof EquityCompanySchema.parse
    > | null>(null);
  const [risk, setRisk] = useState(false),
    [obligations, setObligations] = useState(false),
    [earmark, setEarmark] = useState(false),
    [consent, setConsent] = useState(false);
  const [preview, setPreview] = useState<ActionCentreReceipt | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const pending = useRef<{ id: string; input: ActionCentreInput } | null>(null),
    alive = useRef(true);
  const clear = () => {
    setPreview(null);
    pending.current = null;
    setConsent(false);
    setNotice('');
  };
  const failure = (e: unknown) => {
    if (e instanceof SignedOut) {
      setChoices(null);
      setSaved([]);
      clear();
    }
    setError(
      e instanceof Error ? e.message : 'Unable to complete this request.',
    );
  };
  const load = async () => {
    setBusy(true);
    setError('');
    try {
      const [a, b] = await Promise.all([api('/choices'), api('')]);
      if (alive.current) {
        setChoices(ActionCentreChoicesSchema.parse(a));
        setSaved(ActionCentreListSchema.parse(b).assessments);
      }
    } catch (e) {
      if (alive.current) failure(e);
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
    };
  }, []);
  const fetchEquity = async () => {
    const response = await fetch('/api/v1/equities/' + isin, {
      signal: AbortSignal.timeout(15000),
    });
    if (response.status === 404) return null;
    if (!response.ok)
      throw Error('Company evidence unavailable. Retry before reviewing.');
    return EquityCompanySchema.parse(await response.json());
  };
  const review = async () => {
    if (!choices) return;
    setBusy(true);
    setError('');
    try {
      const company = await fetchEquity(),
        goal = choices.goals.find((item) => item.id === goalId);
      if (!goal) throw Error('Choose a saved goal.');
      const row = company?.records.find(
        (item) =>
          `${item.editionId}|${item.observation.effectiveOn}|${item.observation.kind === 'price' ? item.observation.close : ''}` ===
          priceChoice,
      );
      if (
        priceChoice !== 'manual' &&
        (!row || row.observation.kind !== 'price')
      )
        throw Error('Published price changed. Reload prices.');
      const input = ActionCentreInputSchema.parse({
        isin,
        holdingsVersion: choices.holdings.version,
        goalId,
        goalVersion: goal.version,
        traceId: traceId || null,
        quantity: form.quantity,
        price:
          row?.observation.kind === 'price'
            ? {
                rupees: row.observation.close,
                asOf: row.observation.effectiveOn,
                basis: 'published-equity-close',
                editionId: row.editionId,
                sourceHash: row.hash,
              }
            : {
                rupees: form.price,
                asOf: form.asOf,
                basis: 'user-assumption',
                editionId: null,
                sourceHash: null,
              },
        costs: {
          feeMinor: rupeesToGoalMinor(form.fee ?? ''),
          taxMinor: rupeesToGoalMinor(form.tax ?? ''),
          basis: 'user-assumption',
          note: form.note,
        },
        suitability: {
          availableCashMinor: rupeesToGoalMinor(form.cash ?? ''),
          emergencyReserveMinor: rupeesToGoalMinor(form.reserve ?? ''),
          lossCapacityMinor: rupeesToGoalMinor(form.capacity ?? ''),
          understandsRisk: risk,
          obligationsReviewed: obligations,
          needsMoneyWithinDays: Number(form.needDays),
        },
        limits: {
          executableQuantity: form.liquid,
          settlementDays: Number(form.settlement),
          maximumConcentrationBps: Number(form.concentration),
          turnoverBudgetBps: Number(form.turnover),
          previousTurnoverCostMinor: rupeesToGoalMinor(
            form.priorTurnover ?? '',
          ),
          lastDisposalOn: form.lastDisposal || null,
          cooldownDays: Number(form.cooldown),
          downsideStressBps: Number(form.stress),
          basis: 'user-assumption',
        },
        earmarkNetProceeds: earmark,
        storageConsent: true,
        educationalAcknowledgement: true,
      });
      const contextWarnings = [
        ...equityTraceWarnings(company),
        ...(traceId
          ? ['Linked trace is re-admitted by the server when saved.']
          : []),
      ];
      const trace = choices.traces.find((item) => item.id === traceId) ?? null;
      const now = new Date().toISOString(),
        id = crypto.randomUUID();
      const receipt = ActionCentreReceiptSchema.parse({
        id,
        createdAt: now,
        policy: 'proposed-disposal-education-v1',
        input,
        holdings: choices.holdings,
        goal,
        trace,
        equity: company,
        contextWarnings,
        result: calculateActionCentre(
          input,
          choices.holdings,
          goal,
          now,
          contextWarnings,
        ),
      });
      setPreview(receipt);
      pending.current = { id, input };
    } catch (e) {
      failure(e);
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    if (!pending.current || !consent) return;
    const current = pending.current;
    setBusy(true);
    try {
      const value = ActionCentreReceiptSchema.parse(
        await api('/' + current.id, 'PUT', current.input),
      );
      setPreview(value);
      setNotice('Educational comparison saved.');
      await load();
    } catch (e) {
      failure(e);
    } finally {
      setBusy(false);
    }
  };
  const edit = (key: string, value: string) => {
    setForm((old) => ({ ...old, [key]: value }));
    clear();
  };
  return (
    <section className="action-centre" aria-label="Educational action centre">
      <a href="#overview">Back to my overview</a>
      <h1>Compare before changing anything</h1>
      <p>
        Explore your own disposal idea against doing nothing. Enter the
        assumptions you want to examine; this does not recommend or execute a
        trade.
      </p>
      <nav>
        <a href="#holdings">Holdings</a> <a href="#my-goals">Goals</a>{' '}
        <a href="#impact-traces">Impact traces</a>
      </nav>
      {busy && <p role="status">Loading or saving comparison…</p>}
      {notice && <p role="status">{notice}</p>}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <a href="#account?next=action-centre">Sign in</a>{' '}
          <button onClick={() => void load()} disabled={busy}>
            Reload comparison records
          </button>
        </div>
      )}
      {choices && (
        <>
          <p>
            {choices.bundleGeneratedAt
              ? `On-device snapshot ${choices.bundleGeneratedAt}; comparisons remain local.`
              : 'Private account workspace.'}
          </p>
          {!choices.holdings.holdings.length && (
            <p>Add holdings to compare an actual saved position.</p>
          )}
          {!choices.goals.length && (
            <p>Create a goal before comparing its projected gap.</p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void review();
            }}
          >
            <fieldset disabled={busy}>
              <legend>Your proposal and assumptions</legend>
              <label>
                Saved holding
                <select
                  required
                  value={isin}
                  onChange={(e) => {
                    setIsin(e.target.value);
                    setEquity(null);
                    setPriceChoice('manual');
                    setTraceId('');
                    clear();
                  }}
                >
                  <option value="">Choose holding</option>
                  {choices.holdings.holdings.map((item) => (
                    <option key={item.isin}>{item.isin}</option>
                  ))}
                </select>
              </label>
              <label>
                Saved goal
                <select
                  required
                  value={goalId}
                  onChange={(e) => {
                    setGoalId(e.target.value);
                    setTraceId('');
                    clear();
                  }}
                >
                  <option value="">Choose goal</option>
                  {choices.goals.map((goal) => (
                    <option key={goal.id} value={goal.id}>
                      {goal.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Optional reviewed context
                <select
                  value={traceId}
                  onChange={(e) => {
                    setTraceId(e.target.value);
                    clear();
                  }}
                >
                  <option value="">No linked trace</option>
                  {choices.traces
                    .filter(
                      (item) =>
                        item.input.isin === isin && item.goal.id === goalId,
                    )
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.event.event?.editorial.title} · {item.createdAt}
                      </option>
                    ))}
                </select>
              </label>
              <button
                type="button"
                disabled={!isin}
                onClick={() => {
                  setBusy(true);
                  void fetchEquity()
                    .then((value) => {
                      setEquity(value);
                      setNotice(
                        value
                          ? 'Published prices loaded.'
                          : 'No published price available; enter an explicit assumption.',
                      );
                    })
                    .catch(failure)
                    .finally(() => setBusy(false));
                }}
              >
                Load published price choices
              </button>
              <label>
                Price basis
                <select
                  value={priceChoice}
                  onChange={(e) => {
                    setPriceChoice(e.target.value);
                    clear();
                  }}
                >
                  <option value="manual">My explicit assumed price</option>
                  {equity?.records
                    .filter((item) => item.observation.kind === 'price')
                    .map(
                      (item) =>
                        item.observation.kind === 'price' && (
                          <option
                            key={`${item.editionId}-${item.observation.effectiveOn}`}
                            value={`${item.editionId}|${item.observation.effectiveOn}|${item.observation.close}`}
                          >
                            ₹{item.observation.close} ·{' '}
                            {item.observation.effectiveOn} ·{' '}
                            {item.editionId.slice(0, 8)}
                          </option>
                        ),
                    )}
                </select>
              </label>
              <div className="action-inputs">
                {fields
                  .filter(
                    ([key]) => key !== 'price' || priceChoice === 'manual',
                  )
                  .map(([key, label]) => (
                    <label key={key}>
                      {label}
                      <input
                        required
                        inputMode="decimal"
                        value={form[key] ?? ''}
                        onChange={(e) => edit(key, e.target.value)}
                      />
                    </label>
                  ))}
              </div>
              {priceChoice === 'manual' && (
                <label>
                  Assumed price date
                  <input
                    type="date"
                    required
                    value={form.asOf}
                    onChange={(e) => edit('asOf', e.target.value)}
                  />
                </label>
              )}
              <label>
                Last actual disposal date (optional)
                <input
                  type="date"
                  value={form.lastDisposal}
                  onChange={(e) => edit('lastDisposal', e.target.value)}
                />
              </label>
              <label>
                Fee and tax assumption explanation
                <textarea
                  required
                  minLength={5}
                  maxLength={500}
                  value={form.note ?? ''}
                  onChange={(e) => edit('note', e.target.value)}
                />
              </label>
              <p>
                10,000 basis points = 100%. Limits are your explicit scenario
                assumptions; zero means zero tolerance. No tax rate or market
                liquidity is inferred.
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={risk}
                  onChange={(e) => {
                    setRisk(e.target.checked);
                    clear();
                  }}
                />
                I understand price and investment uncertainty.
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={obligations}
                  onChange={(e) => {
                    setObligations(e.target.checked);
                    clear();
                  }}
                />
                I have reviewed my financial obligations.
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={earmark}
                  onChange={(e) => {
                    setEarmark(e.target.checked);
                    clear();
                  }}
                />
                Hypothetically earmark net proceeds to this goal once.
              </label>
              <button disabled={!isin || !goalId}>
                Review educational comparison
              </button>
            </fieldset>
          </form>
        </>
      )}
      {preview && (
        <section aria-label="Educational comparison review">
          <h2>Review your comparison</h2>
          <Comparison receipt={preview} />
          <label>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            I understand this is educational and agree to store these private
            assumptions.
          </label>
          <button disabled={!consent || busy} onClick={() => void save()}>
            Save educational comparison
          </button>
        </section>
      )}
      <h2>Saved comparisons</h2>
      {!saved.length && <p>No saved comparisons yet.</p>}
      {saved.map(({ receipt, reviewReasons }) => (
        <article key={receipt.id}>
          <h3>
            {receipt.goal.name} · {receipt.createdAt}
          </h3>
          {reviewReasons.length > 0 && (
            <div role="note">
              <strong>Review needed</strong>
              <ul>
                {reviewReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
          <details>
            <summary>Open saved comparison</summary>
            <Comparison receipt={receipt} />
          </details>
          <button
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void api('/' + receipt.id, 'DELETE')
                .then(() => {
                  if (preview?.id === receipt.id) clear();
                  return load();
                })
                .catch(failure)
                .finally(() => setBusy(false));
            }}
          >
            Delete comparison for {receipt.goal.name}
          </button>
        </article>
      ))}
    </section>
  );
}
