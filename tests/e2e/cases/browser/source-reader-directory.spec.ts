import { test, expect } from '@playwright/test';

test('E2E-WEB-1760 source directory reaches actual specialist readers @SOURCES-002', async ({
  page,
}) => {
  const destinations = [
    ['Company identities and exchange evidence', 'Indian equity evidence'],
    ['Fund disclosures and bond yields', 'Funds and bonds'],
    ['Rules and tax originals', 'Regulatory source library'],
  ] as const;
  for (const [link, region] of destinations) {
    await page.goto('/#sources');
    await page
      .getByRole('region', { name: 'Specialist source readers' })
      .getByRole('link', { name: link, exact: true })
      .click();
    await expect(
      page.getByRole('region', { name: region, exact: true }),
    ).toBeVisible();
    if (link === 'Fund disclosures and bond yields') {
      await expect(
        page.getByRole('region', {
          name: 'Historical sovereign bond',
          exact: true,
        }),
      ).toBeVisible();
    }
  }
  await page.goto('/#sources');
  await page
    .getByRole('region', { name: 'Specialist source readers' })
    .getByRole('link', {
      name: 'Release dates and GDP/CPI expectations',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('region', { name: 'GDP forecast comparison' }),
  ).toBeVisible();
});

test('E2E-WEB-1761 specialist routes remain usable when feed coverage fails @SOURCES-002 @TEST-SIMULATION', async ({
  page,
}) => {
  await page.route('**/api/v1/discovery/catalog', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Synthetic feed coverage outage' }),
    }),
  );
  await page.goto('/#sources');
  await expect(
    page.getByRole('button', { name: 'Retry coverage', exact: true }),
  ).toBeVisible();
  const readers = page.getByRole('region', {
    name: 'Specialist source readers',
  });
  await expect(readers).toContainText('only downloaded editions are available');
  await readers
    .getByRole('link', { name: 'Monthly commodity evidence', exact: true })
    .click();
  await expect(
    page.getByRole('heading', {
      name: 'Monthly commodity context',
      exact: true,
    }),
  ).toBeVisible();
});
