import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';
import type { FeedbackSandbox } from './feedback-fixture';
import {
  MediaAssetSchema,
  FeedItemSchema,
} from '../../../packages/contracts/src/index';
import type { OfflineBundle } from '../../../apps/web/src/offline/types';
import { eventFixture, eventHeaders, expect } from './event-fixture';
import { connectionDatabase } from './research-connection-fixture';
import { syntheticPng } from './story-image';

// Synthetic provider transport only. The actual dispatcher/store and review API
// own request identity, retained bytes, publication and immutable receipts.
export async function generatedStoryImage(
  request: APIRequestContext,
  sandbox: FeedbackSandbox,
) {
  const fixture = await eventFixture(request, sandbox);
  const pool = await connectionDatabase(sandbox);
  await pool.end();
  const prepared = await request.post(
    '/api/v1/ops/media/' + fixture.source.id,
    { headers: eventHeaders, data: {} },
  );
  expect(prepared.status()).toBe(201);
  const caption = MediaAssetSchema.parse(await prepared.json());
  const require = createRequire(
    new URL('../../../apps/api/package.json', import.meta.url),
  );
  require('reflect-metadata');
  const [{ MediaStore }, { readConfig }] = await Promise.all([
    import(new URL('../../../apps/api/dist/media.js', import.meta.url).href),
    import(new URL('../../../apps/api/dist/config.js', import.meta.url).href),
  ]);
  const store = new MediaStore(
    readConfig({
      DATABASE_URL: sandbox.databaseUrl,
      MONGODB_URI: 'mongodb://127.0.0.1:27017/synthetic_unused',
      WEB_ORIGIN: eventHeaders.Origin,
      STORY_IMAGE_PROVIDER: 'openai',
      STORY_IMAGE_MODEL: 'synthetic-image-model',
      OPENAI_API_KEY: 'synthetic-not-a-provider-key',
    }),
  );
  const originalFetch = globalThis.fetch;
  let calls = 0;
  const requestId = randomUUID();
  const authorize = async () => {
    const response = await request.get(
      '/api/v1/ops/media/' + fixture.source.id,
    );
    expect(response.status()).toBe(200);
  };
  let asset: ReturnType<typeof MediaAssetSchema.parse>;
  try {
    globalThis.fetch = async (url, init) => {
      expect(String(url)).toBe('https://api.openai.com/v1/images/generations');
      expect(init?.method).toBe('POST');
      const input = JSON.parse(String(init?.body)) as {
        model: string;
        prompt: string;
      };
      expect(input.model).toBe('synthetic-image-model');
      expect(input.prompt).toContain(fixture.source.title);
      calls++;
      return new Response(
        JSON.stringify({ data: [{ b64_json: syntheticPng }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };
    asset = MediaAssetSchema.parse(
      await store.generateImage(fixture.source.id, { requestId }, authorize),
    );
    expect(
      MediaAssetSchema.parse(
        await store.generateImage(fixture.source.id, { requestId }, authorize),
      ),
    ).toEqual(asset);
    expect(calls).toBe(1);
  } finally {
    globalThis.fetch = originalFetch;
    await store.onApplicationShutdown();
  }
  const retained = await connectionDatabase(sandbox);
  try {
    const row = (
      await retained.query(
        'SELECT status,output,provider_output FROM story_image_attempts WHERE id=$1',
        [requestId],
      )
    ).rows[0];
    expect(row.status).toBe('succeeded');
    expect(row.output).toEqual(asset.image);
    expect(JSON.parse(row.provider_output)).toEqual({
      data: [{ b64_json: syntheticPng }],
    });
    expect(row.provider_output).not.toContain('synthetic-not-a-provider-key');
  } finally {
    await retained.end();
  }
  expect(asset.id).toBe(caption.id);
  expect(asset.image?.attemptId).toBe(requestId);
  expect(asset.image?.base64).toBe(syntheticPng);
  expect(
    (
      await request.get(
        '/api/v1/discovery/items/' + fixture.source.id + '/media',
      )
    ).status(),
  ).toBe(404);
  const review = {
    assetId: asset.id,
    imageAttemptId: requestId,
    publish: true,
  };
  expect(
    (
      await request.put('/api/v1/ops/media/' + fixture.source.id, {
        headers: eventHeaders,
        data: review,
      })
    ).status(),
  ).toBe(200);
  return { ...fixture, asset, review };
}

export async function captureStoryPackage(
  request: APIRequestContext,
  id: string,
) {
  const get = async (path: string) => {
    const response = await request.get('/api/v1' + path);
    expect(response.status(), path).toBe(200);
    return response.json();
  };
  const source = FeedItemSchema.parse(await get('/discovery/items/' + id));
  const history = (
    (await get('/discovery/items/' + id + '/history')) as unknown[]
  ).map((row) => FeedItemSchema.parse(row));
  const mediaResponse = await request.get(
    '/api/v1/discovery/items/' + id + '/media',
  );
  expect([200, 404]).toContain(mediaResponse.status());
  const media =
    mediaResponse.status() === 200
      ? { [id]: MediaAssetSchema.parse(await mediaResponse.json()) }
      : {};
  const bundle: OfflineBundle = {
    generatedAt: new Date().toISOString(),
    feed: [source],
    histories: { [id]: history },
    evidence: {},
    media,
    macro: null,
    macroHistory: {},
    macroEvidence: {},
    sources: [],
    learningCatalog: null,
    journeyCatalog: null,
  };
  const { finalizePublicSnapshot } = await import(
    new URL(
      '../../../scripts/lib/finalize-public-snapshot.mjs',
      import.meta.url,
    ).href
  );
  const manifest = await get('/discovery/publication-manifest');
  return finalizePublicSnapshot(bundle, manifest) as OfflineBundle;
}
