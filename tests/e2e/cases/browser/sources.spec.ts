import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { operatorKey } from '../../helpers/operator';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-WEB-070 operations source metadata persists and history opens visibly @SOURCES-001 @UX-002', async ({
  page,
}) => {
  await page.goto('/#sources');
  await expect(
    page.getByRole('heading', { name: 'Our sources', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel(/operator key/i)).toHaveCount(0);
  await page.goto('/#ops');
  await page
    .getByLabel('Operator key', { exact: true })
    .fill(await operatorKey());
  await page
    .getByRole('button', { name: 'Clear entered credential', exact: true })
    .click();
  await expect(page.getByLabel('Operator key', { exact: true })).toHaveValue(
    '',
  );
  await expect(page.getByRole('status')).toContainText(
    'Entered credential cleared',
  );
  await page
    .getByLabel('Operator key', { exact: true })
    .fill(await operatorKey());
  await page
    .getByRole('button', { name: 'Sign in to operations', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Source registry', exact: true })
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
    page.getByRole('status').filter({ hasText: 'Saved source revision 1.' }),
  ).toBeVisible();
  await page
    .getByLabel('Usage constraints')
    .fill('Updated fixture constraint.');
  await page.getByRole('button', { name: 'Save source metadata' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Saved source revision 2.' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: `History ${name}`, exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Source revision history' });
  await expect(dialog).toContainText('No ingestion; fixture only.');
  await expect(dialog).toContainText('Updated fixture constraint.');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await page
    .getByRole('button', { name: 'Source registry', exact: true })
    .click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out of operations' }).click();
  await expect(
    page.getByRole('button', { name: 'Sign in to operations', exact: true }),
  ).toBeVisible();
});
