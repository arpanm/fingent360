import { createHash } from 'node:crypto';
import type pg from 'pg';

export async function applyMigration(
  client: Pick<pg.PoolClient, 'query'>,
  filename: string,
  sql: string,
) {
  const checksum = createHash('sha256').update(sql).digest('hex');
  const existing = await client.query<{ checksum: string }>(
    'SELECT checksum FROM schema_migrations WHERE filename=$1',
    [filename],
  );
  if (existing.rows[0]) {
    if (existing.rows[0].checksum !== checksum) {
      throw new Error(
        `Applied migration changed: ${filename}. Restore it and add a new migration.`,
      );
    }
    return false;
  }
  await client.query(sql);
  await client.query(
    'INSERT INTO schema_migrations(filename,checksum) VALUES ($1,$2)',
    [filename, checksum],
  );
  return true;
}
