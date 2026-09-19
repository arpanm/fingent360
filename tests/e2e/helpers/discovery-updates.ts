import { randomUUID } from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';
import type { FeedbackSandbox } from './feedback-fixture';
import {
  FeedItemSchema,
  type FeedItem,
} from '../../../packages/contracts/src/index';
import { connectionDatabase } from './research-connection-fixture';
import { operatorKey } from './operator';
import { expect } from '@playwright/test';

export async function discoveryUpdates(
  request: APIRequestContext,
  sandbox: FeedbackSandbox,
  count = 32,
) {
  const token = 'synthetic-reader-' + randomUUID().slice(0, 8);
  const headers = {
    Origin: process.env.E2E_WEB_URL || 'http://localhost:5173',
  };
  expect(
    (
      await request.post('/api/v1/ops/session', {
        headers,
        data: { key: await operatorKey() },
      })
    ).status(),
  ).toBe(200);
  let sequence = 0;
  const date = Date.now() - 120000;
  async function publish() {
    const n = sequence++;
    const at = new Date(date + n * 1000).toISOString();
    const draft = FeedItemSchema.parse({
      id: token + '-' + n,
      version: 1,
      kind: 'term',
      title: token + ' item ' + n,
      summary: 'Explicitly synthetic reading-update fixture.',
      body: 'Synthetic educational text for isolated pagination and publication acceptance. It contains no market claim.',
      topics: [token],
      publishedAt: at,
      effectiveLabel: 'Synthetic reading fixture',
      source: {
        name: 'Synthetic acceptance fixture',
        url: 'https://example.com/reading-fixture',
        retrievedAt: at,
        rights: 'Synthetic authored test text; not provider evidence.',
      },
      sourceHash: null,
      importance: 1,
      relatedIds: [],
      status: 'draft',
      correctionNote: null,
      reviewedAt: null,
    });
    const pool = await connectionDatabase(sandbox);
    try {
      await pool.query('BEGIN');
      await pool.query('INSERT INTO discovery_items(id,version) VALUES($1,1)', [
        draft.id,
      ]);
      await pool.query(
        'INSERT INTO discovery_versions(item_id,version,data) VALUES($1,1,$2)',
        [draft.id, draft],
      );
      await pool.query('COMMIT');
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    } finally {
      await pool.end();
    }
    const response = await request.put(
      '/api/v1/ops/discovery/items/' + draft.id,
      {
        headers,
        data: {
          expectedVersion: 1,
          status: 'published',
          correctionNote: 'Publish explicitly synthetic reader fixture.',
        },
      },
    );
    expect(response.status()).toBe(200);
    return FeedItemSchema.parse(await response.json());
  }
  const items: FeedItem[] = [];
  for (let n = 0; n < count; n++) items.push(await publish());
  return {
    token,
    items,
    publish,
    withdraw: async (item: FeedItem) => {
      const response = await request.put(
        '/api/v1/ops/discovery/items/' + item.id,
        {
          headers,
          data: {
            expectedVersion: item.version,
            status: 'withdrawn',
            correctionNote: 'Synthetic reader admission withdrawal.',
          },
        },
      );
      expect(response.status()).toBe(200);
    },
  };
}
