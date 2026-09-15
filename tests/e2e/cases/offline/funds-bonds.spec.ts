import { test, expect } from '@playwright/test';
import { FundsSnapshotSchema } from '../../../../packages/contracts/src/index';
import { fundFixture } from '../../helpers/funds-bonds';
test('E2E-OFFLINE-1080 packaged NAV uses dated bounded coverage without API network @FUNDS-BONDS-001', async ({
  page,
}) => {
  const calls: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/v1/'))
      calls.push(request.url());
  });
  await page.goto('/#funds-bonds');
  await expect(
    page.getByRole('region', { name: 'Funds and bonds' }),
  ).toBeVisible();
  const data = FundsSnapshotSchema.parse(
    await page.evaluate(
      async () => await (await fetch('/api/v1/funds/snapshot')).json(),
    ),
  );
  expect(data.funds.length).toBeLessThanOrEqual(5000);
  expect(calls).toEqual([]);
});
test('E2E-OFFLINE-1081 device comparison survives reload and deletion prevents replay @FUNDS-BONDS-001 @TEST-SIMULATION', async ({
  page,
}) => {
  const calls: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/v1/'))
      calls.push(request.url());
  });
  await page.goto('/#funds-bonds');
  const { comparison } = await fundFixture();
  const saved = await page.evaluate(async (input) => {
    const send = (path: string, body: unknown, method = 'POST') =>
      fetch('/api/v1' + path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    const registered = await send('/account/register', {
      username: 'offline_fund_' + crypto.randomUUID().slice(0, 8),
      password: 'Synthetic-offline-funds-2026',
      consent: true,
    });
    if (!registered.ok) throw Error('Local account registration failed.');
    const id = crypto.randomUUID(),
      response = await send('/account/bond-comparisons/' + id, input, 'PUT');
    return { id, status: response.status, value: await response.json() };
  }, comparison);
  expect(saved.status).toBe(200);
  expect(saved.value.result.totalOutlayPaise).toBe('105072');
  await page.reload();
  const outcome = await page.evaluate(
    async ({ id, input }) => {
      const before = await (
        await fetch('/api/v1/account/bond-comparisons')
      ).json();
      await fetch('/api/v1/account/bond-comparisons/' + id, {
        method: 'DELETE',
      });
      const replay = await fetch('/api/v1/account/bond-comparisons/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      return {
        ids: before.comparisons.map((r: { id: string }) => r.id),
        status: replay.status,
      };
    },
    { id: saved.id, input: comparison },
  );
  expect(outcome.ids).toContain(saved.id);
  expect(outcome.status).toBe(410);
  expect(calls).toEqual([]);
});
