import { randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/app-fixture';
import { BrokerCapabilitiesSchema } from '../../../../packages/contracts/src/broker-parsers';
const headers = { Origin: process.env.E2E_WEB_URL || 'http://localhost:5173' };

test('E2E-API-930 broker capability catalogue exposes five documented unsupported formats @BROKER-PARSERS-002', async ({
  request,
}) => {
  const response = await request.get(
    '/api/v1/account/holdings/broker-capabilities',
  );
  expect(response.status()).toBe(200);
  const catalogue = BrokerCapabilitiesSchema.parse(await response.json());
  expect(catalogue.brokers.map((b) => b.id)).toEqual([
    'zerodha',
    'groww',
    'upstox',
    'angel-one',
    'icici-direct',
  ]);
  for (const broker of catalogue.brokers)
    expect(broker.parserVersion).toBeNull();
});

test('E2E-API-931 invented broker format cannot create a holdings preview @BROKER-PARSERS-002', async ({
  request,
}) => {
  expect(
    (
      await request.post('/api/v1/account/register', {
        headers,
        data: {
          username: `broker_${randomUUID().slice(0, 12)}`,
          password: 'Synthetic-broker-2026',
          consent: true,
        },
      })
    ).status(),
  ).toBe(201);
  for (const broker of [
    'zerodha',
    'groww',
    'upstox',
    'angel-one',
    'icici-direct',
  ]) {
    const response = await request.post('/api/v1/account/holdings/preview', {
      headers,
      data: {
        format: `${broker}-v1`,
        csv: 'isin,quantity,total_cost_paise\nINE002A01018,1,10000',
        expectedVersion: 0,
        storageConsent: true,
      },
    });
    expect(response.status()).toBe(400);
  }
  const current = await request.get('/api/v1/account/holdings');
  expect((await current.json()).version).toBe(0);
  await request.delete('/api/v1/account', { headers });
});
