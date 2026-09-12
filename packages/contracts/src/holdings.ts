import { z } from 'zod';
export function validIndianIsin(value: string): boolean {
  if (!/^IN[A-Z0-9]{9}[0-9]$/.test(value)) return false;
  const digits = [...value]
    .map((v) => (/[A-Z]/.test(v) ? String(v.charCodeAt(0) - 55) : v))
    .join('');
  let total = 0;
  let doubled = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = Number(digits[i]);
    if (doubled) digit *= 2;
    total += digit > 9 ? digit - 9 : digit;
    doubled = !doubled;
  }
  return total % 10 === 0;
}
export const AccountHoldingSchema = z.strictObject({
  isin: z
    .string()
    .refine(validIndianIsin, 'Enter an Indian ISIN with a valid check digit.'),
  quantity: z
    .string()
    .regex(/^(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?$/)
    .refine((v) => /[1-9]/.test(v), 'Quantity must be positive.'),
  totalCostMinor: z.string().regex(/^(0|[1-9][0-9]{0,15})$/),
});
export const HoldingRowsSchema = z
  .array(AccountHoldingSchema)
  .max(200)
  .refine(
    (rows) => new Set(rows.map((r) => r.isin)).size === rows.length,
    'Duplicate ISINs must be consolidated before import.',
  );
export const HoldingsSnapshotSchema = z.strictObject({
  version: z.number().int().nonnegative(),
  holdings: HoldingRowsSchema,
  totalCostMinor: z.string().regex(/^(0|[1-9][0-9]*)$/),
  currency: z.literal('INR'),
  scale: z.literal(2),
  provenance: z.literal('user-entered-unverified'),
  updatedAt: z.iso.datetime().nullable(),
});
export const HoldingsCsvSchema = z.strictObject({
  csv: z.string().max(50000),
  expectedVersion: z.number().int().nonnegative(),
  storageConsent: z.literal(true),
});
export const HoldingsPreviewSchema = z.strictObject({
  previewId: z.uuid(),
  expiresAt: z.iso.datetime(),
  expectedVersion: z.number().int().nonnegative(),
  holdings: HoldingRowsSchema,
  totalCostMinor: z.string().regex(/^(0|[1-9][0-9]*)$/),
  parserVersion: z.literal('standard-holdings-csv-v1'),
});
export const HoldingsConfirmSchema = z.strictObject({
  previewId: z.uuid(),
  expectedVersion: z.number().int().nonnegative(),
});
export const HoldingsHistorySchema = z.strictObject({
  revisions: z.array(HoldingsSnapshotSchema),
});
export type Holding = z.infer<typeof AccountHoldingSchema>;
export type HoldingsSnapshot = z.infer<typeof HoldingsSnapshotSchema>;
export type HoldingsPreview = z.infer<typeof HoldingsPreviewSchema>;
export const holdingsTotal = (rows: Holding[]) =>
  rows.reduce((sum, row) => sum + BigInt(row.totalCostMinor), 0n).toString();
export function parseHoldingsCsv(csv: string): Holding[] {
  const lines = csv
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .trim()
    .split('\n');
  if (lines.shift() !== 'isin,quantity,total_cost_paise')
    throw new Error(
      'Header must be isin,quantity,total_cost_paise. Cost is total acquisition cost in whole INR paise.',
    );
  const rows = lines.map((line, index) => {
    const cells = line.split(',');
    if (cells.length !== 3)
      throw new Error(
        `Row ${index + 2}: expected exactly three unquoted fields.`,
      );
    return { isin: cells[0], quantity: cells[1], totalCostMinor: cells[2] };
  });
  return HoldingRowsSchema.parse(rows);
}
export function holdingsCsv(rows: Holding[]): string {
  return [
    'isin,quantity,total_cost_paise',
    ...rows.map((row) => `${row.isin},${row.quantity},${row.totalCostMinor}`),
  ].join('\n');
}
