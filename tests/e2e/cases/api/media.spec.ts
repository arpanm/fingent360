import { test, expect } from '@playwright/test';
import {
  DiscoveryOperationsSchema,
  FeedItemSchema,
  MediaAssetSchema,
} from '../../../../packages/contracts/src/index';
import { operatorKey } from '../../helpers/operator';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-API-160 reviewed source-version media with withdrawal propagation @UX-002', async ({
  request,
}) => {
  const headers = {
    Origin: process.env.E2E_WEB_URL ?? 'http://localhost:5173',
  };
  expect(
    (
      await request.post('/api/v1/ops/media/term-gdp', { headers, data: {} })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post('/api/v1/ops/session', {
        headers,
        data: { key: await operatorKey() },
      })
    ).status(),
  ).toBe(200);
  let itemId: string | undefined;
  let version: number | undefined;
  let originalStatus: string | undefined;
  try {
    const ops = DiscoveryOperationsSchema.parse(
      await (await request.get('/api/v1/ops/discovery/items')).json(),
    );
    const term = ops.items.find((i) => i.kind === 'term');
    expect(term, 'Run discovery refresh before media acceptance.').toBeTruthy();
    itemId = term!.id;
    originalStatus = term!.status;
    const published = FeedItemSchema.parse(
      await (
        await request.put(`/api/v1/ops/discovery/items/${itemId}`, {
          headers,
          data: {
            expectedVersion: term!.version,
            status: 'published',
            correctionNote: 'Media acceptance of authored glossary edition.',
          },
        })
      ).json(),
    );
    version = published.version;
    const generated = await request.post(`/api/v1/ops/media/${itemId}`, {
      headers,
      data: {},
    });
    expect(generated.status()).toBe(201);
    const asset = MediaAssetSchema.parse(await generated.json());
    expect(asset.itemVersion).toBe(version);
    expect(
      MediaAssetSchema.parse(
        await (
          await request.post(`/api/v1/ops/media/${itemId}`, {
            headers,
            data: {},
          })
        ).json(),
      ).id,
    ).toBe(asset.id);
    expect(
      (await request.get(`/api/v1/discovery/items/${itemId}/media`)).status(),
    ).toBe(404);
    expect(
      (
        await request.put(`/api/v1/ops/media/${itemId}`, {
          headers,
          data: { assetId: asset.id, publish: true },
        })
      ).status(),
    ).toBe(200);
    expect(
      MediaAssetSchema.parse(
        await (
          await request.get(`/api/v1/discovery/items/${itemId}/media`)
        ).json(),
      ).sourceIds,
    ).toContain(itemId);
    const withdrawn = await request.put(
      `/api/v1/ops/discovery/items/${itemId}`,
      {
        headers,
        data: {
          expectedVersion: version,
          status: 'withdrawn',
          correctionNote: 'Media acceptance withdrawal propagation.',
        },
      },
    );
    version = FeedItemSchema.parse(await withdrawn.json()).version;
    expect(
      (await request.get(`/api/v1/discovery/items/${itemId}/media`)).status(),
    ).toBe(404);
  } finally {
    if (itemId && version)
      await request.put(`/api/v1/ops/discovery/items/${itemId}`, {
        headers,
        data: {
          expectedVersion: version,
          status: originalStatus === 'published' ? 'published' : 'withdrawn',
          correctionNote: 'Media acceptance cleanup.',
        },
      });
    await request.delete('/api/v1/ops/session', { headers });
  }
});
