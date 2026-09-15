import { randomUUID } from 'node:crypto';
import {
  test,
  expect,
  eventFixture,
  eventHeaders,
} from '../../helpers/event-fixture';
import {
  EvalDetailSchema,
  FeedItemSchema,
} from '../../../../packages/contracts/src/index';
import { connectionDatabase } from '../../helpers/research-connection-fixture';
test('E2E-API-1110 public response saved once and deleted feedback leaves evaluation corpus @EVAL-LINEAGE-001', async ({
  request,
  feedbackSandbox,
}) => {
  expect((await request.get('/api/v1/ops/evaluations')).status()).toBe(401);
  const f = await eventFixture(request, feedbackSandbox),
    path = '/api/v1/discovery/items/' + f.source.id;
  const item = FeedItemSchema.parse(await (await request.get(path)).json());
  await request.get(path);
  const id = randomUUID(),
    receiptToken = 'a'.repeat(64);
  const posted = await request.post('/api/v1/feedback', {
    headers: eventHeaders,
    data: {
      id,
      receiptToken,
      text: 'Synthetic source context feedback',
      consent: true,
      image: null,
      audio: null,
      context: {
        screen: 'read/' + item.id,
        runtime: 'offline',
        appVersion: 'synthetic-test',
        viewport: { width: 360, height: 720 },
        capturedAt: new Date().toISOString(),
        publicView: {
          kind: 'reader',
          capturedAt: new Date().toISOString(),
          item,
        },
      },
    },
  });
  expect(posted.status()).toBe(201);
  const read = async () =>
    EvalDetailSchema.parse(
      await (await request.get('/api/v1/ops/evaluations/' + item.id)).json(),
    );
  const first = await read();
  expect(first.views).toHaveLength(1);
  expect(first.views[0]?.payload).toEqual(item);
  expect(first.feedback.some((v) => v.id === id)).toBe(true);
  expect(
    (
      await request.delete('/api/v1/feedback/' + id, {
        headers: { ...eventHeaders, 'x-feedback-token': receiptToken },
      })
    ).ok(),
  ).toBe(true);
  expect((await read()).feedback).toHaveLength(0);
});
test('E2E-API-1111 public provider trace persists raw response and returned output without headers @EVAL-LINEAGE-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const f = await eventFixture(request, feedbackSandbox),
    pool = await connectionDatabase(feedbackSandbox);
  const recordingUrl = new URL(
    '../../../../apps/api/dist/eval-lineage-recording.js',
    import.meta.url,
  ).href;
  const providerUrl = new URL(
    '../../../../apps/api/dist/ai-providers.js',
    import.meta.url,
  ).href;
  const { recordPublicAi } = await import(recordingUrl),
    { generateAssistance } = await import(providerUrl);
  const synthetic = {
    output: [
      {
        type: 'message',
        content: [{ type: 'output_text', text: '{"captions":[]}' }],
      },
    ],
  };
  try {
    await recordPublicAi(
      pool,
      f.source,
      'media-caption',
      'openai',
      'synthetic-model',
      'Synthetic public instructions',
      'Synthetic public input',
      (observe: (raw: string) => Promise<void>) =>
        generateAssistance(
          {
            OPENAI_API_KEY: 'synthetic-not-a-real-key',
            OPENAI_MODEL: 'synthetic-model',
          },
          'openai',
          'Synthetic public instructions',
          'Synthetic public input',
          async () => new Response(JSON.stringify(synthetic), { status: 200 }),
          observe,
        ),
    );
  } finally {
    await pool.end();
  }
  const detail = EvalDetailSchema.parse(
    await (await request.get('/api/v1/ops/evaluations/' + f.source.id)).json(),
  );
  expect(detail.traces[0]?.rawOutput).toBe(JSON.stringify(synthetic));
  expect(detail.traces[0]?.textOutput).toBe('{"captions":[]}');
  expect(JSON.stringify(detail)).not.toContain('synthetic-not-a-real-key');
});
test('E2E-API-1114 composed public view binds retained image and original captions without copying image bytes @EVAL-LINEAGE-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const { storyImageFixture } = await import('../../helpers/story-image');
  const f = await storyImageFixture(request, feedbackSandbox);
  expect(
    (
      await request.put('/api/v1/ops/media/' + f.source.id, {
        headers: eventHeaders,
        data: {
          assetId: f.asset.id,
          imageAttemptId: f.attemptId,
          publish: true,
        },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.get('/api/v1/discovery/items/' + f.source.id + '/media')
    ).status(),
  ).toBe(200);
  const detail = EvalDetailSchema.parse(
    await (await request.get('/api/v1/ops/evaluations/' + f.source.id)).json(),
  );
  expect(detail.compositions[0]?.media.imageAttemptId).toBe(f.attemptId);
  expect(detail.compositions[0]?.captions).toEqual(f.asset.captions);
  expect(detail.compositions[0]).not.toHaveProperty('base64');
});
test('E2E-API-1115 private AI retention is separately opted in owned and erased on revoke @EVAL-LINEAGE-001 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const { registerRecoverable } = await import('../../helpers/auth-wait'),
    { consentWrite } = await import('../../helpers/consent-fixture');
  const { PrivateAiHistorySchema } =
    await import('../../../../packages/contracts/src/eval-lineage');
  const user = await registerRecoverable(request),
    pool = await connectionDatabase(feedbackSandbox);
  const historyUrl = new URL(
      '../../../../apps/api/dist/private-ai-history.js',
      import.meta.url,
    ).href,
    { startPrivateAiHistory, finishPrivateAiHistory } = await import(
      historyUrl
    );
  try {
    expect(
      await startPrivateAiHistory(
        pool,
        user.id,
        'openai',
        'synthetic',
        'Synthetic instructions',
        'Synthetic private input',
      ),
    ).toBeNull();
    await consentWrite(request, 'private-ai-history', 'grant');
    const id = await startPrivateAiHistory(
      pool,
      user.id,
      'openai',
      'synthetic',
      'Synthetic instructions',
      'Synthetic private input',
    );
    expect(id).toBeTruthy();
    await finishPrivateAiHistory(pool, user.id, id, {
      raw: 'Synthetic raw output',
      text: 'Synthetic answer',
      status: 'succeeded',
      outcome: 'Synthetic helper acceptance',
    });
    const own = PrivateAiHistorySchema.parse(
      await (await request.get('/api/v1/account/ai-history')).json(),
    );
    expect(own.entries[0]?.input).toBe('Synthetic private input');
    expect(own.entries[0]?.textOutput).toBe('Synthetic answer');
    const other = await playwright.request.newContext({
      baseURL: feedbackSandbox.apiOrigin,
    });
    try {
      await registerRecoverable(other);
      expect(
        PrivateAiHistorySchema.parse(
          await (await other.get('/api/v1/account/ai-history')).json(),
        ).entries,
      ).toHaveLength(0);
    } finally {
      await other.dispose();
    }
    await consentWrite(request, 'private-ai-history', 'revoke');
    expect(
      PrivateAiHistorySchema.parse(
        await (await request.get('/api/v1/account/ai-history')).json(),
      ).entries,
    ).toHaveLength(0);
    await finishPrivateAiHistory(pool, user.id, id, {
      text: 'Late response must not recreate data',
    });
    expect(
      (
        await pool.query(
          'SELECT count(*)::int AS n FROM private_ai_history WHERE user_id=$1',
          [user.id],
        )
      ).rows[0].n,
    ).toBe(0);
  } finally {
    await pool.end();
  }
});
