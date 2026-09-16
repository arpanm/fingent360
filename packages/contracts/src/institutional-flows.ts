import { z } from 'zod';
export const NSE_FLOWS_URL = 'https://www.nseindia.com/reports/fii-dii';
export const CDSL_FLOWS_URL =
  'https://www.cdslindia.com/Publications/FIIDailyData.aspx';
const Amount = z.string().regex(/^-?(0|[1-9][0-9]{0,15})\.[0-9]{2}$/);
const CashRow = z.strictObject({
  participant: z.enum(['FII/FPI', 'DII']),
  buy: Amount,
  sell: Amount,
  net: Amount,
});
const InvestmentRow = z.strictObject({
  asset: z.enum(['Equity', 'Debt', 'Debt-VRR', 'Hybrid', 'Total']),
  route: z.enum([
    'Stock Exchange',
    'Primary market & others',
    'Sub-total',
    'Total',
  ]),
  buy: Amount,
  sell: Amount,
  net: Amount,
  netUsdMillion: Amount,
});
const DerivativeRow = z.strictObject({
  product: z.enum([
    'INDEX_FUTURES',
    'INDEX_OPTIONS',
    'STOCK_FUTURES',
    'STOCK_OPTIONS',
    'INTEREST_RATE_FUTURES',
    'CURRENCY_FUTURES',
    'CURRENCY_OPTIONS',
    'COMMODITY_FUTURES',
    'COMMODITY_OPTIONS',
  ]),
  buyContracts: z.string().regex(/^\d+$/),
  buyAmount: Amount,
  sellContracts: z.string().regex(/^\d+$/),
  sellAmount: Amount,
  openContracts: z.string().regex(/^\d+$/),
  openAmount: Amount,
});
const Common = {
  effectiveOn: z.iso.date(),
  unit: z.literal('INR crore'),
  reconciliation: z.enum(['exact', 'within-source-rounding']),
};
export const InstitutionalFlowDatasetSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    ...Common,
    kind: z.literal('nse-cash'),
    dateMeaning: z.literal('trade-date-provisional'),
    scope: z.enum(['NSE', 'NSE-BSE-MSEI']),
    rows: z.array(CashRow).length(2),
  }),
  z.strictObject({
    ...Common,
    kind: z.literal('cdsl-investment'),
    dateMeaning: z.literal('custodian-reporting-date'),
    scope: z.literal('custodian-reported-investment'),
    usdInr: z.string().regex(/^\d+\.[0-9]{3}$/),
    rows: z.array(InvestmentRow).length(13),
  }),
  z.strictObject({
    ...Common,
    kind: z.literal('cdsl-derivatives'),
    dateMeaning: z.literal('exchange-reporting-date'),
    scope: z.literal('exchange-reported-derivatives'),
    rows: z.array(DerivativeRow).length(9),
  }),
]);
export const InstitutionalFlowInputSchema = z.strictObject({
  requestId: z.uuid(),
  source: z.enum(['nse-cash-html', 'cdsl-daily-html']),
  body: z.string().min(50).max(1000000),
  rightsEvidence: z.string().trim().min(20).max(2000),
  rightsConfirmed: z.literal(true),
});
export const InstitutionalFlowEditionSchema = z
  .strictObject({
    id: z.uuid(),
    source: InstitutionalFlowInputSchema.shape.source,
    sourceUrl: z.enum([NSE_FLOWS_URL, CDSL_FLOWS_URL]),
    sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
    bodyHash: z.string().regex(/^[a-f0-9]{64}$/),
    retrievedAt: z.iso.datetime(),
    parser: z.literal('institutional-html-v1'),
    datasets: z.array(InstitutionalFlowDatasetSchema).length(2),
    reviewedAt: z.iso.datetime().nullable(),
  })
  .superRefine((edition, ctx) => {
    const expected =
      edition.source === 'nse-cash-html' ? NSE_FLOWS_URL : CDSL_FLOWS_URL;
    const scopes = edition.datasets
      .map((d) => d.scope)
      .sort()
      .join('|');
    if (
      edition.sourceUrl !== expected ||
      scopes !==
        (edition.source === 'nse-cash-html'
          ? 'NSE|NSE-BSE-MSEI'
          : 'custodian-reported-investment|exchange-reported-derivatives') ||
      edition.datasets.some(
        (d) => d.effectiveOn > edition.retrievedAt.slice(0, 10),
      ) ||
      (edition.reviewedAt !== null && edition.reviewedAt < edition.retrievedAt)
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Flow source, scope or capture/review dates do not agree.',
      });
    for (const dataset of edition.datasets) {
      const issue = () =>
        ctx.addIssue({
          code: 'custom',
          message:
            'Institutional flow totals, classification or reconciliation do not agree.',
        });
      const near = (a: string, b: bigint) => {
        const d = integer(a) - b;
        return d >= -1n && d <= 1n;
      };
      if (dataset.kind !== 'cdsl-derivatives') {
        if (
          dataset.rows.some(
            (r) =>
              integer(r.buy) < 0n ||
              integer(r.sell) < 0n ||
              !near(r.net, integer(r.buy) - integer(r.sell)) ||
              (dataset.reconciliation === 'exact' &&
                integer(r.net) !== integer(r.buy) - integer(r.sell)),
          )
        )
          issue();
        if (dataset.kind === 'cdsl-investment') {
          const expected = ['Equity', 'Debt', 'Debt-VRR', 'Hybrid']
            .flatMap((asset) =>
              ['Stock Exchange', 'Primary market & others', 'Sub-total'].map(
                (route) => asset + '|' + route,
              ),
            )
            .concat('Total|Total');
          if (
            dataset.rows.some(
              (row, i) => row.asset + '|' + row.route !== expected[i],
            ) ||
            BigInt(dataset.usdInr.replace('.', '')) <= 0n
          )
            issue();
          for (const field of ['buy', 'sell', 'net'] as const) {
            for (const offset of [0, 3, 6, 9]) {
              const sum =
                integer(dataset.rows[offset]![field]) +
                integer(dataset.rows[offset + 1]![field]);
              if (
                !near(dataset.rows[offset + 2]![field], sum) ||
                (dataset.reconciliation === 'exact' &&
                  integer(dataset.rows[offset + 2]![field]) !== sum)
              )
                issue();
            }
            const sum = [2, 5, 8, 11].reduce(
              (total, i) => total + integer(dataset.rows[i]![field]),
              0n,
            );
            if (
              !near(dataset.rows[12]![field], sum) ||
              (dataset.reconciliation === 'exact' &&
                integer(dataset.rows[12]![field]) !== sum)
            )
              issue();
          }
        }
      } else if (new Set(dataset.rows.map((r) => r.product)).size !== 9)
        issue();
      if (
        dataset.kind === 'nse-cash' &&
        new Set(dataset.rows.map((r) => r.participant)).size !== 2
      )
        ctx.addIssue({
          code: 'custom',
          message: 'Both institution categories are required.',
        });
      if (
        dataset.kind === 'cdsl-derivatives' &&
        dataset.rows.some((r) =>
          [r.buyAmount, r.sellAmount, r.openAmount].some((a) =>
            a.startsWith('-'),
          ),
        )
      )
        ctx.addIssue({
          code: 'custom',
          message: 'Gross derivative amounts cannot be negative.',
        });
    }
  });
export const InstitutionalFlowReviewSchema = z.strictObject({
  requestId: z.uuid(),
  id: z.uuid(),
  decision: z.enum(['publish', 'withdraw']),
  reason: z.string().trim().min(12).max(2000),
  rightsVerified: z.boolean(),
});
export const InstitutionalFlowCaptureSchema = z.strictObject({
  id: z.uuid(),
  state: z.enum(['retained', 'quarantined']),
  reason: z.string().nullable(),
});
export const InstitutionalFlowQueueSchema = z
  .array(
    z.strictObject({
      id: z.uuid(),
      source_hash: z.string(),
      error: z.string().nullable(),
      receipt: InstitutionalFlowEditionSchema.nullable(),
      state: z.enum(['quarantined', 'draft', 'publish', 'withdraw']),
    }),
  )
  .max(100);
export const InstitutionalFlowPublicSchema = z
  .strictObject({
    capturedAt: z.iso.datetime(),
    editions: z
      .array(
        InstitutionalFlowEditionSchema.refine(
          (e) => e.reviewedAt !== null,
          'Public flow editions require an independent review.',
        ),
      )
      .max(100),
  })
  .superRefine((value, ctx) => {
    if (
      new Set(value.editions.map((e) => e.source)).size !==
        value.editions.length ||
      value.editions.some((e) => e.reviewedAt! > value.capturedAt)
    )
      ctx.addIssue({
        code: 'custom',
        message:
          'Public flow sources must be unique and reviewed before this snapshot.',
      });
  });
const clean = (html: string) =>
  html
    .replace(/<!--[^]*?-->/g, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
const tableRows = (html: string) =>
  [...html.matchAll(/<tr\b[^>]*>([^]*?)<\/tr>/gi)].map((match) =>
    [...match[1]!.matchAll(/<t[dh]\b[^>]*>([^]*?)<\/t[dh]>/gi)].map((cell) =>
      clean(cell[1]!),
    ),
  );
const integer = (s: string) => BigInt(s.replace('.', ''));
function amount(raw: string) {
  if (!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)\.[0-9]{1,2}$/.test(raw))
    throw Error('Unknown numeric amount format.');
  const [whole, fraction] = raw.replace(/,/g, '').split('.');
  return Amount.parse(whole + '.' + fraction!.padEnd(2, '0'));
}
function day(raw: string) {
  const match = /^(\d{2})-([A-Za-z]{3})-(\d{4})$/.exec(raw);
  const month = [
    'JAN',
    'FEB',
    'MAR',
    'APR',
    'MAY',
    'JUN',
    'JUL',
    'AUG',
    'SEP',
    'OCT',
    'NOV',
    'DEC',
  ].indexOf(match?.[2]?.toUpperCase() ?? '');
  if (!match || month < 0) throw Error('Unknown reporting date.');
  return z.iso
    .date()
    .parse(`${match[3]}-${String(month + 1).padStart(2, '0')}-${match[1]}`);
}
export function parseInstitutionalFlows(
  raw: unknown,
  sourceHash: string,
  retrievedAt: string,
  bodyHash: string,
) {
  const input = InstitutionalFlowInputSchema.parse(raw);
  const datasets: z.infer<typeof InstitutionalFlowDatasetSchema>[] = [];
  let rounding = false;
  const equal = (actual: bigint, expected: bigint) => {
    const diff = actual > expected ? actual - expected : expected - actual;
    if (diff > 1n) throw Error('Reported flow arithmetic does not reconcile.');
    if (diff) rounding = true;
  };
  const values = (buy: string, sell: string, net: string) => {
    const row = { buy: amount(buy), sell: amount(sell), net: amount(net) };
    if (integer(row.buy) < 0n || integer(row.sell) < 0n)
      throw Error('Gross purchases and sales must be nonnegative.');
    equal(integer(row.net), integer(row.buy) - integer(row.sell));
    return row;
  };
  const tables = [
    ...input.body
      .replace(/<!--[^]*?-->/g, '')
      .matchAll(/<table\b([^>]*)>([^]*?)<\/table>/gi),
  ];
  if (input.source === 'nse-cash-html') {
    for (const [id, scope] of [
      ['fiidiiTableNse', 'NSE'],
      ['fiidiiTable', 'NSE-BSE-MSEI'],
    ] as const) {
      rounding = false;
      const matches = tables.filter((t) =>
        new RegExp(`\\bid=["']${id}["']`).test(t[1]!),
      );
      if (matches.length !== 1)
        throw Error(
          'Both exact NSE cash tables must be present in the captured page.',
        );
      const rows = tableRows(matches[0]![2]!);
      if (
        rows.length !== 3 ||
        rows[0]!.map((s) => s.replace(/\s/g, '').toLowerCase()).join('|') !==
          'category|date|buyvalue(₹crores)|sellvalue(₹crores)|netvalue(₹crores)'
      )
        throw Error('NSE cash table layout changed.');
      const parsed = rows.slice(1).map((r) => {
        if (r.length !== 5) throw Error('NSE cash row width changed.');
        return {
          ...CashRow.parse({
            participant: r[0],
            ...values(r[2]!, r[3]!, r[4]!),
          }),
          date: day(r[1]!),
        };
      });
      if (
        new Set(parsed.map((r) => r.participant)).size !== 2 ||
        new Set(parsed.map((r) => r.date)).size !== 1
      )
        throw Error('NSE date or participant coverage changed.');
      datasets.push({
        kind: 'nse-cash',
        scope,
        effectiveOn: parsed[0]!.date,
        dateMeaning: 'trade-date-provisional',
        unit: 'INR crore',
        reconciliation: rounding ? 'within-source-rounding' : 'exact',
        rows: parsed.map((r) => ({
          participant: r.participant,
          buy: r.buy,
          sell: r.sell,
          net: r.net,
        })),
      });
    }
  } else {
    if (tables.length !== 2)
      throw Error(
        'CDSL daily page must contain exactly the investment and derivatives tables.',
      );
    const rows = tableRows(tables[0]![2]!.split(/<tfoot\b/i)[0]!);
    const dateMatch =
      /Daily Trends in FII \/ FPI Investments on (\d{2}-[A-Z]{3}-\d{4})/.exec(
        clean(input.body),
      );
    if (
      !dateMatch ||
      rows.length !== 14 ||
      rows[0]!.join('|') !==
        'Reporting Date|Debt/Equity|Investment Route|Gross Purchases (Rs Crore)|Gross Sales (Rs Crore)|Net Investment (Rs Crore)|Net Investment US($) million|Conversion (1 USD TO INR)*'
    )
      throw Error('CDSL investment layout changed.');
    const date = day(dateMatch[1]!);
    let conversion = '';
    const investments: z.infer<typeof InvestmentRow>[] = [];
    for (let i = 0; i < 12; i++) {
      let r = rows[i + 1]!;
      const asset = ['Equity', 'Debt', 'Debt-VRR', 'Hybrid'][
        Math.floor(i / 3)
      ]!;
      if (i === 0) {
        if (day(r[0]!) !== date)
          throw Error('CDSL heading and reporting date disagree.');
        conversion = r[r.length - 1]!;
        r = r.slice(1, -1);
      }
      if (i % 3 === 0) {
        if (r[0] !== asset) throw Error('CDSL asset classification changed.');
        r = r.slice(1);
      }
      const route = ['Stock Exchange', 'Primary market & others', 'Sub-total'][
        i % 3
      ]!;
      if (r.length !== 5 || r[0] !== route)
        throw Error('CDSL investment routes changed.');
      investments.push(
        InvestmentRow.parse({
          asset,
          route,
          ...values(r[1]!, r[2]!, r[3]!),
          netUsdMillion: amount(r[4]!),
        }),
      );
      if (i % 3 === 2)
        for (const field of ['buy', 'sell', 'net'] as const)
          equal(
            integer(investments[i]![field]),
            integer(investments[i - 1]![field]) +
              integer(investments[i - 2]![field]),
          );
    }
    const total = rows[13]!;
    if (total.length !== 5 || total[0] !== 'Total')
      throw Error('CDSL provider total changed.');
    const totalRow = InvestmentRow.parse({
      asset: 'Total',
      route: 'Total',
      ...values(total[1]!, total[2]!, total[3]!),
      netUsdMillion: amount(total[4]!),
    });
    for (const field of ['buy', 'sell', 'net'] as const)
      equal(
        integer(totalRow[field]),
        investments
          .filter((r) => r.route === 'Sub-total')
          .reduce((s, r) => s + integer(r[field]), 0n),
      );
    investments.push(totalRow);
    datasets.push({
      kind: 'cdsl-investment',
      scope: 'custodian-reported-investment',
      effectiveOn: date,
      dateMeaning: 'custodian-reporting-date',
      unit: 'INR crore',
      usdInr: conversion,
      rows: investments,
      reconciliation: rounding ? 'within-source-rounding' : 'exact',
    });
    const derivatives = tableRows(tables[1]![2]!.split(/<tfoot\b/i)[0]!);
    const derivativeDate =
      /Daily Trends in FII \/ FPI Derivative Trades on (\d{2}-[A-Z]{3}-\d{4})/.exec(
        clean(input.body),
      );
    if (
      !derivativeDate ||
      derivatives.length !== 11 ||
      derivatives[0]!.join('|') !==
        'Reporting Date|Derivative Products|Buy|Sell|Open Interest at the end of the date' ||
      derivatives[1]!.join('|') !==
        'No. of Contracts|Amount in Crore|No. of Contracts|Amount in crore|No. of Contracts|Amount in Crore'
    )
      throw Error('CDSL derivatives layout changed.');
    const effectiveOn = day(derivativeDate[1]!);
    const contracts = (s: string) => {
      if (!/^\d+\.00$/.test(s))
        throw Error('Derivative contracts must be exact whole counts.');
      return s.slice(0, -3);
    };
    const derivativeRows = derivatives.slice(2).map((r, i) => {
      if (
        r.length !== 8 ||
        (i === 0 ? day(r[0]!) !== effectiveOn : r[0] !== '')
      )
        throw Error('Derivative row or date changed.');
      return DerivativeRow.parse({
        product: r[1],
        buyContracts: contracts(r[2]!),
        buyAmount: amount(r[3]!),
        sellContracts: contracts(r[4]!),
        sellAmount: amount(r[5]!),
        openContracts: contracts(r[6]!),
        openAmount: amount(r[7]!),
      });
    });
    if (new Set(derivativeRows.map((r) => r.product)).size !== 9)
      throw Error('Derivative product coverage changed.');
    datasets.push({
      kind: 'cdsl-derivatives',
      scope: 'exchange-reported-derivatives',
      effectiveOn,
      dateMeaning: 'exchange-reporting-date',
      unit: 'INR crore',
      rows: derivativeRows,
      reconciliation: 'exact',
    });
  }
  if (datasets.some((d) => d.effectiveOn > retrievedAt.slice(0, 10)))
    throw Error('Source report date is later than capture date.');
  return InstitutionalFlowEditionSchema.parse({
    id: input.requestId,
    source: input.source,
    sourceUrl:
      input.source === 'nse-cash-html' ? NSE_FLOWS_URL : CDSL_FLOWS_URL,
    sourceHash,
    bodyHash,
    retrievedAt,
    parser: 'institutional-html-v1',
    datasets,
    reviewedAt: null,
  });
}

/** An original editorial summary of exact reviewed values; not a copied news article. */
export function institutionalFlowLines(
  edition: z.infer<typeof InstitutionalFlowEditionSchema>,
) {
  return edition.datasets.flatMap((dataset) =>
    dataset.kind === 'nse-cash'
      ? dataset.rows.map(
          (row) =>
            `${dataset.scope} | provisional trade date ${dataset.effectiveOn} | ${row.participant} | purchases ${row.buy} INR crore | sales ${row.sell} INR crore | net ${row.net} INR crore.`,
        )
      : dataset.kind === 'cdsl-investment'
        ? dataset.rows
            .filter(
              (row) =>
                row.route === 'Sub-total' &&
                (row.asset === 'Equity' || row.asset === 'Debt'),
            )
            .map(
              (row) =>
                `CDSL ${row.asset} | custodian reporting date ${dataset.effectiveOn} | FPI | purchases ${row.buy} INR crore | sales ${row.sell} INR crore | net ${row.net} INR crore.`,
            )
        : [],
  );
}
