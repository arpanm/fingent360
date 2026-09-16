import { randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/app-fixture';
import {
  prepareConnectionAccount,
  connectionHeaders as headers,
} from '../../helpers/research-connection-fixture';
import {
  ImpactCalibrationReceiptSchema,
  ImpactCalibrationListSchema,
} from '../../../../packages/contracts/src/index';
test.use({ manualWorkers: true });
test('E2E-API-1331 actual source availability persists encrypted unqualified calibration replay and deletion @IMPACT-TRACE-001 @TEST-SIMULATION', async ({
  request,
}) => {
  expect(
    (await request.get('/api/v1/account/impact-calibrations')).status(),
  ).toBe(401);
  await prepareConnectionAccount(request);
  const path = '/api/v1/account/impact-calibrations/' + randomUUID(),
    data = { isin: 'INE002A01018', storageConsent: true };
  const response = await request.put(path, { headers, data });
  expect(response.status()).toBe(200);
  const receipt = ImpactCalibrationReceiptSchema.parse(await response.json());
  expect(receipt.result.forecastEnabled).toBe(false);
  expect(receipt.result.quantifiedPortfolioImpact).toBeNull();
  expect(receipt.result.reasons.length).toBeGreaterThan(0);
  expect(await (await request.put(path, { headers, data })).json()).toEqual(
    receipt,
  );
  expect(
    ImpactCalibrationListSchema.parse(
      await (await request.get('/api/v1/account/impact-calibrations')).json(),
    ).receipts,
  ).toContainEqual(receipt);
  expect((await request.delete(path, { headers })).status()).toBe(200);
  expect((await request.put(path, { headers, data })).status()).toBe(410);
});
