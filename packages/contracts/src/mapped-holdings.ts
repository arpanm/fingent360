import { z } from 'zod';
import {
  AccountHoldingSchema,
  HoldingRowsSchema,
  HoldingsImportSchema,
  MappedHoldingsInputSchema,
  SupplementedHoldingsInputSchema,
  holdingQuantityUnits,
  signedHoldingQuantity,
  holdingsTotal,
  type Holding,
} from './holdings.js';

/** Bounded string-only CSV reader. No formula evaluation or column inference. */
export function inspectMappedCsv(csv: string, minimumColumns: 2 | 3 = 3) {
  if (!csv || csv.length > 50000)
    throw Error('Choose a nonempty CSV no larger than 50,000 characters.');
  const text = csv.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (code <= 8 || (code >= 11 && code <= 31) || code === 127)
      throw Error('CSV contains unsupported control characters.');
  }
  const rows: string[][] = [];
  let row: string[] = [],
    value = '',
    quoted = false,
    closed = false;
  const cell = () => {
    if (value.length > 1000 || row.length >= 32)
      throw Error('CSV cells or column count exceed the supported limits.');
    row.push(value);
    value = '';
    closed = false;
  };
  const record = () => {
    cell();
    rows.push(row);
    row = [];
    if (rows.length > 201) throw Error('Use at most 200 source rows.');
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          value += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else value += ch;
    } else if (ch === ',') cell();
    else if (ch === '\n') record();
    else if (closed)
      throw Error('Unexpected characters after a quoted CSV field.');
    else if (ch === '"') {
      if (value) throw Error('CSV quotes must enclose the complete field.');
      quoted = true;
    } else value += ch;
  }
  if (quoted) throw Error('CSV has an unfinished quoted field.');
  if (row.length || value || closed || !text.endsWith('\n')) record();
  const headers = rows.shift() ?? [];
  if (
    headers.length < minimumColumns ||
    headers.some((h) => !h.trim() || h.length > 80 || /\n/.test(h)) ||
    new Set(headers.map((h) => h.trim().toLowerCase())).size !== headers.length
  )
    throw Error(
      `Use at least ${minimumColumns === 2 ? 'two' : 'three'} unique, nonempty column headers of at most 80 characters.`,
    );
  if (
    rows.some((r) => r.length !== headers.length || r.every((v) => !v.trim()))
  )
    throw Error(
      'Every data row must be nonempty and match the header column count.',
    );
  return { headers, rows };
}
function minor(value: string, unit: 'INR-rupees' | 'INR-paise'): string {
  if (unit === 'INR-paise') {
    if (!/^(0|[1-9][0-9]{0,17})$/.test(value))
      throw Error('Use whole nonnegative INR paise without separators.');
    return value;
  }
  if (!/^(0|[1-9][0-9]{0,15})(\.[0-9]{1,2})?$/.test(value))
    throw Error(
      'Use nonnegative INR rupees with at most two decimal places and no separators.',
    );
  const [whole = '', fraction = ''] = value.split('.');
  return (BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))).toString();
}
export function parseMappedHoldings(raw: unknown) {
  const input = z
      .discriminatedUnion('format', [
        MappedHoldingsInputSchema,
        SupplementedHoldingsInputSchema,
      ])
      .parse(raw),
    supplied = input.format === 'supplemented-csv' ? input.supplement : null,
    { headers, rows } = inspectMappedCsv(input.csv, supplied ? 2 : 3),
    mapping = input.mapping;
  // Leave room for expectedVersion/storageConsent under the existing 100 KiB
  // HTTP body limit. The same object must also be acceptable on device.
  if (new TextEncoder().encode(JSON.stringify(input)).byteLength > 100000)
    throw Error(
      'Mapped import exceeds 100,000 encoded bytes. Remove unused columns from a copy of the complete holdings list.',
    );
  if (
    Math.max(
      mapping.isinColumn,
      mapping.quantityColumn,
      'costColumn' in mapping ? mapping.costColumn : 0,
    ) >= headers.length
  )
    throw Error('A selected column is absent. Review the mapping again.');
  if (rows.length !== input.declaredRowCount)
    throw Error('Declared source row count does not match the CSV.');
  if (
    supplied &&
    (supplied.rows.length !== rows.length ||
      supplied.rows.some(
        (r, i) =>
          r.sourceRow !== i + 2 ||
          r.isin !== rows[i]![mapping.isinColumn]!.trim().toUpperCase() ||
          r.quantity !== rows[i]![mapping.quantityColumn]!.trim(),
      ))
  )
    throw Error(
      'Every supplemental cost must match its source row, ISIN and quantity. Review the costs again.',
    );
  const totals = new Map<string, Holding>();
  const receipts: (Holding & { sourceRow: number })[] = [];
  let total = 0n;
  rows.forEach((cells, index) => {
    let holding: Holding;
    try {
      holding = AccountHoldingSchema.parse({
        isin: cells[mapping.isinColumn]!.trim().toUpperCase(),
        quantity: cells[mapping.quantityColumn]!.trim(),
        totalCostMinor: minor(
          input.format === 'supplemented-csv'
            ? input.supplement.rows[index]!.totalCost.trim()
            : cells[input.mapping.costColumn]!.trim(),
          mapping.costUnit,
        ),
      });
    } catch {
      throw Error(
        `Source row ${index + 2}: check its Indian ISIN, positive quantity and total acquisition cost in the selected unit. No row was imported.`,
      );
    }
    total += BigInt(holding.totalCostMinor);
    if (supplied) receipts.push({ sourceRow: index + 2, ...holding });
    const prior = totals.get(holding.isin);
    if (prior) {
      if (mapping.duplicates === 'reject')
        throw Error(
          `Source row ${index + 2}: duplicate ISIN. Choose Combine only if these rows should form one holding.`,
        );
      const combined = AccountHoldingSchema.safeParse({
        isin: holding.isin,
        quantity: signedHoldingQuantity(
          holdingQuantityUnits(prior.quantity) +
            holdingQuantityUnits(holding.quantity),
        ),
        totalCostMinor: (
          BigInt(prior.totalCostMinor) + BigInt(holding.totalCostMinor)
        ).toString(),
      });
      if (!combined.success)
        throw Error(
          `Source row ${index + 2}: combined holding exceeds the supported quantity or cost limit.`,
        );
      totals.set(holding.isin, combined.data);
    } else totals.set(holding.isin, holding);
  });
  const declared = minor(input.declaredTotal, mapping.costUnit);
  if (declared !== total.toString())
    throw Error(
      supplied
        ? 'Declared reconciled acquisition-cost total does not match the supplied costs.'
        : 'Declared source acquisition-cost total does not match the CSV.',
    );
  const holdings = HoldingRowsSchema.parse([...totals.values()]);
  if (holdingsTotal(holdings) !== declared)
    throw Error('Consolidated holdings do not match the source total.');
  return {
    holdings,
    import: HoldingsImportSchema.parse({
      ...(supplied
        ? {
            parserVersion: 'user-supplemented-holdings-csv-v1',
            supplement: {
              origin: supplied.origin,
              basis: supplied.basis,
              attested: true,
              mapping,
              rows: receipts,
            },
          }
        : { parserVersion: 'user-mapped-holdings-csv-v1', mapping }),
      sourceColumns: headers.length,
      consolidatedRowCount: holdings.length,
      declaredRowCount: rows.length,
      declaredTotalMinor: declared,
    }),
  };
}
export type MappedHoldingsInput =
  | z.infer<typeof MappedHoldingsInputSchema>
  | z.infer<typeof SupplementedHoldingsInputSchema>;
