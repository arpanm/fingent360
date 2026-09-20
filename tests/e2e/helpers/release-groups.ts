import { createHash, randomUUID } from 'node:crypto';
import {
  FeedItemSchema,
  EventSaveSchema,
  type FeedItem,
} from '../../../packages/contracts/src/index';
import {
  actualBundledConnectionSource,
  connectionDatabase,
} from './research-connection-fixture';
import type { FeedbackSandbox } from './feedback-fixture';

/** Explicit test-only releases: same headline is deliberately not event identity. */
export async function releaseSources() {
  const template = await actualBundledConnectionSource();
  return [1, 2, 3].map((number) => {
    const id = `fed-release-simulation-${randomUUID()}`;
    return FeedItemSchema.parse({
      ...template,
      id,
      version: 1,
      title: 'TEST-SIMULATION: common release headline',
      summary: `Synthetic release ${number}; this is not live financial evidence.`,
      body: `TEST-SIMULATION: independently retained source document ${number}.`,
      sourceHash: createHash('sha256')
        .update(
          `TEST-SIMULATION: independently retained source document ${number}.`,
        )
        .digest('hex'),
      source: {
        ...template.source,
        name: `Synthetic publisher ${number}`,
        url: `https://example.com/${id}`,
        rights: 'Synthetic acceptance fixture only.',
      },
      relatedIds: [],
    });
  });
}
export async function seedReleaseSources(sandbox: FeedbackSandbox) {
  const sources = await releaseSources();
  const pool = await connectionDatabase(sandbox);
  try {
    for (const source of sources) {
      await pool.query(
        'INSERT INTO discovery_items(id,version) VALUES($1,$2)',
        [source.id, source.version],
      );
      await pool.query(
        'INSERT INTO discovery_versions(item_id,version,data) VALUES($1,$2,$3)',
        [source.id, source.version, source],
      );
    }
  } finally {
    await pool.end();
  }
  return sources;
}
export function releaseInput(
  sources: FeedItem[],
  expectedVersion = 0,
  grouped = true,
) {
  return EventSaveSchema.parse({
    requestId: randomUUID(),
    expectedVersion,
    revisionReason: 'Explicit synthetic same-event selection',
    editorial: {
      title: 'TEST-SIMULATION: one explicitly reviewed event',
      family: 'Policy',
      geography: ['Global'],
      claimKind: 'fact',
      explanation:
        'Synthetic event identity selected by an editor; no live event or financial effect asserted.',
      announcedAt: null,
      effectiveAt: null,
      citations: sources.map((source) => ({
        sourceId: source.id,
        version: source.version,
        hash: source.sourceHash,
        field: 'title',
        quote: source.title,
      })),
      links: [],
      ...(grouped
        ? {
            releaseGroup: {
              sourceIds: sources.map((source) => source.id),
              rationale:
                'These synthetic releases explicitly describe the same test event.',
            },
          }
        : {}),
    },
  });
}
