import type pg from 'pg';
import { FeedItemSchema } from '@fingent360/contracts';

/** Call before reading publication. Retain this transaction until disclosure is assembled.
 * Private callers acquire account first and recheck authorization after this wait. */
export async function admitPublications(c: pg.PoolClient, ids?: string[]) {
  const locked =
    ids === undefined
      ? await c.query('SELECT id FROM discovery_items ORDER BY id FOR SHARE')
      : await c.query(
          'SELECT id FROM discovery_items WHERE id=ANY($1::text[]) ORDER BY id FOR SHARE',
          [[...new Set(ids)].sort()],
        );
  const result = await c.query(
    "SELECT v.data FROM discovery_items i JOIN LATERAL(SELECT data FROM discovery_versions WHERE item_id=i.id AND data->>'status'<>'draft' ORDER BY version DESC LIMIT 1)v ON true WHERE i.id=ANY($1::text[]) ORDER BY i.id",
    [locked.rows.map((r) => r.id)],
  );
  return result.rows.map((r) => FeedItemSchema.parse(r.data));
}
