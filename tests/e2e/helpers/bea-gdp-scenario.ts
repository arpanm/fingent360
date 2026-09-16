import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';
import { expect } from '@playwright/test';
import { parseHistoricalBeaGdp } from '../../../apps/api/src/bea-gdp-history-provider';
import { sourceHash } from '../../../apps/api/src/discovery-provider';
import {
  EventPublicSchema,
  type FeedItem,
} from '../../../packages/contracts/src/index';
import { connectionDatabase } from './research-connection-fixture';
import { operatorKey } from './operator';
import { eventHeaders } from './event-fixture';
import type { FeedbackSandbox } from './feedback-fixture';
export async function beaGdpScenarioFixture(
  request: APIRequestContext,
  sandbox: FeedbackSandbox,
) {
  const db = await connectionDatabase(sandbox);
  const sources: FeedItem[] = [];
  try {
    const pack = JSON.parse(
      await readFile(
        new URL(
          '../../../packages/contracts/test/fixtures/bea-gdp-2025-vintages.json',
          import.meta.url,
        ),
        'utf8',
      ),
    ) as { sources: { url: string; quote: string }[] };
    for (const item of pack.sources) {
      const { url, quote: body } = item;
      const draft = parseHistoricalBeaGdp({
        url,
        body,
        hash: sourceHash(url, body),
        retrievedAt: new Date().toISOString(),
      });
      const source = {
        ...draft,
        status: 'published' as const,
        reviewedAt: new Date().toISOString(),
      };
      await db.query('INSERT INTO discovery_items(id,version) VALUES($1,1)', [
        source.id,
      ]);
      await db.query(
        'INSERT INTO discovery_versions(item_id,version,data) VALUES($1,1,$2)',
        [source.id, source],
      );
      sources.push(source);
    }
  } finally {
    await db.end();
  }
  expect(
    (
      await request.post('/api/v1/ops/session', {
        headers: eventHeaders,
        data: { key: await operatorKey() },
      })
    ).status(),
  ).toBe(200);
  const id = randomUUID(),
    input = {
      requestId: randomUUID(),
      expectedVersion: 0,
      revisionReason:
        'Historical official source pack; test-only review workflow.',
      editorial: {
        title: 'Historical Q2 2025 GDP vintage revision',
        family: 'gdp',
        geography: ['United States'],
        claimKind: 'fact',
        explanation:
          'Compare the third estimate to the second estimate for the same quarter; no consensus surprise or portfolio effect is asserted.',
        announcedAt: '2025-09-25T12:30:00.000Z',
        effectiveAt: null,
        citations: sources.map((source) => ({
          sourceId: source.id,
          version: 1,
          hash: source.sourceHash!,
          field: 'body',
          quote: source.body,
        })),
        links: [],
      },
    };
  expect(
    (
      await request.put('/api/v1/ops/events/' + id, {
        headers: eventHeaders,
        data: input,
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.post(`/api/v1/ops/events/${id}/review`, {
        headers: eventHeaders,
        data: {
          requestId: randomUUID(),
          expectedVersion: 1,
          status: 'published',
          note: 'Test workflow review of actual historical BEA excerpts.',
        },
      })
    ).status(),
  ).toBe(201);
  return EventPublicSchema.parse(
    await (await request.get('/api/v1/events/' + id)).json(),
  );
}
