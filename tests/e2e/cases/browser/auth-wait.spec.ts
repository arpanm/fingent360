import { randomUUID } from 'node:crypto';
import type { APIResponse } from '@playwright/test';
import { test, expect } from '../../helpers/app-fixture';
import {
  authGoal,
  authImport,
  authPassword,
  openAuthDatabase,
  recoveredPassword,
  resetAheadOfOperation,
} from '../../helpers/auth-wait';

test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-WEB-300 a real revoked allocation save clears private state and recovers through keyboard sign-in @AUTH-WAIT-001', async ({
  page,
  request,
  feedbackSandbox,
}) => {
  test.setTimeout(90000);
  await page.goto('/');
  // Browser fetch retains this browser's cookie and follows the owned API route.
  // Only synthetic user-entered financial records are created by the fixture.
  const seeded = await page.evaluate(
    async ({ username, password, goal, imported }) => {
      const post = async (path: string, data: unknown, method = 'POST') => {
        const response = await fetch(`/api/v1/account${path}`, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!response.ok)
          throw Error(
            `Owned authorization fixture failed at ${path}: ${response.status}`,
          );
        return response.json();
      };
      const registration = await post('/register', {
        username,
        password,
        consent: true,
      });
      const recovery = await post('/recovery/code', {
        currentPassword: password,
        confirm: true,
      });
      const savedGoal = await post('/goals', goal);
      const preview = await post('/holdings/preview', imported);
      const holdings = await post('/holdings/confirm', {
        previewId: preview.previewId,
        expectedVersion: 0,
      });
      await post(
        '/allocations',
        {
          expectedVersion: 0,
          expectedHoldingsVersion: 1,
          storageConsent: true,
          rows: [
            {
              goalId: savedGoal.id,
              goalVersion: 1,
              isin: 'INE002A01018',
              quantity: '1.000001',
            },
          ],
        },
        'PUT',
      );
      return {
        owner: {
          id: registration.user.id as string,
          username,
          code: recovery.code as string,
        },
        goal: savedGoal,
        holdings,
      };
    },
    {
      username: `authweb_${randomUUID().slice(0, 12)}`,
      password: authPassword,
      goal: authGoal,
      imported: authImport,
    },
  );
  const db = await openAuthDatabase(feedbackSandbox);
  try {
    await page.goto('/#allocations');
    const plan = page.getByRole('region', {
      name: 'Saved allocation plan',
      exact: true,
    });
    await expect(plan).toContainText('1.000001');
    await page
      .getByRole('button', { name: 'Edit allocations', exact: true })
      .click();
    await expect(page.getByLabel('Goal', { exact: true })).toBeFocused();
    await page
      .getByRole('button', { name: 'Remove allocation 1', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Review allocations', exact: true })
      .click();
    await expect(
      page.getByRole('region', { name: 'Allocation review', exact: true }),
    ).toContainText('empty plan');
    await page
      .getByRole('checkbox', { name: /I agree to store this allocation/ })
      .check();
    const before = await db.privateDigest(seeded.owner.id);
    await resetAheadOfOperation({
      db,
      owner: seeded.owner,
      resetRequest: request,
      operation: async () => {
        // Keep the real upstream response: Chromium may discard the body of a
        // continued cross-origin401 before Network.getResponseBody can read it.
        let receive!: (response: APIResponse) => void;
        let reject!: (error: unknown) => void;
        const received = new Promise<APIResponse>((resolve, fail) => {
          receive = resolve;
          reject = fail;
        });
        void received.catch(() => {});
        let intercepted = false;
        await page.route('**/api/v1/account/allocations', async (route) => {
          if (route.request().method() !== 'PUT' || intercepted) {
            await route.fallback();
            return;
          }
          intercepted = true;
          try {
            const response = await route.fetch({
              url: `${feedbackSandbox.apiOrigin}/api/v1/account/allocations`,
              timeout: 10000,
            });
            await response.body();
            await route.fulfill({ response });
            receive(response);
          } catch (error) {
            reject(error);
            await route.abort().catch(() => {});
          }
        });
        await page
          .getByRole('button', { name: 'Save allocation plan', exact: true })
          .click();
        return received;
      },
    });
    await expect(
      page.getByRole('link', {
        name: 'Sign in or create an account',
        exact: true,
      }),
    ).toBeVisible();
    await expect(plan).toHaveCount(0);
    await expect(
      page.getByRole('region', { name: 'Allocation review', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText('Allocation plan saved.', { exact: true }),
    ).toHaveCount(0);
    expect(await db.privateDigest(seeded.owner.id)).toBe(before);

    const signIn = page.getByRole('link', {
      name: 'Sign in or create an account',
      exact: true,
    });
    await signIn.focus();
    await signIn.press('Enter');
    await expect(page).toHaveURL(/#account\?next=allocations$/);
    await page
      .getByLabel('Username', { exact: true })
      .fill(seeded.owner.username);
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Password', { exact: true })).toBeFocused();
    await page.getByLabel('Password', { exact: true }).fill(recoveredPassword);
    await page.getByLabel('Password', { exact: true }).press('Enter');
    await expect(page).toHaveURL(/#allocations$/);
    await expect(plan).toContainText('1.000001');
    expect(await db.privateDigest(seeded.owner.id)).toBe(before);
    await page
      .getByRole('button', { name: 'Edit allocations', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Remove allocation 1', exact: true })
      .click();
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
      page
        .getByRole('region', { name: 'Goal allocations', exact: true })
        .getByRole('status'),
    ).toHaveText('Allocation plan saved.');
    await page.reload();
    await expect(plan).toContainText('Revision 2');
    await expect(plan).not.toContainText('1.000001');
    await page
      .getByRole('button', { name: 'View allocation history', exact: true })
      .click();
    const history = page.getByRole('region', {
      name: 'Allocation history',
      exact: true,
    });
    await expect(history).toContainText('Allocation revision 2');
    await expect(history).toContainText('Allocation revision 1');
    const preserved = await page.evaluate(async () => {
      const holdings = await (await fetch('/api/v1/account/holdings')).json();
      const goals = await (await fetch('/api/v1/account/goals')).json();
      return { holdings, goals: goals.goals };
    });
    expect(preserved).toEqual({
      holdings: seeded.holdings,
      goals: [seeded.goal],
    });
  } finally {
    // Leave private polling/editor views before the owned API lifecycle ends.
    page.once('dialog', (dialog) => {
      void dialog.accept();
    });
    try {
      await page.goto('/#today');
    } finally {
      await db.close();
    }
  }
});
