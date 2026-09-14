import { z } from 'zod';

export const ConsentPurposeSchema = z.enum([
  'external-ai-private-context',
  'reading-personalization',
  'scheduled-record-reviews',
  'automatic-material-checks',
]);
export const consentPurposes = ConsentPurposeSchema.options;
export type ConsentPurpose = z.infer<typeof ConsentPurposeSchema>;
export const consentDescriptions: Record<
  ConsentPurpose,
  { title: string; use: string; preserved: string }
> = {
  'external-ai-private-context': {
    title: 'Private context in external AI assistance',
    use: 'Share relevant saved goal names, holding identifiers or saved-reading references with the configured AI provider only when you also choose saved history for that request.',
    preserved:
      'Query-based help and your saved records remain available. Already dispatched requests cannot be recalled.',
  },
  'reading-personalization': {
    title: 'Personalized reading order',
    use: 'Use your followed topics, reactions and saved reading to rank the For you feed.',
    preserved:
      'Chronological reading, explicit filters and muted topics remain available. Your preferences and saved reading remain stored.',
  },
  'scheduled-record-reviews': {
    title: 'Scheduled saved-record reviews',
    use: 'Capture your current saved goals, holdings and allocations when one of your active report schedules is due.',
    preserved:
      'Existing reports, manual report requests, schedule pause/delete and your financial records remain available. Renewing after a lapse starts at the next future occurrence.',
  },
  'automatic-material-checks': {
    title: 'Automatic material checks',
    use: 'Check the stored public annual observations using the material thresholds you explicitly enabled, without opening the app in connected mode.',
    preserved:
      'Manual checks, previous receipts and your threshold settings remain available. After renewing a revoked or expired purpose, explicitly enable automatic checks again to start a fresh baseline.',
  },
};
const ScheduleBasisSchema = z.strictObject({
  kind: z.enum(['legacy-schedule-opt-in', 'schedule-opt-in']),
  recordedAt: z.iso.datetime(),
  scheduleId: z.uuid(),
  scheduleVersion: z.number().int().positive().safe(),
  requestId: z.uuid(),
});
export const ConsentBasisSchema = z.union([
  z.strictObject({ kind: z.literal('review'), recordedAt: z.iso.datetime() }),
  z.strictObject({
    kind: z.literal('legacy-reading-preference'),
    recordedAt: z.null(),
  }),
  z.strictObject({
    kind: z.literal('reading-preference-opt-in'),
    recordedAt: z.iso.datetime(),
  }),
  ScheduleBasisSchema,
]);
export const ConsentStateSchema = z
  .strictObject({
    purpose: ConsentPurposeSchema,
    policyVersion: z.literal('purpose-consent-v1'),
    version: z.number().int().nonnegative().safe(),
    decision: z.enum(['not-granted', 'granted', 'revoked']),
    grantedAt: z.iso.datetime().nullable(),
    expiresAt: z.iso.datetime().nullable(),
    changedAt: z.iso.datetime().nullable(),
    basis: ConsentBasisSchema.nullable(),
  })
  .superRefine((v, c) => {
    if (
      (v.decision === 'not-granted' &&
        (v.version !== 0 ||
          v.basis ||
          v.grantedAt ||
          v.expiresAt ||
          v.changedAt)) ||
      (v.version > 0 && (!v.changedAt || !v.basis)) ||
      (v.decision === 'granted' && !v.basis) ||
      (v.decision === 'revoked' && v.version === 0)
    )
      c.addIssue({
        code: 'custom',
        message: 'Consent basis and decision do not agree.',
      });
    if (
      v.basis?.kind === 'legacy-reading-preference' &&
      (v.purpose !== 'reading-personalization' ||
        v.grantedAt !== null ||
        v.version !== 0)
    )
      c.addIssue({
        code: 'custom',
        message: 'Legacy preference basis has no recorded grant date.',
      });
    if (
      v.basis?.kind === 'reading-preference-opt-in' &&
      v.purpose !== 'reading-personalization'
    )
      c.addIssue({
        code: 'custom',
        message: 'Preference basis belongs to reading personalization.',
      });
    if (
      (v.basis?.kind === 'schedule-opt-in' ||
        v.basis?.kind === 'legacy-schedule-opt-in') &&
      v.purpose !== 'scheduled-record-reviews'
    )
      c.addIssue({
        code: 'custom',
        message: 'Schedule basis belongs to scheduled reviews.',
      });
    if (
      v.expiresAt &&
      (!v.grantedAt || Date.parse(v.expiresAt) <= Date.parse(v.grantedAt))
    )
      c.addIssue({
        code: 'custom',
        message: 'Consent expiry must follow its grant.',
      });
    const legacy =
      v.basis?.kind === 'legacy-reading-preference' ||
      v.basis?.kind === 'legacy-schedule-opt-in';
    if (
      (v.version === 0 && v.decision === 'granted' && !legacy) ||
      (v.version > 0 && legacy) ||
      (v.version === 0 && v.changedAt !== null) ||
      (v.decision === 'granted' && !legacy && !v.grantedAt) ||
      (v.grantedAt &&
        v.changedAt &&
        Date.parse(v.grantedAt) > Date.parse(v.changedAt)) ||
      (v.basis?.recordedAt &&
        Date.parse(v.basis.recordedAt) >
          Date.parse(v.changedAt ?? v.grantedAt ?? v.basis.recordedAt))
    )
      c.addIssue({
        code: 'custom',
        message: 'Consent dates and recorded basis do not agree.',
      });
  });
export type ConsentState = z.infer<typeof ConsentStateSchema>;
export function emptyConsent(purpose: ConsentPurpose): ConsentState {
  return {
    purpose,
    policyVersion: 'purpose-consent-v1',
    version: 0,
    decision: 'not-granted',
    grantedAt: null,
    expiresAt: null,
    changedAt: null,
    basis: null,
  };
}
export function consentActive(state: ConsentState, at: string): boolean {
  return (
    Number.isFinite(Date.parse(at)) &&
    state.decision === 'granted' &&
    [state.grantedAt, state.changedAt, state.basis?.recordedAt].every(
      (date) => !date || Date.parse(date) <= Date.parse(at),
    ) &&
    (!state.expiresAt || Date.parse(state.expiresAt) > Date.parse(at))
  );
}
export function consentStatus(state: ConsentState, at: string) {
  return state.decision !== 'granted'
    ? state.decision
    : !consentActive(state, at)
      ? state.expiresAt && Date.parse(state.expiresAt) <= Date.parse(at)
        ? 'expired'
        : 'unavailable'
      : state.version === 0
        ? 'legacy-active'
        : 'active';
}
export const ConsentViewSchema = z.strictObject({
  record: ConsentStateSchema,
  status: z.enum([
    'not-granted',
    'active',
    'legacy-active',
    'expired',
    'revoked',
    'unavailable',
  ]),
});
export const ConsentListSchema = z
  .strictObject({
    ownerId: z.uuid(),
    evaluatedAt: z.iso.datetime(),
    purposes: z.array(ConsentViewSchema).length(consentPurposes.length),
  })
  .superRefine((v, c) => {
    if (
      new Set(v.purposes.map((p) => p.record.purpose)).size !==
        consentPurposes.length ||
      v.purposes.some(
        (p) => p.status !== consentStatus(p.record, v.evaluatedAt),
      )
    )
      c.addIssue({
        code: 'custom',
        message: 'Consent purposes or evaluated states do not agree.',
      });
  });
export const ConsentWriteSchema = z
  .strictObject({
    requestId: z.uuid(),
    expectedVersion: z.number().int().nonnegative().safe(),
    policyVersion: z.literal('purpose-consent-v1'),
    action: z.enum(['grant', 'renew', 'revoke']),
    reviewed: z.literal(true),
    expiresAt: z.iso.datetime().nullable().optional(),
  })
  .superRefine((v, c) => {
    if ((v.action === 'revoke') !== (v.expiresAt === undefined))
      c.addIssue({
        code: 'custom',
        message:
          'Choose expiry for a grant or renewal; revocation has no new expiry.',
      });
  });
export type ConsentWrite = z.infer<typeof ConsentWriteSchema>;
export const ConsentReceiptSchema = z
  .strictObject({
    requestId: z.uuid().nullable(),
    action: z.enum(['grant', 'renew', 'revoke', 'recorded-opt-in']),
    at: z.iso.datetime(),
    before: ConsentStateSchema,
    state: ConsentStateSchema,
    scheduleEffects: z
      .array(
        z.strictObject({ scheduleId: z.uuid(), nextDueAt: z.iso.datetime() }),
      )
      .max(5),
  })
  .superRefine((v, c) => {
    if (
      v.state.purpose !== v.before.purpose ||
      v.state.version !== v.before.version + 1 ||
      v.state.changedAt !== v.at ||
      (v.action === 'recorded-opt-in'
        ? v.requestId !== null
        : v.requestId === null) ||
      (v.state.purpose !== 'scheduled-record-reviews' &&
        v.scheduleEffects.length > 0) ||
      new Set(v.scheduleEffects.map((e) => e.scheduleId)).size !==
        v.scheduleEffects.length
    )
      c.addIssue({
        code: 'custom',
        message: 'Consent receipt does not match its transition.',
      });
    if (
      (v.action === 'revoke'
        ? v.state.decision !== 'revoked'
        : v.state.decision !== 'granted') ||
      (v.action === 'grant' && v.before.decision !== 'not-granted') ||
      (v.action === 'renew' && v.before.decision === 'not-granted') ||
      (v.action === 'recorded-opt-in' && v.before.version !== 0) ||
      (v.action === 'recorded-opt-in' &&
        !(
          (v.state.purpose === 'reading-personalization' &&
            v.state.basis?.kind === 'reading-preference-opt-in') ||
          (v.state.purpose === 'scheduled-record-reviews' &&
            v.state.basis?.kind === 'schedule-opt-in') ||
          (v.state.purpose === 'automatic-material-checks' &&
            v.state.basis?.kind === 'review')
        )) ||
      (v.action !== 'recorded-opt-in' &&
        (v.state.basis?.kind !== 'review' ||
          v.state.basis.recordedAt !== v.at)) ||
      (v.action !== 'revoke' && v.state.grantedAt !== v.at) ||
      (v.action === 'revoke' &&
        (v.state.grantedAt !== v.before.grantedAt ||
          v.state.expiresAt !== v.before.expiresAt)) ||
      (v.before.changedAt &&
        Date.parse(v.before.changedAt) > Date.parse(v.at)) ||
      (v.before.grantedAt &&
        Date.parse(v.before.grantedAt) > Date.parse(v.at)) ||
      v.scheduleEffects.some(
        (e) => Date.parse(e.nextDueAt) <= Date.parse(v.at),
      ) ||
      (v.scheduleEffects.length > 0 &&
        (v.action === 'revoke' ||
          v.action === 'recorded-opt-in' ||
          consentActive(v.before, v.at)))
    )
      c.addIssue({
        code: 'custom',
        message: 'Consent receipt action, dates or effects do not agree.',
      });
  });
export type ConsentReceipt = z.infer<typeof ConsentReceiptSchema>;
export function reviseConsent(
  before: ConsentState,
  input: ConsentWrite,
  at: string,
): ConsentReceipt {
  if (input.expectedVersion !== before.version)
    throw Error(
      'Consent changed. Reload its current state before reviewing again.',
    );
  if (input.action === 'grant' && before.decision !== 'not-granted')
    throw Error('Review a renewal for this existing purpose.');
  if (input.action === 'renew' && before.decision === 'not-granted')
    throw Error('Review an initial grant for this purpose.');
  if (
    input.expiresAt &&
    (Date.parse(input.expiresAt) <= Date.parse(at) ||
      Date.parse(input.expiresAt) > Date.parse(at) + 366 * 86400000)
  )
    throw Error('Choose a future expiry within 366 days, or no expiry.');
  const state = ConsentStateSchema.parse({
    ...before,
    version: before.version + 1,
    decision: input.action === 'revoke' ? 'revoked' : 'granted',
    grantedAt: input.action === 'revoke' ? before.grantedAt : at,
    expiresAt: input.action === 'revoke' ? before.expiresAt : input.expiresAt,
    changedAt: at,
    basis: { kind: 'review', recordedAt: at },
  });
  return ConsentReceiptSchema.parse({
    requestId: input.requestId,
    action: input.action,
    at,
    before,
    state,
    scheduleEffects: [],
  });
}
const SequenceSchema = z
  .string()
  .regex(/^(0|[1-9][0-9]{0,18})$/)
  .refine(
    (v) =>
      /^(0|[1-9][0-9]{0,18})$/.test(v) && BigInt(v) <= 9223372036854775807n,
    'Invalid consent history sequence.',
  );
export const ConsentHistoryQuerySchema = z.strictObject({
  after: SequenceSchema.optional(),
  upper: SequenceSchema.optional(),
});
export const ConsentExportSchema = z
  .strictObject({
    ownerId: z.uuid(),
    upper: SequenceSchema,
    events: z
      .array(
        z.strictObject({
          sequence: SequenceSchema,
          receipt: ConsentReceiptSchema,
        }),
      )
      .max(100),
    next: SequenceSchema.nullable(),
  })
  .superRefine((v, c) => {
    if (
      ![
        v.upper,
        ...v.events.map((e) => e.sequence),
        ...(v.next ? [v.next] : []),
      ].every((n) => /^(0|[1-9][0-9]{0,18})$/.test(n))
    )
      return;
    if (
      v.events.some(
        (e, i) =>
          BigInt(e.sequence) > BigInt(v.upper) ||
          BigInt(e.sequence) <= BigInt(v.events[i - 1]?.sequence ?? '0'),
      ) ||
      (v.next !== null &&
        (v.events.length !== 100 ||
          v.next !== v.events.at(-1)?.sequence ||
          BigInt(v.next) >= BigInt(v.upper)))
    )
      c.addIssue({
        code: 'custom',
        message: 'Consent export page does not reconcile.',
      });
  });
export const CompleteConsentExportSchema = z
  .strictObject({
    ownerId: z.uuid(),
    upper: SequenceSchema,
    complete: z.literal(true),
    events: z.array(
      z.strictObject({
        sequence: SequenceSchema,
        receipt: ConsentReceiptSchema,
      }),
    ),
  })
  .superRefine((v, c) => {
    if (
      ![v.upper, ...v.events.map((e) => e.sequence)].every((n) =>
        /^(0|[1-9][0-9]{0,18})$/.test(n),
      )
    )
      return;
    if (
      (v.events.at(-1)?.sequence ?? '0') !== v.upper ||
      v.events.some(
        (e, i) =>
          BigInt(e.sequence) <= BigInt(v.events[i - 1]?.sequence ?? '0'),
      )
    )
      c.addIssue({
        code: 'custom',
        message:
          'Complete consent history must reach its ordered retained boundary.',
      });
  });
export const ConsentPrivacySchema = z
  .strictObject({ current: ConsentListSchema, history: ConsentExportSchema })
  .refine(
    (v) => v.current.ownerId === v.history.ownerId,
    'Consent export owners must agree.',
  );
export const CompleteConsentPrivacySchema = z
  .strictObject({
    current: ConsentListSchema,
    history: CompleteConsentExportSchema,
  })
  .refine(
    (v) => v.current.ownerId === v.history.ownerId,
    'Consent export owners must agree.',
  );
