import { randomUUID, createHash } from 'node:crypto';
import { MediaAssetSchema } from '../../../packages/contracts/src/index';
import { eventFixture, eventHeaders } from './event-fixture';
import { connectionDatabase } from './research-connection-fixture';
import type { APIRequestContext } from '@playwright/test';
import type { FeedbackSandbox } from './feedback-fixture';
export const syntheticPng =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
export async function storyImageFixture(
  request: APIRequestContext,
  sandbox: FeedbackSandbox,
) {
  const fixture = await eventFixture(request, sandbox);
  const response = await request.post(
    '/api/v1/ops/media/' + fixture.source.id,
    { headers: eventHeaders, data: {} },
  );
  if (!response.ok())
    throw Error(
      'Synthetic image fixture media preparation failed: ' +
        (await response.text()),
    );
  const asset = MediaAssetSchema.parse(await response.json()),
    attemptId = randomUUID();
  const image = {
    attemptId,
    base64: syntheticPng,
    mime: 'image/png',
    width: 1,
    height: 1,
    sha256: createHash('sha256')
      .update(Buffer.from(syntheticPng, 'base64'))
      .digest('hex'),
    provider: 'openai',
    model: 'synthetic-image-model',
    createdAt: new Date().toISOString(),
    label:
      'AI-generated conceptual illustration; not evidence or a real event photograph.',
  };
  const pool = await connectionDatabase(sandbox);
  try {
    await pool.query(
      "INSERT INTO story_image_attempts(id,asset_id,provider,model,prompt,status,output,provider_output,finished_at) VALUES($1,$2,'openai','synthetic-image-model','Synthetic test-only image fixture','succeeded',$3::jsonb,'synthetic',now())",
      [attemptId, asset.id, JSON.stringify(image)],
    );
  } finally {
    await pool.end();
  }
  return { ...fixture, asset, attemptId, image };
}
