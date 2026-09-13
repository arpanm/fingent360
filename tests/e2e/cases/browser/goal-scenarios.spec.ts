import { test, expect } from '../../helpers/app-fixture';
import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import {
  GoalComparisonSchema,
  GoalComparisonsSchema,
  SavedGoalSchema,
  type GoalComparison,
} from '../../../../packages/contracts/src/index';
test('E2E-WEB-280 compare review save reopen adopt and refresh failure preserves historical receipt @GOAL-SCENARIOS-001', async ({
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
        if (!r.ok) throw Error(`Fixture ${path}: ${r.status}`);
        return r.json();
      };
      await post('register', {
        username,
        password: 'Synthetic-scenario-2026',
        consent: true,
      });
      await post('goals', {
        name: 'Synthetic learning goal',
        type: 'education',
        targetMinor: '10000000',
        savedMinor: '10000',
        monthlyMinor: '10000',
        horizonMonths: 12,
        currency: 'INR',
        scale: 2,
        assumptions: 'no-growth-nominal-v1',
        storageConsent: true,
      });
    },
    `scenario_${randomUUID().slice(0, 10)}`,
  );
  await page.goto('/#my-goals');
  await page.getByRole('link', { name: 'Compare plans', exact: true }).click();
  await page
    .getByRole('button', { name: 'New comparison', exact: true })
    .click();
  await page
    .getByLabel('Saved goal', { exact: true })
    .selectOption({ label: 'Synthetic learning goal' });
  await page
    .getByLabel('Monthly contribution in rupees 1', { exact: true })
    .fill('2000.01');
  await page.getByLabel('Months 1', { exact: true }).fill('24');
  await page
    .getByRole('checkbox', { name: /I agree to store this comparison/ })
    .check();
  await page
    .getByRole('button', { name: 'Review comparison', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Comparison editor' }),
  ).toContainText('Unchanged plan');
  await page.screenshot({
    path: test.info().outputPath('goal-comparison-review.png'),
    fullPage: false,
  });
  await page
    .getByRole('button', { name: 'Save comparison', exact: true })
    .click();
  await expect(
    page
      .getByRole('region', { name: 'Goal comparisons', exact: true })
      .getByRole('status'),
  ).toContainText('Comparison saved.');
  await page.reload();
  await page
    .getByRole('region', { name: 'Saved comparisons' })
    .getByRole('button')
    .click();
  await expect(
    page.getByRole('region', { name: 'Saved comparison detail' }),
  ).toContainText('2,000.01');
  await page
    .getByRole('button', { name: 'Review adoption 1', exact: true })
    .click();
  await page
    .getByRole('checkbox', {
      name: 'I confirm this change to my saved goal.',
      exact: true,
    })
    .check();
  await page.route('**/api/v1/account/goal-comparisons', (route) =>
    route.request().method() === 'GET'
      ? route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Synthetic refresh outage' }),
        })
      : route.fallback(),
  );
  await page
    .getByRole('button', { name: 'Adopt alternative', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Adoption receipt' }),
  ).toContainText('Historical adoption receipt');
  await expect(page.getByRole('alert')).toContainText(
    'Synthetic refresh outage',
  );
  await expect(
    page.getByRole('button', { name: 'Review adoption 1', exact: true }),
  ).toBeDisabled();
  await page.unroute('**/api/v1/account/goal-comparisons');
  await page
    .getByRole('button', { name: 'Reload comparisons', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Adoption history' }),
  ).toContainText('goal edition 2');
  const goals = await page.evaluate(async () => {
    const r = await fetch('/api/v1/account/goals');
    return r.json();
  });
  expect(goals.goals[0].monthlyMinor).toBe('200001');
  expect(goals.goals[0].version).toBe(2);
});
test('E2E-WEB-281 signed-out return mobile keyboard review Back and draft cancellation @GOAL-SCENARIOS-001', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const username = `scenario_${randomUUID().slice(0, 10)}`;
  await page.evaluate(async (username) => {
    const call = async (path: string, body: unknown) => {
      const r = await fetch(`/api/v1/account/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw Error(`Fixture ${path}: ${r.status}`);
    };
    await call('register', {
      username,
      password: 'Synthetic-scenario-2026',
      consent: true,
    });
    await call('goals', {
      name: 'Synthetic keyboard goal',
      type: 'education',
      targetMinor: '10000000',
      savedMinor: '10000',
      monthlyMinor: '10000',
      horizonMonths: 12,
      currency: 'INR',
      scale: 2,
      assumptions: 'no-growth-nominal-v1',
      storageConsent: true,
    });
    await call('logout', {});
  }, username);
  await page.goto('/#comparisons');
  await page
    .getByRole('link', { name: 'Sign in or create an account', exact: true })
    .click();
  await expect(page).toHaveURL(/#account\?next=comparisons$/);
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page
    .getByLabel('Password', { exact: true })
    .fill('Synthetic-scenario-2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/#comparisons$/);
  await page
    .getByRole('button', { name: 'New comparison', exact: true })
    .click();
  await expect(
    page.getByRole('heading', {
      name: 'Choose your alternatives',
      exact: true,
    }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Saved goal', { exact: true })).toBeFocused();
  await page
    .getByLabel('Saved goal', { exact: true })
    .selectOption({ label: 'Synthetic keyboard goal' });
  await page.keyboard.press('Tab');
  await expect(
    page.getByLabel('Monthly contribution in rupees 1', { exact: true }),
  ).toBeFocused();
  await page.keyboard.type('1234.56');
  await page.keyboard.press('Tab');
  await page.keyboard.type('18');
  await page
    .getByRole('checkbox', { name: /I agree to store this comparison/ })
    .check();
  await page
    .getByRole('button', { name: 'Review comparison', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Back to alternatives', exact: true })
    .click();
  await expect(
    page.getByLabel('Monthly contribution in rupees 1', { exact: true }),
  ).toHaveValue('1234.56');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page
    .getByRole('link', { name: 'Back to saved goals', exact: true })
    .click();
  await expect(page.getByLabel('Months 1', { exact: true })).toHaveValue('18');
  page.once('dialog', (dialog) => dialog.accept());
  await page
    .getByRole('button', { name: 'Cancel comparison', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Comparison editor' }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

const retryGoal = {
  name: 'Synthetic comparison recovery goal',
  type: 'education',
  targetMinor: '10000000',
  savedMinor: '10000',
  monthlyMinor: '10000',
  horizonMonths: 12,
  currency: 'INR',
  scale: 2,
  assumptions: 'no-growth-nominal-v1',
  storageConsent: true,
};
async function prepareRetryGoal(page: Page) {
  await page.goto('/');
  const value = await page.evaluate(
    async ({ username, goal }) => {
      const post = async (path: string, body: unknown) => {
        const response = await fetch(`/api/v1/account/${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!response.ok)
          throw Error(
            `Owned comparison fixture failed at ${path}: ${response.status}`,
          );
        return response.json();
      };
      await post('register', {
        username,
        password: 'Synthetic-scenario-2026',
        consent: true,
      });
      return post('goals', goal);
    },
    { username: `scenario_${randomUUID().slice(0, 10)}`, goal: retryGoal },
  );
  return SavedGoalSchema.parse(value);
}

test('E2E-WEB-282 initial unavailable or unreadable comparisons recover with keyboard retry and real goals @GOAL-SCENARIOS-001 @TEST-SIMULATION', async ({
  page,
}) => {
  test.setTimeout(60000);
  await prepareRetryGoal(page);
  const endpoint = '**/api/v1/account/goal-comparisons';
  for (const fault of ['unavailable', 'unreadable'] as const) {
    await page.goto('/#today');
    let attempts = 0;
    let unavailable = true;
    await page.route(endpoint, async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      attempts++;
      if (!unavailable) return route.fallback();
      // Keep the outage until Retry, including development effect replays.
      await route.fulfill({
        status: fault === 'unavailable' ? 503 : 502,
        contentType: 'application/json',
        body:
          fault === 'unavailable'
            ? JSON.stringify({
                message: 'Synthetic first comparison load outage',
              })
            : '{unreadable response',
      });
    });
    try {
      await page.goto('/#comparisons');
      await expect(page.getByRole('alert')).toContainText(
        fault === 'unavailable'
          ? 'Synthetic first comparison load outage'
          : 'Comparison service returned an unreadable response',
      );
      await expect(
        page.getByRole('region', { name: 'Saved comparisons', exact: true }),
      ).toHaveCount(0);
      const retry = page.getByRole('button', {
        name: 'Retry comparisons',
        exact: true,
      });
      await expect(retry).toBeEnabled();
      const failedAttempts = attempts;
      unavailable = false;
      await retry.focus();
      await retry.press('Enter');
      await expect(
        page.getByText('Current goal editions loaded.', { exact: false }),
      ).toBeVisible();
      await expect(page.getByRole('alert')).toHaveCount(0);
      await expect(
        page.getByRole('button', { name: 'New comparison', exact: true }),
      ).toBeEnabled();
      await page
        .getByRole('button', { name: 'New comparison', exact: true })
        .click();
      await expect(
        page
          .getByLabel('Saved goal', { exact: true })
          .getByRole('option', { name: retryGoal.name, exact: true }),
      ).toHaveCount(1);
      expect(failedAttempts).toBeGreaterThan(0);
      expect(attempts).toBeGreaterThan(failedAttempts);
      await page
        .getByRole('button', { name: 'Cancel comparison', exact: true })
        .click();
    } finally {
      await page.unroute(endpoint);
    }
  }
});

test('E2E-WEB-283 committed comparison replay stays historical when the goal changes and current refresh fails @GOAL-SCENARIOS-001 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  test.setTimeout(60000);
  const goal = await prepareRetryGoal(page);
  await page.goto('/#comparisons');
  await page
    .getByRole('button', { name: 'New comparison', exact: true })
    .click();
  await page.getByLabel('Saved goal', { exact: true }).selectOption(goal.id);
  await page
    .getByLabel('Monthly contribution in rupees 1', { exact: true })
    .fill('2000.01');
  await page.getByLabel('Months 1', { exact: true }).fill('24');
  await page
    .getByRole('checkbox', { name: /I agree to store this comparison/ })
    .check();
  await page
    .getByRole('button', { name: 'Review comparison', exact: true })
    .click();
  const writes = '**/api/v1/account/goal-comparisons/*',
    reads = '**/api/v1/account/goal-comparisons';
  const observed: {
    saved: GoalComparison | null;
    bodies: (string | null)[];
    urls: string[];
  } = { saved: null, bodies: [], urls: [] };
  let failRefresh = false;
  await page.route(writes, async (route) => {
    if (route.request().method() !== 'PUT') return route.fallback();
    observed.bodies.push(route.request().postData());
    observed.urls.push(route.request().url());
    if (observed.bodies.length !== 1) return route.fallback();
    const url = new URL(route.request().url());
    // Commit the real owned API request, consume its actual receipt, then lose only
    // the browser response. The next PUT goes through normal isolated forwarding.
    const committed = await route.fetch({
      url: `${feedbackSandbox.apiOrigin}${url.pathname}${url.search}`,
      timeout: 15000,
    });
    if (committed.status() !== 200)
      throw Error(`Actual comparison commit failed: ${committed.status()}`);
    observed.saved = GoalComparisonSchema.parse(await committed.json());
    await route.abort('failed');
  });
  await page.route(reads, (route) =>
    failRefresh && route.request().method() === 'GET'
      ? route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'Synthetic current comparison refresh outage',
          }),
        })
      : route.fallback(),
  );
  try {
    await page
      .getByRole('button', { name: 'Save comparison', exact: true })
      .click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Comparison editor', exact: true }),
    ).toBeVisible();
    expect(observed.bodies).toHaveLength(1);
    const saved = GoalComparisonSchema.parse(observed.saved);
    expect(saved.baseline).toEqual(goal);
    const changed = SavedGoalSchema.parse(
      await page.evaluate(
        async ({ id, input }) => {
          const response = await fetch(`/api/v1/account/goals/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ expectedVersion: 1, goal: input }),
          });
          if (!response.ok)
            throw Error(`Actual goal change failed: ${response.status}`);
          return response.json();
        },
        { id: goal.id, input: { ...retryGoal, monthlyMinor: '33333' } },
      ),
    );
    expect(changed.version).toBe(2);
    failRefresh = true;
    await page
      .getByRole('button', { name: 'Save comparison', exact: true })
      .click();
    await expect(
      page.getByRole('region', { name: 'Comparison editor', exact: true }),
    ).toHaveCount(0);
    await expect(
      page
        .getByRole('region', { name: 'Goal comparisons', exact: true })
        .getByRole('status'),
    ).toContainText('Comparison saved.');
    await expect(page.getByRole('alert')).toContainText(
      'Synthetic current comparison refresh outage',
    );
    const detail = page.getByRole('region', {
      name: 'Saved comparison detail',
      exact: true,
    });
    await expect(detail).toContainText('baseline edition 1');
    await expect(detail).toContainText('2,000.01');
    await expect(
      page.getByText(
        'Current goal state is unavailable; reload before adopting.',
        { exact: false },
      ),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Review adoption 1', exact: true }),
    ).toBeDisabled();
    expect(observed.bodies).toHaveLength(2);
    expect(observed.bodies[1]).toBe(observed.bodies[0]);
    expect(observed.urls[1]).toBe(observed.urls[0]);
    failRefresh = false;
    const retry = page.getByRole('button', {
      name: 'Retry comparisons',
      exact: true,
    });
    await retry.focus();
    await retry.press('Enter');
    await expect(
      page.getByText('Current goal editions loaded.', { exact: false }),
    ).toBeVisible();
    await expect(detail.getByRole('alert')).toContainText(
      'This goal changed or was removed',
    );
    await expect(
      page.getByRole('button', { name: 'Review adoption 1', exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole('button', { name: 'New comparison', exact: true }),
    ).toBeEnabled();
    const persisted = GoalComparisonsSchema.parse(
      await page.evaluate(async () => {
        const response = await fetch('/api/v1/account/goal-comparisons');
        if (!response.ok)
          throw Error(`Actual comparison read failed: ${response.status}`);
        return response.json();
      }),
    );
    expect(persisted.comparisons).toEqual([saved]);
    expect(persisted.goals).toEqual([changed]);
    expect(persisted.adoptions).toEqual([]);
  } finally {
    await page.unroute(writes);
    await page.unroute(reads);
  }
});
