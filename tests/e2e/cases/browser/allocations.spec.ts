import { test, expect } from '../../helpers/app-fixture';
import { randomUUID } from 'node:crypto';
test('E2E-WEB-200 choose review save and reload real goal allocations @ALLOCATIONS-001', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(
    async (username) => {
      const post = async (path: string, body: unknown) => {
        const r = await fetch(`/api/v1/account/${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!r.ok) throw Error(`Fixture ${path} failed ${r.status}`);
        return r.json();
      };
      await post('register', {
        username,
        password: 'Synthetic-allocation-2026',
        consent: true,
      });
      await post('goals', {
        name: 'Synthetic allocation goal',
        type: 'education',
        targetMinor: '100000',
        savedMinor: '0',
        monthlyMinor: '100',
        horizonMonths: 12,
        currency: 'INR',
        scale: 2,
        assumptions: 'no-growth-nominal-v1',
        storageConsent: true,
      });
      const p = await post('holdings/preview', {
        csv: 'isin,quantity,total_cost_paise\nINE002A01018,3,10000',
        expectedVersion: 0,
        storageConsent: true,
      });
      await post('holdings/confirm', {
        previewId: p.previewId,
        expectedVersion: 0,
      });
    },
    `alloc_${randomUUID().slice(0, 12)}`,
  );
  await page.goto('/#allocations');
  await page
    .getByRole('button', { name: 'Edit allocations', exact: true })
    .click();
  await page
    .getByLabel('Goal', { exact: true })
    .selectOption({ label: 'Synthetic allocation goal' });
  await page
    .getByLabel('Holding', { exact: true })
    .selectOption('INE002A01018');
  await page
    .getByLabel('Quantity to allocate', { exact: true })
    .fill('1.000001');
  await page
    .getByRole('button', { name: 'Add allocation', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Review allocations', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Allocation review' }),
  ).toContainText('33.33');
  await page
    .getByRole('checkbox', { name: /I agree to store this allocation/ })
    .check();
  await page
    .getByRole('button', { name: 'Save allocation plan', exact: true })
    .click();
  await expect(
    page
      .getByRole('region', { name: 'Goal allocations', exact: true })
      .getByRole('status'),
  ).toHaveText('Allocation plan saved.');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: test.info().outputPath('saved-allocation.png'),
    fullPage: false,
  });
  await page.reload();
  await expect(
    page.getByRole('region', { name: 'Saved allocation plan' }),
  ).toContainText('1.000001');
  await page
    .getByRole('button', { name: 'View allocation history', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Allocation history' }),
  ).toContainText('Allocation revision 1');
});

test('E2E-WEB-201 mobile keyboard edit cancellation release and changed holdings review @ALLOCATIONS-001', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const username = `alloc_${randomUUID().slice(0, 12)}`;
  await page.evaluate(async (username) => {
    const post = async (path: string, body: unknown) => {
      const r = await fetch(`/api/v1/account/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw Error(`Fixture ${path}: ${r.status}`);
      return r.json();
    };
    await post('register', {
      username,
      password: 'Synthetic-allocation-2026',
      consent: true,
    });
    await post('goals', {
      name: 'Synthetic allocation goal',
      type: 'education',
      targetMinor: '100000',
      savedMinor: '0',
      monthlyMinor: '100',
      horizonMonths: 12,
      currency: 'INR',
      scale: 2,
      assumptions: 'no-growth-nominal-v1',
      storageConsent: true,
    });
    const preview = await post('holdings/preview', {
      csv: 'isin,quantity,total_cost_paise\nINE002A01018,3,10000',
      expectedVersion: 0,
      storageConsent: true,
    });
    await post('holdings/confirm', {
      previewId: preview.previewId,
      expectedVersion: 0,
    });
    await post('logout', {});
  }, username);
  await page.goto('/#allocations');
  await page
    .getByRole('link', { name: 'Sign in or create an account', exact: true })
    .click();
  await expect(page).toHaveURL(/#account\?next=allocations$/);
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page
    .getByLabel('Password', { exact: true })
    .fill('Synthetic-allocation-2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/#allocations$/);
  await page
    .getByRole('button', { name: 'Edit allocations', exact: true })
    .click();
  await expect(page.getByLabel('Goal', { exact: true })).toBeFocused();
  await page
    .getByLabel('Goal', { exact: true })
    .selectOption({ label: 'Synthetic allocation goal' });
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Holding', { exact: true })).toBeFocused();
  await page
    .getByLabel('Holding', { exact: true })
    .selectOption('INE002A01018');
  await page.keyboard.press('Tab');
  await expect(
    page.getByLabel('Quantity to allocate', { exact: true }),
  ).toBeFocused();
  await page.keyboard.type('2');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await page
    .getByRole('button', { name: 'Review allocations', exact: true })
    .click();
  await page
    .getByRole('checkbox', { name: /I agree to store this allocation/ })
    .check();
  await page
    .getByRole('button', { name: 'Save allocation plan', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Saved allocation plan' }),
  ).toContainText('2 units');
  await page
    .getByRole('button', { name: 'Edit allocations', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Remove allocation 1', exact: true })
    .click();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page
    .getByRole('button', { name: 'Cancel allocations', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Review allocations', exact: true }),
  ).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page
    .getByRole('button', { name: 'Cancel allocations', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Saved allocation plan' }),
  ).toContainText('2 units');
  await page.evaluate(async () => {
    const post = async (path: string, body: unknown) => {
      const r = await fetch(`/api/v1/account/holdings/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw Error(`Holding change ${r.status}`);
      return r.json();
    };
    const p = await post('preview', {
      csv: 'isin,quantity,total_cost_paise\nINE002A01018,1,3000',
      expectedVersion: 1,
      storageConsent: true,
    });
    await post('confirm', { previewId: p.previewId, expectedVersion: 1 });
  });
  await page
    .getByRole('button', { name: 'Reload allocations', exact: true })
    .click();
  await expect(
    page
      .getByRole('region', { name: 'Saved allocation plan' })
      .getByRole('alert'),
  ).toContainText('Review required');
  await expect(
    page.getByRole('region', { name: 'Saved allocation plan' }),
  ).toContainText('2 units');
  await page
    .getByRole('button', { name: 'Edit allocations', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Remove allocation 1', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Review allocations', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Allocation review' }),
  ).toContainText('releases all earmarked quantities');
  await page
    .getByRole('checkbox', { name: /I agree to store this allocation/ })
    .check();
  await page
    .getByRole('button', { name: 'Save allocation plan', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Saved allocation plan' }),
  ).toContainText('No holdings allocated yet.');
  await expect(
    page
      .getByRole('region', { name: 'Saved allocation plan' })
      .getByRole('alert'),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole('region', { name: 'Saved allocation plan' }),
  ).toContainText('Revision 2');
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page
    .getByRole('button', { name: 'View allocation history', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Allocation history' }),
  ).toContainText('Allocation revision 1');
});
