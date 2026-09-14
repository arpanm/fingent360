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
export const HoldingsImportSchema = z.strictObject({
  parserVersion: z.enum([
    'standard-holdings-csv-v1',
    'standard-holdings-xlsx-v1',
  ]),
  declaredRowCount: z.number().int().min(0).max(200).optional(),
  declaredTotalMinor: z
    .string()
    .regex(/^(0|[1-9][0-9]*)$/)
    .optional(),
});
export const HoldingsSnapshotSchema = z.strictObject({
  version: z.number().int().nonnegative(),
  holdings: HoldingRowsSchema,
  totalCostMinor: z.string().regex(/^(0|[1-9][0-9]*)$/),
  currency: z.literal('INR'),
  scale: z.literal(2),
  provenance: z.literal('user-entered-unverified'),
  updatedAt: z.iso.datetime().nullable(),
  import: HoldingsImportSchema.optional(),
});
export const HoldingsCsvSchema = z.strictObject({
  csv: z.string().max(50000),
  expectedVersion: z.number().int().nonnegative(),
  storageConsent: z.literal(true),
});
export const HoldingsWorkbookSchema = z.strictObject({
  format: z.literal('xlsx'),
  workbookBase64: z.string().min(1).max(87384),
  expectedVersion: z.number().int().nonnegative(),
  storageConsent: z.literal(true),
});
export const HoldingsImportRequestSchema = z.union([
  HoldingsCsvSchema,
  HoldingsWorkbookSchema,
]);
export const HoldingsTemplateSchema = z.strictObject({
  filename: z.string(),
  mime: z.literal(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ),
  base64: z.string().max(87384),
  synthetic: z.boolean(),
});
export const HoldingChangeSchema = z.strictObject({
  isin: AccountHoldingSchema.shape.isin,
  status: z.enum(['added', 'removed', 'changed', 'unchanged']),
  before: AccountHoldingSchema.nullable(),
  after: AccountHoldingSchema.nullable(),
  quantityDelta: z.string().regex(/^-?(0|[1-9][0-9]*)(\.[0-9]{1,6})?$/),
  costDeltaMinor: z.string().regex(/^-?(0|[1-9][0-9]*)$/),
});
export const HoldingsReconciliationSchema = z.strictObject({
  policy: z.literal('holdings-replacement-v1'),
  baseline: HoldingsSnapshotSchema,
  changes: z.array(HoldingChangeSchema).max(400),
  totalCostDeltaMinor: z.string().regex(/^-?(0|[1-9][0-9]*)$/),
  dependencies: z.strictObject({
    allocationRows: z.number().int().nonnegative(),
    holdingConnections: z.number().int().nonnegative(),
    checkedAt: z.iso.datetime(),
  }),
});
export function holdingQuantityUnits(value: string): bigint {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole!) * 1000000n + BigInt(fraction.padEnd(6, '0'));
}
export function signedHoldingQuantity(units: bigint): string {
  const negative = units < 0n,
    absolute = negative ? -units : units,
    fraction = (absolute % 1000000n)
      .toString()
      .padStart(6, '0')
      .replace(/0+$/, '');
  return `${negative ? '-' : ''}${absolute / 1000000n}${fraction ? '.' + fraction : ''}`;
}
export function reconcileHoldings(
  baseline: HoldingsSnapshot,
  proposed: Holding[],
  dependencies: z.infer<typeof HoldingsReconciliationSchema>['dependencies'],
) {
  const original = HoldingsSnapshotSchema.parse(baseline),
    next = HoldingRowsSchema.parse(proposed),
    ids = [
      ...new Set([...original.holdings, ...next].map((r) => r.isin)),
    ].sort();
  if (holdingsTotal(original.holdings) !== original.totalCostMinor)
    throw Error('Baseline acquisition costs do not reconcile.');
  return HoldingsReconciliationSchema.parse({
    policy: 'holdings-replacement-v1',
    baseline: original,
    dependencies,
    totalCostDeltaMinor: (
      BigInt(holdingsTotal(next)) - BigInt(original.totalCostMinor)
    ).toString(),
    changes: ids.map((isin) => {
      const before = original.holdings.find((r) => r.isin === isin) ?? null,
        after = next.find((r) => r.isin === isin) ?? null,
        quantityDelta = signedHoldingQuantity(
          (after ? holdingQuantityUnits(after.quantity) : 0n) -
            (before ? holdingQuantityUnits(before.quantity) : 0n),
        ),
        costDeltaMinor = (
          BigInt(after?.totalCostMinor ?? '0') -
          BigInt(before?.totalCostMinor ?? '0')
        ).toString();
      return {
        isin,
        before,
        after,
        quantityDelta,
        costDeltaMinor,
        status: !before
          ? 'added'
          : !after
            ? 'removed'
            : quantityDelta === '0' && costDeltaMinor === '0'
              ? 'unchanged'
              : 'changed',
      };
    }),
  });
}
export const HoldingsPreviewSchema = z.strictObject({
  reconciliation: HoldingsReconciliationSchema.optional(),
  previewId: z.uuid(),
  expiresAt: z.iso.datetime(),
  expectedVersion: z.number().int().nonnegative(),
  holdings: HoldingRowsSchema,
  totalCostMinor: z.string().regex(/^(0|[1-9][0-9]*)$/),
  parserVersion: z.enum([
    'standard-holdings-csv-v1',
    'standard-holdings-xlsx-v1',
  ]),
  import: HoldingsImportSchema.optional(),
});
export const HoldingsConfirmSchema = z.strictObject({
  acknowledgeRemovals: z.literal(true).optional(),
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

/** Decode pre-XLSX array receipts and new normalized import receipts without retaining uploaded bytes. */
export function storedHoldingsPreview(value: unknown): {
  holdings: Holding[];
  import?: z.infer<typeof HoldingsImportSchema>;
  reconciliation?: z.infer<typeof HoldingsReconciliationSchema> | undefined;
} {
  if (Array.isArray(value)) return { holdings: HoldingRowsSchema.parse(value) };
  return z
    .strictObject({
      holdings: HoldingRowsSchema,
      import: HoldingsImportSchema,
      reconciliation: HoldingsReconciliationSchema.optional(),
    })
    .parse(value);
}
