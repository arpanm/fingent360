import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { APIRequestContext, Page } from '@playwright/test';
import {
  FeedItemSchema,
  connectionSource,
  type FeedItem,
} from '../../../packages/contracts/src/index';
import type { FeedbackSandbox } from './feedback-fixture';
export const connectionPassword = 'Synthetic-connections-2026';
export const connectionHeaders = {
  Origin: process.env.E2E_WEB_URL || 'http://localhost:5173',
};
export const connectionGoal = {
  name: 'Synthetic research goal',
  type: 'education',
  targetMinor: '100000',
  savedMinor: '1000',
  monthlyMinor: '100',
  horizonMonths: 12,
  currency: 'INR',
  scale: 2,
  assumptions: 'no-growth-nominal-v1',
  storageConsent: true,
};
// Loading this helper does not open databases, read snapshots or start services.
export async function connectionDatabase(sandbox: FeedbackSandbox) {
  const require = createRequire(
    new URL('../../../apps/api/package.json', import.meta.url),
  );
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: sandbox.databaseUrl, max: 1 });
  const check = await pool.query('SELECT current_schema() AS schema');
  if (
    check.rows[0]?.schema !== sandbox.schema ||
    !sandbox.schema.startsWith('e2e_feedback_')
  ) {
    await pool.end();
    throw Error(
      'Research fixture refuses a database outside its owned schema.',
    );
  }
  return pool;
}
export async function actualBundledConnectionSource() {
  const bundle = JSON.parse(
    await readFile(
      new URL(
        '../../../apps/web/src/offline/content-bundle.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as { feed: unknown[] };
  const source = bundle.feed
    .map((item) => FeedItemSchema.parse(item))
    .find((item) => item.id.startsWith('fed-') && connectionSource(item));
  if (!source)
    throw Error(
      'A dated published Fed source is required in the actual public bundle.',
    );
  return source;
}
export async function seedConnectionSource(sandbox: FeedbackSandbox) {
  const source = await actualBundledConnectionSource();
  const pool = await connectionDatabase(sandbox);
  try {
    await pool.query('INSERT INTO discovery_items(id,version) VALUES($1,$2)', [
      source.id,
      source.version,
    ]);
    await pool.query(
      'INSERT INTO discovery_versions(item_id,version,data) VALUES($1,$2,$3)',
      [source.id, source.version, source],
    );
  } finally {
    await pool.end();
  }
  return source;
}
// These explicit test-only fault editions never alter the original public bundle.
export async function reviseConnectionSourceFixture(
  sandbox: FeedbackSandbox,
  source: FeedItem,
  status: 'published' | 'withdrawn' | 'draft',
) {
  const next = FeedItemSchema.parse({
    ...source,
    version: source.version + 1,
    status,
    correctionNote: 'Synthetic test-only source lifecycle simulation.',
  });
  const pool = await connectionDatabase(sandbox);
  try {
    await pool.query('BEGIN');
    await pool.query('SELECT id FROM discovery_items WHERE id=$1 FOR UPDATE', [
      source.id,
    ]);
    await pool.query(
      'INSERT INTO discovery_versions(item_id,version,data) VALUES($1,$2,$3)',
      [source.id, next.version, next],
    );
    await pool.query('UPDATE discovery_items SET version=$2 WHERE id=$1', [
      source.id,
      next.version,
    ]);
    await pool.query('COMMIT');
  } finally {
    await pool.end();
  }
  return next;
}
export async function prepareConnectionAccount(request: APIRequestContext) {
  const registered = await request.post('/api/v1/account/register', {
    headers: connectionHeaders,
    data: {
      username: `rc_${randomUUID().slice(0, 12)}`,
      password: connectionPassword,
      consent: true,
    },
  });
  if (!registered.ok())
    throw Error(`Connection account fixture: ${registered.status()}`);
  const response = await request.post('/api/v1/account/goals', {
    headers: connectionHeaders,
    data: connectionGoal,
  });
  if (!response.ok())
    throw Error(`Connection goal fixture: ${response.status()}`);
  const goal = await response.json();
  const preview = await (
    await request.post('/api/v1/account/holdings/preview', {
      headers: connectionHeaders,
      data: {
        csv: 'isin,quantity,total_cost_paise\nINE002A01018,3.000001,10000',
        expectedVersion: 0,
        storageConsent: true,
      },
    })
  ).json();
  const confirmed = await request.post('/api/v1/account/holdings/confirm', {
    headers: connectionHeaders,
    data: { previewId: preview.previewId, expectedVersion: 0 },
  });
  if (!confirmed.ok())
    throw Error(`Connection holdings fixture: ${confirmed.status()}`);
  return goal;
}
export async function prepareConnectionBrowser(page: Page) {
  await page.evaluate(
    async ({ username, password, goal }) => {
      const post = async (path: string, body: unknown) => {
        const r = await fetch(`/api/v1/account/${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!r.ok) throw Error(`Connection fixture ${path}: ${r.status}`);
        return r.json();
      };
      await post('register', { username, password, consent: true });
      await post('goals', goal);
      const preview = await post('holdings/preview', {
        csv: 'isin,quantity,total_cost_paise\nINE002A01018,3.000001,10000',
        expectedVersion: 0,
        storageConsent: true,
      });
      await post('holdings/confirm', {
        previewId: preview.previewId,
        expectedVersion: 0,
      });
    },
    {
      username: `rc_${randomUUID().slice(0, 12)}`,
      password: connectionPassword,
      goal: connectionGoal,
    },
  );
}
export async function routeConnectionReading(
  page: Page,
  sandbox: FeedbackSandbox,
) {
  await page.route(/\/api\/v1\/discovery(?:[/?]|$)/, (route) => {
    const url = new URL(route.request().url());
    return route.continue({
      url: `${sandbox.apiOrigin}${url.pathname}${url.search}`,
    });
  });
}
