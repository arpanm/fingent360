import { test, expect } from '@playwright/test';
import {
  DiscoveryOperationsSchema,
  DiscoveryRunSchema,
  FeedItemSchema,
  FeedSchema,
  OperatorSessionSchema,
} from '../../../../packages/contracts/src/index';
import { operatorKey } from '../../helpers/operator';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-API-120 real feed review, withdrawal and protected operations @UX-002 @external', async ({
  request,
}) => {
  test.setTimeout(120000);
  const headers = {
    Origin: process.env.E2E_WEB_URL ?? 'http://localhost:5173',
  };
  expect((await request.get('/api/v1/ops/discovery/items')).status()).toBe(401);
  expect(
    (
      await request.post('/api/v1/ops/session', {
        headers: { Origin: 'https://evil.example' },
        data: { key: await operatorKey() },
      })
    ).status(),
  ).toBe(403);
  const login = await request.post('/api/v1/ops/session', {
    headers,
    data: { key: await operatorKey() },
  });
  expect(login.status()).toBe(200);
  expect(OperatorSessionSchema.parse(await login.json()).authenticated).toBe(
    true,
  );
  expect(login.headers()['set-cookie']).toContain('HttpOnly');
  expect(login.headers()['set-cookie']).toContain('Path=/api/v1/ops');
  try {
    expect(
      (
        await request.post('/api/v1/ops/discovery/refresh', {
          headers,
          data: { url: 'https://evil.example' },
        })
      ).status(),
    ).toBe(400);
    const response = await request.post('/api/v1/ops/discovery/refresh', {
      headers,
      data: { sourceIds: ['fed', 'glossary'] },
      timeout: 45000,
    });
    expect(response.status(), await response.text()).toBe(201);
    expect(DiscoveryRunSchema.parse(await response.json()).status).toBe(
      'succeeded',
    );
    const operations = DiscoveryOperationsSchema.parse(
      await (await request.get('/api/v1/ops/discovery/items')).json(),
    );
    const item = operations.items.find(
      (i) => i.kind === 'news' && i.id.startsWith('fed-'),
    )!;
    expect(item).toBeTruthy();
    expect(item.source.url).toContain(
      'https://www.federalreserve.gov/newsevents/pressreleases/',
    );
    const originalStatus = item.status;
    const publishedResponse = await request.put(
      `/api/v1/ops/discovery/items/${item.id}`,
      {
        headers,
        data: {
          expectedVersion: item.version,
          status: 'published',
          correctionNote:
            'Acceptance review of official feed metadata and attribution.',
        },
      },
    );
    expect(publishedResponse.status()).toBe(200);
    const published = FeedItemSchema.parse(await publishedResponse.json());
    try {
      expect(
        (
          await request.put(`/api/v1/ops/discovery/items/${item.id}`, {
            headers,
            data: {
              expectedVersion: item.version,
              status: 'withdrawn',
              correctionNote: 'Stale review must fail.',
            },
          })
        ).status(),
      ).toBe(409);
      const publicResponse = await request.get(
        `/api/v1/discovery/items/${item.id}`,
      );
      expect(publicResponse.status(), 'Public item GET after review').toBe(200);
      const publicItem = FeedItemSchema.parse(await publicResponse.json());
      expect(publicItem.status).toBe('published');
      expect(publicItem).toEqual(published);
      const repeatedResponse = await request.get(
        `/api/v1/discovery/items/${item.id}`,
      );
      expect(
        repeatedResponse.status(),
        'Repeated public item GET after evaluation capture',
      ).toBe(200);
      expect(FeedItemSchema.parse(await repeatedResponse.json())).toEqual(
        publicItem,
      );
      expect(
        (
          await request.get(`/api/v1/discovery/items/${item.id}/evidence`)
        ).status(),
      ).toBe(200);
      const feed = FeedSchema.parse(
        await (await request.get('/api/v1/discovery/feed?kind=news')).json(),
      );
      expect(
        feed.items.every((i) => i.kind === 'news' && i.status === 'published'),
      ).toBe(true);
    } finally {
      expect(
        (
          await request.put(`/api/v1/ops/discovery/items/${item.id}`, {
            headers,
            data: {
              expectedVersion: published.version,
              status:
                originalStatus === 'published' ? 'published' : 'withdrawn',
              correctionNote:
                'Acceptance cleanup; preserve prior publication or withdraw previously unpublished item.',
            },
          })
        ).status(),
      ).toBe(200);
    }
  } finally {
    expect(
      (await request.delete('/api/v1/ops/session', { headers })).status(),
    ).toBe(200);
    expect((await request.get('/api/v1/ops/discovery/items')).status()).toBe(
      401,
    );
  }
});
