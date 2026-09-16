import { randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/app-fixture';
import {
  oilEducationFixture,
  oilEducationInput,
  headers,
} from '../../helpers/oil-education';
import { prepareConnectionAccount } from '../../helpers/research-connection-fixture';
import {
  ImpactTraceReceiptSchema,
  ImpactTraceListSchema,
  OIL_EDUCATION_ISIN,
} from '../../../../packages/contracts/src/index';
test.use({
  namedOperators: true,
  manualWorkers: true,
  trace: 'off',
  video: 'off',
  screenshot: 'off',
});
test('E2E-API-1470 historical issuer fuel evidence independently links six steps to owned goal and keeps no-action after withdrawal @DEV-010 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const fixture = await oilEducationFixture(
    request,
    playwright,
    feedbackSandbox,
  );
  try {
    const goal = await prepareConnectionAccount(request, OIL_EDUCATION_ISIN),
      input = {
        educationalPack: 'indigo-atf-context-2026-v1',
        eventId: fixture.event.id,
        eventVersion: fixture.event.event!.version,
        causalContext: {
          id: fixture.context.id,
          version: fixture.context.version,
        },
        sector: 'Airlines',
        isin: OIL_EDUCATION_ISIN,
        holdingsVersion: 1,
        goalId: goal.id,
        goalVersion: goal.version,
        equityBindings: [],
        acknowledgedLimits: true,
        storageConsent: true,
      },
      path = '/api/v1/account/impact-traces/' + randomUUID(),
      before = await (await request.get('/api/v1/account/holdings')).json();
    const response = await request.put(path, { headers, data: input });
    expect(response.status(), await response.text()).toBe(200);
    const receipt = ImpactTraceReceiptSchema.parse(await response.json());
    expect(receipt.chain.map((step) => step.kind)).toEqual([
      'evidence',
      'factor',
      'sector',
      'company',
      'holding',
      'goal',
    ]);
    expect(receipt.oilEducation).toMatchObject({
      companyIsin: OIL_EDUCATION_ISIN,
      sourceDate: '2026-04-01',
      assessment: 'qualitative-context-only',
    });
    expect(receipt.noAction).toMatchObject({
      holdingCostMinor: '10000',
      projectedMinor: '2200',
      gapMinor: '97800',
    });
    expect(receipt.quantifiedImpact).toBeNull();
    expect(receipt.warnings.join(' ')).toContain('Historical issuer report');
    expect(
      await (await request.put(path, { headers, data: input })).json(),
    ).toEqual(receipt);
    expect(
      await (await request.get('/api/v1/account/holdings')).json(),
    ).toEqual(before);
    expect(
      (await (await request.get('/api/v1/account/privacy/export')).json())
        .impactTraces.traces,
    ).toContainEqual(receipt);
    expect(
      (
        await request.put('/api/v1/account/impact-traces/' + randomUUID(), {
          headers,
          data: { ...input, causalContext: undefined },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await fixture.reviewer.post('/api/v1/ops/oil-education/review', {
          headers,
          data: {
            requestId: randomUUID(),
            id: fixture.input.requestId,
            decision: 'withdraw',
            reason:
              'Independent withdrawal of source permission in isolated test.',
            rightsVerified: false,
          },
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await request.put('/api/v1/account/impact-traces/' + randomUUID(), {
          headers,
          data: input,
        })
      ).status(),
    ).toBe(409);
    const retained = ImpactTraceListSchema.parse(
      await (await request.get('/api/v1/account/impact-traces')).json(),
    );
    expect(retained.traces[0]!.reviewReasons.join(' ')).toContain('withdrawn');
    expect(retained.traces[0]!.receipt).toEqual(receipt);
  } finally {
    await fixture.reviewer.dispose();
  }
});
test('E2E-API-1471 unsupported issuer original quarantines without public evidence @DEV-010 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const fixture = await oilEducationFixture(
    request,
    playwright,
    feedbackSandbox,
  );
  try {
    const input = oilEducationInput();
    input.body = input.body.replace('1 April 2026', '2 April 2026');
    const response = await request.post('/api/v1/ops/oil-education/capture', {
      headers,
      data: input,
    });
    expect(response.status()).toBe(201);
    expect((await response.json()).state).toBe('quarantined');
    expect(
      (
        await fixture.reviewer.post('/api/v1/ops/oil-education/review', {
          headers,
          data: {
            requestId: randomUUID(),
            id: input.requestId,
            decision: 'publish',
            reason: 'Unsupported source must not publish.',
            rightsVerified: true,
          },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await (
          await request.get(
            `/api/v1/ops/oil-education/${input.requestId}/evidence`,
          )
        ).json()
      ).body,
    ).toBe(input.body);
  } finally {
    await fixture.reviewer.dispose();
  }
});
