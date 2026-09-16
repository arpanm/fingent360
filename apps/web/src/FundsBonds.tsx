import { CcilZeroReader } from './CcilZero';
import { CorporateRatingsReader } from './CorporateRatings';
import { SovereignBondReader } from './SovereignBonds';
import { FundFactsheetReader } from './FundFactsheet';
import { FundMergerReader } from './FundMergers';
import { CcilYieldsReader } from './CcilYields';
import { SbiPortfolioReader } from './SbiPortfolio';
import { useEffect, useState, useRef } from 'react';
import {
  CorporateRatingListSchema,
  BondComparisonInputSchema,
  BondComparisonsSchema,
  SavedBondComparisonSchema,
  calculateBondComparison,
  FundsListSchema,
  FundDetailSchema,
  type BondComparisonInput,
} from '@fingent360/contracts';
import { json } from './net';
import './funds-bonds.css';
const fundIdentityLabels: Record<string, string> = {
  schemeCode: 'scheme code',
  amc: 'fund manager',
  name: 'scheme name',
  plan: 'plan',
  option: 'option',
  payoutIsin: 'growth/payout ISIN',
  reinvestmentIsin: 'reinvestment ISIN',
};
const paise = (value: string) => {
  if (!/^(0|[1-9][0-9]{0,15})(\.[0-9]{1,2})?$/.test(value))
    throw Error(
      'Enter nonnegative rupee amounts with at most two decimal places.',
    );
  const [whole, fraction = ''] = value.split('.');
  return (BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, '0'))).toString();
};
const rupees = (value: string) => {
  const amount = BigInt(value),
    absolute = amount < 0n ? -amount : amount;
  return `${amount < 0n ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
};
type Form = {
  title: string;
  sourceReference: string;
  settlementOn: string;
  clean: string;
  previousCouponOn: string;
  nextCouponOn: string;
  coupon: string;
  fees: string;
  creditDescription: string;
  cashflows: { date: string; amount: string }[];
  depositBps: string;
  deductionBps: string;
  consent: boolean;
  creditSelection: string;
};
const emptyForm = (): Form => ({
  title: '',
  sourceReference: '',
  settlementOn: '',
  clean: '',
  previousCouponOn: '',
  nextCouponOn: '',
  coupon: '',
  fees: '0',
  creditDescription: 'Not verified',
  cashflows: [{ date: '', amount: '' }],
  depositBps: '',
  deductionBps: '0',
  consent: false,
  creditSelection: '',
});
function formInput(form: Form) {
  if (
    !/^\d+(\.\d{1,2})?$/.test(form.depositBps) ||
    !/^\d+(\.\d{1,2})?$/.test(form.deductionBps)
  )
    throw Error(
      'Enter annual rate and deduction percentages with at most two decimal places.',
    );
  return BondComparisonInputSchema.parse({
    title: form.title,
    sourceReference: form.sourceReference,
    settlementOn: form.settlementOn,
    cleanPricePaise: paise(form.clean),
    previousCouponOn: form.previousCouponOn,
    nextCouponOn: form.nextCouponOn,
    couponAmountPaise: paise(form.coupon),
    feesPaise: paise(form.fees),
    creditDescription: form.creditDescription,
    ...(form.creditSelection
      ? {
          creditEvidence: {
            editionId: form.creditSelection.split('|')[0],
            isin: form.creditSelection.split('|')[1],
          },
        }
      : {}),
    cashflows: form.cashflows.map((r) => ({
      date: r.date,
      amountPaise: paise(r.amount),
    })),
    depositAnnualBps: Number(paise(form.depositBps)),
    depositDeductionBps: Number(paise(form.deductionBps)),
    consent: form.consent,
  });
}
function formOf(input: BondComparisonInput): Form {
  return {
    title: input.title,
    sourceReference: input.sourceReference,
    settlementOn: input.settlementOn,
    clean: rupees(input.cleanPricePaise),
    previousCouponOn: input.previousCouponOn,
    nextCouponOn: input.nextCouponOn,
    coupon: rupees(input.couponAmountPaise),
    fees: rupees(input.feesPaise),
    creditDescription: input.creditDescription,
    creditSelection: input.creditEvidence
      ? input.creditEvidence.editionId + '|' + input.creditEvidence.isin
      : '',
    cashflows: input.cashflows.map((r) => ({
      date: r.date,
      amount: rupees(r.amountPaise),
    })),
    depositBps: rupees(String(input.depositAnnualBps)),
    deductionBps: rupees(String(input.depositDeductionBps)),
    consent: false,
  };
}
function ComparisonResult({
  value,
}: {
  value: ReturnType<typeof calculateBondComparison>;
}) {
  return (
    <section aria-label="Bond comparison review" className="funds-result">
      <h3>Compare the supplied cashflows</h3>
      <dl>
        <dt>Accrued coupon</dt>
        <dd>₹{rupees(value.accruedPaise)}</dd>
        <dt>Total purchase outlay, including fees</dt>
        <dd>₹{rupees(value.totalOutlayPaise)}</dd>
        <dt>Bond receipts through {value.maturityOn}</dt>
        <dd>₹{rupees(value.totalReceiptsPaise)}</dd>
        <dt>Bond net cash gain / loss</dt>
        <dd>₹{rupees(value.netGainPaise)}</dd>
        <dt>Bond annualized cashflow rate</dt>
        <dd>
          {value.xirr.annualPercent === null
            ? value.xirr.status
            : `${value.xirr.annualPercent}%`}
        </dd>
        <dt>Macaulay duration estimate</dt>
        <dd>
          {value.macaulayYears === null
            ? 'Unavailable'
            : `${value.macaulayYears} years`}
        </dd>
        <dt>Deposit maturity under your assumptions</dt>
        <dd>₹{rupees(value.depositMaturityPaise)}</dd>
        <dt>Deposit assumed deduction</dt>
        <dd>₹{rupees(value.depositDeductionPaise)}</dd>
        <dt>Deposit annualized cashflow rate</dt>
        <dd>
          {value.depositXirr.annualPercent === null
            ? value.depositXirr.status
            : `${value.depositXirr.annualPercent}%`}
        </dd>
      </dl>
      {value.evidencePolicy && (
        <section aria-label="Saved bond evidence policy">
          <h4>Evidence and valuation boundaries</h4>
          <p>
            Price: user-entered estimate; evaluated price not supplied; trading
            liquidity not established. No recommendation.
          </p>
          <p>Historical assessment: {value.evidencePolicy.assessmentOn}</p>
          {value.evidencePolicy.credit.status ===
          'historical-original-attached' ? (
            <>
              <p>
                {value.evidencePolicy.credit.observation.isin} ·{' '}
                {value.evidencePolicy.credit.observation.rating} (
                {value.evidencePolicy.credit.observation.outlook}), publication{' '}
                {value.evidencePolicy.credit.publishedOn}. Original receipt, not
                current surveillance.
              </p>
              <a
                href={value.evidencePolicy.credit.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                Attached ICRA original
              </a>
              <p>
                Source hash {value.evidencePolicy.credit.sourceHash}; edition{' '}
                {value.evidencePolicy.credit.editionId}; version{' '}
                {value.evidencePolicy.credit.sourceVersion}
              </p>
            </>
          ) : (
            <p>User credit description only; no verified rating attached.</p>
          )}
        </section>
      )}
      <p>{value.xirr.reason}</p>
      <details>
        <summary>Calculation boundaries</summary>
        {value.notes.map((note) => (
          <p key={note}>{note}</p>
        ))}
      </details>
    </section>
  );
}
export function BondComparisonWorkbench() {
  const [creditRows, setCreditRows] = useState<
      ReturnType<typeof CorporateRatingListSchema.parse>
    >({ editions: [], nextCursor: null }),
    [creditError, setCreditError] = useState('');
  const creditRequest = useRef<AbortController | null>(null);
  const [creditBusy, setCreditBusy] = useState(false);
  async function loadCredits(after?: string) {
    creditRequest.current?.abort();
    const controller = new AbortController();
    creditRequest.current = controller;
    setCreditBusy(true);
    setCreditError('');
    try {
      const value = CorporateRatingListSchema.parse(
        await json(
          '/corporate-ratings' +
            (after ? '?after=' + encodeURIComponent(after) : ''),
          undefined,
          'GET',
          controller.signal,
        ),
      );
      if (!controller.signal.aborted)
        setCreditRows((old) => ({
          ...value,
          editions: after
            ? [...old.editions, ...value.editions]
            : value.editions,
        }));
    } catch (e) {
      if (!controller.signal.aborted)
        setCreditError(
          e instanceof Error ? e.message : 'Credit evidence unavailable.',
        );
    } finally {
      if (!controller.signal.aborted) setCreditBusy(false);
    }
  }
  useEffect(() => {
    void loadCredits();
    return () => creditRequest.current?.abort();
  }, []);
  function ratingSource(selection: string) {
    return creditRows.editions.find((e) => e.id === selection.split('|')[0]);
  }
  const [form, setForm] = useState(emptyForm),
    [preview, setPreview] = useState<ReturnType<
      typeof calculateBondComparison
    > | null>(null),
    [saved, setSaved] = useState<
      ReturnType<typeof BondComparisonsSchema.parse>
    >({ comparisons: [] }),
    [opened, setOpened] = useState<ReturnType<
      typeof SavedBondComparisonSchema.parse
    > | null>(null),
    [id, setId] = useState(() => crypto.randomUUID()),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void json('/account/bond-comparisons', undefined, 'GET', controller.signal)
      .then((data) => {
        if (!controller.signal.aborted)
          setSaved(BondComparisonsSchema.parse(data));
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted)
          setError(
            err instanceof Error
              ? err.message
              : 'Saved comparisons unavailable.',
          );
      });
    return () => controller.abort();
  }, []);
  function change(next: Form) {
    setForm(next);
    setPreview(null);
    setOpened(null);
    setNotice('');
    setId(crypto.randomUUID());
  }
  async function save() {
    setBusy(true);
    setError('');
    try {
      const input = formInput(form),
        value = SavedBondComparisonSchema.parse(
          await json(`/account/bond-comparisons/${id}`, input, 'PUT'),
        );
      if (
        value.id !== id ||
        JSON.stringify(value.input) !== JSON.stringify(input)
      )
        throw Error(
          'Saved comparison receipt differs from the submitted inputs.',
        );
      setOpened(value);
      setPreview(value.result);
      setSaved(
        BondComparisonsSchema.parse(await json('/account/bond-comparisons')),
      );
      setNotice('Comparison saved with its original assumptions.');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save comparison.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function remove(value: string) {
    setBusy(true);
    setError('');
    try {
      await json(`/account/bond-comparisons/${value}`, undefined, 'DELETE');
      setSaved(
        BondComparisonsSchema.parse(await json('/account/bond-comparisons')),
      );
      if (opened?.id === value) {
        setOpened(null);
        setPreview(null);
      }
      setNotice('Saved comparison removed.');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not remove comparison.',
      );
    } finally {
      setBusy(false);
    }
  }
  const fields: [
    keyof Pick<
      Form,
      | 'title'
      | 'sourceReference'
      | 'settlementOn'
      | 'clean'
      | 'previousCouponOn'
      | 'nextCouponOn'
      | 'coupon'
      | 'fees'
      | 'creditDescription'
      | 'depositBps'
      | 'deductionBps'
    >,
    string,
    string,
  ][] = [
    ['title', 'Comparison name', 'text'],
    ['sourceReference', 'Source of bond terms, quote and cashflows', 'text'],
    ['settlementOn', 'Purchase settlement date', 'date'],
    ['clean', 'Clean purchase amount (₹)', 'text'],
    ['previousCouponOn', 'Previous coupon date', 'date'],
    ['nextCouponOn', 'Next coupon date', 'date'],
    ['coupon', 'Coupon amount for this interval (₹)', 'text'],
    ['fees', 'Purchase fees (₹)', 'text'],
    ['creditDescription', 'Credit rating/source/date, or unknown', 'text'],
    ['depositBps', 'Deposit annual simple interest (%)', 'text'],
    ['deductionBps', 'Assumed deduction from deposit interest (%)', 'text'],
  ];
  return (
    <section aria-label="Bond and deposit workbench">
      <h2>Understand the cashflows before comparing returns</h2>
      <p>
        Use the instrument's actual schedule and your quote. Enter future
        receipts net of the bond costs and deductions you know. No live bond
        quote, rating or default probability is supplied.
      </p>
      {error && (
        <p role="alert">
          {error} <a href="#account">Open account</a>
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setError('');
          try {
            setPreview(
              calculateBondComparison(
                formInput(form),
                ratingSource(form.creditSelection),
              ),
            );
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Review inputs.');
          }
        }}
      >
        <label>
          Optional historical credit evidence
          <select
            disabled={creditBusy}
            value={form.creditSelection}
            onChange={(e) =>
              change({ ...form, creditSelection: e.target.value })
            }
          >
            <option value="">Use my description only</option>
            {creditRows.editions.flatMap((edition) =>
              edition.observations.map((row) => (
                <option
                  key={edition.id + row.isin}
                  value={edition.id + '|' + row.isin}
                >
                  {row.isin} · {edition.publishedOn} · {row.agencyStatus}
                </option>
              )),
            )}
          </select>
        </label>
        <p>
          Attachment assesses credit only at your historical settlement date,
          within90days after publication. It does not validate entered price or
          cashflows; trading liquidity remains unknown.
        </p>
        {creditError && <p role="alert">{creditError}</p>}
        <button
          type="button"
          disabled={creditBusy}
          onClick={() => void loadCredits()}
        >
          Reload credit choices
        </button>
        {creditRows.nextCursor && (
          <button
            type="button"
            disabled={creditBusy}
            onClick={() => void loadCredits(creditRows.nextCursor!)}
          >
            More credit choices
          </button>
        )}
        <div className="funds-form-grid">
          {fields.map(([key, title, type]) => (
            <label key={key}>
              {title}
              <input
                required
                type={type}
                value={form[key]}
                onChange={(e) => change({ ...form, [key]: e.target.value })}
              />
            </label>
          ))}
        </div>
        <fieldset>
          <legend>Expected receipts, including final principal</legend>
          {form.cashflows.map((row, index) => (
            <div className="funds-cashflow" key={index}>
              <label>
                Receipt date {index + 1}
                <input
                  type="date"
                  required
                  value={row.date}
                  onChange={(e) =>
                    change({
                      ...form,
                      cashflows: form.cashflows.map((item, i) =>
                        i === index ? { ...item, date: e.target.value } : item,
                      ),
                    })
                  }
                />
              </label>
              <label>
                Receipt amount {index + 1} (₹)
                <input
                  required
                  inputMode="decimal"
                  value={row.amount}
                  onChange={(e) =>
                    change({
                      ...form,
                      cashflows: form.cashflows.map((item, i) =>
                        i === index
                          ? { ...item, amount: e.target.value }
                          : item,
                      ),
                    })
                  }
                />
              </label>
              {form.cashflows.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    change({
                      ...form,
                      cashflows: form.cashflows.filter((_, i) => i !== index),
                    })
                  }
                >
                  Remove receipt {index + 1}
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            disabled={form.cashflows.length >= 120}
            onClick={() =>
              change({
                ...form,
                cashflows: [...form.cashflows, { date: '', amount: '' }],
              })
            }
          >
            Add receipt
          </button>
        </fieldset>
        <label>
          <input
            type="checkbox"
            checked={form.consent}
            onChange={(e) => change({ ...form, consent: e.target.checked })}
          />{' '}
          I confirm these are my supplied assumptions and agree to save them
          when I choose Save.
        </label>
        <button type="submit" disabled={busy}>
          Review comparison
        </button>
      </form>
      {preview && (
        <>
          <ComparisonResult value={preview} />
          {opened && (
            <details>
              <summary>Original saved assumptions</summary>
              <p>
                {opened.input.title} · saved {opened.createdAt}
              </p>
              <p>{opened.input.sourceReference}</p>
              <p>Credit: {opened.input.creditDescription}</p>
              <p>
                Settlement {opened.input.settlementOn}; clean purchase ₹
                {rupees(opened.input.cleanPricePaise)}; fees ₹
                {rupees(opened.input.feesPaise)}.
              </p>
              <p>
                Coupon ₹{rupees(opened.input.couponAmountPaise)} for{' '}
                {opened.input.previousCouponOn}–{opened.input.nextCouponOn}.
              </p>
              <p>
                Deposit simple annual interest{' '}
                {rupees(String(opened.input.depositAnnualBps))}%; assumed
                interest deduction{' '}
                {rupees(String(opened.input.depositDeductionBps))}%.
              </p>
              <ul>
                {opened.input.cashflows.map((row, index) => (
                  <li key={index}>
                    {row.date}: ₹{rupees(row.amountPaise)}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {!opened && (
            <button disabled={busy} onClick={() => void save()}>
              Save comparison
            </button>
          )}
        </>
      )}
      <h3>Saved comparisons</h3>
      <button
        disabled={busy}
        onClick={() => {
          setError('');
          void json('/account/bond-comparisons')
            .then((value) => setSaved(BondComparisonsSchema.parse(value)))
            .catch((err: unknown) =>
              setError(
                err instanceof Error
                  ? err.message
                  : 'Saved comparisons unavailable.',
              ),
            );
        }}
      >
        Reload saved comparisons
      </button>
      {saved.comparisons.length === 0 && <p>No saved comparisons yet.</p>}
      {saved.comparisons.map((value) => (
        <article key={value.id}>
          <button
            onClick={() => {
              setOpened(value);
              setPreview(value.result);
            }}
          >
            {value.input.title} · {value.createdAt.slice(0, 10)}
          </button>
          <button
            onClick={() => {
              change(formOf(value.input));
            }}
          >
            Edit as a new comparison
          </button>
          <button disabled={busy} onClick={() => void remove(value.id)}>
            Remove {value.input.title}
          </button>
        </article>
      ))}
    </section>
  );
}
export function FundsBonds() {
  const [tab, setTab] = useState<'funds' | 'bonds'>('funds'),
    [query, setQuery] = useState(''),
    [search, setSearch] = useState(''),
    [after, setAfter] = useState<string | undefined>(),
    [code, setCode] = useState<string | null>(null),
    [list, setList] = useState<ReturnType<typeof FundsListSchema.parse> | null>(
      null,
    ),
    [detail, setDetail] = useState<ReturnType<
      typeof FundDetailSchema.parse
    > | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(true),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    if (tab !== 'funds') return;
    const controller = new AbortController();
    setBusy(true);
    setError('');
    setDetail(null);
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (after) params.set('after', after);
    void json(
      code ? `/funds/${code}` : `/funds?${params}`,
      undefined,
      'GET',
      controller.signal,
    )
      .then((value) => {
        if (controller.signal.aborted) return;
        if (code) setDetail(FundDetailSchema.parse(value));
        else setList(FundsListSchema.parse(value));
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted)
          setError(
            err instanceof Error ? err.message : 'Fund data unavailable.',
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [tab, search, after, code, retry]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCode(null);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  return (
    <section className="funds-bonds" aria-label="Funds and bonds">
      <header>
        <p className="eyebrow">UNDERSTAND YOUR INVESTMENTS</p>
        <h1>Funds, bonds and the cashflows that matter</h1>
        <p>
          Reported NAV evidence and a private comparison of the bond terms you
          supply.
        </p>
      </header>
      <CcilYieldsReader />
      <CcilZeroReader />
      <SovereignBondReader />
      <CorporateRatingsReader />
      <nav aria-label="Funds and bond tools">
        <button aria-pressed={tab === 'funds'} onClick={() => setTab('funds')}>
          Fund NAVs
        </button>
        <button aria-pressed={tab === 'bonds'} onClick={() => setTab('bonds')}>
          Bond & deposit comparison
        </button>
      </nav>
      {tab === 'funds' && list?.snapshot && (
        <p role="status">
          Device snapshot {list.snapshot.capturedAt.slice(0, 10)}:{' '}
          {list.snapshot.included} of {list.snapshot.total} retained schemes
          included. Connected browsing provides the full retained directory.
        </p>
      )}
      {tab === 'bonds' ? (
        <BondComparisonWorkbench />
      ) : (
        <>
          {code ? (
            <button onClick={() => setCode(null)}>← All funds</button>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSearch(query);
                setAfter(undefined);
              }}
            >
              <label>
                Fund, AMC or scheme code
                <input
                  value={query}
                  maxLength={100}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <button>Search funds</button>
            </form>
          )}
          {busy ? (
            <p role="status">Loading reviewed NAV evidence…</p>
          ) : error ? (
            <div role="alert">
              <p>{error}</p>
              <button onClick={() => setRetry(retry + 1)}>Retry funds</button>
            </div>
          ) : detail ? (
            <section aria-label="Fund NAV history">
              <h2>{detail.history[0]?.observation.name}</h2>
              <p>
                Scheme {detail.schemeCode}. Direct/regular and
                growth/reinvestment identities remain distinct. NAV alone does
                not describe portfolio risk.
              </p>
              <SbiPortfolioReader schemeCode={detail.schemeCode} />
              <FundMergerReader schemeCode={detail.schemeCode} />
              <FundFactsheetReader schemeCode={detail.schemeCode} />
              <section aria-label="NAV history consistency">
                <h3>
                  {detail.reconciliation.status === 'review-required'
                    ? 'History needs review'
                    : detail.reconciliation.status === 'insufficient-history'
                      ? 'Not enough history to compare'
                      : 'Retained records agree'}
                </h3>
                <p>
                  {detail.reconciliation.distinctDates} distinct dates across{' '}
                  {detail.reconciliation.retainedEditions} retained editions.{' '}
                  {detail.reconciliation.firstDate} to{' '}
                  {detail.reconciliation.lastDate}.
                </p>
                {detail.reconciliation.conflictingDates.length > 0 && (
                  <p role="alert">
                    Different NAVs are reported for the same date:{' '}
                    {detail.reconciliation.conflictingDates.join(', ')}. No
                    value has been selected as a corrected NAV.
                  </p>
                )}
                {detail.reconciliation.identityChanges.length > 0 && (
                  <p role="alert">
                    Scheme details changed between captures (
                    {detail.reconciliation.identityChanges
                      .map((field) => fundIdentityLabels[field] ?? field)
                      .join(', ')}
                    ). Review the original editions before treating these as one
                    continuous series.
                  </p>
                )}
                <ul>
                  {detail.reconciliation.limitations.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </section>
              {detail.truncated && (
                <p>
                  Only the retained history available in this view is shown; it
                  is not a complete historical NAV series.
                </p>
              )}
              {detail.history.map((row) => (
                <article key={`${row.edition.id}:${row.observation.sourceRow}`}>
                  <h3>
                    {row.observation.observedOn} ·{' '}
                    {row.observation.nav === null
                      ? 'NAV unavailable'
                      : `₹${row.observation.nav}`}
                  </h3>
                  <p>
                    {row.observation.amc} · {row.observation.category}
                    <span>
                      {' '}
                      · {row.observation.plan ?? 'Plan not supplied'} ·{' '}
                      {row.observation.option ?? 'Option not supplied'}
                    </span>
                  </p>
                  <p>
                    Growth/payout ISIN{' '}
                    {row.observation.payoutIsin ?? 'not supplied'} ·
                    reinvestment ISIN{' '}
                    {row.observation.reinvestmentIsin ?? 'not supplied'}
                  </p>
                  <details>
                    <summary>Source and retrieval edition</summary>
                    <p>
                      AMFI · {row.edition.retrievedAt} · {row.edition.parser}
                    </p>
                    <p>{row.edition.sourceUrl}</p>
                    {row.edition.historyCatalog && (
                      <p>
                        Source catalog {row.edition.historyCatalog.version},
                        observed {row.edition.historyCatalog.observedOn}.
                      </p>
                    )}
                    <code>{row.edition.hash}</code>
                    <p>
                      Source row {row.observation.sourceRow}. Retained NAV date
                      is not a live executable quote.
                    </p>
                  </details>
                </article>
              ))}
            </section>
          ) : (
            <>
              <div className="funds-list">
                {list?.funds.map((row) => (
                  <button
                    key={row.observation.schemeCode}
                    onClick={() => setCode(row.observation.schemeCode)}
                  >
                    <strong>{row.observation.name}</strong>
                    <span>{row.observation.amc}</span>
                    <span>
                      {row.observation.plan ?? 'Plan not supplied'} ·{' '}
                      {row.observation.option ?? 'Option not supplied'}
                    </span>
                    <span>
                      {row.observation.nav === null
                        ? 'NAV not supplied'
                        : `₹${row.observation.nav}`}{' '}
                      · {row.observation.observedOn} →
                    </span>
                  </button>
                ))}
              </div>
              {!list?.funds.length && (
                <p>
                  No reviewed fund records match. NAV data appears after
                  permitted source capture and review.
                </p>
              )}
              <nav>
                {after && (
                  <button onClick={() => setAfter(undefined)}>
                    First fund page
                  </button>
                )}
                {list?.nextAfter && (
                  <button onClick={() => setAfter(list.nextAfter!)}>
                    Next funds
                  </button>
                )}
              </nav>
            </>
          )}
        </>
      )}
    </section>
  );
}
