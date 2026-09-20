import { z } from 'zod';
import { DiscoveryIdSchema, type FeedItem } from './discovery.js';
import { EventPublicSchema } from './events.js';

export const ReleaseGroupQuerySchema = z.strictObject({
  sources: z
    .string()
    .max(5049)
    .transform((value) => value.split(','))
    .pipe(
      z
        .array(DiscoveryIdSchema)
        .min(1)
        .max(50)
        .refine(
          (ids) => new Set(ids).size === ids.length,
          'Choose distinct source IDs.',
        ),
    ),
});
export const ReleaseGroupSchema = z.strictObject({
  eventId: z.uuid(),
  eventVersion: z.number().int().positive(),
  title: z.string().min(1).max(200),
  rationale: z.string().min(12).max(1000),
  reviewedAt: z.iso.datetime(),
  members: z
    .array(
      z.strictObject({
        id: DiscoveryIdSchema,
        version: z.number().int().positive(),
        sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
      }),
    )
    .min(2)
    .max(5),
});
export const ReleaseGroupsSchema = z.strictObject({
  groups: z.array(ReleaseGroupSchema).max(50),
  evaluatedAt: z.iso.datetime(),
  limited: z.boolean(),
  conflicted: z.boolean(),
});
export type ReleaseGroup = z.infer<typeof ReleaseGroupSchema>;

/** Call only after current source/identity and lineage admission. No inferred associations. */
export function projectReleaseGroups(
  records: z.infer<typeof EventPublicSchema>[],
  sourceIds: string[],
  evaluatedAt: string,
) {
  const groups: ReleaseGroup[] = [];
  for (const record of records) {
    const event = record.event,
      selection = event?.editorial.releaseGroup;
    if (
      record.status !== 'published' ||
      !event ||
      !selection ||
      !record.reviewedAt
    )
      continue;
    groups.push(
      ReleaseGroupSchema.parse({
        eventId: record.id,
        eventVersion: event.version,
        title: event.editorial.title,
        rationale: selection.rationale,
        reviewedAt: record.reviewedAt,
        members: selection.sourceIds.map((id) => {
          const source = event.sources.find((row) => row.id === id)!;
          return { id, version: source.version, sourceHash: source.sourceHash };
        }),
      }),
    );
  }
  const counts = new Map<string, number>();
  for (const group of groups)
    for (const member of group.members)
      counts.set(member.id, (counts.get(member.id) ?? 0) + 1);
  const relevant = groups.filter((group) =>
    group.members.some((member) => sourceIds.includes(member.id)),
  );
  const conflict = (group: ReleaseGroup) =>
    group.members.some((member) => counts.get(member.id)! > 1);
  return ReleaseGroupsSchema.parse({
    groups: relevant.filter((group) => !conflict(group)),
    evaluatedAt,
    limited: false,
    conflicted: relevant.some(conflict),
  });
}
export function groupContainsEdition(group: ReleaseGroup, item: FeedItem) {
  return group.members.some(
    (member) =>
      member.id === item.id &&
      member.version === item.version &&
      member.sourceHash === item.sourceHash,
  );
}
