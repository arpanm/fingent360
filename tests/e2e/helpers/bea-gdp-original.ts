import { readFile } from 'node:fs/promises';
import { expect, type APIRequestContext } from '@playwright/test';
import { originalGdpItem } from '../../../apps/api/src/bea-gdp-original-provider';
import { sourceHash } from '../../../apps/api/src/discovery-provider';
import {
  connectionDatabase,
  connectionHeaders,
} from './research-connection-fixture';
import { automaticPublicationConfig } from './research-auto-publication';
import { operatorKey } from './operator';
import type { FeedbackSandbox } from './feedback-fixture';
export async function gdpOriginalInputs() {
  const fixture = JSON.parse(
    await readFile(
      new URL(
        '../../../packages/contracts/test/fixtures/bea-gdp-original-shape.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as {
    releases: Array<{
      url: string;
      title: string;
      release: string;
      quote: string;
      expectedPublishedAt: string;
    }>;
  };
  return fixture.releases.map((release) => {
    const body = `<h1>${release.title}</h1><div class="field field--name-field-release-date field--type-string">${release.release}</div><div class="field--name-body"><p>${release.quote}</p></div>`;
    return {
      url: release.url,
      body,
      hash: sourceHash(release.url, body),
      retrievedAt: '2026-09-15T00:00:00.000Z',
      expectedPublishedAt: release.expectedPublishedAt,
    };
  });
}
export async function gdpOriginalFixture(
  request: APIRequestContext,
  sandbox: FeedbackSandbox,
) {
  const pool = await connectionDatabase(sandbox),
    { mongo } = await automaticPublicationConfig(sandbox),
    inputs = await gdpOriginalInputs();
  const items = inputs.map(originalGdpItem);
  try {
    for (const [index, item] of items.entries()) {
      const raw = inputs[index]!;
      await mongo.db().collection('discovery_raw').insertOne({
        _id: raw.hash,
        url: raw.url,
        body: raw.body,
        retrievedAt: raw.retrievedAt,
      });
      await pool.query('INSERT INTO discovery_items(id,version) VALUES($1,1)', [
        item.id,
      ]);
      await pool.query(
        'INSERT INTO discovery_versions(item_id,version,data) VALUES($1,1,$2)',
        [item.id, item],
      );
    }
  } finally {
    await Promise.allSettled([pool.end(), mongo.close()]);
  }
  expect(
    (
      await request.post('/api/v1/ops/session', {
        headers: connectionHeaders,
        data: { key: await operatorKey() },
      })
    ).status(),
  ).toBe(200);
  for (const item of items)
    expect(
      (
        await request.put('/api/v1/ops/discovery/items/' + item.id, {
          headers: connectionHeaders,
          data: {
            expectedVersion: 1,
            status: 'published',
            correctionNote:
              'TEST-SIMULATION: original BEA layout and actual source values reviewed.',
          },
        })
      ).status(),
    ).toBe(200);
  return items;
}
