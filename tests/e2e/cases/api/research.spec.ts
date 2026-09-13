import { test, expect } from '@playwright/test';
import {
  ResearchCatalogSchema,
  ResearchRunsSchema,
  ResearchContextSchema,
  FeedSchema,
} from '../../../../packages/contracts/src/index';
import { operatorKey } from '../../helpers/operator';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-API-180 real source catalog filters and source-bound context @SOURCES-002', async ({
  request,
}) => {
  const response = await request.get('/api/v1/discovery/catalog');
  expect(response.status()).toBe(200);
  const catalog = ResearchCatalogSchema.parse(await response.json());
  expect(catalog.sources.find((s) => s.id === 'rbi')?.access).toBe(
    'review_required',
  );
  expect(catalog.sources.find((s) => s.id === 'pib')?.access).toBe('enabled');
  const all = FeedSchema.parse(
    await (
      await request.get('/api/v1/discovery/feed?view=explore&region=india')
    ).json(),
  );
  for (const item of all.items) expect(item.topics).toContain('India');
  const today = FeedSchema.parse(
    await (await request.get('/api/v1/discovery/feed?view=today')).json(),
  );
  expect(today.items.length).toBeLessThanOrEqual(24);
  expect(
    today.items.length,
    'Refresh and review genuine source items first.',
  ).toBeGreaterThan(0);
  const item = today.items[0]!;
  const context = ResearchContextSchema.parse(
    await (
      await request.get(`/api/v1/discovery/items/${item.id}/context`)
    ).json(),
  );
  expect(context.itemId).toBe(item.id);
  expect(context.itemVersion).toBe(item.version);
  expect(
    (await request.get('/api/v1/discovery/feed?region=invalid')).status(),
  ).toBe(400);
});
test('E2E-API-181 selected refresh is authorized, durable and rejects unknown sources @SOURCES-002', async ({
  request,
}) => {
  const headers = {
    Origin: process.env.E2E_WEB_URL ?? 'http://localhost:5173',
  };
  expect((await request.get('/api/v1/ops/discovery/runs')).status()).toBe(401);
  expect(
    (
      await request.post('/api/v1/ops/session', {
        headers,
        data: { key: await operatorKey() },
      })
    ).status(),
  ).toBe(200);
  try {
    for (const sourceIds of [['unknown'], ['rbi'], ['fed', 'fed']])
      expect(
        (
          await request.post('/api/v1/ops/discovery/refresh', {
            headers,
            data: { sourceIds },
          })
        ).status(),
      ).toBe(400);
    const refresh = await request.post('/api/v1/ops/discovery/refresh', {
      headers,
      data: { sourceIds: ['glossary'] },
    });
    expect(refresh.status()).toBe(201);
    const runs = ResearchRunsSchema.parse(
      await (await request.get('/api/v1/ops/discovery/runs')).json(),
    );
    expect(runs.runs[0]?.sourceId).toBe('glossary');
    expect(runs.runs[0]?.status).toBe('succeeded');
    expect(runs.runs[0]?.checked).toBeGreaterThanOrEqual(11);
  } finally {
    await request.delete('/api/v1/ops/session', { headers });
  }
});

test('E2E-API-182 signed-in source filters preserve the public corpus and reject cross-filter cursors @SOURCES-002', async ({
  request,
}) => {
  const headers = {
      Origin: process.env.E2E_WEB_URL ?? 'http://localhost:5173',
    },
    password = 'Synthetic-research-test-2026';
  const username = `research_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  expect(
    (
      await request.post('/api/v1/account/register', {
        headers,
        data: { username, password, consent: true },
      })
    ).status(),
  ).toBe(201);
  try {
    for (const query of [
      'source=world-bank&region=india&kind=annual&view=explore',
      'topic=Inflation&view=explore',
      'source=glossary&view=today',
    ]) {
      const publicItems = [];
      let cursor: string | null = null;
      do {
        const response = await request.get(
          `/api/v1/discovery/feed?${query}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
        );
        expect(response.status()).toBe(200);
        const page = FeedSchema.parse(await response.json());
        publicItems.push(...page.items);
        cursor = page.nextCursor;
      } while (cursor);
      const privateItems = [];
      cursor = null;
      do {
        const response = await request.get(
          `/api/v1/account/library/feed?${query}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
        );
        expect(response.status()).toBe(200);
        const page = await response.json();
        privateItems.push(...page.items);
        cursor = page.nextCursor;
      } while (cursor);
      expect(privateItems.map((i) => i.id).sort()).toEqual(
        publicItems.map((i) => i.id).sort(),
      );
    }
    expect(
      (
        await request.get('/api/v1/account/library/feed?region=invalid')
      ).status(),
    ).toBe(400);
    const first = await (
      await request.get('/api/v1/account/library/feed?view=explore')
    ).json();
    expect(
      first.nextCursor,
      'Publish more than20 genuine items before this acceptance case.',
    ).toBeTruthy();
    expect(
      (
        await request.get(
          `/api/v1/account/library/feed?view=today&cursor=${encodeURIComponent(first.nextCursor)}`,
        )
      ).status(),
    ).toBe(409);
    const publicFirst = FeedSchema.parse(
      await (await request.get('/api/v1/discovery/feed?view=explore')).json(),
    );
    expect(
      publicFirst.nextCursor,
      'Publish more than30 genuine items before this acceptance case.',
    ).toBeTruthy();
    expect(
      (
        await request.get(
          `/api/v1/discovery/feed?view=today&cursor=${encodeURIComponent(publicFirst.nextCursor!)}`,
        )
      ).status(),
    ).toBe(409);
  } finally {
    expect(
      (
        await request.delete('/api/v1/account', { headers, data: { password } })
      ).status(),
    ).toBe(200);
  }
});
