import { z } from 'zod';
import { ReadingCalendarContextSchema } from './reading-calendar.js';
import type { FeedItem } from './discovery.js';
import { DiscoveryIdSchema, FeedItemSchema } from './discovery.js';
const Seq = z
  .string()
  .max(19)
  .regex(/^(0|[1-9][0-9]*)$/)
  .refine((v) => BigInt(v) <= 9223372036854775807n, 'Invalid sequence.');
const Keys = z
  .array(z.string().min(1).max(80))
  .max(30)
  .refine((v) => new Set(v).size === v.length, 'Choose each value once.');
export const ReadingFollowSettingsSchema = z.strictObject({
  sources: Keys,
  topics: Keys,
  muted: z.boolean(),
});
export const ReadingFollowConfigSchema = ReadingFollowSettingsSchema.extend({
  version: z.number().int().nonnegative(),
  savedAt: z.iso.datetime().nullable(),
});
export const ReadingFollowWriteSchema = ReadingFollowSettingsSchema.extend({
  requestId: z.uuid(),
  expectedVersion: z.number().int().nonnegative(),
  consent: z.literal(true),
});
export const ReadingFollowCheckSchema = z.strictObject({
  requestId: z.uuid(),
  expectedVersion: z.number().int().nonnegative(),
});
export const ReadingFollowAckSchema = z.strictObject({
  requestId: z.uuid(),
  expectedVersion: z.number().int().positive(),
});
export const ReadingFollowItemSchema = z.strictObject({
  itemId: DiscoveryIdSchema,
  version: z.number().int().positive(),
  edition: z.number().int().positive(),
  sourceId: z.string().max(80),
  matched: z.array(z.string().max(90)).max(60),
  publication: z.enum(['published', 'withdrawn', 'unavailable']),
  status: z.enum(['baseline', 'open', 'acknowledged', 'resolved']),
  reason: z.enum([
    'baseline',
    'new',
    'edition',
    'withdrawn',
    'republished',
    'no-longer-followed',
  ]),
  observedAt: z.iso.datetime(),
  configVersion: z.number().int().positive(),
});
export const ReadingFollowReceiptSchema = z.strictObject({
  requestId: z.uuid(),
  kind: z.enum(['settings', 'check', 'acknowledge']),
  configVersion: z.number().int().nonnegative(),
  startedAt: z.iso.datetime(),
  completedAt: z.iso.datetime(),
  bundleGeneratedAt: z.iso.datetime().nullable(),
  examined: z.number().int().nonnegative(),
  changed: z.number().int().nonnegative(),
});
export const ReadingFollowEventSchema = z.strictObject({
  sequence: Seq,
  record: z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('config'),
      config: ReadingFollowConfigSchema,
    }),
    z.strictObject({ kind: z.literal('item'), item: ReadingFollowItemSchema }),
    z.strictObject({
      kind: z.literal('operation'),
      fingerprint: z.string().max(10000),
      receipt: ReadingFollowReceiptSchema,
    }),
  ]),
});
export const ReadingFollowViewSchema = z.strictObject({
  calendarContext: ReadingCalendarContextSchema.optional(),
  availableIds: z.array(DiscoveryIdSchema).max(100),
  publishedReading: z
    .array(
      z.strictObject({
        id: DiscoveryIdSchema,
        edition: FeedItemSchema.shape.version,
        title: FeedItemSchema.shape.title,
        sourceName: FeedItemSchema.shape.source.shape.name,
      }),
    )
    .max(100),
  config: ReadingFollowConfigSchema,
  items: z.array(ReadingFollowItemSchema).max(100),
  next: DiscoveryIdSchema.nullable(),
  observedAt: z.iso.datetime(),
  bundleGeneratedAt: z.iso.datetime().nullable(),
});
/** Transient current-view metadata only; never persisted in notice history. */
export function readingFollowPublications(items: FeedItem[], ids: string[]) {
  return items
    .filter((item) => item.status === 'published' && ids.includes(item.id))
    .map((item) => ({
      id: item.id,
      edition: item.version,
      title: item.title,
      sourceName: item.source.name,
    }));
}
export const ReadingFollowExportSchema = z.strictObject({
  ownerId: z.uuid(),
  events: z.array(ReadingFollowEventSchema).max(100),
  upper: Seq,
  next: Seq.nullable(),
});
export const CompleteReadingFollowExportSchema = z.strictObject({
  ownerId: z.uuid(),
  events: z.array(ReadingFollowEventSchema),
  complete: z.literal(true),
});
export const ReadingFollowPageSchema = z.strictObject({
  after: DiscoveryIdSchema.optional(),
});
export const ReadingFollowExportQuerySchema = z.strictObject({
  after: Seq.optional(),
  upper: Seq.optional(),
});
export type ReadingFollowConfig = z.infer<typeof ReadingFollowConfigSchema>;
export type ReadingFollowItem = z.infer<typeof ReadingFollowItemSchema>;
export type ReadingFollowReceipt = z.infer<typeof ReadingFollowReceiptSchema>;
export type ReadingFollowEvent = z.infer<typeof ReadingFollowEventSchema>;
export const emptyReadingFollow = (): ReadingFollowConfig => ({
  version: 0,
  sources: [],
  topics: [],
  muted: false,
  savedAt: null,
});
/** Acknowledgement binds the observed notice, even after unrelated settings edits. */
export function readingFollowAckReceipt(
  item: ReadingFollowItem,
  requestId: string,
  startedAt: string,
  completedAt: string,
  bundleGeneratedAt: string | null,
): ReadingFollowReceipt {
  return ReadingFollowReceiptSchema.parse({
    requestId,
    kind: 'acknowledge',
    configVersion: item.configVersion,
    startedAt,
    completedAt,
    bundleGeneratedAt,
    examined: 1,
    changed: 1,
  });
}

export function readingFollowKeys(
  item: FeedItem,
  sourceId: string,
  config: ReadingFollowConfig,
) {
  return [
    ...(config.sources.includes(sourceId) ? [`source:${sourceId}`] : []),
    ...item.topics
      .filter((topic) => config.topics.includes(topic))
      .map((topic) => `topic:${topic}`),
  ].sort();
}
export function evaluateReadingFollow(
  old: ReadingFollowItem | null,
  item: FeedItem | null,
  sourceId: string,
  config: ReadingFollowConfig,
  at: string,
  baseline = false,
  previousConfig?: ReadingFollowConfig,
): ReadingFollowItem | null {
  const matched = item ? readingFollowKeys(item, sourceId, config) : [];
  if (baseline && previousConfig) {
    const selected = (key: string, value: ReadingFollowConfig) =>
      key.startsWith('source:')
        ? value.sources.includes(key.slice(7))
        : value.topics.includes(key.slice(6));
    const candidates = [
      ...(old?.matched ?? []),
      ...(item ? readingFollowKeys(item, sourceId, previousConfig) : []),
    ];
    const retained =
      !!old &&
      candidates.some(
        (key) => selected(key, previousConfig) && selected(key, config),
      );
    const unmute = previousConfig.muted && !config.muted;
    // Editing unrelated follows or muting must not silently acknowledge a notice
    // or advance its observed edition. Only an explicit unmute resets backlog.
    if (retained && !unmute) return null;
    if (config.muted && !old) return null;
  }

  if (
    !old &&
    (!item || item.status !== 'published' || !matched.length || config.muted)
  )
    return null;
  const publication =
    item?.status === 'published'
      ? 'published'
      : item?.status === 'withdrawn'
        ? 'withdrawn'
        : 'unavailable';
  const inactive = config.muted || !matched.length || !item;
  const reason = baseline
    ? 'baseline'
    : inactive
      ? 'no-longer-followed'
      : publication === 'withdrawn'
        ? 'withdrawn'
        : old?.publication === 'withdrawn'
          ? 'republished'
          : old
            ? 'edition'
            : 'new';
  const status =
    baseline || inactive
      ? old?.status === 'open' || old?.status === 'acknowledged'
        ? 'resolved'
        : 'baseline'
      : 'open';
  if (
    old &&
    !baseline &&
    !inactive &&
    old.edition === item?.version &&
    old.publication === publication &&
    JSON.stringify(old.matched) === JSON.stringify(matched)
  )
    return null;
  if (old && inactive && old.status !== 'open' && old.status !== 'acknowledged')
    return null;
  return ReadingFollowItemSchema.parse({
    itemId: item?.id ?? old!.itemId,
    version: (old?.version ?? 0) + 1,
    edition: item?.version ?? old!.edition,
    sourceId: item ? sourceId : old!.sourceId,
    matched,
    publication,
    status,
    reason,
    observedAt: at,
    configVersion: config.version,
  });
}
