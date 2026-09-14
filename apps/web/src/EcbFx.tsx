import { useEffect, useId, useRef, useState } from 'react';
import {
  ECB_FX_HOME,
  ECB_FX_TERMS,
  EcbFxPublicSchema,
  EcbFxHistorySchema,
  EcbFxEditionSchema,
  EcbFxEvidenceSchema,
  ecbFxLatest,
  type EcbFxEdition,
  type EcbFxPublic,
} from '@fingent360/contracts';
import { json } from './net';
import { returnTo, restorePosition } from './navigation';
import './ecb-fx.css';

const dayLabel = (value: string) =>
  new Date(value + 'T12:00:00Z').toLocaleDateString(undefined, {
    timeZone: 'UTC',
    dateStyle: 'medium',
  });
const instantLabel = (value: string | null) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'Not recorded';

export function EcbFxEditionView({
  edition,
  sourceDetails = false,
}: {
  edition: EcbFxEdition;
  sourceDetails?: boolean;
}) {
  const monthId = useId();
  const months = [
    ...new Set(edition.observations.map((row) => row.date.slice(0, 7))),
  ]
    .sort()
    .reverse();
  const [choice, setChoice] = useState<{
    edition: number;
    month: string;
  } | null>(null);
  const month =
    choice?.edition === edition.edition &&
    (choice.month === 'all' || months.includes(choice.month))
      ? choice.month
      : months[0]!;
  const rows = edition.observations
    .filter((row) => month === 'all' || row.date.startsWith(month + '-'))
    .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <section
      className="fx-edition"
      aria-label={`FX edition ${edition.edition}`}
    >
      <p>
        Edition {edition.edition} · captured{' '}
        <time dateTime={edition.retrievedAt}>
          {instantLabel(edition.retrievedAt)}
        </time>
      </p>
      <p>
        Reported dates:{' '}
        <time dateTime={edition.windowStart}>
          {dayLabel(edition.windowStart)}
        </time>{' '}
        to{' '}
        <time dateTime={edition.windowEnd}>{dayLabel(edition.windowEnd)}</time>.
        Unreported days stay blank; rates are never carried forward.
      </p>
      <div className="fx-period-control">
        <label htmlFor={monthId}>Observation month</label>
        <select
          id={monthId}
          value={month}
          onChange={(event) =>
            setChoice({ edition: edition.edition, month: event.target.value })
          }
        >
          {months.map((value) => (
            <option key={value} value={value}>
              {new Date(value + '-01T12:00:00Z').toLocaleDateString(undefined, {
                timeZone: 'UTC',
                month: 'long',
                year: 'numeric',
              })}
            </option>
          ))}
          <option value="all">Full captured window</option>
        </select>
      </div>
      <div
        className="fx-table-scroll"
        role="region"
        aria-label="Scrollable reference-rate observations"
        tabIndex={0}
      >
        <table className="data-table">
          <caption>ECB inputs and separately calculated cross-rate</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">
                USD per EUR
                <br />
                <small>ECB input</small>
              </th>
              <th scope="col">
                INR per EUR
                <br />
                <small>ECB input</small>
              </th>
              <th scope="col">
                INR per USD
                <br />
                <small>Fingent360 calculation</small>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.date}>
                <th scope="row">
                  <time dateTime={row.date}>{dayLabel(row.date)}</time>
                </th>
                <td>{row.usdPerEur}</td>
                <td>{row.inrPerEur}</td>
                <td>{row.derivedInrPerUsd.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="fx-detail">
        <summary>What changed in this capture?</summary>
        <p>
          {edition.comparison.previousEdition === null
            ? 'This is the first captured edition.'
            : `Compared with captured edition ${edition.comparison.previousEdition}.`}
        </p>
        <dl>
          {(
            [
              ['Newly present dates', edition.comparison.addedDates],
              ['Changed input dates', edition.comparison.changedDates],
              [
                'Dates absent from this capture',
                edition.comparison.absentDates,
              ],
            ] as const
          ).map(([label, dates]) => (
            <div key={label}>
              <dt>
                {label} ({dates.length})
              </dt>
              <dd>{dates.length ? dates.map(dayLabel).join(' · ') : 'None'}</dd>
            </div>
          ))}
        </dl>
        <p>
          The source is a rolling 90-day file. Absent dates may have aged out of
          the window; absence does not establish a correction or withdrawal.
          Prior captured editions remain separate records.
        </p>
      </details>
      <details className="fx-detail">
        <summary>How the cross-rate is calculated</summary>
        <p>
          For the same reported date: INR per USD = (INR per EUR) ÷ (USD per
          EUR). Original ECB decimal text is unchanged. Fingent360 divides exact
          integers and rounds the result to eight decimal places, with halfway
          values rounded away from zero.
        </p>
        <p>
          This calculated cross-rate is not a direct ECB, RBI or FBIL INR/USD
          quotation.
        </p>
        {sourceDetails && (
          <>
            <p>Exact reduced fractions for the selected dates:</p>
            <ul>
              {rows.map((row) => (
                <li key={row.date}>
                  <time dateTime={row.date}>{dayLabel(row.date)}</time>:{' '}
                  {row.derivedInrPerUsd.numerator} ÷{' '}
                  {row.derivedInrPerUsd.denominator} ={' '}
                  {row.derivedInrPerUsd.value}
                </li>
              ))}
            </ul>
          </>
        )}
      </details>
      {sourceDetails && (
        <details className="fx-detail">
          <summary>Evidence identity and method version</summary>
          <dl>
            <dt>Source receipt SHA-256</dt>
            <dd>{edition.sourceHash}</dd>
            <dt>Parser</dt>
            <dd>{edition.parserVersion}</dd>
            <dt>Calculation</dt>
            <dd>{edition.observations[0]!.derivedInrPerUsd.methodVersion}</dd>
          </dl>
          <p>
            Exact historical publication times are unknown. This is a retrieval
            revision, not a historical as-of vintage. Public evidence contains
            reviewed numerical records; retained original XML is available to
            authorized operators.
          </p>
        </details>
      )}
    </section>
  );
}

type Result = {
  route: string;
  current?: EcbFxPublic;
  history?: ReturnType<typeof EcbFxHistorySchema.parse>;
  edition?: EcbFxEdition;
};
export function EcbFx({ route = 'reference-fx' }: { route?: string }) {
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(true),
    [reload, setReload] = useState(0);
  const generation = useRef(0),
    live = useRef(false),
    heading = useRef<HTMLHeadingElement>(null);
  const view = route.split('/')[1],
    id = route.split('/')[2];
  useEffect(() => {
    live.current = true;
    const ticket = ++generation.current;
    setBusy(true);
    setError('');
    setData(null);
    void (async () => {
      let value: Result;
      if (route === 'reference-fx')
        value = {
          route,
          current: EcbFxPublicSchema.parse(await json('/reference-fx')),
        };
      else if (route === 'reference-fx/history')
        value = {
          route,
          history: EcbFxHistorySchema.parse(
            await json('/reference-fx/history'),
          ),
        };
      else if (
        /^reference-fx\/(edition|evidence)\/[1-9][0-9]{0,8}$/.test(route)
      ) {
        const body = await json(
          `/reference-fx/${view === 'evidence' ? 'evidence' : 'editions'}/${id}`,
        );
        value = {
          route,
          edition:
            view === 'evidence'
              ? EcbFxEvidenceSchema.parse(body).edition
              : EcbFxEditionSchema.parse(body),
        };
      } else
        throw Error(
          'This exchange-rate page is unavailable. Return to reference exchange rates.',
        );
      if (live.current && ticket === generation.current) setData(value);
    })()
      .catch((failure: unknown) => {
        if (live.current && ticket === generation.current)
          setError(
            failure instanceof Error
              ? failure.message
              : 'Reference rates are unavailable. Retry.',
          );
      })
      .finally(() => {
        if (live.current && ticket === generation.current) {
          setBusy(false);
          if (view) heading.current?.focus({ preventScroll: true });
          else restorePosition(route);
        }
      });
    return () => {
      live.current = false;
      generation.current++;
    };
  }, [route, view, id, reload]);
  const visible = data?.route === route ? data : null;
  const current = visible?.current;
  const latest = current?.edition
    ? ecbFxLatest(current.edition, current.evaluatedOn)
    : null;
  async function moreHistory() {
    if (!visible?.history?.nextBefore || busy) return;
    const boundary = visible.history.nextBefore;
    const previous = visible.history;
    const ticket = ++generation.current;
    setBusy(true);
    setError('');
    try {
      const next = EcbFxHistorySchema.parse(
        await json(`/reference-fx/history?before=${boundary}`),
      );
      if (
        (next.nextBefore !== null && next.nextBefore >= boundary) ||
        next.editions.some(
          (edition) =>
            edition.edition >= boundary ||
            previous.editions.some((old) => old.edition === edition.edition),
        )
      )
        throw Error(
          'History changed or repeated a page. Reload reference rates before continuing.',
        );
      if (live.current && ticket === generation.current)
        setData({
          route,
          history: {
            editions: [...previous.editions, ...next.editions],
            nextBefore: next.nextBefore,
          },
        });
    } catch (failure) {
      if (live.current && ticket === generation.current) {
        setData(null);
        setError(
          failure instanceof Error
            ? failure.message
            : 'History unavailable. Retry.',
        );
      }
    } finally {
      if (live.current && ticket === generation.current) setBusy(false);
    }
  }
  return (
    <section className="reference-fx" aria-label="Reference exchange rates">
      {view && (
        <button
          className="text-link back-control"
          aria-label="Back to previous exchange-rate view"
          onClick={() => returnTo('reference-fx')}
        >
          Back
        </button>
      )}
      <header>
        <p className="page-kicker">Currency context</p>
        <h1 ref={heading} tabIndex={-1}>
          {view === 'history'
            ? 'Reviewed FX history'
            : view === 'evidence'
              ? 'Exchange-rate evidence'
              : 'Reference exchange rates'}
        </h1>
        <p>
          Daily ECB reference observations, with a separately calculated
          rupee–dollar cross-rate.
        </p>
        <p className="fx-source">
          <a href={ECB_FX_HOME} target="_blank" rel="noopener noreferrer">
            ECB original · free to access (new tab)
          </a>
          {' · '}
          <a href={ECB_FX_TERMS} target="_blank" rel="noopener noreferrer">
            Reuse terms (new tab)
          </a>
        </p>
      </header>
      <button disabled={busy} onClick={() => setReload((value) => value + 1)}>
        {error ? 'Retry reference rates' : 'Reload reference rates'}
      </button>
      {busy && <p role="status">Reading reviewed reference rates…</p>}
      {error && <p role="alert">{error}</p>}
      {current &&
        (current.status !== 'published' ? (
          <p role="status">
            {current.status === 'withdrawn'
              ? 'This reference-rate source was withdrawn. Values, history and evidence are unavailable.'
              : 'No reviewed reference-rate edition is available yet.'}
          </p>
        ) : (
          <>
            {latest ? (
              <>
                <p>
                  Latest reported date in this edition:{' '}
                  <strong>
                    <time dateTime={latest.date}>{dayLabel(latest.date)}</time>
                  </strong>
                </p>
                <div className="fx-values">
                  <article className="panel">
                    <p className="page-kicker">Unchanged ECB inputs</p>
                    <h2>For one euro</h2>
                    <dl>
                      <dt>US dollars</dt>
                      <dd>{latest.usdPerEur} USD</dd>
                      <dt>Indian rupees</dt>
                      <dd>{latest.inrPerEur} INR</dd>
                    </dl>
                  </article>
                  <article className="panel fx-calculated">
                    <p className="page-kicker">Fingent360 calculation</p>
                    <h2>For one US dollar</h2>
                    <p className="fx-value">
                      {latest.derivedInrPerUsd.value} <span>INR</span>
                    </p>
                    <p>
                      Same-day inputs divided exactly; rounded to eight decimal
                      places.
                    </p>
                  </article>
                </div>
              </>
            ) : (
              <p>No observation is available on or before this view date.</p>
            )}
            <nav className="fx-links" aria-label="Reference-rate details">
              <a href="#reference-fx/history">Review retrieval history</a>
              <a href={`#reference-fx/edition/${current.edition!.edition}`}>
                All reported dates
              </a>
              <a href={`#reference-fx/evidence/${current.edition!.edition}`}>
                Inspect numerical evidence
              </a>
            </nav>
            <details className="fx-detail">
              <summary>When was this data captured and reviewed?</summary>
              <dl>
                <dt>This edition captured</dt>
                <dd>{instantLabel(current.edition!.retrievedAt)}</dd>
                <dt>Source last checked</dt>
                <dd>{instantLabel(current.checkedAt)}</dd>
                <dt>Publication reviewed</dt>
                <dd>{instantLabel(current.reviewedAt)}</dd>
                <dt>View date in Europe/Berlin</dt>
                <dd>{dayLabel(current.evaluatedOn)}</dd>
              </dl>
              <p>
                A fresh check does not make an older observation current.
                Original historical publication times are unknown.
              </p>
            </details>
          </>
        ))}
      {visible?.history && (
        <>
          <p>
            Reviewed capture editions since the last source withdrawal. Each
            preserves its own reported window.
          </p>
          {!visible.history.editions.length && (
            <p>No reviewed retrieval history.</p>
          )}
          <ol className="fx-history">
            {visible.history.editions.map((edition) => (
              <li key={edition.edition}>
                <a href={`#reference-fx/edition/${edition.edition}`}>
                  Retrieval edition {edition.edition}
                </a>
                <p>
                  <time dateTime={edition.retrievedAt}>
                    {instantLabel(edition.retrievedAt)}
                  </time>{' '}
                  · {dayLabel(edition.windowStart)} to{' '}
                  {dayLabel(edition.windowEnd)}
                </p>
              </li>
            ))}
          </ol>
          {visible.history.nextBefore && (
            <button disabled={busy} onClick={() => void moreHistory()}>
              More retrieval editions
            </button>
          )}
        </>
      )}
      {visible?.edition && (
        <>
          <EcbFxEditionView
            edition={visible.edition}
            sourceDetails={view === 'evidence'}
          />
          {view !== 'evidence' && (
            <a href={`#reference-fx/evidence/${visible.edition.edition}`}>
              Inspect this edition's evidence
            </a>
          )}
        </>
      )}
      <p className="fx-use-note">
        For learning and reference. ECB discourages transaction use; these are
        not executable quotes or Indian end-of-day rates. No ECB endorsement is
        implied.
      </p>
    </section>
  );
}
