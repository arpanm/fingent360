import { test, expect } from '../../helpers/app-fixture';
import { discoveryUpdates } from '../../helpers/discovery-updates';
import { FeedSchema } from '../../../../packages/contracts/src/index';

test('E2E-WEB-137 explicit new-reading admission preserves story identity keyboard focus and complete cursor collection @UX-002C @TEST-SIMULATION', async ({
  page,
  request,
  feedbackSandbox,
}, testInfo) => {
  test.setTimeout(120000);
  const f = await discoveryUpdates(request, feedbackSandbox);
  await page.route('**/api/v1/discovery/**', (route) => {
    const url = new URL(route.request().url());
    return route.continue({
      url: feedbackSandbox.apiOrigin + url.pathname + url.search,
    });
  });
  const path = '/api/v1/discovery/feed?view=explore&q=' + f.token;
  const first = FeedSchema.parse(await (await request.get(path)).json());
  expect(first.items).toHaveLength(30);
  const selected = first.items[1]!;
  await page.goto('/#explore?q=' + f.token + '&mode=stories');
  const stage = page.getByRole('region', {
    name: 'Reading story',
    exact: true,
  });
  await expect(stage.getByRole('heading')).toHaveText(first.items[0]!.title);
  await stage.focus();
  await page.keyboard.press('ArrowDown');
  await expect(stage.getByRole('heading')).toHaveText(selected.title);
  const added = await f.publish();
  const check = page.getByRole('button', {
    name: 'Check for new reading',
    exact: true,
  });
  await check.focus();
  await page.keyboard.press('Enter');
  const apply = page.getByRole('button', {
    name: 'Apply updated reading',
    exact: true,
  });
  await expect(apply).toBeEnabled();
  await expect(stage.getByRole('heading')).toHaveText(selected.title);
  await expect(
    stage.getByRole('link', { name: /Read the story/ }),
  ).toHaveAttribute('data-item-id', selected.id);
  await apply.focus();
  await page.keyboard.press('Enter');
  await expect(apply).toHaveCount(0);
  await expect(stage).toBeFocused();
  await expect(stage.getByRole('heading')).toHaveText(selected.title);
  await page.getByRole('button', { name: 'Scan', exact: true }).click();
  await page.getByRole('button', { name: 'More reading', exact: true }).click();
  const links = page.locator('a.headline-link');
  await expect(links).toHaveCount(33);
  const ids = await links.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('data-item-id')),
  );
  expect(new Set(ids).size).toBe(33);
  expect(ids.slice().sort()).toEqual(
    [...f.items.map((item) => item.id), added.id].sort(),
  );
  await page.getByRole('button', { name: 'Stories', exact: true }).click();
  await expect(stage.getByRole('heading')).toHaveText(selected.title);
  await check.click();
  await expect(
    page.getByText('Reading checked. No new items were added.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(apply).toHaveCount(0);
  // A second publication is staged, then a real withdrawal occurs before Apply.
  await f.publish();
  await check.click();
  await expect(apply).toBeEnabled();
  await f.withdraw(selected);
  await apply.focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByText(
      'Your previous story is no longer in this selection. Choose another available story.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(stage.getByRole('heading')).not.toHaveText(selected.title);
  await expect(
    page.getByRole('heading', { name: selected.title, exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('synthetic-reading-updates.png'),
    fullPage: true,
  });
});

test('E2E-WEB-138 failed and superseded explicit reading checks cannot replace the current selection @UX-002C @TEST-SIMULATION', async ({
  page,
  request,
  feedbackSandbox,
}) => {
  const f = await discoveryUpdates(request, feedbackSandbox, 3);
  let fail = false;
  let hold = false;
  let release!: () => void;
  let captured!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    captured = resolve;
  });
  let active = 0;
  await page.route('**/api/v1/discovery/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/feed') && fail) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Synthetic explicit-check failure' }),
      });
      return;
    }
    if (url.pathname.endsWith('/feed') && hold) {
      hold = false;
      active++;
      try {
        const response = await route.fetch({
          url: feedbackSandbox.apiOrigin + url.pathname + url.search,
        });
        expect(response.status()).toBe(200);
        captured();
        await held;
        await route.fulfill({ response });
      } finally {
        active--;
      }
    } else
      await route.continue({
        url: feedbackSandbox.apiOrigin + url.pathname + url.search,
      });
  });
  try {
    await page.goto('/#explore?q=' + f.token + '&mode=stories');
    const stage = page.getByRole('region', {
      name: 'Reading story',
      exact: true,
    });
    await expect(stage.getByRole('heading')).toBeVisible();
    const title = await stage.getByRole('heading').textContent();
    fail = true;
    await page
      .getByRole('button', { name: 'Check for new reading', exact: true })
      .click();
    await expect(page.getByRole('alert')).toContainText(
      'Synthetic explicit-check failure',
    );
    await expect(stage.getByRole('heading')).toHaveText(title!);
    fail = false;
    await page
      .getByRole('button', { name: 'Retry new reading check', exact: true })
      .click();
    await expect(
      page.getByText('Reading checked. No new items were added.', {
        exact: true,
      }),
    ).toBeVisible();
    await f.publish();
    hold = true;
    await page
      .getByRole('button', { name: 'Check for new reading', exact: true })
      .click();
    await started;
    await page
      .getByLabel('Search topics and reading')
      .fill('synthetic-no-match-' + f.token);
    await expect(stage).toHaveCount(0);
    release();
    await expect.poll(() => active).toBe(0);
    await expect(
      page.getByRole('button', { name: 'Apply updated reading', exact: true }),
    ).toHaveCount(0);
    await expect(stage).toHaveCount(0);
  } finally {
    release();
    await expect.poll(() => active).toBe(0);
  }
});
