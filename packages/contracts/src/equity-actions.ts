import { z } from 'zod';

export const NSE_ACTIONS_PARSER = 'nse-corporate-actions-csv-v1';
export const NSE_ACTIONS_URL =
  'https://www.nseindia.com/companies-listing/corporate-filings-actions';
export const NseActionDetailsSchema = z.strictObject({
  symbol: z.string().min(1).max(240),
  series: z.string().min(1).max(240),
  name: z.string().min(1).max(240),
  faceValue: z.string().regex(/^(0|[1-9][0-9]{0,20})(\.[0-9]{1,8})?$/),
  exOn: z.iso.date(),
  bookClosureStart: z.iso.date().nullable(),
  bookClosureEnd: z.iso.date().nullable(),
  identityEditionId: z.uuid(),
  identityHash: z.string().regex(/^[a-f0-9]{64}$/),
});
export type ActionIdentity = {
  isin: string;
  symbol: string;
  series: string;
  effectiveOn: string;
  editionId: string;
  hash: string;
};
const headers = [
  'SYMBOL',
  'COMPANY NAME',
  'SERIES',
  'PURPOSE',
  'FACE VALUE',
  'EX-DATE',
  'RECORD DATE',
  'BOOK CLOSURE START DATE',
  'BOOK CLOSURE END DATE',
];
function date(value: string, optional = false): string | null {
  if (optional && (value === '-' || value === '')) return null;
  const match = /^(\d{2})-([A-Za-z]{3})-(\d{4})$/.exec(value);
  const months = [
    'jan',
    'feb',
    'mar',
    'apr',
    'may',
    'jun',
    'jul',
    'aug',
    'sep',
    'oct',
    'nov',
    'dec',
  ];
  if (!match || !months.includes(match[2]!.toLowerCase()))
    throw Error('NSE corporate-action date must use DD-MMM-YYYY.');
  return z.iso
    .date()
    .parse(
      `${match[3]}-${String(months.indexOf(match[2]!.toLowerCase()) + 1).padStart(2, '0')}-${match[1]}`,
    );
}
/** No numeric inference is made from free-text purposes. Identity joins fail closed. */
export function parseNseActionRows(
  header: string[],
  rows: string[][],
  effectiveOn: string,
  identities: ActionIdentity[],
) {
  if (
    header.length !== headers.length ||
    header.some((value, i) => value !== headers[i])
  )
    throw Error('NSE corporate-action CSV header changed.');
  const bySymbol = new Map<string, ActionIdentity[]>();
  for (const identity of identities) {
    if (identity.effectiveOn > effectiveOn) continue;
    const key = JSON.stringify([identity.symbol, identity.series]);
    const existing = bySymbol.get(key) ?? [];
    existing.push(identity);
    bySymbol.set(key, existing);
  }
  for (const candidates of bySymbol.values())
    candidates.sort(
      (a, b) =>
        b.effectiveOn.localeCompare(a.effectiveOn) ||
        a.editionId.localeCompare(b.editionId),
    );
  return rows.map((cells, index) => {
    if (cells.length !== headers.length)
      throw Error(
        `Row ${index + 2}: NSE corporate-action column count changed.`,
      );
    const exOn = date(cells[5]!)!;
    // Historical actions must never inherit a later symbol reuse. Future
    // announced actions can use only identities known at the capture date.
    const identityOn = exOn < effectiveOn ? exOn : effectiveOn;
    const candidates = bySymbol.get(JSON.stringify([cells[0], cells[2]])) ?? [];
    const newest = candidates.find(
      (identity) => identity.effectiveOn <= identityOn,
    )?.effectiveOn;
    const current =
      newest === undefined
        ? []
        : candidates.filter((identity) => identity.effectiveOn === newest);
    if (!current.length || new Set(current.map((row) => row.isin)).size !== 1)
      throw Error(
        `Row ${index + 2}: publish an unambiguous NSE symbol/series identity first.`,
      );
    const identity = current.sort((a, b) =>
      a.editionId.localeCompare(b.editionId),
    )[0]!;
    const details = NseActionDetailsSchema.parse({
      symbol: cells[0],
      name: cells[1],
      series: cells[2],
      faceValue: cells[4],
      exOn,
      bookClosureStart: date(cells[7]!, true),
      bookClosureEnd: date(cells[8]!, true),
      identityEditionId: identity.editionId,
      identityHash: identity.hash,
    });
    if (
      details.bookClosureStart &&
      details.bookClosureEnd &&
      details.bookClosureStart > details.bookClosureEnd
    )
      throw Error('Book closure dates are reversed.');
    return {
      kind: 'corporate-action' as const,
      isin: identity.isin,
      effectiveOn,
      sourceRow: index + 2,
      purpose: z.string().parse(cells[3]),
      recordOn: date(cells[6]!, true),
      adjustment: 'not-applied' as const,
      nseAction: details,
    };
  });
}
