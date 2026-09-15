import { test, expect, eventHeaders } from '../../helpers/event-fixture';
import { storyImageFixture, syntheticPng } from '../../helpers/story-image';
import { MediaAssetSchema } from '../../../../packages/contracts/src/index';
import { connectionDatabase } from '../../helpers/research-connection-fixture';
test('E2E-API-1140 exact image attempt review gates real public media and immutable image bytes @STORY-MEDIA-002 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const f = await storyImageFixture(request, feedbackSandbox),
    path = '/api/v1/ops/media/' + f.source.id;
  expect(
    (
      await request.get('/api/v1/discovery/items/' + f.source.id + '/media')
    ).status(),
  ).toBe(404);
  expect(
    (
      await request.put(path, {
        headers: eventHeaders,
        data: { assetId: f.asset.id, publish: true },
      })
    ).status(),
  ).toBe(409);
  const saved = await request.put(path, {
    headers: eventHeaders,
    data: { assetId: f.asset.id, imageAttemptId: f.attemptId, publish: true },
  });
  expect(saved.status()).toBe(200);
  const publicAsset = MediaAssetSchema.parse(
    await (
      await request.get('/api/v1/discovery/items/' + f.source.id + '/media')
    ).json(),
  );
  expect(publicAsset.image?.base64).toBe(syntheticPng);
  const pool = await connectionDatabase(feedbackSandbox);
  try {
    await expect(
      pool.query('DELETE FROM story_image_attempts WHERE id=$1', [f.attemptId]),
    ).rejects.toThrow();
  } finally {
    await pool.end();
  }
  expect(
    (
      await request.put(path, {
        headers: eventHeaders,
        data: {
          assetId: f.asset.id,
          imageAttemptId: f.attemptId,
          publish: false,
        },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.get('/api/v1/discovery/items/' + f.source.id + '/media')
    ).status(),
  ).toBe(404);
});
test('E2E-API-1141 image encoder rejects SVG corrupt bytes and excessive dimensions @STORY-MEDIA-002 @TEST-SIMULATION', async () => {
  const url = new URL(
    '../../../../apps/api/dist/story-image-provider.js',
    import.meta.url,
  ).href;
  const { validateStoryPng } = await import(url);
  expect(validateStoryPng(syntheticPng).width).toBe(1);
  expect(() =>
    validateStoryPng(Buffer.from('<svg/>').toString('base64')),
  ).toThrow();
  const tooLarge = Buffer.from(syntheticPng, 'base64');
  tooLarge.writeUInt32BE(5000, 16);
  expect(() => validateStoryPng(tooLarge.toString('base64'))).toThrow();
});
