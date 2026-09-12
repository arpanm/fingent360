import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-WEB-060 save, edit, reload and remove a private goal @GOALS-001', async ({
  page,
}) => {
  test.setTimeout(60000);
  const password = 'Synthetic-goal-test-only-2026';
  const headers = {
    Origin: process.env.E2E_WEB_URL || 'http://localhost:5173',
  };
  await page.goto('/#account');
  await page
    .getByRole('button', { name: 'Create a new account', exact: true })
    .click();
  await page
    .getByLabel('Username', { exact: true })
    .fill(`goal_${randomUUID().slice(0, 16)}`);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('checkbox', { name: /I agree to store/ }).check();
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Sign out', exact: true }),
  ).toBeVisible();
  try {
    await page.goto('/#my-goals');
    await page
      .getByRole('button', { name: 'Create a goal', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Cancel goal', exact: true })
      .click();
    await expect(
      page.getByLabel('Goal name', { exact: true }),
    ).not.toBeVisible();
    await page
      .getByRole('button', { name: 'Create a goal', exact: true })
      .click();
    await page
      .getByLabel('Goal name', { exact: true })
      .fill('Synthetic school plan');
    await page
      .getByLabel('Target amount (INR)', { exact: true })
      .fill('100000.01');
    await page
      .getByLabel('Monthly contribution (INR)', { exact: true })
      .fill('1000.01');
    await page.getByLabel('Months from this plan', { exact: true }).fill('12');
    await expect(page.getByLabel('Goal name', { exact: true })).toHaveValue(
      'Synthetic school plan',
    );
    await expect(
      page.getByLabel('Monthly contribution (INR)', { exact: true }),
    ).toHaveValue('1000.01');
    await page
      .getByRole('checkbox', { name: /I agree to store this goal/ })
      .check();
    await page
      .getByRole('button', { name: 'Add saved goal', exact: true })
      .click();
    const card = page.getByRole('article', {
      name: 'Goal Synthetic school plan',
      exact: true,
    });
    await expect(card.getByText('₹12,000.12', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('progressbar', {
        name: 'Saved progress for Synthetic school plan',
      }),
    ).toHaveAttribute('value', '0');
    await page.reload();
    await expect(card).toContainText('₹1,00,000.01');
    await card.getByRole('button', { name: 'Edit goal', exact: true }).click();
    await page
      .getByLabel('Monthly contribution (INR)', { exact: true })
      .fill('2000.01');
    await page
      .getByRole('checkbox', { name: /I agree to store this goal/ })
      .check();
    await page
      .getByRole('button', { name: 'Save goal changes', exact: true })
      .click();
    await expect(card).toContainText('revision 2');
    await card
      .getByRole('button', { name: 'View revisions', exact: true })
      .click();
    await expect(
      page.getByRole('region', { name: 'Goal revisions' }),
    ).toContainText('revision 1');
    page.once('dialog', (dialog) => dialog.accept());
    await card
      .getByRole('button', { name: 'Remove goal', exact: true })
      .click();
    await expect(card).toHaveCount(0);
  } finally {
    await page.request.delete('/api/v1/account', {
      headers,
      data: { password },
    });
  }
});

test('E2E-WEB-062 goal auth gates distinguish outages and cancellation preserves edits @GOALS-001 @UX-001', async ({
  page,
}) => {
  // Deliberate transport failure fixtures; saved feature data is never mocked.
  await page.route('**/api/v1/account/goals', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'text/html',
      body: '<html>Temporary outage</html>',
    }),
  );
  await page.goto('/#my-goals');
  await expect(page.getByRole('alert')).toContainText('unreadable response');
  await expect(
    page.getByRole('link', {
      name: 'Sign in or create an account',
      exact: true,
    }),
  ).toHaveCount(0);
  await page.unroute('**/api/v1/account/goals');
  await page.reload();
  await expect(
    page.getByRole('link', {
      name: 'Sign in or create an account',
      exact: true,
    }),
  ).toHaveAttribute('href', '#account?next=my-goals');
  await page
    .getByRole('link', { name: 'Sign in or create an account', exact: true })
    .click();
  const password = 'Synthetic-goal-test-only-2026';
  await page
    .getByRole('button', { name: 'Create a new account', exact: true })
    .click();
  await page
    .getByLabel('Username', { exact: true })
    .fill(`goal_${randomUUID().slice(0, 16)}`);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('checkbox', { name: /I agree to store/ }).check();
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  try {
    await page
      .getByRole('button', { name: 'Create a goal', exact: true })
      .click();
    await page
      .getByLabel('Goal name', { exact: true })
      .fill('Unsaved synthetic draft');
    page.once('dialog', (dialog) => dialog.dismiss());
    await page
      .getByRole('button', { name: 'Cancel goal', exact: true })
      .click();
    await expect(page.getByLabel('Goal name', { exact: true })).toHaveValue(
      'Unsaved synthetic draft',
    );
    page.once('dialog', (dialog) => dialog.accept());
    await page
      .getByRole('button', { name: 'Cancel goal', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Create a goal', exact: true }),
    ).toBeFocused();
    await page.route('**/api/v1/account/goals', (route) =>
      route.fulfill({ status: 401, body: '' }),
    );
    await page
      .getByRole('button', { name: 'Reload goals', exact: true })
      .click();
    await expect(
      page.getByRole('link', {
        name: 'Sign in or create an account',
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Saved goals', exact: true }),
    ).toHaveCount(0);
  } finally {
    await page.unroute('**/api/v1/account/goals');
    await page.request.delete('/api/v1/account', {
      headers: { Origin: process.env.E2E_WEB_URL || 'http://localhost:5173' },
      data: { password },
    });
  }
});
