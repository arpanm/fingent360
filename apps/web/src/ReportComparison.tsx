import { useEffect, useRef, useState } from 'react';
import {
  ReportComparisonOptionsSchema,
  ReportComparisonQuerySchema,
  ReportComparisonSchema,
  type ReportComparison as Comparison,
  type ReportComparisonField,
  type ReportComparisonReference,
  type ReportComparisonRow,
} from '@fingent360/contracts';
import { AccountGate, type AccountDestination } from './AccountGate';
import { go } from './navigation';
import './report-comparison.css';

const labels: Record<ReportComparisonField['field'], string> = {
  name: 'Name',
  type: 'Goal type',
  version: 'Recorded revision',
  target: 'Target',
  saved: 'Entered savings',
  monthly: 'Monthly contribution',
  months: 'Horizon in months',
  projected: 'Contribution-only projection',
  gap: 'Contribution-only gap',
  quantity: 'Quantity',
  cost: 'Recorded acquisition cost',
  goalVersion: 'Bound goal revision',
  holdingsVersion: 'Bound holdings revision',
  review: 'Review context at capture',
  sourceId: 'Bound source ID',
  sourceVersion: 'Bound source version',
  sourceHash: 'Bound source hash',
  sourceName: 'Bound source name',
  sourcePublishedAt: 'Bound source publication time',
  sourceRetrievedAt: 'Bound source retrieval time',
  targetKind: 'Target kind',
  targetId: 'Target ID',
  targetVersion: 'Bound target revision',
  targetLabel: 'Target label',
  note: 'Personal note',
  savedAt: 'Connection saved at',
  sourceAtCapture: 'Source observed at capture',
  targetAtCapture: 'Target observed at capture',
};
function value(
  raw: string | null,
  unit: ReportComparisonField['unit'],
  signed = false,
): string {
  if (raw === null) return 'Not present';
  if (unit === 'text') return raw;
  const amount = BigInt(raw),
    absolute = amount < 0n ? -amount : amount;
  const sign = amount < 0n ? '−' : signed && amount > 0n ? '+' : '';
  if (unit === 'integer') return `${sign}${absolute}`;
  const scale = unit === 'paise' ? 100n : 1000000n;
  const fraction = (absolute % scale)
    .toString()
    .padStart(unit === 'paise' ? 2 : 6, '0');
  return `${unit === 'paise' ? 'INR ' : ''}${sign}${absolute / scale}.${fraction}`;
}
function Fields({ fields }: { fields: ReportComparisonField[] }) {
  return (
    <div className="comparison-fields">
      {fields.map((f) => (
        <div className="comparison-field" key={f.field}>
          <h4>{labels[f.field]}</h4>
          <dl>
            <div>
              <dt>Earlier</dt>
              <dd>{value(f.before, f.unit)}</dd>
            </div>
            <div>
              <dt>Later</dt>
              <dd>{value(f.after, f.unit)}</dd>
            </div>
            <div>
              <dt>Difference</dt>
              <dd>
                {f.before === null || f.after === null
                  ? 'No shared baseline'
                  : f.unit === 'text'
                    ? f.before === f.after
                      ? 'Unchanged'
                      : 'Changed'
                    : value(f.difference, f.unit, true)}
              </dd>
            </div>
          </dl>
        </div>
      ))}
    </div>
  );
}
function Rows({ title, rows }: { title: string; rows: ReportComparisonRow[] }) {
  return (
    <section aria-label={title} className="comparison-category">
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <p>No records captured in this category.</p>
      ) : (
        rows.map((r) => (
          <details key={r.key} open={r.status !== 'unchanged'}>
            <summary>
              {r.label} · {r.status}
            </summary>
            <Fields fields={r.fields} />
          </details>
        ))
      )}
    </section>
  );
}
function Baseline({
  report,
  direction,
}: {
  report: ReportComparisonReference;
  direction: string;
}) {
  return (
    <article className="panel">
      <h3>
        {direction}: {report.label}
      </h3>
      <p>
        Captured <time>{report.capturedAt}</time>
      </p>
      <p>
        Issued <time>{report.issuedAt}</time>
      </p>
      <p>
        {report.policy} · Holdings revision {report.holdingsVersion} ·
        Allocation revision {report.allocationVersion}
      </p>
      <a href={`#reports?selected=${report.id}`}>
        Open {direction.toLowerCase()} original
      </a>
    </article>
  );
}
export function ReportComparison() {
  const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
  const initial = ReportComparisonQuerySchema.safeParse(
    new Set([...params.keys()]).size === params.size
      ? Object.fromEntries(params)
      : {},
  );
  const deepLink = useRef(initial.success ? initial.data : null);
  const [first, setFirst] = useState(initial.success ? initial.data.first : '');
  const [second, setSecond] = useState(
    initial.success ? initial.data.second : '',
  );
  const selectedIds = useRef({ first, second });
  const [options, setOptions] = useState<ReportComparisonReference[]>([]);
  const [loaded, setLoaded] = useState(false),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    params.size && !initial.success
      ? 'Choose two different valid report IDs.'
      : '',
  );
  const [optionError, setOptionError] = useState(''),
    [guest, setGuest] = useState(false);
  const [reviewing, setReviewing] = useState(false),
    [result, setResult] = useState<Comparison | null>(null);
  const live = useRef(false),
    denied = useRef(false),
    optionGeneration = useRef(0),
    comparisonGeneration = useRef(0);
  const optionRequest = useRef<AbortController | null>(null),
    comparisonRequest = useRef<AbortController | null>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  function signOut() {
    if (!live.current) return;
    denied.current = true;
    optionGeneration.current++;
    comparisonGeneration.current++;
    optionRequest.current?.abort();
    comparisonRequest.current?.abort();
    deepLink.current = null;
    selectedIds.current = { first: '', second: '' };
    setFirst('');
    setSecond('');
    setOptions([]);
    setResult(null);
    setReviewing(false);
    setError('');
    setOptionError('');
    setLoading(false);
    setBusy(false);
    setGuest(true);
  }
  async function read(path: string, signal: AbortSignal) {
    const response = await fetch(`/api/v1/account/report-comparison${path}`, {
      credentials: 'include',
      signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
    });
    // Authentication denial dominates every ticket, including superseded requests.
    if (response.status === 401) {
      signOut();
      throw Error('Sign in to compare your private issued reports.');
    }
    const data: unknown = await response.json();
    if (!response.ok)
      throw Error(
        typeof data === 'object' && data && 'message' in data
          ? String(data.message)
          : 'Reports are unavailable. Try again.',
      );
    return data;
  }
  async function loadOptions() {
    if (denied.current) return;
    optionRequest.current?.abort();
    const controller = new AbortController();
    optionRequest.current = controller;
    const ticket = ++optionGeneration.current;
    setLoading(true);
    setOptionError('');
    try {
      const parsed = ReportComparisonOptionsSchema.safeParse(
        await read('/options', controller.signal),
      );
      if (!parsed.success)
        throw Error('The report choices are unreadable. Retry loading them.');
      const data = parsed.data;
      if (
        !live.current ||
        denied.current ||
        ticket !== optionGeneration.current
      )
        return;
      setOptions(data.reports);
      setLoaded(true);
      if (
        [selectedIds.current.first, selectedIds.current.second].some(
          (id) => id && !data.reports.some((r) => r.id === id),
        )
      ) {
        comparisonGeneration.current++;
        comparisonRequest.current?.abort();
        setResult(null);
        setBusy(false);
        setReviewing(false);
        setError(
          'One or both selected reports are unavailable. Choose two owned issued reports.',
        );
      }
    } catch (e) {
      if (
        !live.current ||
        denied.current ||
        ticket !== optionGeneration.current
      )
        return;
      setOptions([]);
      setLoaded(false);
      setOptionError(
        e instanceof Error
          ? e.message
          : 'Unable to read report choices. Try again.',
      );
    } finally {
      if (live.current && ticket === optionGeneration.current)
        setLoading(false);
    }
  }
  async function compare(a: string, b: string) {
    if (denied.current) return;
    comparisonRequest.current?.abort();
    const controller = new AbortController();
    comparisonRequest.current = controller;
    const ticket = ++comparisonGeneration.current;
    setResult(null);
    setError('');
    setReviewing(false);
    setBusy(true);
    try {
      const parsed = ReportComparisonSchema.safeParse(
        await read(
          `?first=${encodeURIComponent(a)}&second=${encodeURIComponent(b)}`,
          controller.signal,
        ),
      );
      if (!parsed.success)
        throw Error(
          'The comparison is unreadable. Retry reading the originals.',
        );
      const data = parsed.data;
      if (
        !live.current ||
        denied.current ||
        ticket !== comparisonGeneration.current
      )
        return;
      if (
        ![data.earlier.id, data.later.id].includes(a) ||
        ![data.earlier.id, data.later.id].includes(b) ||
        a === b
      )
        throw Error('The response does not match the selected reports. Retry.');
      setResult(data);
    } catch (e) {
      if (
        !live.current ||
        denied.current ||
        ticket !== comparisonGeneration.current
      )
        return;
      setResult(null);
      setError(
        e instanceof Error
          ? e.message
          : 'Unable to compare these reports. Try again.',
      );
    } finally {
      if (live.current && ticket === comparisonGeneration.current)
        setBusy(false);
    }
  }
  function select(which: 'first' | 'second', id: string) {
    comparisonGeneration.current++;
    comparisonRequest.current?.abort();
    setBusy(false);
    setResult(null);
    setReviewing(false);
    setError('');
    selectedIds.current = { ...selectedIds.current, [which]: id };
    if (which === 'first') setFirst(id);
    else setSecond(id);
  }
  function refresh() {
    void loadOptions();
    if (first && second && first !== second) void compare(first, second);
  }
  useEffect(() => {
    live.current = true;
    void loadOptions();
    if (deepLink.current)
      void compare(deepLink.current.first, deepLink.current.second);
    return () => {
      live.current = false;
      optionGeneration.current++;
      comparisonGeneration.current++;
      optionRequest.current?.abort();
      comparisonRequest.current?.abort();
    };
    // This instance is keyed by the complete route. No response survives a route change.
  }, []);
  useEffect(() => {
    if (result) resultHeading.current?.focus();
  }, [result]);
  if (guest)
    return (
      <AccountGate
        next={
          (initial.success
            ? `report-compare?first=${initial.data.first}&second=${initial.data.second}`
            : 'report-compare') as AccountDestination
        }
        title="Sign in to compare issued reports"
        description="Comparisons read only your own issued saved-record reviews."
      />
    );
  const selected = [first, second].map((id) =>
    options.find((r) => r.id === id),
  );
  const valid = first !== second && selected.every(Boolean);
  const route =
    first && second
      ? `report-compare?first=${first}&second=${second}`
      : 'report-compare';
  return (
    <section
      className="report-comparison"
      aria-label="Compare issued reports"
      data-feedback-private
    >
      <p className="page-kicker">Your saved records</p>
      <h1>Compare issued reports</h1>
      <p>
        See how captured inputs changed. Recorded acquisition cost is not market
        value, a return, a gain or a loss. Projections add entered savings and
        contributions only, with no growth, inflation, tax, fees or withdrawals
        assumed. Allocation costs are not added to entered goal savings.
      </p>
      <nav className="page-actions" aria-label="Report comparison navigation">
        <a href="#reports">Saved record reviews</a>
        <a href="#more">More</a>
        <button onClick={refresh} disabled={loading && busy}>
          Refresh comparison
        </button>
      </nav>
      {loading && <p role="status">Loading issued report choices…</p>}
      {optionError && (
        <div role="alert">
          <p>{optionError}</p>
          <button onClick={() => void loadOptions()}>
            Retry report choices
          </button>
        </div>
      )}
      {loaded && options.length < 2 && (
        <p role="status">
          {options.length === 0
            ? 'No issued reports yet.'
            : 'One issued report is available.'}{' '}
          Create and prepare two saved record reviews to compare.
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) {
            setResult(null);
            setReviewing(true);
            setError('');
          }
        }}
      >
        <div className="comparison-selectors">
          {(['first', 'second'] as const).map((which) => (
            <div key={which}>
              <label htmlFor={`comparison-${which}`}>
                {which === 'first' ? 'First report' : 'Second report'}
              </label>
              <select
                id={`comparison-${which}`}
                value={which === 'first' ? first : second}
                onChange={(e) => select(which, e.target.value)}
                disabled={!loaded}
              >
                <option value="">Choose an issued report</option>
                {(which === 'first' ? first : second) &&
                  !options.some(
                    (r) => r.id === (which === 'first' ? first : second),
                  ) && (
                    <option value={which === 'first' ? first : second}>
                      Selected report unavailable
                    </option>
                  )}
                {options.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label} · {r.capturedAt}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        {first && first === second && (
          <p role="alert">Choose two different issued reports.</p>
        )}
        <button disabled={!valid || busy || loading}>Review comparison</button>
      </form>
      {reviewing && valid && (
        <section className="panel" aria-label="Review selected reports">
          <h2>Review the two baselines</h2>
          <p>
            Direction is older capture to newer capture, even when selected in
            reverse. Equal capture times use issue time, then report ID.
          </p>
          {selected.map((r) => (
            <p key={r!.id}>
              {r!.label} · Captured {r!.capturedAt} · Issued {r!.issuedAt} ·{' '}
              {r!.policy}
            </p>
          ))}
          <div className="page-actions">
            <button
              onClick={() => {
                if (window.location.hash === `#${route}`)
                  void compare(first, second);
                else go(route);
              }}
            >
              Compare captured records
            </button>
            <button onClick={() => setReviewing(false)}>
              Cancel comparison
            </button>
          </div>
        </section>
      )}
      {busy && <p role="status">Reading both owned originals…</p>}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button
            disabled={!first || !second || first === second}
            onClick={() => void compare(first, second)}
          >
            Retry comparison
          </button>
        </div>
      )}
      {result && (
        <section aria-label="Issued report comparison">
          <h2 ref={resultHeading} tabIndex={-1}>
            Changes between captured records
          </h2>
          <p>
            Availability checked {result.checkedAt}. This dated comparison does
            not describe your current account records or current source
            publication status. Refresh to check the originals again.
          </p>
          <div className="comparison-baselines">
            <Baseline report={result.earlier} direction="Earlier" />
            <Baseline report={result.later} direction="Later" />
          </div>
          {result.tiedCaptureTimes && (
            <p role="note">
              Capture times are equal. Issue time, then report ID determines the
              displayed order; this does not establish which inputs changed
              first.
            </p>
          )}
          <section aria-label="Recorded cost total">
            <h3>Recorded cost total</h3>
            <Fields fields={[result.recordedCost]} />
          </section>
          <Rows
            title="Goal inputs and contribution-only projections"
            rows={result.goals}
          />
          <Rows title="Recorded holdings" rows={result.holdings} />
          <Rows
            title="Captured goal allocation bindings"
            rows={result.allocations}
          />
          <section aria-label="Research capture availability">
            <h3>Dated personal research context</h3>
            <p>
              Earlier research:{' '}
              {result.research.earlierCapturedAt ?? 'Not captured in v1'}. Later
              research:{' '}
              {result.research.laterCapturedAt ?? 'Not captured in v1'}.
            </p>
            <p>
              Personal notes are not verified impact or advice. These dated
              bindings do not establish a source's current availability.
            </p>
            {result.research.comparable ? (
              <Rows
                title="Captured research connection changes"
                rows={result.research.rows}
              />
            ) : (
              <p>
                Research comparison is unavailable unless both originals
                captured research. No additions or removals are inferred.
              </p>
            )}
          </section>
        </section>
      )}
    </section>
  );
}
