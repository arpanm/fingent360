import {
  test,
  expect,
  adjustmentActors,
  adjustmentInput,
  adjustmentReview,
  retentionHeaders,
} from '../../helpers/equity-adjustments';
import {
  AdjustmentPublicSchema,
  exactNseAdjustment,
  normalizeAdjustedClose,
} from '../../../../packages/contracts/src/index';
import { randomUUID } from 'node:crypto';
test.use({ namedOperators: true });
test('E2E-API-1340 reviewed complete action window binds actual retained closes and raw source, normalizes bonus and withdraws @EQUITY-COVERAGE-001 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const { reviewer } = await adjustmentActors(
    request,
    playwright,
    feedbackSandbox,
  );
  try {
    const input = adjustmentInput();
    const prepare = await request.post(
      '/api/v1/ops/equity-adjustments/prepare',
      { headers: retentionHeaders, data: input },
    );
    expect(prepare.status(), await prepare.text()).toBe(201);
    expect(
      AdjustmentPublicSchema.parse(
        await (
          await request.get(`/api/v1/equity-adjustments/${input.isin}`)
        ).json(),
      ).windows,
    ).toEqual([]);
    const review = adjustmentReview(input.requestId);
    expect(
      (
        await request.post('/api/v1/ops/equity-adjustments/review', {
          headers: retentionHeaders,
          data: review,
        })
      ).status(),
    ).toBe(403);
    for (let i = 0; i < 2; i++)
      expect(
        (
          await reviewer.post('/api/v1/ops/equity-adjustments/review', {
            headers: retentionHeaders,
            data: review,
          })
        ).status(),
      ).toBe(201);
    const published = AdjustmentPublicSchema.parse(
      await (
        await request.get(`/api/v1/equity-adjustments/${input.isin}`)
      ).json(),
    );
    expect(published.windows[0]?.factors[0]).toMatchObject({
      kind: 'bonus',
      numerator: '1',
      denominator: '2',
    });
    expect(
      published.windows[0]?.prices.map((row) => row.normalizedClose),
    ).toEqual(['100', '100', '100', '100']);
    expect(published.windows[0]?.prices[0]?.rawClose).toBe('200');
    expect(
      (
        await (
          await request.get(
            `/api/v1/ops/equity-adjustments/${input.requestId}/evidence`,
          )
        ).json()
      ).sourceCsv,
    ).toBe(input.sourceCsv);
    expect(
      (
        await reviewer.post('/api/v1/ops/equity-adjustments/review', {
          headers: retentionHeaders,
          data: adjustmentReview(input.requestId, 'withdraw'),
        })
      ).status(),
    ).toBe(201);
    expect(
      AdjustmentPublicSchema.parse(
        await (
          await request.get(`/api/v1/equity-adjustments/${input.isin}`)
        ).json(),
      ).windows,
    ).toEqual([]);
  } finally {
    await reviewer.dispose();
  }
});
test('E2E-API-1341 changed underlying source invalidates a published adjustment receipt @EQUITY-COVERAGE-001 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const { reviewer, equityId } = await adjustmentActors(
    request,
    playwright,
    feedbackSandbox,
  );
  try {
    const input = adjustmentInput();
    expect(
      (
        await request.post('/api/v1/ops/equity-adjustments/prepare', {
          headers: retentionHeaders,
          data: input,
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await reviewer.post('/api/v1/ops/equity-adjustments/review', {
          headers: retentionHeaders,
          data: adjustmentReview(input.requestId),
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await reviewer.post('/api/v1/ops/equities/review', {
          headers: retentionHeaders,
          data: {
            requestId: randomUUID(),
            editionId: equityId,
            decision: 'withdraw',
            reason: 'Synthetic source withdrawal.',
          },
        })
      ).status(),
    ).toBe(201);
    expect(
      (await request.get(`/api/v1/equity-adjustments/${input.isin}`)).status(),
    ).toBe(404);
  } finally {
    await reviewer.dispose();
  }
});
test('E2E-API-1342 exact split and cash dividend factors reject unknown mixed purposes and invalid reference @EQUITY-COVERAGE-001 @TEST-SIMULATION', async () => {
  const split = exactNseAdjustment(
    'Face Value Split (Sub-Division) - From Rs10/- Per Share To Re1/- Per Share'
      .replace('Rs10', 'Rs 10')
      .replace('Re1', 'Re 1'),
    '2025-01-06',
    null,
  );
  expect(split).toMatchObject({ numerator: '1', denominator: '10' });
  expect(normalizeAdjustedClose('200', '2025-01-03', [split])).toBe('20');
  const cash = exactNseAdjustment('Dividend - Rs 5 Per Share', '2025-01-06', {
    date: '2025-01-03',
    close: '200',
  });
  expect(cash).toMatchObject({ numerator: '39', denominator: '40' });
  expect(normalizeAdjustedClose('200', '2025-01-03', [cash])).toBe('195');
  for (const purpose of [
    'Bonus 1:1 / Dividend - Rs 5 Per Share',
    'Rights 1:2',
    'Dividend - Rs 200 Per Share',
  ])
    expect(() =>
      exactNseAdjustment(purpose, '2025-01-06', {
        date: '2025-01-03',
        close: '200',
      }),
    ).toThrow();
});
test('E2E-API-1343 actual private calibration retains admitted normalization and omits it after withdrawal @EQUITY-COVERAGE-001 @IMPACT-TRACE-001 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const { prepareConnectionAccount, connectionHeaders } =
    await import('../../helpers/research-connection-fixture');
  const { ImpactCalibrationReceiptSchema } =
    await import('../../../../packages/contracts/src/index');
  const { reviewer } = await adjustmentActors(
    request,
    playwright,
    feedbackSandbox,
  );
  try {
    const input = adjustmentInput();
    expect(
      (
        await request.post('/api/v1/ops/equity-adjustments/prepare', {
          headers: retentionHeaders,
          data: input,
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await reviewer.post('/api/v1/ops/equity-adjustments/review', {
          headers: retentionHeaders,
          data: adjustmentReview(input.requestId),
        })
      ).status(),
    ).toBe(201);
    await prepareConnectionAccount(request);
    const path = '/api/v1/account/impact-calibrations/' + randomUUID();
    const response = await request.put(path, {
      headers: connectionHeaders,
      data: { isin: input.isin, storageConsent: true },
    });
    expect(response.status(), await response.text()).toBe(200);
    const saved = ImpactCalibrationReceiptSchema.parse(await response.json());
    expect(saved.adjustmentCoverage?.id).toBe(input.requestId);
    expect(saved.result.model).toBe('daily-fx-company-adjusted-ols-v1');
    expect(saved.result.forecastEnabled).toBe(false);
    expect(saved.adjustmentCoverage?.prices[0]).toMatchObject({
      rawClose: '200',
      normalizedClose: '100',
    });
    expect(
      (await (await request.get('/api/v1/account/impact-calibrations')).json())
        .receipts,
    ).toContainEqual(saved);
    expect(
      (
        await reviewer.post('/api/v1/ops/equity-adjustments/review', {
          headers: retentionHeaders,
          data: adjustmentReview(input.requestId, 'withdraw'),
        })
      ).status(),
    ).toBe(201);
    const next = await request.put(
      '/api/v1/account/impact-calibrations/' + randomUUID(),
      {
        headers: connectionHeaders,
        data: { isin: input.isin, storageConsent: true },
      },
    );
    expect(next.status()).toBe(200);
    expect(
      ImpactCalibrationReceiptSchema.parse(await next.json())
        .adjustmentCoverage,
    ).toBeNull();
  } finally {
    await reviewer.dispose();
  }
});
