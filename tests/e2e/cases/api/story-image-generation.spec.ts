import { randomUUID } from 'node:crypto';
import {
  test,
  expect,
  retentionHeaders,
  prepareStoryImageFixture,
  storyImageMode,
  storyImageProviderState,
} from '../../helpers/story-image-generation';
import {
  connectionDatabase,
  reviseConnectionSourceFixture,
} from '../../helpers/research-connection-fixture';
import { syntheticPng } from '../../helpers/story-image';
import {
  MediaAssetSchema,
  PublicationProposalSchema,
} from '../../../../packages/contracts/src/index';

test.use({
  namedOperators: true,
  manualWorkers: true,
  storyImageSimulation: true,
});

test('E2E-API-1146 actual image requests replay reject concurrency and publish only after independent exact-attempt approval @STORY-MEDIA-002 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const f = await prepareStoryImageFixture(
    request,
    playwright,
    feedbackSandbox,
  );
  const pool = await connectionDatabase(feedbackSandbox);
  let pending: ReturnType<typeof request.post> | undefined;
  try {
    const requestId = randomUUID();
    await storyImageMode(feedbackSandbox, 'hold');
    pending = request.post(f.path + '/image', {
      headers: retentionHeaders,
      data: { requestId },
    });
    await expect
      .poll(async () => (await storyImageProviderState(feedbackSandbox)).calls)
      .toBe(1);
    for (const id of [requestId, randomUUID()]) {
      const conflict = await request.post(f.path + '/image', {
        headers: retentionHeaders,
        data: { requestId: id },
      });
      expect(conflict.status()).toBe(409);
      expect((await conflict.json()).message).toContain(
        'Another image is being prepared',
      );
    }
    expect(
      (await pool.query('SELECT status FROM story_image_attempts')).rows,
    ).toEqual([{ status: 'running' }]);
    await storyImageMode(feedbackSandbox, 'success');
    const response = await pending;
    expect(response.status()).toBe(201);
    const asset = MediaAssetSchema.parse(await response.json());
    expect(asset.id).toBe(f.asset.id);
    expect(asset.image).toMatchObject({
      attemptId: requestId,
      provider: 'openai',
      model: 'synthetic-story-image-model',
      base64: syntheticPng,
    });
    const replay = await request.post(f.path + '/image', {
      headers: retentionHeaders,
      data: { requestId },
    });
    expect(replay.status()).toBe(201);
    expect(MediaAssetSchema.parse(await replay.json())).toEqual(asset);
    const upstream = await storyImageProviderState(feedbackSandbox);
    expect(upstream.calls).toBe(1);
    expect(upstream.last_request?.prompt).toContain(f.source.title);
    expect(upstream.last_request?.model).toBe('synthetic-story-image-model');
    const attempt = (
      await pool.query(
        'SELECT status,output,provider_output FROM story_image_attempts WHERE id=$1',
        [requestId],
      )
    ).rows[0];
    expect(attempt.status).toBe('succeeded');
    expect(attempt.output).toEqual(asset.image);
    expect(JSON.parse(attempt.provider_output)).toEqual({
      data: [{ b64_json: syntheticPng }],
    });
    expect(attempt.provider_output).not.toContain(
      'synthetic-story-image-key-never-send',
    );
    const publicPath = '/api/v1/discovery/items/' + f.source.id + '/media';
    expect((await request.get(publicPath)).status()).toBe(404);
    expect(
      (
        await request.put(f.path, {
          headers: retentionHeaders,
          data: { assetId: asset.id, imageAttemptId: requestId, publish: true },
        })
      ).status(),
    ).toBe(403);
    const proposalId = randomUUID();
    const proposal = {
      kind: 'media',
      target: f.source.id,
      body: { assetId: asset.id, imageAttemptId: requestId, publish: true },
    };
    expect(
      (
        await request.put('/api/v1/ops/proposals/' + proposalId, {
          headers: retentionHeaders,
          data: proposal,
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await request.post('/api/v1/ops/proposals/' + proposalId + '/approve', {
          headers: retentionHeaders,
          data: { note: 'Synthetic self review must fail' },
        })
      ).status(),
    ).toBe(403);
    expect((await request.get(publicPath)).status()).toBe(404);
    const approved = await f.reviewer.post(
      '/api/v1/ops/proposals/' + proposalId + '/approve',
      {
        headers: retentionHeaders,
        data: { note: 'TEST-SIMULATION independent exact-image review' },
      },
    );
    expect(approved.status()).toBe(201);
    expect(PublicationProposalSchema.parse(await approved.json()).state).toBe(
      'approved',
    );
    const published = MediaAssetSchema.parse(
      await (await request.get(publicPath)).json(),
    );
    expect(published.image).toEqual(asset.image);
    await expect(
      pool.query('DELETE FROM story_image_attempts WHERE id=$1', [requestId]),
    ).rejects.toThrow();
    const withdrawal = randomUUID();
    expect(
      (
        await request.put('/api/v1/ops/proposals/' + withdrawal, {
          headers: retentionHeaders,
          data: { ...proposal, body: { ...proposal.body, publish: false } },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await f.reviewer.post(
          '/api/v1/ops/proposals/' + withdrawal + '/approve',
          {
            headers: retentionHeaders,
            data: { note: 'Synthetic image withdrawal' },
          },
        )
      ).status(),
    ).toBe(201);
    expect((await request.get(publicPath)).status()).toBe(404);
  } finally {
    await storyImageMode(feedbackSandbox, 'success');
    await pending?.catch(() => {});
    await pool.end();
    await f.reviewer.dispose();
  }
});

for (const status of ['published', 'withdrawn'] as const) {
  test(`${status === 'published' ? 'E2E-API-1147 source revision during image generation retains bytes without current attachment' : 'E2E-API-1149 source withdrawal during image generation retains bytes without publication'} @STORY-MEDIA-002 @TEST-SIMULATION`, async ({
    request,
    playwright,
    feedbackSandbox,
  }) => {
    const f = await prepareStoryImageFixture(
      request,
      playwright,
      feedbackSandbox,
    );
    const pool = await connectionDatabase(feedbackSandbox);
    let pending: ReturnType<typeof request.post> | undefined;
    try {
      const requestId = randomUUID();
      await storyImageMode(feedbackSandbox, 'hold');
      pending = request.post(f.path + '/image', {
        headers: retentionHeaders,
        data: { requestId },
      });
      await expect
        .poll(
          async () => (await storyImageProviderState(feedbackSandbox)).calls,
        )
        .toBe(1);
      await reviseConnectionSourceFixture(feedbackSandbox, f.source, status);
      await storyImageMode(feedbackSandbox, 'success');
      expect((await pending).status()).toBe(status === 'published' ? 409 : 404);
      const retained = (
        await pool.query(
          'SELECT asset_id,status,output FROM story_image_attempts WHERE id=$1',
          [requestId],
        )
      ).rows[0];
      expect(retained).toMatchObject({
        asset_id: f.asset.id,
        status: 'succeeded',
      });
      expect(retained.output.base64).toBe(syntheticPng);
      expect((await request.get(f.path)).status()).toBe(404);
      expect(
        (
          await request.get('/api/v1/discovery/items/' + f.source.id + '/media')
        ).status(),
      ).toBe(404);
      expect(
        (await pool.query('SELECT count(*)::int AS n FROM story_image_reviews'))
          .rows[0].n,
      ).toBe(0);
      expect((await storyImageProviderState(feedbackSandbox)).calls).toBe(1);
    } finally {
      await storyImageMode(feedbackSandbox, 'success');
      await pending?.catch(() => {});
      await pool.end();
      await f.reviewer.dispose();
    }
  });
}

test('E2E-API-1148 failed image attempts require new request identity and superseded replay never substitutes later bytes @STORY-MEDIA-002 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const f = await prepareStoryImageFixture(
    request,
    playwright,
    feedbackSandbox,
  );
  const pool = await connectionDatabase(feedbackSandbox);
  try {
    await storyImageMode(feedbackSandbox, 'fail');
    const failedId = randomUUID();
    expect(
      (
        await request.post(f.path + '/image', {
          headers: retentionHeaders,
          data: { requestId: failedId },
        })
      ).status(),
    ).toBe(503);
    expect(
      (
        await pool.query(
          'SELECT status,output,provider_output FROM story_image_attempts WHERE id=$1',
          [failedId],
        )
      ).rows[0],
    ).toMatchObject({ status: 'failed', output: null });
    await storyImageMode(feedbackSandbox, 'success');
    const recover = await request.post(f.path + '/image', {
      headers: retentionHeaders,
      data: { requestId: failedId },
    });
    expect(recover.status()).toBe(409);
    expect((await recover.json()).message).toContain(
      'Explicitly start a new attempt',
    );
    expect((await storyImageProviderState(feedbackSandbox)).calls).toBe(1);
    const ids = [randomUUID(), randomUUID()];
    const staleProposal = randomUUID();
    for (const requestId of ids) {
      const response = await request.post(f.path + '/image', {
        headers: retentionHeaders,
        data: { requestId },
      });
      expect(response.status()).toBe(201);
      expect(
        MediaAssetSchema.parse(await response.json()).image?.attemptId,
      ).toBe(requestId);
      if (requestId === ids[0])
        expect(
          (
            await request.put('/api/v1/ops/proposals/' + staleProposal, {
              headers: retentionHeaders,
              data: {
                kind: 'media',
                target: f.source.id,
                body: {
                  assetId: f.asset.id,
                  imageAttemptId: requestId,
                  publish: true,
                },
              },
            })
          ).status(),
        ).toBe(200);
    }
    expect(
      (
        await f.reviewer.post(
          '/api/v1/ops/proposals/' + staleProposal + '/approve',
          {
            headers: retentionHeaders,
            data: { note: 'Synthetic superseded image review must fail' },
          },
        )
      ).status(),
    ).toBe(409);
    const superseded = await request.post(f.path + '/image', {
      headers: retentionHeaders,
      data: { requestId: ids[0] },
    });
    expect(superseded.status()).toBe(409);
    expect((await superseded.json()).message).toContain('superseded');
    expect((await storyImageProviderState(feedbackSandbox)).calls).toBe(3);
    expect(
      (
        await pool.query(
          'SELECT status FROM story_image_attempts ORDER BY started_at',
        )
      ).rows,
    ).toEqual([
      { status: 'failed' },
      { status: 'succeeded' },
      { status: 'succeeded' },
    ]);
    expect(
      (
        await request.get('/api/v1/discovery/items/' + f.source.id + '/media')
      ).status(),
    ).toBe(404);
  } finally {
    await pool.end();
    await f.reviewer.dispose();
  }
});
