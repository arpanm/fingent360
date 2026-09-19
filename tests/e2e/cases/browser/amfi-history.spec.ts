import { randomUUID } from 'node:crypto';
import {
  test,
  expect,
  retentionHeaders,
  indiaActors,
  historyInput,
} from '../../helpers/amfi-history';
test.use({ namedOperators: true });
test('E2E-WEB-1540 historical NAV navigation shows dated observations and expandable retained provenance @SRC-015 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox),
    data = historyInput();
  try {
    expect(
      (
        await request.post('/api/v1/ops/funds/import', {
          headers: retentionHeaders,
          data,
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await reviewer.post('/api/v1/ops/funds/review', {
          headers: retentionHeaders,
          data: {
            requestId: randomUUID(),
            editionId: data.requestId,
            decision: 'publish',
            reason: 'Synthetic browser history source review.',
          },
        })
      ).status(),
    ).toBe(201);
    await page.goto('/#funds-bonds');
    await page.getByRole('button', { name: /Synthetic history fund/ }).click();
    const history = page.getByRole('region', { name: 'Fund NAV history' });
    await expect(history).toContainText('2026-09-09');
    await expect(history).toContainText('2026-09-11');
    const provenance = history
      .getByText('Source and retrieval edition', { exact: true })
      .first();
    await provenance.focus();
    await provenance.press('Enter');
    await expect(history).toContainText('amfi-history-v1');
    await expect(history).toContainText(data.sourceUrl);
  } finally {
    await reviewer.dispose();
  }
});
test('E2E-WEB-1542 official catalog selector builds scoped history requests and rejects oversized periods @SRC-015 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  await page.goto('/#ops');
  await page
    .getByLabel('Named operator username', { exact: true })
    .fill(feedbackSandbox.namedCredentials!.username);
  await page
    .getByLabel('Named operator password', { exact: true })
    .fill(feedbackSandbox.namedCredentials!.password);
  await page
    .getByRole('button', { name: 'Sign in to operations', exact: true })
    .click();
  await page.getByRole('button', { name: 'Fund data', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'History mutual fund', exact: true })
    .selectOption('9');
  await page
    .getByRole('combobox', { name: 'History scheme type', exact: true })
    .selectOption('2');
  await page
    .getByLabel('History from date', { exact: true })
    .fill('2026-09-09');
  await page.getByLabel('History to date', { exact: true }).fill('2026-09-11');
  await page
    .getByRole('button', { name: 'Use this history request', exact: true })
    .click();
  await expect(
    page.getByLabel(
      'Historical report URL (optional; leave empty for latest NAV)',
      { exact: true },
    ),
  ).toHaveValue(/mf=9.*tp=2/);
  await page
    .getByLabel('History from date', { exact: true })
    .fill('2026-01-01');
  await page
    .getByRole('button', { name: 'Use this history request', exact: true })
    .click();
  await expect(
    page.getByText('Choose a history interval of 1 to 90 calendar days.', {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole('combobox', { name: 'History mutual fund', exact: true })
    .selectOption('');
  await page.getByLabel('History NAV date', { exact: true }).fill('2026-09-11');
  await page
    .getByRole('button', { name: 'Use this history request', exact: true })
    .click();
  await expect(page.getByLabel('History to date', { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByLabel(
      'Historical report URL (optional; leave empty for latest NAV)',
      { exact: true },
    ),
  ).toHaveValue(/frmdt=11-Sep-2026&tp=2$/);
});
