import {
  IntelligenceBriefSnapshotSchema,
  IntelligenceBriefPublicSchema,
  IntelligenceBriefListSchema,
  IntelligenceBriefHistorySchema,
  EventPublicSchema,
} from '@fingent360/contracts';
import { z } from 'zod';
import { handleEvents } from './events';
import { fail, type OfflineHandler } from './types';
export const handleIntelligenceBriefs: OfflineHandler = async (
  request,
  state,
  bundle,
) => {
  if (
    request.path === '/api/v1/ops/intelligence-briefs' ||
    request.path.startsWith('/api/v1/ops/intelligence-briefs/')
  )
    return fail(
      503,
      'Editorial brief preparation and independent publication require the connected API.',
    );
  const base = '/api/v1/intelligence-briefs';
  if (request.path !== base && !request.path.startsWith(base + '/'))
    return null;
  if (request.method !== 'GET')
    return fail(405, 'Brief snapshots are read-only.');
  const stored = (bundle as typeof bundle & { intelligenceBriefs?: unknown })
      .intelligenceBriefs,
    parsed = IntelligenceBriefSnapshotSchema.safeParse(
      stored ?? { capturedAt: bundle.generatedAt, items: [], histories: {} },
    );
  if (!parsed.success)
    return fail(
      503,
      'Offline brief snapshot is unreadable. Rebuild or refresh it.',
    );
  const items = [];
  for (const item of parsed.data.items) {
    const points = [];
    for (const point of item.points) {
      if (!point.event) {
        points.push(point);
        continue;
      }
      let current: z.infer<typeof EventPublicSchema> | null;
      try {
        current = EventPublicSchema.parse(
          (
            await handleEvents(
              {
                ...request,
                path: '/api/v1/events/' + point.id,
                query: new URLSearchParams(),
              },
              state,
              bundle,
            )
          )?.body,
        );
      } catch {
        current = null;
      }
      const same =
        current?.status === 'published' &&
        current.event?.version === point.version &&
        JSON.stringify(current.event) === JSON.stringify(point.event.event);
      points.push(
        same
          ? {
              ...point,
              reasons: [
                ...point.reasons,
                'Installed snapshot cannot know later source corrections or withdrawals.',
              ],
            }
          : {
              ...point,
              status: 'unavailable',
              event: null,
              reasons: [
                'Current installed source, identity, event or lineage admission no longer supports this issued point.',
              ],
            },
      );
    }
    items.push(
      IntelligenceBriefPublicSchema.parse({
        ...item,
        points,
        evaluatedAt: new Date().toISOString(),
      }),
    );
  }
  if (request.path === base + '/snapshot')
    return {
      body: IntelligenceBriefSnapshotSchema.parse({ ...parsed.data, items }),
    };
  if (request.path === base) {
    const raw = request.query.get('after');
    if (raw && !z.uuid().safeParse(raw).success)
      return fail(400, 'Invalid brief cursor.');
    const sorted = items
      .filter((item) => !raw || item.id > raw)
      .sort((a, b) => a.id.localeCompare(b.id));
    return {
      body: IntelligenceBriefListSchema.parse({
        items: sorted.slice(0, 50),
        next: sorted.length > 50 ? sorted[49]!.id : null,
      }),
    };
  }
  const match = /^\/api\/v1\/intelligence-briefs\/([^/]+)(\/history)?$/.exec(
    request.path,
  );
  if (!match || !z.uuid().safeParse(match[1]).success)
    return fail(404, 'Brief snapshot not found.');
  const item = items.find((row) => row.id === match[1]);
  if (!item) return fail(404, 'Brief is outside this installed snapshot.');
  if (!match[2]) return { body: item };
  if (request.query.has('before'))
    return fail(
      503,
      'Earlier issued brief history requires the connected API or a refreshed snapshot.',
    );
  return {
    body: IntelligenceBriefHistorySchema.parse(
      parsed.data.histories[item.id] ?? { versions: [], nextBefore: null },
    ),
  };
};
