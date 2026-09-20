import type { APIRequestContext, PlaywrightWorkerArgs } from '@playwright/test';
import type { FeedbackSandbox } from './feedback-fixture';
import { test, expect } from './feedback-fixture';
import { indiaActors, retentionHeaders } from './india-macro';
import {
  seedConnectionSource,
  connectionDatabase,
} from './research-connection-fixture';
import { MediaAssetSchema } from '../../../packages/contracts/src/index';
export { test, expect, retentionHeaders };

export async function prepareStoryImageFixture(
  request: APIRequestContext,
  playwright: PlaywrightWorkerArgs['playwright'],
  sandbox: FeedbackSandbox,
) {
  const reviewer = await indiaActors(request, playwright, sandbox);
  try {
    const source = await seedConnectionSource(sandbox);
    const path = '/api/v1/ops/media/' + source.id;
    const response = await request.post(path, {
      headers: retentionHeaders,
      data: {},
    });
    expect(response.status()).toBe(201);
    const asset = MediaAssetSchema.parse(await response.json());
    expect(asset.image).toBeUndefined();
    return { source, path, asset, reviewer };
  } catch (error) {
    await reviewer.dispose();
    throw error;
  }
}
export async function storyImageMode(
  sandbox: FeedbackSandbox,
  mode: 'success' | 'fail' | 'hold',
) {
  const pool = await connectionDatabase(sandbox);
  try {
    expect(
      (
        await pool.query(
          'UPDATE test_story_image_provider SET mode=$1 WHERE id=true',
          [mode],
        )
      ).rowCount,
    ).toBe(1);
  } finally {
    await pool.end();
  }
}
export async function storyImageProviderState(sandbox: FeedbackSandbox) {
  const pool = await connectionDatabase(sandbox);
  try {
    const row = (
      await pool.query(
        'SELECT calls,last_request FROM test_story_image_provider WHERE id=true',
      )
    ).rows[0];
    return row as {
      calls: number;
      last_request: { model: string; prompt: string } | null;
    };
  } finally {
    await pool.end();
  }
}
