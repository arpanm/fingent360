import { test, expect, type Page } from '@playwright/test';
import { RecoveryCreatedSchema } from '../../../../packages/contracts/src/index';
import { expectRecoveryCaptureMask } from '../../helpers/recovery-capture';
async function local(page: Page, path: string, method = 'GET', body?: unknown) {
  return page.evaluate(
    async (args) => {
      const response = await fetch('/api/v1/account' + args.path, {
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
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-OFFLINE-250 recovery preserves local records revokes session and consumes the saved code @RECOVERY-001', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  const username = `localrecovery_${Date.now()}`,
    password = 'Local-recovery-password-2026',
    next = 'Local-updated-password-2026';
  expect(
    (
      await local(page, '/register', 'POST', {
        username,
        password,
        consent: true,
      })
    ).status,
  ).toBe(201);
  expect(
    (
      await local(page, '/watchlist', 'PUT', {
        indicators: ['NY.GDP.MKTP.KD.ZG'],
      })
    ).status,
  ).toBe(200);
  const old = RecoveryCreatedSchema.parse(
    (
      await local(page, '/recovery/code', 'POST', {
        currentPassword: password,
        confirm: true,
      })
    ).body,
  );
  const current = RecoveryCreatedSchema.parse(
    (
      await local(page, '/recovery/code', 'POST', {
        currentPassword: password,
        confirm: true,
      })
    ).body,
  );
  expect(
    (
      await local(page, '/recovery/reset', 'POST', {
        username,
        code: old.code,
        newPassword: next,
      })
    ).status,
  ).toBe(401);
  expect(
    JSON.stringify((await local(page, '/privacy/export')).body),
  ).not.toContain(current.code);
  await local(page, '/logout', 'POST');
  await page.goto('/#recovery');
  await page.getByLabel('Account username', { exact: true }).fill(username);
  await page
    .getByLabel('Saved recovery code', { exact: true })
    .fill(current.code);
  await page.getByLabel('New password', { exact: true }).fill(next);
  await page.getByLabel('Confirm new password', { exact: true }).fill(next);
  await page
    .getByRole('button', { name: 'Reset password', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Password reset', exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  expect((await local(page, '/watchlist')).status).toBe(401);
  expect(
    (
      await local(page, '/recovery/reset', 'POST', {
        username,
        code: current.code,
        newPassword: password,
      })
    ).status,
  ).toBe(401);
  expect(
    (await local(page, '/login', 'POST', { username, password: next })).status,
  ).toBe(200);
  expect((await local(page, '/watchlist')).body).toEqual({
    indicators: ['NY.GDP.MKTP.KD.ZG'],
  });
  await local(page, '', 'DELETE', { password: next });
});
test('E2E-OFFLINE-251 recovery attempt bounds survive reload without changing the existing password @RECOVERY-001', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  const username = `bounded_${Date.now()}`,
    password = 'Bounded-recovery-password-2026';
  await local(page, '/register', 'POST', { username, password, consent: true });
  const code = RecoveryCreatedSchema.parse(
    (
      await local(page, '/recovery/code', 'POST', {
        currentPassword: password,
        confirm: true,
      })
    ).body,
  ).code;
  for (let i = 0; i < 5; i++)
    expect(
      (
        await local(page, '/recovery/reset', 'POST', {
          username,
          code: '0'.repeat(64),
          newPassword: 'Ignored-new-password-2026',
        })
      ).status,
    ).toBe(401);
  await page.reload();
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  expect(
    (
      await local(page, '/recovery/reset', 'POST', {
        username,
        code,
        newPassword: 'Ignored-new-password-2026',
      })
    ).status,
  ).toBe(429);
  expect((await local(page, '/watchlist')).status).toBe(200);
  await local(page, '', 'DELETE', { password });
});

test('E2E-OFFLINE-252 exhausted device recovery budget cannot grow counters across usernames and reload @RECOVERY-001', async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto('/');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  const prefix = `absent_${Date.now()}`;
  const reset = (index: number) =>
    local(page, '/recovery/reset', 'POST', {
      username: `${prefix}_${index}`,
      code: '0'.repeat(64),
      newPassword: 'Unused-local-recovery-password-2026',
    });
  // Actual device handlers and PBKDF2 run against unknown synthetic usernames.
  for (let index = 0; index < 29; index++)
    expect((await reset(index)).status).toBe(401);
  const boundary = await Promise.all([reset(29), reset(30)]);
  expect(boundary.map((response) => response.status).sort()).toEqual([
    401, 429,
  ]);
  const counters = () =>
    page.evaluate(
      () =>
        new Promise<number[]>((resolve, reject) => {
          const open = indexedDB.open('fingent360-device', 1);
          open.onerror = () =>
            reject(
              new Error('Could not inspect owned device recovery counters.'),
            );
          open.onsuccess = () => {
            const db = open.result;
            const read = db
              .transaction('workspace', 'readonly')
              .objectStore('workspace')
              .get('current');
            read.onerror = () => {
              db.close();
              reject(
                new Error('Could not read owned device recovery counters.'),
              );
            };
            read.onsuccess = () => {
              const state = read.result as
                | {
                    data?: {
                      localRecoveryLimits?: Record<string, { count: number }>;
                    };
                  }
                | undefined;
              const counts = Object.values(
                state?.data?.localRecoveryLimits ?? {},
              )
                .map((entry) => entry.count)
                .sort((a, b) => a - b);
              db.close();
              resolve(counts);
            };
          };
        }),
    );
  const before = await counters();
  expect(before).toEqual([...Array<number>(30).fill(1), 30]);
  for (let index = 31; index < 56; index++)
    expect((await reset(index)).status).toBe(429);
  expect(await counters()).toEqual(before);
  await page.reload();
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  expect((await reset(56)).status).toBe(429);
  expect(await counters()).toEqual(before);
});

test('E2E-OFFLINE-253 generated recovery code is masked in actual feedback capture without delivery @RECOVERY-001', async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto('/');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  const username = `capture_${Date.now()}`;
  const password = 'Local-recovery-capture-password-2026';
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
    await page.goto('/#privacy');
    const settings = page.getByRole('region', { name: 'Recovery code' });
    await settings.getByText('Create a recovery code', { exact: true }).click();
    await settings
      .getByLabel('Current password for recovery', { exact: true })
      .fill(password);
    await settings
      .getByLabel(
        'I will save this code privately. Any earlier recovery code will stop working.',
        { exact: true },
      )
      .check();
    await settings
      .getByRole('button', { name: 'Generate recovery code', exact: true })
      .click();
    const output = settings.getByLabel('Your new recovery code', {
      exact: true,
    });
    await expect(output).toBeVisible();
    expect(
      await output.evaluate((element) =>
        /^[a-f0-9]{64}$/.test(element.textContent ?? ''),
      ),
      'The actual device-generated code must be displayed.',
    ).toBe(true);
    await expectRecoveryCaptureMask(page, output);
    expect(
      await output.evaluate((element) =>
        /^[a-f0-9]{64}$/.test(element.textContent ?? ''),
      ),
      'Capture must leave the original private code available to its owner.',
    ).toBe(true);
    await settings
      .getByRole('button', { name: 'I saved my recovery code', exact: true })
      .click();
    await page.reload();
    await expect(page.getByLabel('On-device mode')).toBeVisible();
    await expect(
      page.getByLabel('Your new recovery code', { exact: true }),
    ).toHaveCount(0);
  } finally {
    await local(page, '', 'DELETE', { password });
  }
});
