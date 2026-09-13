import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
const headers = { Origin: process.env.E2E_WEB_URL || 'http://localhost:5173' };
const password = 'E2E-only-private-passphrase-2026';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-WEB-150 query help applies only an explicitly chosen goal name @ASSIST-001', async ({
  page,
}) => {
  await page.goto('/#my-goals');
  expect(
    (
      await page.request.post('/api/v1/account/register', {
        headers,
        data: {
          username: `e2e_${randomUUID().slice(0, 16)}`,
          password,
          consent: true,
        },
      })
    ).status(),
  ).toBe(201);
  try {
    await page.reload();
    await page
      .getByRole('button', { name: 'Create a goal', exact: true })
      .click();
    await page.getByText('Help me with this', { exact: true }).click();
    await expect(
      page.getByRole('combobox', { name: 'Assistance provider', exact: true }),
    ).toHaveAccessibleName('Assistance provider');
    await page
      .getByLabel('Assistance provider', { exact: true })
      .selectOption('query');
    await page
      .getByLabel('What would you like help with?', { exact: true })
      .fill('education goal');
    await page
      .getByRole('button', { name: 'Get suggestions', exact: true })
      .click();
    await expect(
      page.getByRole('region', { name: 'Assistance results' }),
    ).toContainText('Query-based');
    await expect(page.getByLabel('Goal name', { exact: true })).toHaveValue('');
    await page
      .getByRole('button', { name: 'Apply name suggestion', exact: true })
      .click();
    await expect(page.getByLabel('Goal name', { exact: true })).toHaveValue(
      'Education goal',
    );
  } finally {
    await page.request.delete('/api/v1/account', {
      headers,
      data: { password },
    });
  }
});
