import { test, expect, eventFixture } from '../../helpers/event-fixture';
test('E2E-WEB-1112 public reader attaches source snapshot only to matching feedback screen @EVAL-LINEAGE-001', async ({
  page,
  request,
  feedbackSandbox,
}) => {
  const f = await eventFixture(request, feedbackSandbox);
  await page.route('**/api/v1/discovery/items/**', (route) => {
    const url = new URL(route.request().url());
    return route.continue({
      url: feedbackSandbox.apiOrigin + url.pathname + url.search,
    });
  });
  await page.goto('/#read/' + f.source.id);
  await expect(
    page.getByRole('heading', { name: f.source.title, exact: true }),
  ).toBeVisible();
  const snapshot = await page.evaluate(() =>
    JSON.parse(
      sessionStorage.getItem('fingent360-public-reading-view-v1') ?? 'null',
    ),
  );
  expect(snapshot.item.id).toBe(f.source.id);
  expect(snapshot.kind).toBe('reader');
  expect(snapshot).not.toHaveProperty('holdings');
});
test('E2E-WEB-1116 privacy exposes separately opted-in private request history @EVAL-LINEAGE-001', async ({
  page,
  request,
}) => {
  const { registerRecoverable } = await import('../../helpers/auth-wait');
  await registerRecoverable(request);
  await page.context().addCookies((await request.storageState()).cookies);
  await page.goto('/#privacy');
  const history = page.getByRole('region', {
    name: 'My AI request history',
    exact: true,
  });
  await history.getByRole('button', { name: 'Load my AI history' }).click();
  await expect(history).toContainText('History not enabled');
  await expect(history).toContainText('seven days');
});
