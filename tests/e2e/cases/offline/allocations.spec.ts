import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
test('E2E-OFFLINE-240 offline choose review save and reload durable goal allocations @ALLOCATIONS-001', async ({
  page,
}) => {
  const username = `alloc_${randomUUID().slice(0, 12)}`;
  const networkApi: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/v1/'))
      networkApi.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await page.evaluate(async (username) => {
    const post = async (path: string, body: unknown) => {
      const r = await fetch(`/api/v1/account/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw Error(`Fixture ${path} failed ${r.status}`);
      return r.json();
    };
    await post('register', {
      username,
      password: 'Synthetic-allocation-2026',
      consent: true,
    });
    await post('goals', {
      name: 'Synthetic allocation goal',
      type: 'education',
      targetMinor: '100000',
      savedMinor: '0',
      monthlyMinor: '100',
      horizonMonths: 12,
      currency: 'INR',
      scale: 2,
      assumptions: 'no-growth-nominal-v1',
      storageConsent: true,
    });
    const p = await post('holdings/preview', {
      csv: 'isin,quantity,total_cost_paise\nINE002A01018,3,10000',
      expectedVersion: 0,
      storageConsent: true,
    });
    await post('holdings/confirm', {
      previewId: p.previewId,
      expectedVersion: 0,
    });
  }, username);
  await page.goto('/#allocations');
  await page
    .getByRole('button', { name: 'Edit allocations', exact: true })
    .click();
  await page
    .getByLabel('Goal', { exact: true })
    .selectOption({ label: 'Synthetic allocation goal' });
  await page
    .getByLabel('Holding', { exact: true })
    .selectOption('INE002A01018');
  await page
    .getByLabel('Quantity to allocate', { exact: true })
    .fill('1.000001');
  await page
    .getByRole('button', { name: 'Add allocation', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Review allocations', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Allocation review' }),
  ).toContainText('33.33');
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
  await expect(
    page.getByRole('region', { name: 'Saved allocation plan' }),
  ).toContainText('1.000001');
  await page
    .getByRole('button', { name: 'View allocation history', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Allocation history' }),
  ).toContainText('Allocation revision 1');
  const deletion = await page.evaluate(async () => {
    const call = async (path: string, method = 'GET', body?: unknown) => {
      const r = await fetch(`/api/v1/account${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: r.status, body: await r.json() };
    };
    const prior = await call('/privacy/export');
    const removed = await call('', 'DELETE', {
      password: 'Synthetic-allocation-2026',
    });
    const denied = await call('/allocations');
    return { prior, removed, denied };
  });
  expect(deletion.prior.status).toBe(200);
  expect(deletion.prior.body.allocations.revisions).toHaveLength(1);
  expect(deletion.removed.status).toBe(200);
  expect(deletion.denied.status).toBe(401);
  const fresh = await page.evaluate(async (username) => {
    const call = async (path: string, method = 'GET', body?: unknown) => {
      const r = await fetch(`/api/v1/account${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (!r.ok) throw Error(`Offline fixture ${path}: ${r.status}`);
      return r.json();
    };
    await call('/register', 'POST', {
      username,
      password: 'Synthetic-allocation-2026',
      consent: true,
    });
    const allocations = await call('/allocations');
    const exported = await call('/privacy/export');
    await call('', 'DELETE', { password: 'Synthetic-allocation-2026' });
    return { allocations, exported };
  }, username);
  expect(fresh.allocations.snapshot.rows).toEqual([]);
  expect(fresh.allocations.snapshot.version).toBe(0);
  expect(fresh.exported.allocations.revisions).toEqual([]);
  expect(networkApi).toEqual([]);
});
