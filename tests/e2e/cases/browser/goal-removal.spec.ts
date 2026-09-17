import { test, expect } from '@playwright/test';
import {
  exerciseGoalRemoval,
  createRemovalGoals,
  accountCall,
  removalPassword,
} from '../../helpers/goal-removal';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });

test('E2E-WEB-068 deleting the edited goal closes its draft while cancellation and other-goal removal preserve it @GOALS-001', async ({
  page,
}) => {
  await page.goto('/#account');
  await exerciseGoalRemoval(page);
});

test('E2E-WEB-069 delayed original goal list cannot restore a removed goal @GOALS-001 @TEST-SIMULATION', async ({
  page,
}) => {
  await page.goto('/#account');
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let captured!: () => void;
  const capturedList = new Promise<void>((resolve) => {
    captured = resolve;
  });
  let first = true;
  await page.route('**/api/v1/account/goals', async (route) => {
    if (route.request().method() !== 'GET' || !first) return route.continue();
    first = false;
    const response = await route.fetch();
    captured();
    await held;
    await route.fulfill({
      response,
      headers: { ...response.headers(), 'x-goal-held': 'true' },
    });
  });
  try {
    await createRemovalGoals(page);
    await page.goto('/#my-goals');
    await capturedList;
    await page
      .getByRole('button', { name: 'Reload goals', exact: true })
      .click();
    const goal = page.getByRole('article', {
      name: 'Goal Synthetic draft goal',
      exact: true,
    });
    await expect(goal).toBeVisible();
    page.once('dialog', (dialog) => dialog.accept());
    await goal
      .getByRole('button', { name: 'Remove goal', exact: true })
      .click();
    await expect(goal).toHaveCount(0);
    const responseArrives = page.waitForResponse(
      (response) => response.headers()['x-goal-held'] === 'true',
    );
    release();
    await (await responseArrives).finished();
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await expect(goal).toHaveCount(0);
    await expect(
      page.getByRole('article', {
        name: 'Goal Synthetic second goal',
        exact: true,
      }),
    ).toBeVisible();
  } finally {
    release();
    await page.unrouteAll({ behavior: 'wait' });
    await accountCall(page, '', 'DELETE', { password: removalPassword });
  }
});
