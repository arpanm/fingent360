import { test, expect } from '@playwright/test';
test.describe('Working virtual journey @SLICE-001', () => {
  test('E2E-WEB-010 event → import → goals → review → reload', async ({
    page,
  }) => {
    await page.goto('/#brief');
    await page.getByRole('link', { name: 'Explore the mechanism' }).click();
    await page.getByRole('link', { name: 'Alpha Air', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Alpha Air', exact: true }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Import CSV', exact: true }).click();
    await page.getByRole('button', { name: 'Open virtual workspace' }).click();
    try {
      await page.getByRole('button', { name: 'Preview import' }).click();
      await expect(
        page.getByText('Reconciled — ready to confirm'),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Confirm import' }).click();
      await expect(
        page.getByText('Saved revision 1.', { exact: true }),
      ).toBeVisible();
      await page.getByRole('link', { name: 'Goals', exact: true }).click();
      await page.getByRole('button', { name: 'Add goal', exact: true }).click();
      await page
        .getByLabel('Goal 1 name', { exact: true })
        .fill('Education one');
      await page
        .getByLabel('Goal 1 allocation (%)', { exact: true })
        .fill('40');
      await page.getByRole('button', { name: 'Add goal', exact: true }).click();
      await page
        .getByLabel('Goal 2 name', { exact: true })
        .fill('Education two');
      await page
        .getByLabel('Goal 2 allocation (%)', { exact: true })
        .fill('60');
      await page.getByRole('button', { name: 'Save goals' }).click();
      await expect(
        page.getByText(/Education one: INR 800.00 funded/),
      ).toBeVisible();
      await expect(
        page.getByText(/Education two: INR 1200.00 funded/),
      ).toBeVisible();
      await page.getByRole('link', { name: 'Reviews', exact: true }).click();
      await page.getByRole('button', { name: 'Create review' }).click();
      await expect(
        page
          .getByRole('article', { name: 'Selected review' })
          .getByRole('heading', { name: 'Review', exact: true }),
      ).toBeVisible();
      await page.getByLabel('Exercise input condition').selectOption('stale');
      await page.getByRole('button', { name: 'Create review' }).click();
      await expect(
        page.getByRole('heading', { name: 'Unable to assess', exact: true }),
      ).toBeVisible();
      await page.reload();
      await expect(
        page.getByRole('button', { name: /Unable to assess · revision 2/ }),
      ).toBeVisible();
      await page.getByRole('link', { name: 'Portfolio', exact: true }).click();
      await expect(page.getByLabel('Alpha Air quantity')).toHaveValue('10');
      await expect(page.getByLabel('Saved valuation')).toContainText(
        'INR 2000.00',
      );
      const dimensions = await page.evaluate(() => [
        document.documentElement.scrollWidth,
        document.documentElement.clientWidth,
      ]);
      expect(dimensions[0]).toBeLessThanOrEqual(dimensions[1]!);
    } finally {
      await page
        .getByText('Workspace access and deletion', { exact: true })
        .click();
      await page
        .getByRole('button', { name: 'Delete virtual workspace and data' })
        .click();
    }
  });
  test('E2E-WEB-011 invalid import and excessive allocations show correction', async ({
    page,
  }) => {
    await page.goto('/#import');
    await page.getByRole('button', { name: 'Open virtual workspace' }).click();
    try {
      await page.getByLabel('Declared total including cash (INR)').fill('1.00');
      await page.getByRole('button', { name: 'Preview import' }).click();
      await expect(
        page.getByText('Needs correction — nothing imported'),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Confirm import' }),
      ).toBeDisabled();
      await page.getByRole('link', { name: 'Goals', exact: true }).click();
      await page.getByRole('button', { name: 'Add goal', exact: true }).click();
      await page
        .getByLabel('Goal 1 name', { exact: true })
        .fill('Invalid allocation');
      await page
        .getByLabel('Goal 1 allocation (%)', { exact: true })
        .fill('101');
      await page.getByRole('button', { name: 'Save goals' }).click();
      await expect(page.getByRole('alert')).toContainText('100');
    } finally {
      await page
        .getByText('Workspace access and deletion', { exact: true })
        .click();
      await page
        .getByRole('button', { name: 'Delete virtual workspace and data' })
        .click();
    }
  });
  test('E2E-WEB-012 failed save preserves edits and shows an error @simulated', async ({
    page,
  }) => {
    await page.goto('/#portfolio');
    await page.getByRole('button', { name: 'Open virtual workspace' }).click();
    try {
      await page.getByLabel('Alpha Air quantity').fill('10');
      await page.route('**/api/v1/journey/workspace', async (route) => {
        if (route.request().method() === 'POST')
          await route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Simulated storage outage' }),
          });
        else await route.continue();
      });
      await page.getByRole('button', { name: 'Save portfolio' }).click();
      await expect(page.getByRole('alert')).toContainText(
        'Simulated storage outage',
      );
      await expect(page.getByLabel('Alpha Air quantity')).toHaveValue('10');
      await expect(page.getByLabel('Saved valuation')).toContainText(
        'INR 0.00',
      );
      await page.unroute('**/api/v1/journey/workspace');
      await page.getByRole('button', { name: 'Save portfolio' }).click();
      await expect(
        page.getByText('Saved revision 1.', { exact: true }),
      ).toBeVisible();
    } finally {
      await page.unroute('**/api/v1/journey/workspace');
      await page
        .getByText('Workspace access and deletion', { exact: true })
        .click();
      await page
        .getByRole('button', { name: 'Delete virtual workspace and data' })
        .click();
    }
  });
});
