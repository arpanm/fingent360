import {
  test,
  expect,
  retentionHeaders,
  prepareStoryImageFixture,
  storyImageMode,
  storyImageProviderState,
} from '../../helpers/story-image-generation';
import { sourceOpsBrowser } from '../../helpers/source-ops-browser';
import {
  tabToObservationControl,
  captureObservationLayout,
} from '../../helpers/observation-inbox-accessibility';
import { connectionDatabase } from '../../helpers/research-connection-fixture';
import { MediaAssetSchema } from '../../../../packages/contracts/src/index';

test.use({
  namedOperators: true,
  manualWorkers: true,
  storyImageSimulation: true,
});

test('E2E-WEB-1146 Operations image failure recovery and lost-response replay use actual attempts with keyboard and narrow layout @STORY-MEDIA-002 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}, testInfo) => {
  const f = await prepareStoryImageFixture(
    request,
    playwright,
    feedbackSandbox,
  );
  const pool = await connectionDatabase(feedbackSandbox);
  const ids: string[] = [];
  let loseNextSuccess = false;
  try {
    await page.setViewportSize({ width: 360, height: 780 });
    await storyImageMode(feedbackSandbox, 'fail');
    await sourceOpsBrowser(page, request, feedbackSandbox, 'Publishing');
    const card = page.getByRole('article').filter({
      has: page.getByRole('heading', { name: f.source.title, exact: true }),
    });
    await card
      .getByRole('button', { name: 'Prepare visual summary', exact: true })
      .click();
    const dialog = page.getByRole('dialog', { name: 'Review visual summary' });
    const illustration = dialog.getByRole('region', {
      name: 'Story illustration',
    });
    await expect(illustration).toBeVisible();
    // Hold only the real committed response, never invent an application result.
    await page.route('**/api/v1/ops/media/*/image', async (route) => {
      const body = route.request().postDataJSON() as { requestId: string };
      ids.push(body.requestId);
      if (!loseNextSuccess) return route.fallback();
      const response = await route.fetch({
        url:
          feedbackSandbox.apiOrigin + new URL(route.request().url()).pathname,
        headers: {
          ...(await route.request().allHeaders()),
          ...retentionHeaders,
        },
      });
      expect(response.status()).toBe(201);
      MediaAssetSchema.parse(await response.json());
      loseNextSuccess = false;
      await route.abort('failed');
    });
    const prepare = illustration.getByRole('button', {
      name: 'Prepare AI illustration',
      exact: true,
    });
    await tabToObservationControl(page, prepare);
    await page.keyboard.press('Enter');
    await expect(illustration.getByRole('alert')).toContainText(
      'Image generation unavailable',
    );
    expect((await storyImageProviderState(feedbackSandbox)).calls).toBe(1);
    expect(ids).toHaveLength(1);
    const failedId = ids[0];
    const recover = illustration.getByRole('button', {
      name: 'Recover image attempt',
      exact: true,
    });
    await tabToObservationControl(page, recover);
    await page.keyboard.press('Space');
    await expect(illustration.getByRole('alert')).toContainText(
      'Explicitly start a new attempt',
    );
    expect(ids).toEqual([failedId, failedId]);
    expect((await storyImageProviderState(feedbackSandbox)).calls).toBe(1);
    await storyImageMode(feedbackSandbox, 'hold');
    loseNextSuccess = true;
    const retry = illustration.getByRole('button', {
      name: 'Start a new image attempt',
      exact: true,
    });
    await tabToObservationControl(page, retry);
    await page.keyboard.press('Enter');
    await expect
      .poll(async () => (await storyImageProviderState(feedbackSandbox)).calls)
      .toBe(2);
    await expect(
      illustration.getByRole('button', {
        name: 'Preparing image…',
        exact: true,
      }),
    ).toBeDisabled();
    expect(ids).toHaveLength(3);
    expect(ids[2]).not.toBe(failedId);
    await storyImageMode(feedbackSandbox, 'success');
    await expect(illustration.getByRole('alert')).toBeVisible();
    await expect(recover).toBeEnabled();
    const recoveredId = ids[2];
    expect(
      (
        await pool.query(
          'SELECT status FROM story_image_attempts WHERE id=$1',
          [recoveredId],
        )
      ).rows[0].status,
    ).toBe('succeeded');
    await tabToObservationControl(page, recover);
    await page.keyboard.press('Enter');
    await expect(illustration).toContainText('synthetic-story-image-model');
    await expect(illustration).toContainText(recoveredId!);
    await expect(illustration.getByRole('alert')).toHaveCount(0);
    expect(ids).toEqual([failedId, failedId, recoveredId, recoveredId]);
    expect((await storyImageProviderState(feedbackSandbox)).calls).toBe(2);
    expect(
      (
        await pool.query(
          'SELECT status FROM story_image_attempts ORDER BY started_at',
        )
      ).rows,
    ).toEqual([{ status: 'failed' }, { status: 'succeeded' }]);
    await expect(dialog.locator('img')).toHaveAttribute(
      'src',
      /^data:image\/png;base64,/,
    );
    await expect(dialog).toContainText(
      'AI-generated conceptual illustration; not evidence',
    );
    expect(
      (
        await request.get('/api/v1/discovery/items/' + f.source.id + '/media')
      ).status(),
    ).toBe(404);
    await tabToObservationControl(page, prepare);
    await captureObservationLayout(
      page,
      illustration,
      testInfo,
      'synthetic-story-image-recovered.png',
    );
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(
      card.getByRole('button', { name: 'Prepare visual summary', exact: true }),
    ).toBeFocused();
  } finally {
    await storyImageMode(feedbackSandbox, 'success');
    await page.unroute('**/api/v1/ops/media/*/image');
    await pool.end();
    await f.reviewer.dispose();
  }
});
