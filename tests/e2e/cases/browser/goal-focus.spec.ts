import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { SavedGoalsSchema } from '../../../../packages/contracts/src/index';

test.use({ trace: 'off', video: 'off', screenshot: 'off' });

test('E2E-WEB-067 delayed frames cannot steal goal contribution input @GOALS-001 @simulated @UI-RACES-001', async ({
  page,
}) => {
  const password = 'Synthetic-goal-focus-2026';
  const headers = {
    Origin: process.env.E2E_WEB_URL || 'http://localhost:5173',
  };
  expect(
    (
      await page.request.post('/api/v1/account/register', {
        headers,
        data: {
          username: `focus_${randomUUID().slice(0, 16)}`,
          password,
          consent: true,
        },
      })
    ).status(),
  ).toBe(201);
  try {
    await page.goto('/#my-goals');
    await page
      .getByRole('button', { name: 'Create a goal', exact: true })
      .click();
    await page
      .getByLabel('Goal name', { exact: true })
      .fill('Synthetic delayed-frame goal');
    await page
      .getByRole('button', { name: 'Next: amounts', exact: true })
      .click();
    await page
      .getByLabel('Target amount (INR)', { exact: true })
      .fill('100000.01');
    // Hold the browser's next animation callbacks to model a busy frame. Inputs
    // remain real DOM controls and saving still uses the real owned API/database.
    await page.evaluate(() => {
      const original = window.requestAnimationFrame.bind(window);
      const pending: FrameRequestCallback[] = [];
      let id = 0;
      window.requestAnimationFrame = (callback) => {
        pending.push(callback);
        return ++id;
      };
      Object.assign(window, {
        releaseGoalFrames: () => {
          window.requestAnimationFrame = original;
          pending.splice(0).forEach((callback) => callback(performance.now()));
        },
      });
    });
    // Force skips Playwright's animation stability check while frames are held;
    // it does not skip the application event handlers or input validation.
    await page
      .getByRole('button', { name: 'Next: contributions', exact: true })
      .click({ force: true });
    const monthly = page.getByLabel('Monthly contribution (INR)', {
      exact: true,
    });
    const months = page.getByLabel('Months from this plan', { exact: true });
    await monthly.fill('1000.01');
    await months.fill('');
    await expect(months).toBeFocused();
    await page.evaluate(() =>
      (
        window as unknown as { releaseGoalFrames: () => void }
      ).releaseGoalFrames(),
    );
    await page.keyboard.insertText('12');
    await expect(months).toHaveValue('12');
    await expect(monthly).toHaveValue('1000.01');
    await page
      .getByRole('button', { name: 'Review goal', exact: true })
      .click();
    await page
      .getByRole('checkbox', { name: /I agree to store this goal/ })
      .check();
    await page
      .getByRole('button', { name: 'Add saved goal', exact: true })
      .click();
    await expect(
      page.getByRole('article', {
        name: 'Goal Synthetic delayed-frame goal',
        exact: true,
      }),
    ).toBeVisible();
    const goals = SavedGoalsSchema.parse(
      await (await page.request.get('/api/v1/account/goals')).json(),
    );
    expect(goals.goals).toHaveLength(1);
    expect(goals.goals[0]).toMatchObject({
      monthlyMinor: '100001',
      horizonMonths: 12,
      projectedMinor: '1200012',
    });
  } finally {
    await page
      .evaluate(() =>
        (
          window as unknown as { releaseGoalFrames?: () => void }
        ).releaseGoalFrames?.(),
      )
      .catch(() => {});
    await page.request.delete('/api/v1/account', {
      headers,
      data: { password },
    });
  }
});
