import { z } from 'zod';
import {
  MacroIndicatorSchema,
  MacroObservationSchema,
  MacroValueSchema,
  type MacroIndicator,
} from './macro.js';

const factor = 10n ** 30n;
function units(value: string) {
  const negative = value.startsWith('-');
  const [whole, fraction = ''] = (negative ? value.slice(1) : value).split('.');
  const result = BigInt(whole!) * factor + BigInt(fraction.padEnd(30, '0'));
  return negative ? -result : result;
}
function decimal(value: bigint) {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const fraction = (absolute % factor)
    .toString()
    .padStart(30, '0')
    .replace(/0+$/, '');
  return `${negative ? '-' : ''}${absolute / factor}${fraction ? `.${fraction}` : ''}`;
}
export const MaterialThresholdSchema = z
  .string()
  .regex(/^(0|[1-9]\d{0,2})(\.\d{1,6})?$/)
  .pipe(
    z
      .string()
      .refine(
        (v) => units(v) > 0n && units(v) <= 100n * factor,
        'Use a positive threshold up to 100 percentage points.',
      ),
  )
  .transform((v) => decimal(units(v)));
const Difference = z.string().regex(/^-?(0|[1-9]\d{0,18})(\.\d{1,30})?$/);
export const MaterialPolicySchema = z.strictObject({
  indicator: MacroIndicatorSchema,
  thresholdPoints: MaterialThresholdSchema,
});
const unique = <T extends { indicator: string }>(items: T[]) =>
  new Set(items.map((v) => v.indicator)).size === items.length;
const Policies = z
  .array(MaterialPolicySchema)
  .max(2)
  .refine(unique, 'Duplicate indicators are not allowed.');
export const MaterialSourceSchema = z
  .strictObject({
    indicator: MacroIndicatorSchema,
    latest: MacroObservationSchema.nullable(),
    lastSuccessAt: z.iso.datetime().nullable(),
  })
  .refine(
    (value) => !value.latest || value.latest.indicator === value.indicator,
    'Source observation must match its indicator.',
  );
export const MaterialNoticeSchema = z
  .strictObject({
    indicator: MacroIndicatorSchema,
    version: z.number().int().positive(),
    policyVersion: z.number().int().positive(),
    before: MacroObservationSchema,
    after: MacroObservationSchema,
    differencePoints: Difference,
    thresholdPoints: MaterialThresholdSchema,
    checkedAt: z.iso.datetime(),
    read: z.boolean(),
  })
  .superRefine((value, context) => {
    if (
      !MaterialThresholdSchema.safeParse(value.thresholdPoints).success ||
      [value.before.value, value.after.value].some(
        (amount) =>
          amount !== null && !MacroValueSchema.safeParse(amount).success,
      )
    )
      return;
    if (
      value.before.indicator !== value.indicator ||
      value.after.indicator !== value.indicator ||
      value.before.value === null ||
      value.after.value === null ||
      value.after.year <= value.before.year ||
      [value.before, value.after].some(
        (observation) =>
          observation.year > new Date(value.checkedAt).getUTCFullYear() ||
          Date.parse(observation.retrievedAt) > Date.parse(value.checkedAt),
      )
    )
      context.addIssue({
        code: 'custom',
        message:
          'A material notice must compare two known annual periods of the same indicator.',
      });
    else {
      const change = units(value.after.value) - units(value.before.value);
      if (
        decimal(change) !== value.differencePoints ||
        (change < 0n ? -change : change) < units(value.thresholdPoints)
      )
        context.addIssue({
          code: 'custom',
          message:
            'Material notice arithmetic or threshold does not reconcile.',
        });
    }
  });
export const MaterialStateSchema = z
  .strictObject({
    automatic: z
      .strictObject({
        enabled: z.boolean(),
        nextCheckAt: z.iso.datetime().nullable(),
        consentVersion: z.number().int().positive().nullable().default(null),
        lastCheckAt: z.iso.datetime().nullable(),
        lastResult: z.enum(['checked', 'consent-unavailable']).nullable(),
      })
      .default({
        enabled: false,
        nextCheckAt: null,
        consentVersion: null,
        lastCheckAt: null,
        lastResult: null,
      }),
    version: z.number().int().nonnegative(),
    policyVersion: z.number().int().nonnegative(),
    policies: Policies,
    baselines: z
      .array(
        z.strictObject({
          indicator: MacroIndicatorSchema,
          observation: MacroObservationSchema.nullable(),
          pendingReset: z.boolean(),
        }),
      )
      .max(2)
      .refine(unique),
    notices: z.array(MaterialNoticeSchema).max(2).refine(unique),
    followed: z.array(MacroIndicatorSchema).max(2),
    muted: z.array(MacroIndicatorSchema).max(2),
    updatedAt: z.iso.datetime().nullable(),
  })
  .superRefine((value, context) => {
    const policies = new Set(value.policies.map((p) => p.indicator));
    if (value.automatic.enabled !== (value.automatic.nextCheckAt !== null))
      context.addIssue({
        code: 'custom',
        message: 'Automatic due state must match its enabled setting.',
      });
    if (
      value.automatic.enabled &&
      (!value.automatic.consentVersion || !value.policies.length)
    )
      context.addIssue({
        code: 'custom',
        message:
          'Enabled automatic checks require a recorded purpose version and rule.',
      });
    if (
      new Set(value.followed).size !== value.followed.length ||
      new Set(value.muted).size !== value.muted.length ||
      value.policies.some((p) => !value.followed.includes(p.indicator)) ||
      value.baselines.length !== policies.size ||
      value.baselines.some(
        (b) =>
          !policies.has(b.indicator) ||
          (b.observation && b.observation.indicator !== b.indicator),
      ) ||
      value.notices.some(
        (n) =>
          !policies.has(n.indicator) || n.policyVersion > value.policyVersion,
      )
    )
      context.addIssue({
        code: 'custom',
        message: 'Material policy state is inconsistent.',
      });
  });
export type MaterialState = z.infer<typeof MaterialStateSchema>;
export type MaterialSource = z.infer<typeof MaterialSourceSchema>;
const binding = {
  requestId: z.uuid(),
  expectedVersion: z.number().int().nonnegative(),
};
export const MaterialWriteSchema = z.discriminatedUnion('action', [
  z
    .strictObject({
      ...binding,
      action: z.literal('automatic-settings'),
      enabled: z.boolean(),
      backgroundConsent: z.boolean(),
    })
    .refine(
      (value) => !value.enabled || value.backgroundConsent,
      'Explicit background consent is required.',
    ),
  z.strictObject({
    ...binding,
    action: z.literal('configure'),
    policies: Policies,
    storageConsent: z.literal(true),
  }),
  z.strictObject({ ...binding, action: z.literal('check') }),
  z.strictObject({
    ...binding,
    action: z.literal('acknowledge'),
    indicator: MacroIndicatorSchema,
    noticeVersion: z.number().int().positive(),
    read: z.boolean(),
  }),
]);
export type MaterialWrite = z.infer<typeof MaterialWriteSchema>;
export const MaterialOutcomeSchema = z
  .strictObject({
    indicator: MacroIndicatorSchema,
    outcome: z.enum([
      'baseline',
      'material',
      'below-threshold',
      'unchanged',
      'revision',
      'missing',
      'stale',
      'muted',
      'older-period',
      'future-data',
    ]),
    before: MacroObservationSchema.nullable(),
    after: MacroObservationSchema.nullable(),
    differencePoints: Difference.nullable(),
  })
  .superRefine((value, context) => {
    if (
      [value.before?.value, value.after?.value].some(
        (amount) =>
          amount !== undefined &&
          amount !== null &&
          !MacroValueSchema.safeParse(amount).success,
      )
    )
      return;
    if (
      [value.before, value.after].some(
        (observation) =>
          observation && observation.indicator !== value.indicator,
      ) ||
      (value.differencePoints !== null &&
        (!value.before ||
          !value.after ||
          value.before.value === null ||
          value.after.value === null ||
          decimal(units(value.after.value) - units(value.before.value)) !==
            value.differencePoints))
    )
      context.addIssue({
        code: 'custom',
        message: 'Outcome observations and exact difference must reconcile.',
      });
  });
export const MaterialReceiptSchema = z.strictObject({
  requestId: z.uuid().nullable(),
  action: z.enum([
    'configure',
    'check',
    'acknowledge',
    'context',
    'automatic-settings',
    'automatic-check',
    'automatic-paused',
  ]),
  at: z.iso.datetime(),
  state: MaterialStateSchema,
  sources: z.array(MaterialSourceSchema).max(2).refine(unique),
  outcomes: z.array(MaterialOutcomeSchema).max(2),
});
export const MaterialViewSchema = z.strictObject({
  automaticPermissionCurrent: z.boolean().default(false),
  state: MaterialStateSchema,
  sources: z.array(MaterialSourceSchema).max(2).refine(unique),
  evaluatedAt: z.iso.datetime(),
  bundleGeneratedAt: z.iso.datetime().nullable(),
});
export const MaterialWorkerHealthSchema = z.strictObject({
  observedAt: z.iso.datetime(),
  heartbeatAt: z.iso.datetime().nullable(),
  lastSuccessAt: z.iso.datetime().nullable(),
  lastFailureAt: z.iso.datetime().nullable(),
  dueAccounts: z.number().int().nonnegative(),
  retryAccounts: z.number().int().nonnegative(),
});
const sequence = z
  .string()
  .regex(/^(0|[1-9]\d{0,18})$/)
  .pipe(z.string().refine((v) => BigInt(v) <= 9223372036854775807n));
export const MaterialHistoryQuerySchema = z.strictObject({
  after: sequence.optional(),
  upper: sequence.optional(),
});
export const MaterialEventSchema = z.strictObject({
  sequence,
  receipt: MaterialReceiptSchema,
});
export const MaterialExportSchema = z
  .strictObject({
    ownerId: z.uuid(),
    upper: sequence,
    events: z.array(MaterialEventSchema).max(100),
    next: sequence.nullable(),
  })
  .superRefine((value, context) => {
    if (
      value.events.some(
        (event, index) =>
          BigInt(event.sequence) > BigInt(value.upper) ||
          BigInt(event.sequence) <=
            BigInt(value.events[index - 1]?.sequence ?? '0'),
      ) ||
      (value.next !== null &&
        (value.events.length !== 100 ||
          value.next !== value.events.at(-1)?.sequence))
    )
      context.addIssue({
        code: 'custom',
        message: 'Invalid material history ordering or continuation.',
      });
  });
export const CompleteMaterialExportSchema = z
  .strictObject({
    ownerId: z.uuid(),
    events: z.array(MaterialEventSchema),
    complete: z.literal(true),
  })
  .refine(
    (value) =>
      value.events.every(
        (event, index) =>
          BigInt(event.sequence) >
          BigInt(value.events[index - 1]?.sequence ?? '0'),
      ),
    'Complete material history must be strictly ordered.',
  );
export type MaterialReceipt = z.infer<typeof MaterialReceiptSchema>;
export class MaterialError extends Error {
  constructor(
    public status: 400 | 409,
    message: string,
  ) {
    super(message);
  }
}
export function emptyMaterial(): MaterialState {
  return MaterialStateSchema.parse({
    version: 0,
    policyVersion: 0,
    policies: [],
    baselines: [],
    notices: [],
    followed: [],
    muted: [],
    updatedAt: null,
  });
}
export function freshMaterial(source: MaterialSource | undefined, at: string) {
  if (!source?.lastSuccessAt) return false;
  const age = Date.parse(at) - Date.parse(source.lastSuccessAt);
  return (
    age >= 0 &&
    age <= 7 * 86400000 &&
    (!source.latest ||
      (source.latest.year <= new Date(at).getUTCFullYear() &&
        Date.parse(source.latest.retrievedAt) <= Date.parse(at)))
  );
}
function baseline(
  state: MaterialState,
  indicator: MacroIndicator,
  source: MaterialSource | undefined,
  at: string,
) {
  const prior = state.baselines.find((v) => v.indicator === indicator);
  const latest = source?.latest;
  const accepted =
    latest !== undefined &&
    latest !== null &&
    latest.value !== null &&
    freshMaterial(source, at);
  return {
    indicator,
    observation: accepted ? latest : (prior?.observation ?? null),
    pendingReset: !accepted,
  };
}
export function syncMaterialContext(
  previous: MaterialState,
  followed: MacroIndicator[],
  muted: MacroIndicator[],
  sources: MaterialSource[],
  at: string,
): MaterialState {
  const state = structuredClone(MaterialStateSchema.parse(previous));
  const nextFollowed = [...followed].sort(),
    nextMuted = muted.filter((v) => followed.includes(v)).sort();
  if (
    JSON.stringify(nextFollowed) === JSON.stringify(state.followed) &&
    JSON.stringify(nextMuted) === JSON.stringify(state.muted)
  )
    return state;
  state.policies = state.policies.filter((p) => followed.includes(p.indicator));
  state.baselines = state.baselines.filter((v) =>
    state.policies.some((p) => p.indicator === v.indicator),
  );
  state.notices = state.notices.filter((v) =>
    state.policies.some((p) => p.indicator === v.indicator),
  );
  for (const policy of state.policies) {
    if (
      (!state.followed.includes(policy.indicator) &&
        followed.includes(policy.indicator)) ||
      (state.muted.includes(policy.indicator) &&
        !nextMuted.includes(policy.indicator))
    ) {
      state.baselines = state.baselines
        .filter((v) => v.indicator !== policy.indicator)
        .concat(
          baseline(
            state,
            policy.indicator,
            sources.find((s) => s.indicator === policy.indicator),
            at,
          ),
        );
      state.notices = state.notices.filter(
        (v) => v.indicator !== policy.indicator,
      );
    }
  }
  state.followed = nextFollowed;
  state.muted = nextMuted;
  if (!state.policies.length) {
    state.automatic.enabled = false;
    state.automatic.nextCheckAt = null;
  }
  state.version++;
  state.updatedAt = at;
  return MaterialStateSchema.parse(state);
}
export function applyMaterial(
  previous: MaterialState,
  input: MaterialWrite,
  sources: MaterialSource[],
  at: string,
  automaticConsentVersion?: number,
): MaterialReceipt {
  const state = structuredClone(MaterialStateSchema.parse(previous));
  if (input.expectedVersion !== state.version)
    throw new MaterialError(
      409,
      'Your material-change settings changed. Reload before continuing.',
    );
  const outcomes: z.infer<typeof MaterialOutcomeSchema>[] = [];
  if (input.action === 'automatic-settings') {
    if (input.enabled && !state.policies.length)
      throw new MaterialError(
        400,
        'Save a material threshold before enabling automatic checks.',
      );
    if (input.enabled) {
      if (
        !Number.isSafeInteger(automaticConsentVersion) ||
        automaticConsentVersion! <= 0
      )
        throw new MaterialError(
          400,
          'A current recorded background-purpose version is required.',
        );
      state.automatic.consentVersion = automaticConsentVersion!;
      state.baselines = state.policies.map((policy) =>
        baseline(
          state,
          policy.indicator,
          sources.find((source) => source.indicator === policy.indicator),
          at,
        ),
      );
      state.notices = [];
    }
    state.automatic.enabled = input.enabled;
    state.automatic.nextCheckAt = input.enabled
      ? new Date(Date.parse(at) + 86400000).toISOString()
      : null;
  } else if (input.action === 'configure') {
    if (input.policies.some((p) => !state.followed.includes(p.indicator)))
      throw new MaterialError(
        400,
        'Follow each indicator before enabling its material-change rule.',
      );
    const policies = [...input.policies].sort((a, b) =>
      a.indicator.localeCompare(b.indicator),
    );
    for (const policy of policies) {
      const old = state.policies.find((v) => v.indicator === policy.indicator);
      if (!old || old.thresholdPoints !== policy.thresholdPoints) {
        const next = baseline(
          state,
          policy.indicator,
          sources.find((s) => s.indicator === policy.indicator),
          at,
        );
        state.baselines = state.baselines
          .filter((v) => v.indicator !== policy.indicator)
          .concat(next);
        state.notices = state.notices.filter(
          (v) => v.indicator !== policy.indicator,
        );
      }
    }
    state.policies = policies;
    state.baselines = state.baselines.filter((v) =>
      policies.some((p) => p.indicator === v.indicator),
    );
    state.notices = state.notices.filter((v) =>
      policies.some((p) => p.indicator === v.indicator),
    );
    state.policyVersion++;
  } else if (input.action === 'acknowledge') {
    const notice = state.notices.find((n) => n.indicator === input.indicator);
    if (!notice || notice.version !== input.noticeVersion)
      throw new MaterialError(
        409,
        'That material-change notice changed. Reload before acknowledging it.',
      );
    notice.read = input.read;
  } else
    for (const policy of state.policies) {
      const source = sources.find((s) => s.indicator === policy.indicator);
      const prior = state.baselines.find(
        (b) => b.indicator === policy.indicator,
      )!;
      const before = prior.observation,
        after = source?.latest ?? null;
      let outcome: z.infer<typeof MaterialOutcomeSchema>['outcome'];
      let differencePoints: string | null = null;
      if (state.muted.includes(policy.indicator)) outcome = 'muted';
      else if (!after || after.value === null) outcome = 'missing';
      else if (
        [before, after].some(
          (observation) =>
            observation &&
            (observation.year > new Date(at).getUTCFullYear() ||
              Date.parse(observation.retrievedAt) > Date.parse(at)),
        )
      )
        outcome = 'future-data';
      else if (!freshMaterial(source, at)) outcome = 'stale';
      else if (prior.pendingReset || !before || before.value === null) {
        outcome = 'baseline';
        prior.observation = after;
        prior.pendingReset = false;
      } else if (after.year < before.year) outcome = 'older-period';
      else {
        const change = units(after.value) - units(before.value);
        differencePoints = decimal(change);
        outcome =
          after.id === before.id
            ? 'unchanged'
            : after.year === before.year
              ? 'revision'
              : change === 0n
                ? 'unchanged'
                : (change < 0n ? -change : change) >=
                    units(policy.thresholdPoints)
                  ? 'material'
                  : 'below-threshold';
        prior.observation = after;
        if (outcome === 'material') {
          const old = state.notices.find(
            (n) => n.indicator === policy.indicator,
          );
          state.notices = state.notices
            .filter((n) => n.indicator !== policy.indicator)
            .concat({
              indicator: policy.indicator,
              version: (old?.version ?? 0) + 1,
              policyVersion: state.policyVersion,
              before,
              after,
              differencePoints,
              thresholdPoints: policy.thresholdPoints,
              checkedAt: at,
              read: false,
            });
        }
      }
      outcomes.push({
        indicator: policy.indicator,
        outcome,
        before,
        after,
        differencePoints,
      });
    }
  if (!state.policies.length) {
    state.automatic.enabled = false;
    state.automatic.nextCheckAt = null;
  }
  state.version++;
  state.updatedAt = at;
  return MaterialReceiptSchema.parse({
    requestId: input.requestId,
    action: input.action,
    at,
    state,
    sources,
    outcomes,
  });
}

/** Caller serializes the account and checks purpose permission before evaluation. */
export function automaticMaterial(
  previous: MaterialState,
  sources: MaterialSource[],
  at: string,
  permitted: boolean,
): MaterialReceipt | null {
  const state = MaterialStateSchema.parse(previous);
  if (
    !state.automatic.enabled ||
    !state.automatic.nextCheckAt ||
    Date.parse(state.automatic.nextCheckAt) > Date.parse(at)
  )
    return null;
  if (!permitted) {
    state.automatic.enabled = false;
    state.automatic.nextCheckAt = null;
    state.automatic.lastResult = 'consent-unavailable';
    state.updatedAt = at;
    state.version++;
    return MaterialReceiptSchema.parse({
      requestId: null,
      action: 'automatic-paused',
      at,
      state,
      sources: [],
      outcomes: [],
    });
  }
  const receipt = applyMaterial(
    state,
    {
      action: 'check',
      requestId: '00000000-0000-4000-8000-000000000000',
      expectedVersion: state.version,
    },
    sources,
    at,
  );
  receipt.requestId = null;
  receipt.action = 'automatic-check';
  receipt.state.automatic.lastCheckAt = at;
  receipt.state.automatic.lastResult = 'checked';
  receipt.state.automatic.nextCheckAt = new Date(
    Date.parse(at) + 86400000,
  ).toISOString();
  return MaterialReceiptSchema.parse(receipt);
}
