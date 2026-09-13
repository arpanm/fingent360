import { test, expect } from '@playwright/test';
import { operatorKey } from '../../helpers/operator';
import { FeedSchema } from '../../../../packages/contracts/src/index';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-WEB-180 source filters Scan Stories reader context and Back preserve selection @SOURCES-002', async ({
  page,
}) => {
  await page.goto('/#explore');
  const feed = FeedSchema.parse(
    await (
      await page.request.get('/api/v1/discovery/feed?view=explore')
    ).json(),
  );
  expect(feed.items.length).toBeGreaterThan(0);
  await expect(
    page.getByLabel('Research source', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel('Research topic', { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel('Research region', { exact: true })
    .selectOption('global');
  await expect(page).toHaveURL(/region=global/);
  await page.getByRole('button', { name: 'Stories', exact: true }).click();
  await expect(page).toHaveURL(/mode=stories/);
  const story = page.getByRole('region', { name: 'Reading story' });
  await expect(story).toBeVisible();
  await story.focus();
  const next = story.getByRole('button', { name: 'Next', exact: true });
  if (await next.isEnabled()) {
    const before = await story.getByRole('heading').textContent();
    await page.keyboard.press('ArrowDown');
    await expect(story.getByRole('heading')).not.toHaveText(before!);
    await page.keyboard.press('ArrowUp');
    await expect(story.getByRole('heading')).toHaveText(before!);
  }
  await story.getByRole('link', { name: 'Read the story' }).click();
  await expect(
    page.getByRole('heading', { name: 'Follow the source.', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Reading context' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page).toHaveURL(/region=global.*mode=stories/);
  await expect(
    page.getByRole('button', { name: 'Stories', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Scan', exact: true }).click();
  await page
    .getByRole('searchbox', { name: 'Search topics and reading' })
    .fill('no-published-item-zzzz');
  await expect(
    page.getByText('No published items match those filters.', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Clear reading filters', exact: true })
    .click();
  await expect(page.locator('a.headline-link').first()).toBeVisible();
  await page.goto('/#sources');
  await expect(
    page.getByRole('heading', { name: 'Our sources', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: /Read published items/ }).first(),
  ).toBeVisible();
  await page
    .getByRole('link', { name: /Read published items/ })
    .first()
    .click();
  await expect(page).toHaveURL(/#explore\?source=/);
  await expect(page.locator('a.headline-link').first()).toBeVisible();
});

test('E2E-WEB-181 operations fixed-source selection reports independent refresh outcomes @SOURCES-002', async ({
  page,
}) => {
  test.setTimeout(90000);
  const session = await page.request.post('/api/v1/ops/session', {
    headers: { Origin: process.env.E2E_WEB_URL || 'http://localhost:5173' },
    data: { key: await operatorKey() },
  });
  expect(session.status()).toBe(200);
  try {
    await page.goto('/#ops');
    const panel = page.getByRole('region', { name: 'Source refresh' });
    await expect(panel).toBeVisible();
    const refresh = panel.getByRole('button', {
      name: 'Refresh discovery sources',
      exact: true,
    });
    await expect(refresh).toBeDisabled();
    await panel
      .getByRole('checkbox', { name: /glossary|educational/i })
      .check();
    await expect(refresh).toBeEnabled();
    await refresh.click();
    await expect(
      panel.getByRole('button', {
        name: 'Refresh discovery sources',
        exact: true,
      }),
    ).toBeEnabled({ timeout: 60000 });
    await expect(
      panel.getByText(/checked · .*new drafts/).first(),
    ).toBeVisible();
    await panel
      .getByRole('button', { name: 'Reload source status', exact: true })
      .click();
    await expect(
      panel.getByRole('checkbox', { name: /glossary|educational/i }),
    ).toBeChecked();
  } finally {
    await page.request.delete('/api/v1/ops/session', {
      headers: { Origin: process.env.E2E_WEB_URL || 'http://localhost:5173' },
    });
  }
});

test('E2E-WEB-182 India source story opens original evidence history and linked learning @SOURCES-002', async ({
  page,
}) => {
  const feed = FeedSchema.parse(
    await (
      await page.request.get('/api/v1/discovery/feed?source=pib&view=explore')
    ).json(),
  );
  expect(
    feed.items.length,
    'Refresh and review the permitted PIB source pack first.',
  ).toBeGreaterThan(0);
  const item = feed.items[0]!;
  await page.goto('/#explore?source=pib&region=india&mode=stories');
  const story = page.getByRole('region', { name: 'Reading story' });
  await expect(story.getByRole('heading')).toHaveText(item.title);
  await story.getByRole('link', { name: 'Read the story' }).click();
  await expect(
    page.getByRole('heading', { name: item.title, exact: true }),
  ).toBeVisible();
  await expect(page.locator('.reader-deck')).toBeEmpty();
  await expect(page.locator('.reading-body')).toContainText(item.body);
  await page
    .getByRole('button', { name: 'Stored evidence', exact: true })
    .click();
  const evidence = page.getByRole('dialog', { name: 'Stored source evidence' });
  await expect(evidence).toContainText(item.sourceHash!);
  await page.keyboard.press('Escape');
  await expect(evidence).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Version history', exact: true })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Version history' }),
  ).toContainText(item.title);
  await page.keyboard.press('Escape');
  const context = page.getByRole('region', { name: 'Reading context' });
  const learning = context.getByRole('link', { name: /^Try:/ }).first();
  await expect(learning).toBeVisible();
  await learning.click();
  await expect(page).toHaveURL(/#learning\?question=/);
  await expect(
    page.getByRole('heading', { name: 'Understand one thing better' }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole('heading', { name: item.title, exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page).toHaveURL(/source=pib&region=india&mode=stories/);
  await expect(story.getByRole('heading')).toHaveText(item.title);
});
