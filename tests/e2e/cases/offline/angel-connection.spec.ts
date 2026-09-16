import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
test('E2E-OFFLINE-1490 broker authorization is unavailable on device without issuing provider requests @DEV-028', async ({
  page,
}) => {
  const providerRequests: string[] = [];
  page.on('request', (r) => {
    if (
      new URL(r.url()).hostname === 'apiconnect.angelone.in' ||
      new URL(r.url()).hostname === 'smartapi.angelone.in'
    )
      providerRequests.push(r.url());
  });
  await page.goto('/');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  const username = 'angel_' + randomUUID().slice(0, 12);
  const registered = await page.evaluate(
    async (name) =>
      (
        await fetch('/api/v1/account/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: name,
            password: 'Synthetic-offline-angel-password',
            consent: true,
          }),
        })
      ).status,
    username,
  );
  expect(registered).toBe(201);
  await page.goto('/#holdings');
  const connection = page.getByRole('region', { name: 'Connect Angel One' });
  await expect(connection).toContainText(
    'Broker authorization needs connected mode',
  );
  expect(
    await page.evaluate(async () => {
      const response = await fetch(
        '/api/v1/account/broker-connections/angel/start',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ consent: true }),
        },
      );
      return response.status;
    }),
  ).toBe(503);
  expect(providerRequests).toEqual([]);
});
