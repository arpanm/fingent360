import { test, expect } from '../../helpers/app-fixture';
import {
  seedStaleMacro,
  worldBankMode,
} from '../../helpers/world-bank-recovery';
import { sourceOpsBrowser } from '../../helpers/source-ops-browser';
import { operatorKey } from '../../helpers/operator';
import { retentionHeaders } from '../../helpers/retention';
test.use({
  worldBankSimulation: true,
  trace: 'off',
  video: 'off',
  screenshot: 'off',
});

test('E2E-WEB-2310 annual macro keeps accepted values and explicit freshness after real refresh failure and recovery @DATA-001 @TEST-SIMULATION', async ({
  page,
  request,
  feedbackSandbox,
}) => {
  await seedStaleMacro(request, feedbackSandbox);
  await worldBankMode(feedbackSandbox, 'http');
  await page.route(/\/api\/v1\/macro(?:[/?]|$)/, (route) => {
    const url = new URL(route.request().url());
    return route.continue({
      url: feedbackSandbox.apiOrigin + url.pathname + url.search,
    });
  });
  await page.goto('/#macro');
  const card = page.getByRole('article', {
    name: 'India GDP growth',
    exact: true,
  });
  await expect(card).toContainText(
    'Source check is due. These are previously accepted observations.',
  );
  await expect(card).toContainText('Observation year 2024');
  expect(
    (
      await request.post('/api/v1/ops/session', {
        headers: retentionHeaders,
        data: { key: await operatorKey() },
      })
    ).status(),
  ).toBe(200);
  await sourceOpsBrowser(page, request, feedbackSandbox, 'Macro ingestion');
  await page
    .getByRole('button', { name: 'Refresh India GDP growth', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText(
    'World Bank returned HTTP 503',
  );
  await page.goto('/#macro');
  await expect(card).toContainText(
    'Source check is due. These are previously accepted observations.',
  );
  await expect(card).toContainText('Observation year 2024');
  await worldBankMode(feedbackSandbox, 'success');
  await sourceOpsBrowser(page, request, feedbackSandbox, 'Macro ingestion');
  await page
    .getByRole('button', { name: 'Refresh India GDP growth', exact: true })
    .click();
  await expect(
    page.getByRole('status').filter({ hasText: 'India GDP growth: succeeded' }),
  ).toBeVisible();
  await page.goto('/#macro');
  await expect(card).toContainText('Source checked recently.');
  await expect(card).toContainText('Observation year 2024');
});
