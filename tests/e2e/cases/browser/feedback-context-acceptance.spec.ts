import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import type { APIRequestContext, APIResponse, Page } from '@playwright/test';
import {
  test,
  expect,
  eventFixture,
  eventHeaders,
} from '../../helpers/event-fixture';
import type { FeedbackSandbox } from '../../helpers/feedback-fixture';
import {
  connectionDatabase,
  prepareConnectionAccount,
  reviseConnectionSourceFixture,
} from '../../helpers/research-connection-fixture';
import { syntheticPng } from '../../helpers/story-image';
import {
  EvalDetailSchema,
  FeedbackReceiptSchema,
  FeedbackReportSchema,
  FeedbackSubmissionSchema,
  FeedSchema,
  MediaAssetSchema,
  type FeedItem,
} from '../../../../packages/contracts/src/index';

// Real isolated application/storage. Only the external provider transport below
// is synthetic, confined to a child process; no live key/provider is consulted.
// Do not record capability tokens, private account setup or connection strings.
test.use({ trace: 'off', video: 'off', screenshot: 'off' });

async function generatedMedia(sandbox: FeedbackSandbox, source: FeedItem) {
  const pool = await connectionDatabase(sandbox);
  await pool.end();
  const script = `
    import { randomUUID } from 'node:crypto';
    let input = '';
    for await (const chunk of process.stdin) input += chunk;
    const fixture = JSON.parse(input);
    const { MediaStore } = await import(fixture.module);
    const transport = [];
    globalThis.fetch = async (url, options) => {
      const body = JSON.parse(options.body);
      let raw;
      if (String(url) === 'https://api.openai.com/v1/responses') {
        const request = JSON.parse(body.input);
        if (request.sourceId !== fixture.source.id ||
            request.sourceVersion !== fixture.source.version)
          throw Error('Synthetic transport received another source edition.');
        const caption = request.blocks.find((block) => block.length <= 240);
        if (!caption) throw Error('Synthetic source has no eligible whole block.');
        const text = JSON.stringify({
          sourceId: request.sourceId, sourceVersion: request.sourceVersion,
          captions: [caption],
        });
        raw = JSON.stringify({ output: [{ type: 'message', content: [
          { type: 'output_text', text },
        ] }] });
      } else if (String(url) === 'https://api.openai.com/v1/images/generations') {
        raw = JSON.stringify({ data: [{ b64_json: fixture.png }] });
      } else throw Error('Live provider transport is forbidden in this fixture.');
      transport.push({ url: String(url), body, raw });
      return new Response(raw, { status: 200 });
    };
    const store = new MediaStore({
      DATABASE_URL: fixture.databaseUrl,
      AI_PROVIDER: 'openai', OPENAI_API_KEY: 'synthetic-feedback-context-key',
      OPENAI_MODEL: 'synthetic-feedback-caption-model',
      STORY_IMAGE_PROVIDER: 'openai', STORY_IMAGE_MODEL: 'synthetic-feedback-image-model',
    });
    try {
      await store.generate(fixture.source.id);
      const attemptId = randomUUID();
      const asset = await store.generateImage(
        fixture.source.id, { requestId: attemptId }, async () => undefined,
      );
      process.stdout.write(JSON.stringify({ asset, attemptId, transport }));
    } finally { await store.onApplicationShutdown(); }
  `;
  const stdout = await new Promise<string>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['--input-type=module', '-e', script],
      {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { PATH: process.env.PATH, NODE_NO_WARNINGS: '1' },
      },
    );
    let output = '';
    let expired = false;
    const timeout = setTimeout(() => {
      expired = true;
      child.kill('SIGKILL');
    }, 30000);
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString();
      if (output.length > 1_000_000) child.kill('SIGKILL');
    });
    // Drain without exposing database connection diagnostics in test artifacts.
    child.stderr.resume();
    child.stdin.on('error', () => {});
    child.once('error', () => {
      clearTimeout(timeout);
      reject(Error('Synthetic media subprocess could not start.'));
    });
    child.once('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0 || expired)
        reject(
          Error('Synthetic media subprocess did not finish successfully.'),
        );
      else resolve(output);
    });
    child.stdin.end(
      JSON.stringify({
        databaseUrl: sandbox.databaseUrl,
        source,
        png: syntheticPng,
        module: new URL('../../../../apps/api/dist/media.js', import.meta.url)
          .href,
      }),
    );
  });
  const generated = JSON.parse(stdout) as {
    asset: unknown;
    attemptId: string;
    transport: Array<{
      url: string;
      body: {
        model: string;
        instructions?: string;
        input?: string;
        prompt?: string;
      };
      raw: string;
    }>;
  };
  const asset = MediaAssetSchema.parse(generated.asset);
  expect(asset.generation).toMatchObject({
    provider: 'openai',
    model: 'synthetic-feedback-caption-model',
    fallbackReason: null,
  });
  expect(asset.image?.attemptId).toBe(generated.attemptId);
  expect(generated.transport.map((entry) => entry.url)).toEqual([
    'https://api.openai.com/v1/responses',
    'https://api.openai.com/v1/images/generations',
  ]);
  return { ...generated, asset };
}

async function prepareBrowser(page: Page, sandbox: FeedbackSandbox) {
  await page.route('**/api/v1/discovery/**', (route) => {
    const url = new URL(route.request().url());
    return route.continue({
      url: sandbox.apiOrigin + url.pathname + url.search,
    });
  });
  await page.goto('/#feedback');
  await page
    .getByLabel('Feedback API URL', { exact: true })
    .fill(sandbox.apiOrigin);
  await page
    .getByLabel('Automatically deliver submitted feedback', { exact: true })
    .check();
  await page
    .getByRole('button', {
      name: 'Save feedback delivery settings',
      exact: true,
    })
    .click();
  await expect(
    page.getByText(
      'Feedback delivery enabled. Submitted reports will retry while the app is open.',
      { exact: true },
    ),
  ).toBeVisible();
}

async function submitContext(
  page: Page,
  request: APIRequestContext,
  label: string,
) {
  const text =
    'TEST-SIMULATION feedback context: ' + label + ' ' + randomUUID();
  await page
    .getByRole('button', { name: 'Give feedback', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Feedback only', exact: true })
    .click();
  const dialog = page.getByRole('dialog', {
    name: 'Share feedback',
    exact: true,
  });
  await dialog.getByLabel('Your feedback', { exact: true }).fill(text);
  await dialog
    .getByLabel(
      'Send this feedback and its attachments to the feedback team.',
      { exact: true },
    )
    .check();
  const delivered = page.waitForResponse((response) => {
    const sent = response.request();
    return (
      new URL(response.url()).pathname === '/api/v1/feedback' &&
      sent.method() === 'POST' &&
      sent.postDataJSON()?.text === text
    );
  });
  await dialog
    .getByRole('button', { name: 'Submit feedback', exact: true })
    .click();
  const response = await delivered;
  expect(response.status()).toBe(201);
  const payload = FeedbackSubmissionSchema.parse(
    response.request().postDataJSON(),
  );
  const receipt = FeedbackReceiptSchema.parse(await response.json());
  expect(receipt.id).toBe(payload.id);
  const retained = await request.get('/api/v1/ops/feedback/' + receipt.id);
  expect(retained.status()).toBe(200);
  const report = FeedbackReportSchema.parse(await retained.json());
  expect(report.context).toEqual(payload.context);
  expect(report.text).toBe(text);
  expect(report.image).toBeNull();
  expect(report.audio).toBeNull();
  expect(JSON.stringify(report.context)).not.toContain(syntheticPng);
  expect(JSON.stringify(report.context)).not.toContain(
    'synthetic-feedback-context-key',
  );
  // Keep the underlying reader mounted, including while its actual request is held.
  await page
    .getByRole('dialog', { name: 'Saved on this device', exact: true })
    .getByRole('button', { name: 'Back to the app', exact: true })
    .click();
  return { id: receipt.id, context: report.context };
}

async function evaluation(request: APIRequestContext, id: string) {
  const response = await request.get('/api/v1/ops/evaluations/' + id);
  expect(response.status()).toBe(200);
  return EvalDetailSchema.parse(await response.json());
}

test('E2E-WEB-1121 reader and story feedback submit exact displayed edition and link retained actual media provider evidence @FEEDBACK-001 @EVAL-LINEAGE-001 @TEST-SIMULATION', async ({
  page,
  request,
  feedbackSandbox,
}) => {
  test.setTimeout(90000);
  const { source } = await eventFixture(request, feedbackSandbox);
  const generated = await generatedMedia(feedbackSandbox, source);
  const reviewed = await request.put('/api/v1/ops/media/' + source.id, {
    headers: eventHeaders,
    data: {
      assetId: generated.asset.id,
      imageAttemptId: generated.attemptId,
      publish: true,
    },
  });
  expect(reviewed.status()).toBe(200);
  await prepareBrowser(page, feedbackSandbox);
  await page.goto('/#read/' + source.id);
  await expect(
    page.getByRole('heading', { name: source.title, exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'Reviewed visual summary' })
      .locator('img'),
  ).toHaveAttribute('src', 'data:image/png;base64,' + syntheticPng);
  const reader = await submitContext(page, request, 'actual reader');
  const media = {
    assetId: generated.asset.id,
    imageAttemptId: generated.attemptId,
    imageHash: generated.asset.image!.sha256,
  };
  expect(reader.context.screen).toBe('read/' + source.id);
  expect(reader.context.publicView).toMatchObject({
    kind: 'reader',
    item: source,
    media,
  });

  const query = encodeURIComponent(source.title.slice(0, 80));
  const selected = FeedSchema.parse(
    await (
      await request.get('/api/v1/discovery/feed?view=explore&q=' + query)
    ).json(),
  );
  expect(selected.items[0]?.id).toBe(source.id);
  await page.goto('/#explore?q=' + query + '&mode=stories');
  const story = page.getByRole('region', {
    name: 'Reading story',
    exact: true,
  });
  await expect(
    story.getByRole('heading', { name: source.title, exact: true }),
  ).toBeVisible();
  await expect(story.locator('img')).toHaveAttribute(
    'src',
    'data:image/png;base64,' + syntheticPng,
  );
  const submittedStory = await submitContext(page, request, 'actual story');
  expect(submittedStory.context.screen).toBe('explore');
  expect(submittedStory.context.publicView).toMatchObject({
    kind: 'story',
    item: source,
    media,
  });

  const detail = await evaluation(request, source.id);
  for (const submission of [reader, submittedStory]) {
    expect(
      detail.feedback.find((entry) => entry.id === submission.id)?.view,
    ).toEqual(submission.context.publicView);
  }
  expect(
    detail.views.some(
      (entry) =>
        entry.sourceVersion === source.version &&
        entry.payload.id === source.id,
    ),
  ).toBe(true);
  const composition = detail.compositions.find(
    (entry) => entry.media.assetId === generated.asset.id,
  );
  expect(composition?.media).toEqual(media);
  expect(composition?.item).toEqual(source);
  expect(composition?.captions).toEqual(generated.asset.captions);
  const caption = generated.transport[0]!;
  expect(detail.traces).toContainEqual(
    expect.objectContaining({
      sourceId: source.id,
      sourceVersion: source.version,
      kind: 'media-caption',
      provider: 'openai',
      model: caption.body.model,
      status: 'succeeded',
      instructions: caption.body.instructions,
      input: caption.body.input,
      rawOutput: caption.raw,
      textOutput: JSON.parse(caption.raw).output[0].content[0].text,
    }),
  );
  expect(detail.imageAttempts).toContainEqual(
    expect.objectContaining({
      id: generated.attemptId,
      assetId: generated.asset.id,
      provider: 'openai',
      model: 'synthetic-feedback-image-model',
      status: 'succeeded',
    }),
  );
  const pool = await connectionDatabase(feedbackSandbox);
  try {
    const image = await pool.query(
      'SELECT asset_id,provider,model,prompt,provider_output,output FROM story_image_attempts WHERE id=$1',
      [generated.attemptId],
    );
    expect(image.rows).toHaveLength(1);
    expect(image.rows[0]).toMatchObject({
      asset_id: generated.asset.id,
      provider: 'openai',
      model: generated.transport[1]!.body.model,
      prompt: generated.transport[1]!.body.prompt,
      provider_output: generated.transport[1]!.raw,
      output: generated.asset.image,
    });
  } finally {
    await pool.end();
  }
});

test('E2E-WEB-1122 submitted context excludes private and loading screens and mismatched media then recovers exact revised edition @FEEDBACK-001 @EVAL-LINEAGE-001 @TEST-SIMULATION', async ({
  page,
  request,
  feedbackSandbox,
}) => {
  test.setTimeout(90000);
  const { source } = await eventFixture(request, feedbackSandbox);
  await prepareConnectionAccount(request);
  await page.context().addCookies((await request.storageState()).cookies);
  await prepareBrowser(page, feedbackSandbox);
  await page.goto('/#read/' + source.id);
  await expect(
    page.getByRole('heading', { name: source.title, exact: true }),
  ).toBeVisible();
  await page.goto('/#goals');
  await expect(
    page.getByRole('heading', { name: 'Synthetic research goal', exact: true }),
  ).toBeVisible();
  const privateReport = await submitContext(page, request, 'private screen');
  expect(privateReport.context.screen).toBe('goals');
  expect(privateReport.context).not.toHaveProperty('publicView');
  expect(JSON.stringify(privateReport.context)).not.toContain(
    'Synthetic research goal',
  );
  expect(JSON.stringify(privateReport.context)).not.toContain('INE002A01018');

  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let captured = 0;
  let initialResponse: Promise<APIResponse> | undefined;
  const exactReader = new RegExp('/api/v1/discovery/items/' + source.id + '$');
  await page.route(exactReader, async (route) => {
    // Retain the first genuine response for duplicate mount requests too. This
    // explicitly simulated delayed snapshot cannot race the subsequent revision.
    initialResponse ??= route.fetch({
      url: feedbackSandbox.apiOrigin + '/api/v1/discovery/items/' + source.id,
    });
    const actual = await initialResponse;
    expect(actual.status()).toBe(200);
    captured++;
    await gate;
    await route.fulfill({ response: actual });
  });
  try {
    await page.goto('/#read/' + source.id);
    await expect.poll(() => captured).toBeGreaterThan(0);
    await expect(
      page.getByRole('heading', { name: source.title, exact: true }),
    ).toHaveCount(0);
    const loading = await submitContext(page, request, 'reader still loading');
    expect(loading.context.screen).toBe('read/' + source.id);
    expect(loading.context).not.toHaveProperty('publicView');

    // Keep the genuine old source response, then publish a genuine new-edition
    // visual. No response body is fabricated: this is the actual crossed-version race.
    const revised = await reviseConnectionSourceFixture(
      feedbackSandbox,
      source,
      'published',
    );
    const prepared = await request.post('/api/v1/ops/media/' + source.id, {
      headers: eventHeaders,
      data: {},
    });
    expect(prepared.status()).toBe(201);
    const nextAsset = MediaAssetSchema.parse(await prepared.json());
    expect(nextAsset.itemVersion).toBe(revised.version);
    expect(
      (
        await request.put('/api/v1/ops/media/' + source.id, {
          headers: eventHeaders,
          data: { assetId: nextAsset.id, publish: true },
        })
      ).status(),
    ).toBe(200);
    release();
    await expect(
      page.getByText(
        'This visual belongs to another source edition. Refresh reading.',
        { exact: false },
      ),
    ).toBeVisible();
    const crossed = await submitContext(
      page,
      request,
      'mismatched visual excluded',
    );
    expect(crossed.context.publicView?.item).toEqual(source);
    expect(crossed.context.publicView).not.toHaveProperty('media');
    await page.unroute(exactReader);
    await page.reload();
    await expect(
      page.getByRole('region', { name: 'Reviewed visual summary' }),
    ).toBeVisible();
    const recovered = await submitContext(
      page,
      request,
      'revised reader recovered',
    );
    expect(recovered.context.publicView).toMatchObject({
      kind: 'reader',
      item: revised,
      media: { assetId: nextAsset.id, imageAttemptId: null, imageHash: null },
    });
    const detail = await evaluation(request, source.id);
    expect(
      detail.feedback.some(
        (entry) => entry.id === privateReport.id || entry.id === loading.id,
      ),
    ).toBe(false);
    expect(
      detail.feedback.find((entry) => entry.id === crossed.id)?.view,
    ).toEqual(crossed.context.publicView);
    expect(
      detail.feedback.find((entry) => entry.id === recovered.id)?.view,
    ).toEqual(recovered.context.publicView);
  } finally {
    release();
    await page.unroute(exactReader);
  }
});
