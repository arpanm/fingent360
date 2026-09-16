import { randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/app-fixture';
import { indiaActors } from '../../helpers/india-macro';
import { retainPriceHistory } from '../../helpers/equity-price-history';
import { commodityInput } from '../../helpers/commodity-benchmarks';
import { retentionHeaders } from '../../helpers/retention';
test.use({ namedOperators: true, manualWorkers: true });
test('E2E-WEB-1830 keyboard price pagination moves focus to loaded results and failed range to recovery @UX-002G @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    await retainPriceHistory(request, reviewer);
    await page.route(/\/api\/v1\/equities(?:[/?]|$)/, (route) => {
      const url = new URL(route.request().url());
      return route.continue({
        url: feedbackSandbox.apiOrigin + url.pathname + url.search,
      });
    });
    await page.goto('/?equity=INE002A01018#equities');
    const region = page.getByRole('region', {
      name: 'Price history',
      exact: true,
    });
    await region.getByLabel('Price history from').fill('2025-01-01');
    await region.getByLabel('Price history through').fill('2025-01-19');
    await region
      .getByRole('button', { name: 'Load price history', exact: true })
      .press('Enter');
    await expect(
      region.getByRole('heading', {
        name: 'Retained price results',
        exact: true,
      }),
    ).toBeFocused();
    await region
      .getByRole('button', { name: 'More price dates', exact: true })
      .press('Enter');
    await expect(
      region.getByRole('heading', { name: '2025-01-01', exact: true }),
    ).toBeVisible();
    await expect(
      region.getByRole('heading', {
        name: 'Retained price results',
        exact: true,
      }),
    ).toBeFocused();
    await region
      .getByRole('button', { name: 'Previous price dates', exact: true })
      .press('Enter');
    await expect(
      region.getByRole('heading', { name: '2025-01-17', exact: true }),
    ).toBeVisible();
    await expect(
      region.getByRole('heading', {
        name: 'Retained price results',
        exact: true,
      }),
    ).toBeFocused();
    await region.getByLabel('Price history from').fill('2023-01-01');
    await region
      .getByRole('button', { name: 'Load price history', exact: true })
      .press('Enter');
    await expect(region.getByRole('alert')).toBeFocused();
    await expect(region.getByRole('alert')).toContainText('retry');
  } finally {
    await reviewer.dispose();
  }
});
test('E2E-WEB-1831 selected commodity edition retry and browser Back retain exact edition after simulated network failure @UX-002G @SRC-009 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    const ids: string[] = [];
    for (let i = 0; i < 2; i++) {
      const input = await commodityInput();
      expect(
        (
          await request.post('/api/v1/ops/commodity-benchmarks/capture', {
            headers: retentionHeaders,
            data: input,
          })
        ).status(),
      ).toBe(201);
      expect(
        (
          await reviewer.post('/api/v1/ops/commodity-benchmarks/review', {
            headers: retentionHeaders,
            data: {
              requestId: randomUUID(),
              id: input.requestId,
              decision: 'publish',
              reason:
                'Synthetic original monthly workbook independently reviewed for navigation acceptance.',
              rightsVerified: true,
            },
          })
        ).status(),
      ).toBe(201);
      ids.push(input.requestId);
    }
    let fault = true;
    const requested: string[] = [];
    await page.route('**/api/v1/commodity-benchmarks**', async (route) => {
      const url = new URL(route.request().url());
      requested.push(url.searchParams.get('edition') ?? 'current');
      if (url.searchParams.get('edition') === ids[0] && fault) {
        fault = false;
        await route.abort('failed');
        return;
      }
      await route.continue({
        url: feedbackSandbox.apiOrigin + url.pathname + url.search,
      });
    });
    await page.goto('/#commodities');
    const reader = page.getByRole('main', { name: 'Monthly commodities' });
    await reader
      .getByText('Source and retained edition evidence', { exact: true })
      .click();
    await reader
      .getByLabel('Retained reviewed edition', { exact: true })
      .selectOption(ids[0]!);
    await expect(reader.getByRole('alert')).toBeFocused();
    await expect(page).toHaveURL(new RegExp('edition=' + ids[0]));
    await reader
      .getByRole('button', {
        name: 'Retry selected commodity edition',
        exact: true,
      })
      .press('Enter');
    await expect(
      reader.getByRole('heading', {
        name: 'Monthly commodity context',
        exact: true,
      }),
    ).toBeFocused();
    await reader
      .getByText('Source and retained edition evidence', { exact: true })
      .click();
    await expect(
      reader.getByLabel('Retained reviewed edition', { exact: true }),
    ).toHaveValue(ids[0]!);
    expect(requested.filter((id) => id === ids[0])).toHaveLength(2);
    await reader
      .getByLabel('Retained reviewed edition', { exact: true })
      .selectOption(ids[1]!);
    await expect(
      reader.getByRole('heading', {
        name: 'Monthly commodity context',
        exact: true,
      }),
    ).toBeFocused();
    await page.goBack();
    await expect(page).toHaveURL(new RegExp('edition=' + ids[0]));
    await reader
      .getByText('Source and retained edition evidence', { exact: true })
      .click();
    await expect(
      reader.getByLabel('Retained reviewed edition', { exact: true }),
    ).toHaveValue(ids[0]!);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    await reviewer.dispose();
  }
});
