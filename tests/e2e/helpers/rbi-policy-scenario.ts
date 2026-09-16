import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';
import { expect } from '@playwright/test';
import { sourceHash } from '../../../apps/api/src/discovery-provider';
import {
  EventPublicSchema,
  FeedItemSchema,
} from '../../../packages/contracts/src/index';
import { connectionDatabase } from './research-connection-fixture';
import { operatorKey } from './operator';
import { eventHeaders } from './event-fixture';
import type { FeedbackSandbox } from './feedback-fixture';
export async function rbiPolicySource() {
  const pack = JSON.parse(
    await readFile(
      new URL(
        '../../../packages/contracts/test/fixtures/rbi-20250606-repo.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as { url: string; quote: string; publishedOn: string; rights: string };
  const now = new Date().toISOString();
  // Test-only admission timestamp. The original RBI publication time is unknown.
  return FeedItemSchema.parse({
    id: 'rbi-repo-test-' + randomUUID(),
    version: 1,
    kind: 'news',
    title: 'Historical RBI June 2025 repo decision',
    summary: pack.quote,
    body: pack.quote,
    topics: ['Rates'],
    publishedAt: now,
    effectiveLabel:
      pack.publishedOn +
      '; original release date only; test admission timestamp is not publication time',
    source: {
      name: 'Reserve Bank of India',
      url: pack.url,
      retrievedAt: now,
      rights: pack.rights,
    },
    sourceHash: sourceHash(pack.url, pack.quote),
    importance: 1,
    relatedIds: [],
    status: 'published',
    reviewedAt: now,
    correctionNote: null,
  });
}
export async function rbiPolicyScenarioFixture(
  request: APIRequestContext,
  sandbox: FeedbackSandbox,
) {
  const source = await rbiPolicySource(),
    db = await connectionDatabase(sandbox);
  try {
    await db.query('INSERT INTO discovery_items(id,version) VALUES($1,1)', [
      source.id,
    ]);
    await db.query(
      'INSERT INTO discovery_versions(item_id,version,data) VALUES($1,1,$2)',
      [source.id, source],
    );
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
        'Test-only retained historical RBI evidence, not live source activation.',
      editorial: {
        title: 'Historical RBI June 2025 repo reduction',
        family: 'policy-rate',
        geography: ['India'],
        claimKind: 'fact',
        explanation:
          'The circular records a prior-to-new repo change. No consensus surprise or market effect is inferred. Original release date 2025-06-06; exact publication time unavailable.',
        announcedAt: null,
        effectiveAt: null,
        citations: [
          {
            sourceId: source.id,
            version: 1,
            hash: source.sourceHash!,
            field: 'body',
            quote: source.body,
          },
        ],
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
          note: 'Synthetic admission workflow using minimal original RBI quote and verified date/facts.',
        },
      })
    ).status(),
  ).toBe(201);
  return EventPublicSchema.parse(
    await (await request.get('/api/v1/events/' + id)).json(),
  );
}
