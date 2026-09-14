// Public export documentation reviewed 2026-09-14. These are help links,
// never parser presets or assertions about an uploaded file's provenance.
export const brokerImportResearch = [
  {
    name: 'Zerodha',
    url: 'https://support.zerodha.com/category/console/portfolio/console-holdings/articles/holding-report',
    evidence: 'Console → Portfolio → Holdings offers a dated XLSX download.',
    caution:
      'Transferred units may need acquisition details corrected before their costs are known.',
    detailUrl:
      'https://support.zerodha.com/category/console/portfolio/console-holdings/articles/how-to-update-buy-average',
    gap: 'The documented download path does not define a complete workbook schema and acquisition-cost reconciliation rule.',
  },
  {
    name: 'Groww',
    url: 'https://groww.in/updates/updates-from-groww-tax-loss-harvesting-intraday-oco-bonds-and-lots-more',
    evidence:
      'Groww’s official product update announces a Stock Holding Statement for a selected date in Reports.',
    gap: 'A Groww-specific downloadable holdings layout and exact cost-total rule are still unverified.',
  },
  {
    name: 'Upstox',
    url: 'https://upstox.com/help-center/how-can-i-check-my-holdings-248548/',
    evidence:
      'Reports → Holdings → choose a date → Download offers Excel or PDF. The trading interface separately offers CSV export.',
    caution:
      'Check the quantity scope: the dated report demonstration shows free quantity and valuation, which do not establish total acquisition cost.',
    detailUrl:
      'https://upstox.com/market-talk/january-updates-trade-from-charts-watchlist-tags-and-more/',
    gap: 'The update does not specify export headers, cost units or source totals.',
  },
  {
    name: 'Angel One',
    url: 'https://www.angelone.in/support/reports-and-statements/holding-statement',
    evidence:
      'Portfolio → choose Equity → download offers an Excel holding statement, including quantity and average price.',
    gap: 'Average price is not total acquisition cost. Exact workbook columns and cost reconciliation remain unverified.',
  },
  {
    name: 'ICICI Direct',
    url: 'https://www.icicidirect.com/faqs/stocks/how-can-i-download-a-summary-of-my-portfolio-on-website',
    evidence: 'Stocks → Portfolio → Download lets you choose a file format.',
    caution:
      'ICICI Direct says off-market Portfolio entries can use transfer-day closing prices. Verify actual acquisition costs from your records.',
    detailUrl:
      'https://www.icicidirect.com/faqs/stocks/what-is-the-difference-between-portfolio-beta-and-demat-holdings',
    gap: 'The help page does not define the exported file schema or acquisition-cost total.',
  },
] as const;

export function BrokerImportGuide() {
  return (
    <details className="broker-import-guide">
      <summary>Broker export help and supported imports</summary>
      <p>
        Use the Fingent360 standard CSV/XLSX template, or map a CSV with
        verified ISIN, quantity and total purchase-cost columns. Automatic
        broker formats are not enabled. If exact acquisition costs are missing,
        choose Map CSV columns → Supply exact costs from my records. Each
        supplied amount and its records basis are saved as your attestation.
      </p>
      <p>
        Public documentation reviewed 14 September 2026. These five platforms
        are the initial research order.
      </p>
      <ol>
        {brokerImportResearch.map((broker) => (
          <li key={broker.name}>
            <h4>{broker.name}</h4>
            <p>{broker.evidence}</p>
            <a href={broker.url} target="_blank" rel="noopener noreferrer">
              {broker.name} official export help (opens a new tab)
            </a>
            {'caution' in broker && (
              <p>
                {broker.caution}{' '}
                <a
                  href={broker.detailUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {broker.name} additional guidance (opens a new tab)
                </a>
              </p>
            )}
          </li>
        ))}
      </ol>
      <p>
        Before importing, check that your file includes each security’s ISIN,
        quantity and total purchase cost. If ISIN or quantity is missing, use
        the standard template or enter the holding manually. Convert a workbook
        to CSV yourself before mapping; check that the selected sheet and
        quantity scope represent your complete intended holdings. You will
        review the changes before anything is saved.
      </p>
    </details>
  );
}
