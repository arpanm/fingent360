import { z } from 'zod';

export const BrokerIdSchema = z.enum([
  'zerodha',
  'groww',
  'upstox',
  'angel-one',
  'icici-direct',
]);
export const BrokerCapabilitySchema = z.strictObject({
  id: BrokerIdSchema,
  name: z.string().min(1).max(40),
  status: z.literal('format-evidence-pending'),
  parserVersion: z.null(),
  evidenceReviewedOn: z.literal('2026-09-14'),
  url: z.url(),
  evidence: z.string().min(1),
  gap: z.string().min(1),
  caution: z.string().optional(),
  detailUrl: z.url().optional(),
  fallback: z.literal('explicit-mapped-or-supplemented-csv'),
});
export const BrokerCapabilitiesSchema = z.strictObject({
  version: z.literal('broker-capabilities-v1'),
  brokers: z.array(BrokerCapabilitySchema).length(5),
});

const research = [
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

export function brokerCapabilities() {
  return BrokerCapabilitiesSchema.parse({
    version: 'broker-capabilities-v1',
    brokers: research.map((item, index) => ({
      ...item,
      id: BrokerIdSchema.options[index],
      status: 'format-evidence-pending',
      parserVersion: null,
      evidenceReviewedOn: '2026-09-14',
      fallback: 'explicit-mapped-or-supplemented-csv',
    })),
  });
}
/** Never detect a broker from a filename, familiar header or submitted claim. */
export function requireVerifiedBrokerParser(id: unknown): never {
  const selected = BrokerIdSchema.parse(id);
  const broker = brokerCapabilities().brokers.find(
    (item) => item.id === selected,
  )!;
  throw new Error(
    `${broker.name} automatic format is not enabled. ${broker.gap} Use explicit CSV mapping and review instead.`,
  );
}
