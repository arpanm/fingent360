import { test, expect, type Page } from '@playwright/test';
import {
  SavedGoalSchema,
  SavedGoalsSchema,
  SavedGoalHistorySchema,
  HoldingsPreviewSchema,
  HoldingsSnapshotSchema,
  HoldingsHistorySchema,
  PrivacyExportSchema,
  CurrentAccountSchema,
  OverviewSchema,
} from '../../../../packages/contracts/src/index';
async function local(page: Page, path: string, method = 'GET', body?: unknown) {
  return page.evaluate(
    async (args) => {
      const response = await fetch(`/api/v1/account${args.path}`, {
        method: args.method,
        headers: { 'Content-Type': 'application/json' },
        ...(args.body === undefined ? {} : { body: JSON.stringify(args.body) }),
      });
      return {
        status: response.status,
        body: (await response.json()) as unknown,
      };
    },
    { path, method, body },
  );
}
const password = 'Offline-finance-fixture-2026';
const input = {
  name: 'Offline education',
  type: 'education',
  targetMinor: '9999999999999999',
  savedMinor: '12345',
  monthlyMinor: '78901',
  horizonMonths: 1200,
  currency: 'INR',
  scale: 2,
  assumptions: 'no-growth-nominal-v1',
  storageConsent: true,
};
test('E2E-OFFLINE-010 exact goals and confirmed holdings survive reload without a server @ANDROID-001', async ({
  page,
}) => {
  await page.goto('/');
  const username = `finance_${Date.now()}`;
  expect(
    (
      await local(page, '/register', 'POST', {
        username,
        password,
        consent: true,
      })
    ).status,
  ).toBe(201);
  try {
    expect(
      SavedGoalsSchema.parse((await local(page, '/goals')).body).goals,
    ).toHaveLength(0);
    expect(
      (await local(page, '/goals', 'POST', { ...input, storageConsent: false }))
        .status,
    ).toBe(400);
    const created = SavedGoalSchema.parse(
      (await local(page, '/goals', 'POST', input)).body,
    );
    expect(created.projectedMinor).toBe('94693545');
    const updated = SavedGoalSchema.parse(
      (
        await local(page, `/goals/${created.id}`, 'PUT', {
          expectedVersion: 1,
          goal: { ...input, name: 'Updated offline education' },
        })
      ).body,
    );
    expect(updated.version).toBe(2);
    expect(
      (
        await local(page, `/goals/${created.id}`, 'PUT', {
          expectedVersion: 1,
          goal: input,
        })
      ).status,
    ).toBe(409);
    expect(
      SavedGoalHistorySchema.parse(
        (await local(page, `/goals/${created.id}/history`)).body,
      ).revisions.map((v) => v.version),
    ).toEqual([2, 1]);
    const preview = HoldingsPreviewSchema.parse(
      (
        await local(page, '/holdings/preview', 'POST', {
          csv: 'isin,quantity,total_cost_paise\nINE009A01021,1.123456,9999999999999999',
          expectedVersion: 0,
          storageConsent: true,
        })
      ).body,
    );
    expect(
      HoldingsSnapshotSchema.parse((await local(page, '/holdings')).body)
        .version,
    ).toBe(0);
    const confirmation = { previewId: preview.previewId, expectedVersion: 0 };
    const saved = HoldingsSnapshotSchema.parse(
      (await local(page, '/holdings/confirm', 'POST', confirmation)).body,
    );
    expect(saved.totalCostMinor).toBe('9999999999999999');
    expect(
      HoldingsSnapshotSchema.parse(
        (await local(page, '/holdings/confirm', 'POST', confirmation)).body,
      ),
    ).toEqual(saved);
    expect(
      HoldingsHistorySchema.parse((await local(page, '/holdings/history')).body)
        .revisions,
    ).toHaveLength(1);
    await page.reload();
    expect(
      CurrentAccountSchema.parse((await local(page, '')).body).user?.username,
    ).toBe(username);
    const overview = OverviewSchema.parse(
      (await local(page, '/overview')).body,
    );
    expect(overview.goals[0]?.name).toBe('Updated offline education');
    expect(overview.holdings).toEqual(saved);
    const exported = PrivacyExportSchema.parse(
      (await local(page, '/privacy/export')).body,
    );
    expect(exported.goals.revisions).toHaveLength(2);
    expect(exported.holdings.revisions).toHaveLength(1);
    expect(JSON.stringify(exported)).not.toContain('passwordHash');
    expect(JSON.stringify(exported)).not.toContain(password);
    await local(page, '/logout', 'POST', {});
    expect((await local(page, '/goals')).status).toBe(401);
    expect(
      (
        await local(page, '/login', 'POST', {
          username,
          password: 'incorrect-password',
        })
      ).status,
    ).toBe(401);
    expect(
      (await local(page, '/login', 'POST', { username, password })).status,
    ).toBe(200);
    expect(
      SavedGoalsSchema.parse((await local(page, '/goals')).body).goals[0]?.id,
    ).toBe(created.id);
  } finally {
    await local(page, '/login', 'POST', { username, password });
    await local(page, '', 'DELETE', { password });
  }
});
test('E2E-OFFLINE-011 local ownership and deletion preserve the other account @ANDROID-001', async ({
  page,
}) => {
  await page.goto('/');
  const first = `owner_${Date.now()}`;
  const second = `other_${Date.now()}`;
  await local(page, '/register', 'POST', {
    username: first,
    password,
    consent: true,
  });
  const goal = SavedGoalSchema.parse(
    (await local(page, '/goals', 'POST', input)).body,
  );
  const preview = HoldingsPreviewSchema.parse(
    (
      await local(page, '/holdings/preview', 'POST', {
        csv: 'isin,quantity,total_cost_paise',
        expectedVersion: 0,
        storageConsent: true,
      })
    ).body,
  );
  await local(page, '/logout', 'POST', {});
  await local(page, '/register', 'POST', {
    username: second,
    password,
    consent: true,
  });
  expect(
    SavedGoalsSchema.parse((await local(page, '/goals')).body).goals,
  ).toHaveLength(0);
  expect((await local(page, `/goals/${goal.id}/history`)).status).toBe(404);
  expect(
    (
      await local(page, '/holdings/confirm', 'POST', {
        previewId: preview.previewId,
        expectedVersion: 0,
      })
    ).status,
  ).toBe(404);
  expect(
    (await local(page, '', 'DELETE', { password: 'incorrect-password' }))
      .status,
  ).toBe(401);
  expect((await local(page, '', 'DELETE', { password })).status).toBe(200);
  expect(
    (await local(page, '/login', 'POST', { username: second, password }))
      .status,
  ).toBe(401);
  expect(
    (await local(page, '/login', 'POST', { username: first, password })).status,
  ).toBe(200);
  expect(
    SavedGoalsSchema.parse((await local(page, '/goals')).body).goals[0]?.id,
  ).toBe(goal.id);
  await local(page, `/goals/${goal.id}`, 'DELETE', { expectedVersion: 1 });
  expect(
    PrivacyExportSchema.parse((await local(page, '/privacy/export')).body).goals
      .revisions[0]?.deletedAt,
  ).not.toBeNull();
  await local(page, '', 'DELETE', { password });
});
test('E2E-OFFLINE-012 expired sessions protect every private module and login throttles persist @ANDROID-001', async ({
  page,
}) => {
  await page.goto('/');
  const username = `expiry_${Date.now()}`;
  expect(
    (
      await local(page, '/register', 'POST', {
        username,
        password,
        consent: true,
      })
    ).status,
  ).toBe(201);
  await page.clock.setFixedTime(new Date(Date.now() + 8 * 86400000));
  expect(
    CurrentAccountSchema.parse((await local(page, '')).body).user,
  ).toBeNull();
  for (const path of [
    '/goals',
    '/holdings',
    '/overview',
    '/library',
    '/learning/state',
    '/privacy/export',
  ])
    expect((await local(page, path)).status).toBe(401);
  for (let attempt = 0; attempt < 5; attempt++)
    expect(
      (
        await local(page, '/login', 'POST', {
          username,
          password: 'incorrect-password',
        })
      ).status,
    ).toBe(401);
  await page.reload();
  expect(
    (await local(page, '/login', 'POST', { username, password })).status,
  ).toBe(429);
  await page.clock.setFixedTime(new Date(Date.now() + 9 * 86400000));
  expect(
    (await local(page, '/login', 'POST', { username, password })).status,
  ).toBe(200);
  expect((await local(page, '', 'DELETE', { password })).status).toBe(200);
});
