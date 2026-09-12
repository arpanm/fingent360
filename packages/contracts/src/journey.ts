import { z } from 'zod';

export const AmountSchema = z.string().regex(/^(0|[1-9]\d{0,11})\.\d{2}$/);
export const QuantitySchema = z
  .string()
  .regex(/^(0|[1-9]\d{0,8})(\.\d{1,6})?$/);
export const InstrumentIdSchema = z.enum(['alpha-air', 'bharat-software']);
export const HoldingSchema = z.strictObject({
  instrumentId: InstrumentIdSchema,
  quantity: QuantitySchema.refine(
    (v) => /[1-9]/.test(v),
    'Quantity must be positive',
  ),
});
export const GoalSchema = z.strictObject({
  id: z.uuid(),
  name: z.string().trim().min(1).max(80),
  type: z.enum(['education', 'purchase', 'retirement', 'other']),
  target: AmountSchema.refine((v) => v !== '0.00', 'Target must be positive'),
  targetDate: z.iso.date(),
  priority: z.enum(['essential', 'flexible']),
  allocationPercent: z.number().int().min(0).max(100),
});
export const PortfolioInputSchema = z
  .strictObject({
    holdings: z.array(HoldingSchema).max(2),
    cash: AmountSchema,
    goals: z.array(GoalSchema).max(20),
  })
  .superRefine((v, ctx) => {
    if (
      new Set(v.holdings.map((h) => h.instrumentId)).size !== v.holdings.length
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Duplicate instrument rows; combine quantities first',
      });
    if (new Set(v.goals.map((g) => g.id)).size !== v.goals.length)
      ctx.addIssue({ code: 'custom', message: 'Duplicate goal IDs' });
    if (v.goals.reduce((sum, g) => sum + g.allocationPercent, 0) > 100)
      ctx.addIssue({
        code: 'custom',
        message: 'Goal allocations must total at most 100%',
      });
  });
export type PortfolioInput = z.infer<typeof PortfolioInputSchema>;
export const SaveInputSchema = z.strictObject({
  expectedRevision: z.number().int().nonnegative(),
  idempotencyKey: z.uuid(),
  portfolio: PortfolioInputSchema,
});
export const PreviewInputSchema = z.strictObject({
  csv: z.string().min(1).max(16000),
  cash: AmountSchema,
  sourceTotal: AmountSchema,
});
export const ConfirmInputSchema = z.strictObject({
  previewId: z.uuid(),
  expectedRevision: z.number().int().nonnegative(),
  idempotencyKey: z.uuid(),
});
export const ScenarioSchema = z.enum(['baseline', 'stale', 'conflicting']);
export const ReviewInputSchema = z.strictObject({ scenario: ScenarioSchema });
export const CatalogSchema = z.strictObject({
  mode: z.literal('synthetic'),
  version: z.literal('fixture-v1'),
  asOf: z.iso.datetime(),
  event: z.strictObject({
    id: z.string(),
    title: z.string(),
    summary: z.string(),
    mechanism: z.string(),
    claimKind: z.literal('scenario'),
    affectedInstrumentIds: z.array(InstrumentIdSchema),
    sources: z.array(
      z.strictObject({
        id: z.string(),
        title: z.string(),
        text: z.string(),
        locator: z.string(),
      }),
    ),
  }),
  companies: z.array(
    z.strictObject({
      id: InstrumentIdSchema,
      name: z.string(),
      sector: z.string(),
      price: AmountSchema,
      currency: z.literal('INR'),
      explanation: z.string(),
    }),
  ),
});
const CalculatedAmountSchema = z.string().regex(/^(0|[1-9]\d{0,17})\.\d{2}$/);
export const ValuationSchema = z.strictObject({
  total: CalculatedAmountSchema,
  equity: CalculatedAmountSchema,
  affected: CalculatedAmountSchema,
  affectedPercent: CalculatedAmountSchema.nullable(),
  positions: z.array(
    z.strictObject({
      instrumentId: InstrumentIdSchema,
      value: CalculatedAmountSchema,
    }),
  ),
  goals: z.array(
    z.strictObject({
      id: z.uuid(),
      funded: CalculatedAmountSchema,
      affected: CalculatedAmountSchema,
      fundedPercent: CalculatedAmountSchema,
    }),
  ),
  unallocated: CalculatedAmountSchema,
});
export const WorkspaceSchema = z.strictObject({
  revision: z.number().int().nonnegative(),
  portfolio: PortfolioInputSchema,
  valuation: ValuationSchema,
});
export const SessionSchema = z.strictObject({
  token: z.string().regex(/^[a-f0-9]{64}$/),
});
export const PreviewSchema = z.strictObject({
  id: z.uuid(),
  holdings: z.array(HoldingSchema),
  cash: AmountSchema,
  sourceTotal: AmountSchema,
  calculatedTotal: CalculatedAmountSchema,
  matched: z.boolean(),
  issues: z.array(z.string()),
});
export const ReviewSchema = z.strictObject({
  id: z.uuid(),
  issuedAt: z.iso.datetime(),
  revision: z.number().int().nonnegative(),
  policyVersion: z.literal('educational-demo-v1'),
  fixtureVersion: z.literal('fixture-v1'),
  scenario: ScenarioSchema,
  status: z.enum(['review', 'no_review_trigger', 'unable_to_assess']),
  reasons: z.array(z.string()),
  comparator: z.string(),
  portfolio: PortfolioInputSchema,
  valuation: ValuationSchema,
});
export const ReviewListSchema = z.array(ReviewSchema);
export type Review = z.infer<typeof ReviewSchema>;
export type Workspace = z.infer<typeof WorkspaceSchema>;
export type Preview = z.infer<typeof PreviewSchema>;
export type Catalog = z.infer<typeof CatalogSchema>;
