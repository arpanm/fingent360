import { useEffect, useState } from 'react';
import {
  SbiPortfolioListSchema,
  type SbiPortfolio,
} from '@fingent360/contracts';
import { json } from './net';
export function SbiPortfolioTable({ portfolio }: { portfolio: SbiPortfolio }) {
  return (
    <>
      <p>
        Disclosure as of {portfolio.asOf}. AUM {portfolio.aumLakh} INR lakh.
        This is a dated portfolio disclosure, not today's holdings or a complete
        risk model.
      </p>
      <p>
        {portfolio.quality === 'source-discrepancy'
          ? 'Source discrepancy: reported amounts and weights need care.'
          : 'Reported amounts reconcile within displayed rounding precision.'}{' '}
        We do not normalize weights or infer missing exposure. A # weight means
        the provider reports less than 0.005%; it is not an exact zero.
        Stock-option market values are included once in AUM; separate futures
        exposure is not added again.
      </p>
      {portfolio.warnings.length > 0 && (
        <details>
          <summary>
            Inspect source discrepancies ({portfolio.warnings.length})
          </summary>
          <ul>
            {portfolio.warnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        </details>
      )}
      {[
        'equity',
        'stock-options',
        'reit',
        'foreign',
        'treasury',
        'treps',
        'current',
        'derivatives',
      ].map((section) => (
        <details key={section}>
          <summary>
            {section === 'derivatives'
              ? 'Derivatives — separate from cash AUM'
              : section}{' '}
            ({portfolio.rows.filter((row) => row.section === section).length})
          </summary>
          {section === 'derivatives' && (
            <p>
              Long/short derivative exposures are separate; adding them to cash
              assets would double count. No delta-adjusted exposure is
              calculated.
            </p>
          )}
          <div style={{ overflowX: 'auto' }}>
            <table>
              <caption>
                {section} disclosure · INR lakh and reported percent
              </caption>
              <thead>
                <tr>
                  <th>Instrument</th>
                  <th>ISIN / direction</th>
                  <th>Quantity</th>
                  <th>Market value</th>
                  <th>Reported % AUM</th>
                  <th>Instrument yield %</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.rows
                  .filter((row) => row.section === section)
                  .map((row) => (
                    <tr key={row.row}>
                      <td>
                        {row.name}
                        <small>{row.classification}</small>
                      </td>
                      <td>{row.isin || row.direction || 'Not specified'}</td>
                      <td>{row.quantity ?? 'Not specified'}</td>
                      <td>{row.amountLakh}</td>
                      <td>{row.reportedWeightPercent}</td>
                      <td>{row.yieldPercent ?? 'Not disclosed'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p>
            Reported section total{' '}
            {portfolio.totals.find((t) => t.section === section)?.amountLakh}{' '}
            INR lakh ·{' '}
            {
              portfolio.totals.find((t) => t.section === section)
                ?.reportedWeightPercent
            }
            % AUM.
          </p>
        </details>
      ))}
    </>
  );
}
export function SbiPortfolioReader({ schemeCode }: { schemeCode: string }) {
  const [value, setValue] = useState<ReturnType<
      typeof SbiPortfolioListSchema.parse
    > | null>(null),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setValue(null);
    setError('');
    json(
      '/fund-lookthrough?schemeCode=' + schemeCode,
      undefined,
      'GET',
      abort.signal,
    )
      .then((raw) => {
        if (!abort.signal.aborted) setValue(SbiPortfolioListSchema.parse(raw));
      })
      .catch((failure) => {
        if (!abort.signal.aborted)
          setError(
            failure instanceof Error
              ? failure.message
              : 'Portfolio unavailable.',
          );
      });
    return () => abort.abort();
  }, [schemeCode, retry]);
  return (
    <section aria-label="Fund portfolio disclosure">
      <h3>What this fund disclosed</h3>
      {!value && !error && <p role="status">Loading reviewed portfolio…</p>}
      {error && (
        <div role="alert">
          {error}
          <button onClick={() => setRetry((v) => v + 1)}>
            Retry portfolio
          </button>
        </div>
      )}
      {value?.editions.length === 0 && (
        <p>
          No currently admitted portfolio mapping is available for this scheme.
          Nothing is inferred from its name.
        </p>
      )}
      {value?.editions.map((edition) => (
        <article key={edition.id}>
          <h4>{edition.portfolio?.scheme}</h4>
          <p>
            Mapped to {edition.mapping?.schemeName} ·{' '}
            {edition.mapping?.schemeCode}. Reviewed {edition.reviewedAt};
            retrieved {edition.retrievedAt}.
          </p>
          <a href={edition.sourceUrl} target="_blank" rel="noreferrer">
            Original AMC disclosure
          </a>
          {edition.portfolio && (
            <SbiPortfolioTable portfolio={edition.portfolio} />
          )}
        </article>
      ))}
    </section>
  );
}
