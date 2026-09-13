import { randomUUID } from 'node:crypto';
import { test, expect, type Page } from '@playwright/test';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
const password = 'Synthetic-loading-race-2026';
const headers = { Origin: process.env.E2E_WEB_URL || 'http://localhost:5173' };

async function delayInitialRead(page: Page, endpoint: string) {
  let count = 0;
  let release!: () => void;
  let captured!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const fetched = new Promise<void>((resolve) => {
    captured = resolve;
  });
  let fallback: ReturnType<typeof setTimeout> | undefined;
  await page.route(`**${endpoint}`, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    count++;
    if (count !== 1) {
      // StrictMode's second read is allowed through; only its predecessor stays held.
      if (fallback) clearTimeout(fallback);
      await route.continue();
      return;
    }
    // Production has one effect, so release it rather than blocking initial loading.
    fallback = setTimeout(release, 700);
    try {
      const response = await route.fetch();
      captured();
      await held;
      await route.fulfill({ response });
    } catch (error) {
      captured();
      // StrictMode can abort the superseded browser request. Other errors fail the test.
      if (!/closed|cancel|abort/i.test(String(error))) throw error;
    }
  });
  return {
    fetched,
    release: () => {
      if (fallback) clearTimeout(fallback);
      release();
    },
    cleanup: async () => {
      if (fallback) clearTimeout(fallback);
      release();
      await page.unrouteAll({ behavior: 'wait' });
    },
  };
}
async function register(page: Page) {
  expect(
    (
      await page.request.post('/api/v1/account/register', {
        headers,
        data: {
          username: `race_${randomUUID().slice(0, 16)}`,
          password,
          consent: true,
        },
      })
    ).status(),
  ).toBe(201);
}

test('E2E-WEB-063 late initial goals read cannot overwrite a newly saved goal @UX-001', async ({
  page,
}) => {
  test.setTimeout(60000);
  await register(page);
  const delayed = await delayInitialRead(page, '/api/v1/account/goals');
  try {
    await page.goto('/#my-goals');
    await delayed.fetched;
    await page
      .getByRole('button', { name: 'Create a goal', exact: true })
      .click();
    await page
      .getByLabel('Goal name', { exact: true })
      .fill('Synthetic delayed-read goal');
    await page
      .getByRole('button', { name: 'Next: amounts', exact: true })
      .click();
    await page
      .getByLabel('Target amount (INR)', { exact: true })
      .fill('1000.01');
    await page
      .getByRole('button', { name: 'Next: contributions', exact: true })
      .click();
    await page
      .getByLabel('Monthly contribution (INR)', { exact: true })
      .fill('10.01');
    await page
      .getByRole('button', { name: 'Review goal', exact: true })
      .click();
    await page
      .getByRole('checkbox', { name: /I agree to store this goal/ })
      .check();
    await page
      .getByRole('button', { name: 'Add saved goal', exact: true })
      .click();
    const goal = page.getByRole('article', {
      name: 'Goal Synthetic delayed-read goal',
      exact: true,
    });
    await expect(goal).toContainText('₹1,000.01');
    delayed.release();
    await page.waitForLoadState('networkidle');
    await expect(goal).toContainText('₹1,000.01');
  } finally {
    await delayed.cleanup();
    await page.request.delete('/api/v1/account', {
      headers,
      data: { password },
    });
  }
});

test('E2E-WEB-093 late initial holdings read cannot overwrite an entered draft @UX-001', async ({
  page,
}) => {
  test.setTimeout(60000);
  await register(page);
  const delayed = await delayInitialRead(page, '/api/v1/account/holdings');
  try {
    await page.goto('/#holdings');
    await delayed.fetched;
    await page
      .getByLabel('Security ISIN', { exact: true })
      .fill('INE002A01018');
    await page
      .getByRole('button', { name: 'Next: holding amounts', exact: true })
      .click();
    await page.getByLabel('Quantity', { exact: true }).fill('1.000001');
    await page
      .getByLabel('Total purchase cost (INR)', { exact: true })
      .fill('500.01');
    await page
      .getByRole('button', { name: 'Review this holding', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Add to draft', exact: true })
      .click();
    const draft = page.getByRole('region', {
      name: 'Draft holdings',
      exact: true,
    });
    await expect(draft).toContainText('500.01');
    delayed.release();
    await page.waitForLoadState('networkidle');
    await expect(draft).toContainText('INE002A01018');
    await expect(draft).toContainText('500.01');
    await expect(
      page.getByRole('region', { name: 'Saved holdings', exact: true }),
    ).toContainText('No holdings saved.');
  } finally {
    await delayed.cleanup();
    await page.request.delete('/api/v1/account', {
      headers,
      data: { password },
    });
  }
});
