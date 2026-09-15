import { z } from 'zod';
export const NSE_UDIFF_SCHEMA_URL =
  'https://nsearchives.nseindia.com/web/mediaattachment/2026-06/UDiFF_trade_and_Bhavcopy_file_formats_20260630115803.xlsx';
export const NSE_UDIFF_SCHEMA_SHA256 =
  'b9f2fa369af20381374cdb40c3ebc96c43029401e057225599cfe63b288ba3e8';
export const NSE_UDIFF_PARSER = 'nse-udiff-cm-v20260630' as const;
export const NSE_UDIFF_HEADERS = [
  'TradDt',
  'BizDt',
  'Sgmt',
  'Src',
  'FinInstrmTp',
  'FinInstrmId',
  'ISIN',
  'TckrSymb',
  'SctySrs',
  'XpryDt',
  'FininstrmActlXpryDt',
  'StrkPric',
  'OptnTp',
  'FinInstrmNm',
  'OpnPric',
  'HghPric',
  'LwPric',
  'ClsPric',
  'LastPric',
  'PrvsClsgPric',
  'UndrlygPric',
  'SttlmPric',
  'OpnIntrst',
  'ChngInOpnIntrst',
  'TtlTradgVol',
  'TtlTrfVal',
  'TtlNbOfTxsExctd',
  'SsnId',
  'NewBrdLotQty',
  'Rmks',
  'Rsvd1',
  'Rsvd2',
  'Rsvd3',
  'Rsvd4',
] as const;
const price = z.string().regex(/^(0|[1-9][0-9]{0,18})(\.[0-9]{1,6})?$/);
const integer = z.string().regex(/^(0|[1-9][0-9]{0,24})$/);
export const EquityUdiffQuoteSchema = z.strictObject({
  symbol: z.string().min(1).max(12),
  name: z.string().min(1).max(50),
  series: z.literal('EQ'),
  instrumentId: z.string().regex(/^[0-9]{1,10}$/),
  businessOn: z.iso.date(),
  open: price,
  high: price,
  low: price,
  last: price,
  previousClose: price,
  settlement: price.nullable(),
  turnoverRupees: price,
  trades: integer,
  marketLot: z.string().regex(/^[1-9][0-9]{0,11}$/),
  session: z.string().regex(/^(?:[1-9][0-9]?|F[12])$/),
  remarks: z.string().max(150),
});
export const EquitySourceCoverageSchema = z
  .strictObject({
    inputRows: z.number().int().positive(),
    acceptedRows: z.number().int().positive(),
    excludedRows: z.number().int().nonnegative(),
    scope: z.literal('NSE CM STK EQ-series INE-prefix equities only'),
  })
  .refine(
    (v) => v.inputRows === v.acceptedRows + v.excludedRows,
    'Source row counts do not reconcile.',
  );
export function nseUdiffFilename(on: string) {
  z.iso.date().parse(on);
  return `BhavCopy_NSE_CM_0_0_0_${on.replaceAll('-', '')}_F_0000.csv`;
}
/** Archive path is the current official all-reports metadata path, not an inferred legacy endpoint. */
export function nseUdiffUrl(on: string) {
  return `https://nsearchives.nseindia.com/content/cm/${nseUdiffFilename(on)}.zip`;
}
const scaled = (value: string) => {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole!) * 1000000n + BigInt(fraction.padEnd(6, '0'));
};
export function parseUdiffRows(
  header: string[],
  rows: string[][],
  effectiveOn: string,
  filename: string,
) {
  if (filename !== nseUdiffFilename(effectiveOn))
    throw Error(
      'Final cash-market filename does not match the requested trade date.',
    );
  if (
    header.length !== NSE_UDIFF_HEADERS.length ||
    header.some((field, i) => field !== NSE_UDIFF_HEADERS[i])
  )
    throw Error('UDiFF header differs from NSE schema20260630.');
  const records = [];
  const identities = new Set<string>();
  const symbols = new Set<string>();
  const instruments = new Set<string>();
  for (let index = 0; index < rows.length; index++) {
    const cells = rows[index]!;
    if (cells.length !== header.length)
      throw Error('UDiFF field count changed.');
    const row = Object.fromEntries(
      header.map((field, i) => [field, cells[i]!]),
    );
    if (
      row.TradDt !== effectiveOn ||
      row.BizDt !== effectiveOn ||
      row.Sgmt !== 'CM' ||
      row.Src !== 'NSE' ||
      row.FinInstrmTp !== 'STK'
    )
      throw Error(
        'UDiFF trade date, business date, exchange or segment does not reconcile.',
      );
    if (row.SctySrs !== 'EQ' || !row.ISIN!.startsWith('INE')) continue;
    z.string()
      .regex(/^INE[A-Z0-9]{8}[0-9]$/)
      .parse(row.ISIN);
    for (const key of [
      'XpryDt',
      'FininstrmActlXpryDt',
      'StrkPric',
      'OptnTp',
      'UndrlygPric',
      'OpnIntrst',
      'ChngInOpnIntrst',
      'Rsvd1',
      'Rsvd2',
      'Rsvd3',
      'Rsvd4',
    ])
      if (row[key] !== '')
        throw Error(
          'Non-applicable cash-equity or reserved UDiFF field is populated.',
        );
    const quote = EquityUdiffQuoteSchema.parse({
      symbol: row.TckrSymb,
      name: row.FinInstrmNm,
      series: 'EQ',
      instrumentId: row.FinInstrmId,
      businessOn: row.BizDt,
      open: row.OpnPric,
      high: row.HghPric,
      low: row.LwPric,
      last: row.LastPric,
      previousClose: row.PrvsClsgPric,
      settlement: row.SttlmPric === '' ? null : row.SttlmPric,
      turnoverRupees: row.TtlTrfVal,
      trades: row.TtlNbOfTxsExctd,
      marketLot: row.NewBrdLotQty,
      session: row.SsnId,
      remarks: row.Rmks,
    });
    const close = price.parse(row.ClsPric),
      volume = integer.parse(row.TtlTradgVol);
    if (BigInt(volume) > 0n) {
      if (
        scaled(quote.low) > scaled(quote.high) ||
        [quote.open, close, quote.last].some(
          (p) =>
            scaled(p) < scaled(quote.low) || scaled(p) > scaled(quote.high),
        )
      )
        throw Error('Traded OHLC prices do not reconcile.');
      if (BigInt(quote.trades) === 0n)
        throw Error('Positive volume cannot have zero trades.');
    }
    if (
      identities.has(row.ISIN!) ||
      symbols.has(quote.symbol) ||
      instruments.has(quote.instrumentId)
    )
      throw Error(
        'Duplicate or conflicting equity identity within the source.',
      );
    identities.add(row.ISIN!);
    symbols.add(quote.symbol);
    instruments.add(quote.instrumentId);
    records.push({
      kind: 'price' as const,
      isin: row.ISIN!,
      effectiveOn,
      sourceRow: index + 2,
      exchange: 'NSE' as const,
      currency: 'INR' as const,
      close,
      volume,
      adjusted: false as const,
      udiff: quote,
    });
  }
  if (!records.length)
    throw Error('No supported EQ-series Indian-equity records in this source.');
  return {
    records,
    coverage: EquitySourceCoverageSchema.parse({
      inputRows: rows.length,
      acceptedRows: records.length,
      excludedRows: rows.length - records.length,
      scope: 'NSE CM STK EQ-series INE-prefix equities only',
    }),
  };
}
