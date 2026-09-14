import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { test as isolated, expect } from './feedback-fixture';
import { ownedRetentionDatabase, type OwnedPool } from './retention';

const sourceTables = [
  'research_sources',
  'research_source_revisions',
  'discovery_items',
  'discovery_versions',
  'discovery_runs',
  'discovery_source_runs',
] as const;

async function sourceDigests(pool: OwnedPool) {
  try {
    await pool.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const digests: Record<string, string[]> = {};
    for (const table of sourceTables) {
      const result = await pool.query<{ digest: string }>(
        `SELECT md5(row_to_json(t)::text) AS digest FROM ${table} t ORDER BY 1`,
      );
      digests[table] = result.rows.map((row) => row.digest);
    }
    await pool.query('COMMIT');
    return digests;
  } catch {
    await pool.query('ROLLBACK').catch(() => {});
    throw Error(
      'Could not read normal source digests; check local storage and migrations. No normal rows were changed by the guard.',
    );
  }
}

export const test = isolated.extend<{
  sourceDatabase: OwnedPool;
  normalSourceStorage: void;
}>({
  normalSourceStorage: [
    async ({ feedbackSandbox }, use) => {
      // Lazy, read-only observation of configured normal storage. Do not derive
      // its namespace by removing the owned URL's search_path or assume public.
      const local = parseEnv(
        await readFile(new URL('../../../.env', import.meta.url), 'utf8'),
      );
      const connection = new URL(
        process.env.DATABASE_URL ?? local.DATABASE_URL!,
      );
      if (
        !['postgres:', 'postgresql:'].includes(connection.protocol) ||
        !['localhost', '127.0.0.1', '[::1]'].includes(connection.hostname)
      )
        throw Error(
          'Source preservation checks require configured loopback PostgreSQL.',
        );
      const { Pool } = createRequire(
        new URL('../../../apps/api/package.json', import.meta.url),
      )('pg') as {
        Pool: new (options: {
          connectionString: string;
          max: number;
          connectionTimeoutMillis: number;
          statement_timeout: number;
        }) => OwnedPool;
      };
      const pool = new Pool({
        connectionString: connection.href,
        max: 1,
        connectionTimeoutMillis: 3000,
        statement_timeout: 10000,
      });
      try {
        let schema: string | undefined;
        try {
          const result = await pool.query<{ schema: string }>(
            'SELECT current_schema() AS schema',
          );
          schema = result.rows[0]?.schema;
        } catch {
          throw Error(
            'Could not inspect the configured normal source namespace.',
          );
        }
        if (!schema || schema === feedbackSandbox.schema)
          throw Error(
            'Normal source preservation must inspect a distinct configured namespace.',
          );
        const before = await sourceDigests(pool);
        try {
          await use();
        } finally {
          expect(
            await sourceDigests(pool),
            'Normal source records must remain unchanged. Do not run normal ingestion/publication alongside this bounded selection.',
          ).toEqual(before);
        }
      } finally {
        await pool.end();
      }
    },
    { auto: true },
  ],
  sourceDatabase: async ({ feedbackSandbox }, use) => {
    const pool = await ownedRetentionDatabase(feedbackSandbox);
    try {
      await use(pool);
    } finally {
      await pool.end();
    }
  },
  context: async ({ context, feedbackSandbox }, use) => {
    // SourceEditor and SourceRefresh use inherited /ops routes. Only the two
    // public source-page reads also need this actual owned application.
    await context.route(
      (url) =>
        url.pathname === '/api/v1/sources' ||
        url.pathname === '/api/v1/discovery/catalog',
      (route) => {
        const url = new URL(route.request().url());
        return route.continue({
          url: `${feedbackSandbox.apiOrigin}${url.pathname}${url.search}`,
        });
      },
    );
    await use(context);
  },
});
export { expect };
