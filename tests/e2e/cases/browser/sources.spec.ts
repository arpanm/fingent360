import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { operatorKey } from '../../helpers/operator';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-WEB-070 operator source metadata persists and has history @SOURCES-001', async ({
  page,
}) => {
  await page.goto('/#sources');
  await expect(
    page.getByRole('heading', { name: 'Source registry', exact: true }),
  ).toBeVisible();
  await page
    .getByText('Source registry operator controls', { exact: true })
    .click();
  await page.getByLabel('Registry operator key').fill(await operatorKey());
  await page
    .getByRole('button', { name: 'Load operator registry', exact: true })
    .click();
  const name = `Synthetic browser metadata ${randomUUID()}`;
  await page.getByLabel('Source name', { exact: true }).fill(name);
  await page.getByLabel('Source category').fill('Synthetic acceptance fixture');
  await page
    .getByLabel('Source URL', { exact: true })
    .fill('https://example.com/source');
  await page.getByLabel('Terms URL').fill('https://example.com/terms');
  await page
    .getByLabel('Usage constraints')
    .fill('No ingestion; fixture only.');
  await page.getByRole('button', { name: 'Save source metadata' }).click();
  await expect(
    page
      .getByRole('region', { name: 'Source registry', exact: true })
      .getByRole('status'),
  ).toHaveText('Saved source revision 1.');
  await page
    .getByLabel('Usage constraints')
    .fill('Updated fixture constraint.');
  await page.getByRole('button', { name: 'Save source metadata' }).click();
  await expect(
    page
      .getByRole('region', { name: 'Source registry', exact: true })
      .getByRole('status'),
  ).toHaveText('Saved source revision 2.');
  await page
    .getByRole('button', { name: `History ${name}`, exact: true })
    .click();
  const history = page.getByRole('region', { name: 'Source revision history' });
  await expect(
    history.getByText('No ingestion; fixture only.', { exact: true }),
  ).toBeVisible();
  await expect(
    history.getByText('Updated fixture constraint.', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole('article', { name, exact: true })).toHaveCount(0);
  await page
    .getByText('Source registry operator controls', { exact: true })
    .click();
  await page.getByLabel('Registry operator key').fill(await operatorKey());
  await page
    .getByRole('button', { name: 'Load operator registry', exact: true })
    .click();
  await expect(page.getByRole('article', { name, exact: true })).toContainText(
    'Updated fixture constraint.',
  );
});
