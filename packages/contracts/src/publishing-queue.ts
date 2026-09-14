import { z } from 'zod';
import {
  DiscoveryIdSchema,
  DiscoveryRunSchema,
  FeedItemSchema,
} from './discovery.js';
import { sourceIdFor } from './research.js';

export const publishingSources = [
  'fed',
  'ecb-press',
  'ecb-statistics',
  'pib',
  'bea',
  'world-bank',
  'glossary',
  'other',
] as const;
export const publishingSourceLabels: Record<
  (typeof publishingSources)[number],
  string
> = {
  fed: 'Federal Reserve',
  'ecb-press': 'ECB press',
  'ecb-statistics': 'ECB statistics',
  pib: 'PIB',
  bea: 'BEA',
  'world-bank': 'World Bank',
  glossary: 'Authored glossary',
  other: 'Other',
};
export const PublishingFiltersSchema = z.strictObject({
  source: z.enum(publishingSources).optional(),
  status: z.enum(['draft', 'published', 'withdrawn']).optional(),
  q: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .refine(
      (value) =>
        [...value].every((character) => {
          const code = character.charCodeAt(0);
          return code >= 32 && code !== 127;
        }),
      'Search text cannot include control characters.',
    )
    .optional(),
});
export type PublishingFilters = z.infer<typeof PublishingFiltersSchema>;
export const PublishingCursorSchema = z
  .string()
  .min(40)
  .max(2400)
  .regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
export const PublishingQuerySchema = PublishingFiltersSchema.extend({
  cursor: PublishingCursorSchema.optional(),
});
export const PublishingPositionSchema = z.strictObject({
  id: DiscoveryIdSchema,
  changedAt: z.iso.datetime({ precision: 6 }),
});
export function comparePublishingPosition(
  a: z.infer<typeof PublishingPositionSchema>,
  b: z.infer<typeof PublishingPositionSchema>,
) {
  if (a.changedAt !== b.changedAt) return a.changedAt < b.changedAt ? -1 : 1;
  return a.id === b.id ? 0 : a.id < b.id ? -1 : 1;
}
export const PublishingEntrySchema = z.strictObject({
  item: FeedItemSchema,
  changedAt: z.iso.datetime({ precision: 6 }),
});
export const PublishingPageSchema = z
  .strictObject({
    items: z.array(PublishingEntrySchema).max(20),
    filters: PublishingFiltersSchema,
    pageSize: z.literal(20),
    upper: PublishingPositionSchema.nullable(),
    openedAt: z.iso.datetime(),
    evaluatedAt: z.iso.datetime(),
    nextCursor: PublishingCursorSchema.nullable(),
    latestRun: DiscoveryRunSchema.nullable(),
  })
  .refine(
    (page) =>
      !page.nextCursor || (page.items.length === 20 && page.upper !== null),
  )
  .refine((page) => page.upper !== null || page.items.length === 0)
  .refine(
    (page) =>
      new Set(page.items.map(({ item }) => item.id)).size === page.items.length,
  )
  .refine((page) =>
    page.items.every(
      ({ item, changedAt }, index) =>
        (!page.upper ||
          comparePublishingPosition({ id: item.id, changedAt }, page.upper) <=
            0) &&
        (index === 0 ||
          comparePublishingPosition(
            {
              id: page.items[index - 1]!.item.id,
              changedAt: page.items[index - 1]!.changedAt,
            },
            { id: item.id, changedAt },
          ) > 0) &&
        (!page.filters.status || item.status === page.filters.status) &&
        (!page.filters.source || sourceIdFor(item) === page.filters.source),
    ),
  );
export type PublishingPage = z.infer<typeof PublishingPageSchema>;
