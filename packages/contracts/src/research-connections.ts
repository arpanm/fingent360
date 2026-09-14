import { isBeaReleaseUrl } from './bea.js';
import { z } from 'zod';
import { DiscoveryIdSchema, type FeedItem } from './discovery.js';
import { AccountHoldingSchema, type HoldingsSnapshot } from './holdings.js';
import type { SavedGoal } from './goals.js';
import { sourceIdFor } from './research.js';

export const ConnectionSourceBindingSchema = z.strictObject({
  itemId: DiscoveryIdSchema,
  version: z.number().int().positive(),
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
});
export const ConnectionSourceReceiptSchema =
  ConnectionSourceBindingSchema.extend({
    name: z.string().min(1).max(200),
    url: z.url().refine((v) => {
      const u = new URL(v);
      return u.protocol === 'https:' && !u.username && !u.password;
    }),
    publishedAt: z.iso.datetime(),
    effectiveLabel: z.string().max(160),
    retrievedAt: z.iso.datetime(),
  });
export const ConnectionTargetBindingSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('holding'),
    id: AccountHoldingSchema.shape.isin,
    version: z.number().int().positive(),
  }),
  z.strictObject({
    kind: z.literal('goal'),
    id: z.uuid(),
    version: z.number().int().positive(),
  }),
]);
export const ConnectionTargetSchema = z.strictObject({
  binding: ConnectionTargetBindingSchema,
  label: z.string().min(1).max(200),
});
const Note = z.string().trim().min(1).max(1000);
const fields = {
  requestId: z.uuid(),
  expectedVersion: z.number().int().positive(),
};
const bindingFields = {
  source: ConnectionSourceBindingSchema,
  target: ConnectionTargetBindingSchema,
  note: Note,
  storageConsent: z.literal(true),
};
export const ResearchConnectionWriteSchema = z.discriminatedUnion('action', [
  z.strictObject({
    ...fields,
    expectedVersion: z.literal(0),
    action: z.literal('create'),
    ...bindingFields,
  }),
  z.strictObject({
    ...fields,
    action: z.literal('reaffirm'),
    ...bindingFields,
  }),
  z.strictObject({
    ...fields,
    action: z.literal('edit'),
    note: Note,
    storageConsent: z.literal(true),
  }),
  z.strictObject({ ...fields, action: z.literal('remove') }),
]);
export const ResearchConnectionRevisionSchema = z.strictObject({
  id: z.uuid(),
  version: z.number().int().positive(),
  action: z.enum(['create', 'edit', 'reaffirm', 'remove']),
  source: ConnectionSourceReceiptSchema,
  target: ConnectionTargetSchema,
  note: Note,
  savedAt: z.iso.datetime(),
  consentedAt: z.iso.datetime(),
  removed: z.boolean(),
});
export const ResearchConnectionHistorySchema = z.strictObject({
  revisions: z.array(ResearchConnectionRevisionSchema),
});
export const ResearchConnectionViewSchema = z.strictObject({
  revision: ResearchConnectionRevisionSchema,
  reviewReasons: z.array(z.string()),
  currentSource: ConnectionSourceReceiptSchema.nullable(),
  currentTarget: ConnectionTargetSchema.nullable(),
});
export const ResearchConnectionsSchema = z.strictObject({
  connections: z.array(ResearchConnectionViewSchema).max(200),
  targets: z.array(ConnectionTargetSchema),
  selectedSource: ConnectionSourceReceiptSchema.nullable(),
  evaluatedAt: z.iso.datetime(),
  bundleGeneratedAt: z.iso.datetime().nullable(),
});
export const ResearchConnectionQuerySchema = z.strictObject({
  itemId: DiscoveryIdSchema.optional(),
});
export type ConnectionSourceBinding = z.infer<
  typeof ConnectionSourceBindingSchema
>;
export type ConnectionSourceReceipt = z.infer<
  typeof ConnectionSourceReceiptSchema
>;
export type ConnectionTargetBinding = z.infer<
  typeof ConnectionTargetBindingSchema
>;
export type ConnectionTarget = z.infer<typeof ConnectionTargetSchema>;
export type ResearchConnectionWrite = z.infer<
  typeof ResearchConnectionWriteSchema
>;
export type ResearchConnectionRevision = z.infer<
  typeof ResearchConnectionRevisionSchema
>;
export type ResearchConnectionView = z.infer<
  typeof ResearchConnectionViewSchema
>;
export type ResearchConnections = z.infer<typeof ResearchConnectionsSchema>;
export class ConnectionError extends Error {
  constructor(
    public status: 400 | 404 | 409,
    message: string,
  ) {
    super(message);
  }
}
export function connectionSource(
  item: FeedItem | undefined,
): ConnectionSourceReceipt | null {
  if (
    !item ||
    item.status !== 'published' ||
    !item.sourceHash ||
    (item.id.startsWith('bea-') && !isBeaReleaseUrl(item.source.url)) ||
    ![
      'fed',
      'ecb-press',
      'ecb-statistics',
      'pib',
      'world-bank',
      'bea',
    ].includes(sourceIdFor(item))
  )
    return null;
  return ConnectionSourceReceiptSchema.parse({
    itemId: item.id,
    version: item.version,
    sourceHash: item.sourceHash,
    name: item.source.name,
    url: item.source.url,
    publishedAt: item.publishedAt,
    effectiveLabel: item.effectiveLabel,
    retrievedAt: item.source.retrievedAt,
  });
}
export function connectionTargets(
  holdings: HoldingsSnapshot,
  goals: SavedGoal[],
): ConnectionTarget[] {
  return [
    ...holdings.holdings.map((h) => ({
      binding: {
        kind: 'holding' as const,
        id: h.isin,
        version: holdings.version,
      },
      label: h.isin,
    })),
    ...goals.map((g) => ({
      binding: { kind: 'goal' as const, id: g.id, version: g.version },
      label: g.name,
    })),
  ];
}
function sameTarget(a: ConnectionTargetBinding, b: ConnectionTargetBinding) {
  return a.kind === b.kind && a.id === b.id;
}
export function connectionView(
  revision: ResearchConnectionRevision,
  sources: ConnectionSourceReceipt[],
  targets: ConnectionTarget[],
): ResearchConnectionView {
  const currentSource =
    sources.find((s) => s.itemId === revision.source.itemId) ?? null;
  const currentTarget =
    targets.find((t) => sameTarget(t.binding, revision.target.binding)) ?? null;
  const reviewReasons: string[] = [];
  if (!currentSource)
    reviewReasons.push(
      'The source is withdrawn or no longer published. Its text is unavailable here.',
    );
  else if (
    currentSource.version !== revision.source.version ||
    currentSource.sourceHash !== revision.source.sourceHash
  )
    reviewReasons.push('A newer source edition is published.');
  if (!currentTarget) reviewReasons.push('Your connected record was removed.');
  else if (currentTarget.binding.version !== revision.target.binding.version)
    reviewReasons.push(
      'Your connected records changed since you saved this connection.',
    );
  return ResearchConnectionViewSchema.parse({
    revision,
    reviewReasons,
    currentSource,
    currentTarget,
  });
}
export function reviseConnection(
  id: string,
  input: ResearchConnectionWrite,
  previous: ResearchConnectionRevision | null,
  sources: ConnectionSourceReceipt[],
  targets: ConnectionTarget[],
  savedAt: string,
): ResearchConnectionRevision {
  if ((previous?.version ?? 0) !== input.expectedVersion)
    throw new ConnectionError(
      409,
      'This connection changed. Reload and review before saving.',
    );
  if (previous?.removed)
    throw new ConnectionError(
      409,
      'This connection was removed. Its history remains available.',
    );
  if (input.action !== 'create' && !previous)
    throw new ConnectionError(404, 'Connection not found.');
  if (input.action === 'edit' || input.action === 'remove')
    return ResearchConnectionRevisionSchema.parse({
      ...previous,
      version: input.expectedVersion + 1,
      action: input.action,
      note: input.action === 'edit' ? input.note : previous!.note,
      savedAt,
      consentedAt: input.action === 'edit' ? savedAt : previous!.consentedAt,
      removed: input.action === 'remove',
    });
  const source = sources.find((s) => s.itemId === input.source.itemId);
  if (!source)
    throw new ConnectionError(
      409,
      'This source is no longer published. Reload your connections.',
    );
  if (
    source.version !== input.source.version ||
    source.sourceHash !== input.source.sourceHash
  )
    throw new ConnectionError(
      409,
      'The source edition changed. Reload and review the current published edition.',
    );
  const target = targets.find((t) => sameTarget(t.binding, input.target));
  if (!target)
    throw new ConnectionError(
      400,
      'Choose an existing holding or goal belonging to this account.',
    );
  if (target.binding.version !== input.target.version)
    throw new ConnectionError(
      409,
      'Your connected record changed. Reload and review its current version.',
    );
  if (
    previous &&
    (previous.source.itemId !== source.itemId ||
      !sameTarget(previous.target.binding, target.binding))
  )
    throw new ConnectionError(
      400,
      'Reaffirm the same source and record. Create a separate connection to choose another.',
    );
  return ResearchConnectionRevisionSchema.parse({
    id,
    version: input.expectedVersion + 1,
    action: input.action,
    source,
    target,
    note: input.note,
    savedAt,
    consentedAt: savedAt,
    removed: false,
  });
}
