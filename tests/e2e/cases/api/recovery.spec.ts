import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { test, expect } from '../../helpers/app-fixture';
import {
  RecoveryCreatedSchema,
  RecoveryStatusSchema,
  CurrentAccountSchema,
} from '../../../../packages/contracts/src/index';
const password = 'Recovery-fixture-password-2026',
  nextPassword = 'Recovery-new-password-2026';
const headers = { Origin: process.env.E2E_WEB_URL || 'http://localhost:5173' };
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-API-210 recovery rotation single use preserves data and serializes old-password login @RECOVERY-001', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  test.setTimeout(60000);
  const username = `recover_${randomUUID().slice(0, 16)}`,
    other = await playwright.request.newContext({
      baseURL: feedbackSandbox.apiOrigin,
    });
  expect(
    (
      await request.post('/api/v1/account/register', {
        headers,
        data: { username, password, consent: true },
      })
    ).status(),
  ).toBe(201);
  try {
    expect(
      (
        await request.post('/api/v1/account/recovery/code', {
          data: { currentPassword: password, confirm: true },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await other.post('/api/v1/account/recovery/code', {
          headers,
          data: { currentPassword: password, confirm: true },
        })
      ).status(),
    ).toBe(401);
    expect(
      (
        await request.put('/api/v1/account/watchlist', {
          headers,
          data: { indicators: ['NY.GDP.MKTP.KD.ZG'] },
        })
      ).status(),
    ).toBe(200);
    const first = RecoveryCreatedSchema.parse(
      await (
        await request.post('/api/v1/account/recovery/code', {
          headers,
          data: { currentPassword: password, confirm: true },
        })
      ).json(),
    );
    const secondResponse = await request.post('/api/v1/account/recovery/code', {
      headers,
      data: { currentPassword: password, confirm: true },
    });
    expect(secondResponse.headers()['cache-control']).toBe('no-store');
    const second = RecoveryCreatedSchema.parse(await secondResponse.json());
    expect(
      second.code !== first.code,
      'Rotation must change the private code.',
    ).toBe(true);
    const bad = await other.post('/api/v1/account/recovery/reset', {
      headers,
      data: { username, code: first.code, newPassword: nextPassword },
    });
    expect(bad.status()).toBe(401);
    const unknown = await other.post('/api/v1/account/recovery/reset', {
      headers,
      data: {
        username: `missing_${randomUUID().slice(0, 12)}`,
        code: first.code,
        newPassword: nextPassword,
      },
    });
    expect(unknown.status()).toBe(401);
    expect(await unknown.json()).toEqual(await bad.json());
    const exported = JSON.stringify(
      await (await request.get('/api/v1/account/privacy/export')).json(),
    );
    expect(
      exported.includes(first.code),
      'Exports must exclude old recovery codes.',
    ).toBe(false);
    expect(
      exported.includes(second.code),
      'Exports must exclude current recovery codes.',
    ).toBe(false);
    expect(
      exported.includes('code_hash'),
      'Exports must exclude recovery hashes.',
    ).toBe(false);
    const [reset, login] = await Promise.all([
      other.post('/api/v1/account/recovery/reset', {
        headers,
        data: { username, code: second.code, newPassword: nextPassword },
      }),
      request.post('/api/v1/account/login', {
        headers,
        data: { username, password },
      }),
    ]);
    expect(reset.status()).toBe(200);
    expect([200, 401]).toContain(login.status());
    expect(
      CurrentAccountSchema.parse(
        await (await request.get('/api/v1/account')).json(),
      ).user,
    ).toBeNull();
    expect(
      (
        await other.post('/api/v1/account/recovery/reset', {
          headers,
          data: { username, code: second.code, newPassword: password },
        })
      ).status(),
    ).toBe(401);
    expect(
      (
        await request.post('/api/v1/account/login', {
          headers,
          data: { username, password: nextPassword },
        })
      ).status(),
    ).toBe(200);
    expect(
      await (await request.get('/api/v1/account/watchlist')).json(),
    ).toEqual({ indicators: ['NY.GDP.MKTP.KD.ZG'] });
    expect(
      RecoveryStatusSchema.parse(
        await (await request.get('/api/v1/account/recovery')).json(),
      ).configured,
    ).toBe(false);
  } finally {
    const removed = await request.delete('/api/v1/account', {
      headers,
      data: { password: nextPassword },
    });
    if (removed.status() !== 200)
      await request.delete('/api/v1/account', { headers, data: { password } });
    await other.dispose();
  }
});
test('E2E-API-211 recovery failures persist a bounded username budget across sessions @RECOVERY-001', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  test.setTimeout(60000);
  const username = `limit_${randomUUID().slice(0, 16)}`;
  await request.post('/api/v1/account/register', {
    headers,
    data: { username, password, consent: true },
  });
  const other = await playwright.request.newContext({
    baseURL: feedbackSandbox.apiOrigin,
  });
  try {
    const code = RecoveryCreatedSchema.parse(
      await (
        await request.post('/api/v1/account/recovery/code', {
          headers,
          data: { currentPassword: password, confirm: true },
        })
      ).json(),
    ).code;
    for (let i = 0; i < 5; i++)
      expect(
        (
          await other.post('/api/v1/account/recovery/reset', {
            headers,
            data: { username, code: '0'.repeat(64), newPassword: nextPassword },
          })
        ).status(),
      ).toBe(401);
    expect(
      (
        await request.post('/api/v1/account/recovery/reset', {
          headers,
          data: { username, code, newPassword: nextPassword },
        })
      ).status(),
    ).toBe(429);
    expect((await request.get('/api/v1/account/watchlist')).status()).toBe(200);
  } finally {
    await request.delete('/api/v1/account', { headers, data: { password } });
    await other.dispose();
  }
});

test('E2E-API-212 global recovery admission serializes and denied usernames cannot grow counters @RECOVERY-001', async ({
  request,
  feedbackSandbox,
}) => {
  test.setTimeout(120000);
  const prefix = `absent_${randomUUID().slice(0, 12)}`;
  const reset = (index: number) =>
    request.post('/api/v1/account/recovery/reset', {
      headers,
      data: {
        username: `${prefix}_${index}`,
        code: '0'.repeat(64),
        newPassword: 'Unused-recovery-password-2026',
      },
    });
  // These are deliberately unknown synthetic usernames. Real API requests,
  // password hashing and committed attempt budgets run; no success is mocked.
  for (let index = 0; index < 29; index++)
    expect((await reset(index)).status()).toBe(401);
  const boundary = await Promise.all([reset(29), reset(30)]);
  expect(boundary.map((response) => response.status()).sort()).toEqual([
    401, 429,
  ]);
  const pg = createRequire(
    new URL('../../../../apps/api/package.json', import.meta.url),
  )('pg') as {
    Pool: new (options: { connectionString: string; max: number }) => {
      query: (sql: string) => Promise<{ rows: Array<{ attempts: number }> }>;
      end: () => Promise<void>;
    };
  };
  const pool = new pg.Pool({
    connectionString: feedbackSandbox.databaseUrl,
    max: 1,
  });
  try {
    const counters = async () =>
      (
        await pool.query(
          'SELECT attempts FROM app_recovery_limits ORDER BY attempts',
        )
      ).rows;
    const before = await counters();
    expect(before).toEqual([
      ...Array.from({ length: 30 }, () => ({ attempts: 1 })),
      { attempts: 30 },
    ]);
    for (let index = 31; index < 56; index++)
      expect((await reset(index)).status()).toBe(429);
    expect(await counters()).toEqual(before);
  } finally {
    await pool.end();
  }
});
