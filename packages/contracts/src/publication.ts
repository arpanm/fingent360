import { z } from 'zod';
import {
  FeedItemSchema,
  DiscoveryEvidenceSchema,
  DiscoveryIdSchema,
  type FeedItem,
} from './discovery.js';
import { LibrarySchema, type Library } from './library.js';

export const withdrawnTitle = 'Withdrawn source item';
export const publicationTitle = (status: string) =>
  status === 'withdrawn' ? withdrawnTitle : 'Source item unavailable';
/** Publication history is retained internally. This function only changes disclosure. */
export function publicEdition(
  item: FeedItem,
  currentWithdrawn = false,
): FeedItem {
  if (!currentWithdrawn && item.status !== 'withdrawn') return item;
  return FeedItemSchema.parse({
    ...item,
    title: item.id.startsWith('bea-')
      ? 'Withdrawn BEA release'
      : withdrawnTitle,
    summary: '',
    body: '',
    topics: [],
    relatedIds: [],
    effectiveLabel: `Edition dated ${item.publishedAt.slice(0, 10)}`,
    correctionNote: 'This source edition is unavailable for public reading.',
  });
}
export function currentPublications(
  feed: FeedItem[],
  histories: Record<string, FeedItem[]> = {},
): FeedItem[] {
  const current = new Map<string, FeedItem>();
  for (const raw of [...feed, ...Object.values(histories).flat()]) {
    const item = FeedItemSchema.parse(raw);
    if (
      item.status !== 'draft' &&
      (!current.has(item.id) || current.get(item.id)!.version < item.version)
    )
      current.set(item.id, item);
  }
  return [...current.values()].sort((a, b) => a.id.localeCompare(b.id));
}
export function editionEvidence(item: FeedItem, raw: unknown) {
  const evidence = DiscoveryEvidenceSchema.parse(raw);
  if (
    item.status !== 'published' ||
    !item.sourceHash ||
    item.sourceHash !== evidence.hash
  )
    throw new Error('Published edition evidence is unavailable.');
  // BEA already has an independently validated, narrower metadata excerpt.
  if (item.id.startsWith('bea-') && evidence.scope === 'release-metadata')
    return evidence;
  return DiscoveryEvidenceSchema.parse({
    hash: evidence.hash,
    url: evidence.url,
    retrievedAt: evidence.retrievedAt,
    scope: 'published-edition',
    body: JSON.stringify(
      {
        itemId: item.id,
        version: item.version,
        title: item.title,
        summary: item.summary,
        body: item.body,
        publishedAt: item.publishedAt,
        effectiveLabel: item.effectiveLabel,
        sourceUrl: item.source.url,
      },
      null,
      2,
    ),
  });
}
export function publicationStatus(
  id: string,
  sources: FeedItem[],
): 'published' | 'withdrawn' | 'unavailable' {
  const status = sources.find((s) => s.id === id)?.status;
  return status === 'published' || status === 'withdrawn'
    ? status
    : 'unavailable';
}
export function publicLibrary(library: Library, sources: FeedItem[]): Library {
  return LibrarySchema.parse({
    ...library,
    saved: library.saved.map((s) => {
      const current = sources.find((v) => v.id === s.itemId);
      const status = publicationStatus(s.itemId, sources);
      return {
        ...s,
        currentStatus: status,
        currentVersion: current?.version ?? null,
        ...(status === 'published'
          ? {}
          : { title: publicationTitle(status), summary: '' }),
      };
    }),
    reminders: library.reminders.map((r) => ({
      ...r,
      currentStatus: publicationStatus(r.itemId, sources),
      ...(publicationStatus(r.itemId, sources) === 'published'
        ? {}
        : { title: publicationTitle(publicationStatus(r.itemId, sources)) }),
    })),
    notifications: library.notifications.map((n) => ({
      ...n,
      currentStatus: publicationStatus(n.itemId, sources),
      ...(publicationStatus(n.itemId, sources) === 'published'
        ? {}
        : { title: publicationTitle(publicationStatus(n.itemId, sources)) }),
    })),
  });
}
export const PublicationManifestSchema = z.strictObject({
  admittedAt: z.iso.datetime(),
  items: z
    .array(
      z.strictObject({
        id: DiscoveryIdSchema,
        version: z.number().int().positive(),
        mediaId: z.uuid().nullable(),
      }),
    )
    .max(2000),
});
