import { FeedItemSchema } from '../../../packages/contracts/src/index';
import type { FeedbackSandbox } from './feedback-fixture';
import {
  connectionDatabase,
  seedConnectionSource,
} from './research-connection-fixture';

// Explicitly synthetic pagination editions, stored only in the owned fixture schema.
// No file/database/provider access occurs during test discovery.
export async function readingPaginationSources(
  sandbox: FeedbackSandbox,
  count = 201,
) {
  const source = await seedConnectionSource(sandbox);
  const items = Array.from({ length: count }, (_, i) =>
    FeedItemSchema.parse({
      ...source,
      id: `fed-reading-page-${String(i).padStart(4, '0')}`,
      title: `Synthetic reading pagination item ${i}`,
      summary: 'Synthetic pagination fixture; no live publication claim.',
      body: '',
      sourceHash: null,
      correctionNote: 'Synthetic test-only reviewed edition.',
      source: { ...source.source, rights: 'Synthetic test fixture only.' },
      version: 1,
    }),
  );
  const db = await connectionDatabase(sandbox);
  try {
    await db.query('BEGIN');
    for (const item of items) {
      await db.query('INSERT INTO discovery_items(id,version) VALUES($1,1)', [
        item.id,
      ]);
      await db.query(
        'INSERT INTO discovery_versions(item_id,version,data) VALUES($1,1,$2)',
        [item.id, item],
      );
    }
    await db.query('COMMIT');
  } finally {
    await db.query('ROLLBACK').catch(() => {});
    await db.end();
  }
  return items;
}
