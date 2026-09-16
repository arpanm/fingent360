import { z } from 'zod';
import { FeedItemSchema, type FeedItem } from './discovery.js';
const HttpsUrl = z.url().refine((value) => {
  const url = new URL(value);
  return url.protocol === 'https:' && !url.username && !url.password;
});
export const ResearchFiltersSchema = z.strictObject({
  q: z.string().trim().max(200).optional(),
  kind: z.enum(['news', 'term', 'annual']).optional(),
  source: z
    .string()
    .regex(/^[a-z0-9-]{1,80}$/)
    .optional(),
  topic: z.string().trim().min(1).max(80).optional(),
  region: z.enum(['india', 'global']).optional(),
  view: z.enum(['today', 'explore']).optional(),
});
export type ResearchFilters = z.infer<typeof ResearchFiltersSchema>;
export const ResearchSourceSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]{1,80}$/),
  name: z.string().min(1).max(200),
  region: z.enum(['india', 'global']),
  description: z.string().max(2000),
  homeUrl: HttpsUrl,
  feedUrl: HttpsUrl.nullable(),
  termsUrl: HttpsUrl,
  rights: z.string().max(4000),
  access: z.enum(['enabled', 'blocked', 'review_required']),
  accessNote: z.string().max(2000),
  topics: z.array(z.string().max(80)),
  publishedCount: z.number().int().nonnegative(),
  latestPublishedAt: z.iso.datetime().nullable(),
  lastCheckedAt: z.iso.datetime().nullable(),
  lastSuccessAt: z.iso.datetime().nullable(),
  lastRunStatus: z.enum(['running', 'succeeded', 'failed']).nullable(),
  lastMessage: z.string().max(2000),
});
export const ResearchCatalogSchema = z.strictObject({
  sources: z.array(ResearchSourceSchema),
  topics: z.array(z.string()),
  evaluatedAt: z.iso.datetime(),
});
export type ResearchSource = z.infer<typeof ResearchSourceSchema>;
export type ResearchCatalog = z.infer<typeof ResearchCatalogSchema>;
export const ResearchContextSchema = z.strictObject({
  itemId: z.string(),
  itemVersion: z.number().int().positive(),
  method: z.literal('topic-context-v1'),
  topics: z.array(z.string()),
  explanations: z.array(
    z.strictObject({
      title: z.string(),
      text: z.string(),
      href: z.string().regex(/^#read\/[a-z0-9-]+$/),
    }),
  ),
  related: z.array(FeedItemSchema),
  terms: z.array(FeedItemSchema),
  learning: z.array(
    z.strictObject({
      id: z.string(),
      title: z.string(),
      href: z.string().regex(/^#learning\?question=[a-z0-9-]+$/),
    }),
  ),
  caveat: z.string(),
});
export type ResearchContext = z.infer<typeof ResearchContextSchema>;
export const ResearchRefreshInputSchema = z.strictObject({
  sourceIds: z
    .array(z.string().regex(/^[a-z0-9-]{1,80}$/))
    .min(1)
    .max(20)
    .optional(),
});
export const ResearchSourceRunSchema = z.strictObject({
  id: z.uuid(),
  runId: z.uuid(),
  sourceId: z.string(),
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().nullable(),
  status: z.enum(['running', 'succeeded', 'failed']),
  message: z.string(),
  checked: z.number().int().nonnegative(),
  inserted: z.number().int().nonnegative(),
});
export const ResearchRunsSchema = z.strictObject({
  runs: z.array(ResearchSourceRunSchema),
});
export function sourceIdFor(item: FeedItem): string {
  if (item.id.startsWith('gdp-original-')) return 'bea-gdp-original';
  for (const id of ['ecb-statistics', 'ecb-press', 'fed', 'pib', 'bea'])
    if (item.id.startsWith(`${id}-`)) return id;
  if (
    item.id.startsWith('annual-') ||
    item.id.startsWith('wb-') ||
    item.source.name === 'World Bank'
  )
    return 'world-bank';
  if (item.kind === 'term') return 'glossary';
  return 'other';
}
export function regionFor(item: FeedItem): 'india' | 'global' {
  return ['pib', 'world-bank'].includes(sourceIdFor(item)) ||
    item.topics.includes('India')
    ? 'india'
    : 'global';
}
export function filterResearchItems(
  items: FeedItem[],
  filters: ResearchFilters,
): FeedItem[] {
  const input = ResearchFiltersSchema.parse(filters),
    q = (input.q ?? '').toLocaleLowerCase();
  return items
    .filter(
      (item) =>
        item.status === 'published' &&
        (!input.kind || item.kind === input.kind) &&
        (!input.source || sourceIdFor(item) === input.source) &&
        (!input.topic || item.topics.includes(input.topic)) &&
        (!input.region || regionFor(item) === input.region) &&
        (!q ||
          `${item.title} ${item.summary} ${item.body} ${item.topics.join(' ')}`
            .toLocaleLowerCase()
            .includes(q)),
    )
    .sort(
      (a, b) =>
        b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id),
    );
}
// A digest is deliberately bounded. Explore always keeps the complete collection.
export function selectToday(items: FeedItem[]): FeedItem[] {
  const result: FeedItem[] = [],
    sourceCounts = new Map<string, number>(),
    annualKeys = new Set<string>();
  const ordered = [
    ...items.filter((v) => v.kind === 'news'),
    ...items.filter((v) => v.kind === 'annual'),
    ...items.filter((v) => v.kind === 'term'),
  ];
  for (const item of ordered) {
    const source = sourceIdFor(item),
      count = sourceCounts.get(source) ?? 0;
    if (count >= (item.kind === 'term' ? 4 : item.kind === 'annual' ? 4 : 8))
      continue;
    if (item.kind === 'annual') {
      const key = item.title.replace(/\b(?:19|20)\d{2}\b/g, '').trim();
      if (annualKeys.has(key)) continue;
      annualKeys.add(key);
    }
    result.push(item);
    sourceCounts.set(source, count + 1);
  }
  const queues = new Map<string, FeedItem[]>();
  for (const item of result) {
    const key = sourceIdFor(item);
    if (!queues.has(key)) queues.set(key, []);
    queues.get(key)!.push(item);
  }
  const spread: FeedItem[] = [];
  while (
    spread.length < 24 &&
    [...queues.values()].some((queue) => queue.length)
  ) {
    for (const queue of queues.values()) {
      if (spread.length === 24) break;
      const item = queue.shift();
      if (item) spread.push(item);
    }
  }
  return spread;
}
export function researchSelection(
  items: FeedItem[],
  filters: ResearchFilters,
): FeedItem[] {
  const selected = filterResearchItems(items, filters);
  return filters.view === 'today' ? selectToday(selected) : selected;
}
