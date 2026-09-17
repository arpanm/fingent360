import { expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import {
  SavedGoalSchema,
  SavedGoalsSchema,
} from '../../../packages/contracts/src/index';

export async function accountCall(
  page: Page,
  path: string,
  method = 'GET',
  body?: unknown,
) {
  return page.evaluate(
    async ({ path, method, body }) => {
      const response = await fetch(`/api/v1/account${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return {
        status: response.status,
        body: (await response.json()) as unknown,
      };
    },
    { path, method, body },
  );
}
export const removalPassword = 'Synthetic-goal-removal-2026';
export async function createRemovalGoals(page: Page) {
  expect(
    (
      await accountCall(page, '/register', 'POST', {
        username: `remove_${randomUUID().slice(0, 12)}`,
        password: removalPassword,
        consent: true,
      })
    ).status,
  ).toBe(201);
  const goals = [];
  for (const name of ['Synthetic draft goal', 'Synthetic second goal']) {
    const response = await accountCall(page, '/goals', 'POST', {
      name,
      type: 'education',
      targetMinor: '10000001',
      savedMinor: '10000',
      monthlyMinor: '100001',
      horizonMonths: 120,
      currency: 'INR',
      scale: 2,
      assumptions: 'no-growth-nominal-v1',
      storageConsent: true,
    });
    expect(response.status).toBe(201);
    goals.push(SavedGoalSchema.parse(response.body));
  }
  return goals;
}
export async function exerciseGoalRemoval(page: Page) {
  try {
    await createRemovalGoals(page);
    await page.goto('/#my-goals');
    const first = page.getByRole('article', {
      name: 'Goal Synthetic draft goal',
      exact: true,
    });
    const second = page.getByRole('article', {
      name: 'Goal Synthetic second goal',
      exact: true,
    });
    await first.getByRole('button', { name: 'Edit goal', exact: true }).click();
    await page
      .getByLabel('Goal name', { exact: true })
      .fill('Unsaved private draft');
    page.once('dialog', (dialog) => dialog.dismiss());
    await first
      .getByRole('button', { name: 'Remove goal', exact: true })
      .click();
    await expect(page.getByLabel('Goal name', { exact: true })).toHaveValue(
      'Unsaved private draft',
    );
    await expect(first).toBeVisible();
    // Removing a different goal must not discard the goal being edited.
    page.once('dialog', (dialog) => dialog.accept());
    await second
      .getByRole('button', { name: 'Remove goal', exact: true })
      .click();
    await expect(second).toHaveCount(0);
    await expect(page.getByLabel('Goal name', { exact: true })).toHaveValue(
      'Unsaved private draft',
    );
    await page
      .getByRole('button', { name: 'Next: amounts', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Next: contributions', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Review goal', exact: true })
      .click();
    page.once('dialog', (dialog) => dialog.accept());
    await first
      .getByRole('button', { name: 'Remove goal', exact: true })
      .click();
    await expect(first).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Goal review' })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole('button', { name: 'Add saved goal', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Create a goal', exact: true }),
    ).toBeFocused();
    const stored = await accountCall(page, '/goals');
    expect(stored.status).toBe(200);
    expect(SavedGoalsSchema.parse(stored.body).goals).toEqual([]);
    // Removal also clears the draft navigation guard.
    let unexpectedDialog = false;
    page.on('dialog', async (dialog) => {
      unexpectedDialog = true;
      await dialog.dismiss();
    });
    await page.goto('/#today');
    expect(unexpectedDialog).toBe(false);
    await page.goto('/#my-goals');
    await expect(
      page.getByRole('button', { name: 'Add your first goal', exact: true }),
    ).toBeVisible();
  } finally {
    await accountCall(page, '', 'DELETE', { password: removalPassword });
  }
}
