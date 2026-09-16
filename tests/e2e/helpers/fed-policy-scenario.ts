import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';
import { expect } from '@playwright/test';
import {
  parseHistoricalFedPolicy,
  FED_POLICY_HISTORY_URLS,
} from '../../../apps/api/src/fed-policy-provider';
import { sourceHash } from '../../../apps/api/src/discovery-provider';
import {
  EventPublicSchema,
  type FeedItem,
} from '../../../packages/contracts/src/index';
import { connectionDatabase } from './research-connection-fixture';
import { operatorKey } from './operator';
import { eventHeaders } from './event-fixture';
import type { FeedbackSandbox } from './feedback-fixture';
export async function fedPolicyScenarioFixture(
  request: APIRequestContext,
  sandbox: FeedbackSandbox,
) {
  const db = await connectionDatabase(sandbox);
  const sources: FeedItem[] = [];
  try {
    for (const [index, day] of ['20240731', '20240918'].entries()) {
      const body = await readFile(
        new URL(
          `../../../packages/contracts/test/fixtures/fomc-${day}.html.txt`,
          import.meta.url,
        ),
        'utf8',
      );
      const url = FED_POLICY_HISTORY_URLS[index]!;
      const draft = parseHistoricalFedPolicy({
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
        title: 'Historical 2024 FOMC target-range comparison',
        family: 'policy-rate',
        geography: ['United States'],
        claimKind: 'fact',
        explanation:
          'Compare the September decision to the earlier July statement; no market reaction or portfolio effect is asserted.',
        announcedAt: '2024-09-18T18:00:00.000Z',
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
          note: 'Test workflow review of actual historical Federal Reserve excerpts.',
        },
      })
    ).status(),
  ).toBe(201);
  return EventPublicSchema.parse(
    await (await request.get('/api/v1/events/' + id)).json(),
  );
}
