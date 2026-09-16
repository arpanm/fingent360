import { randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/app-fixture';
import {
  governanceFixture,
  releaseGovernanceFixture,
  governanceHeaders as headers,
} from '../../helpers/research-governance';
import { prepareConnectionAccount } from '../../helpers/research-connection-fixture';
import {
  ImpactTraceReceiptSchema,
  TRANSMISSION_CATALOG,
  transmissionFor,
  transmissionOutcome,
} from '../../../../packages/contracts/src/index';
test.use({ namedOperators: true, manualWorkers: true });
test('E2E-API-1700 reviewed exact transmission catalog persists into actual holding goal receipt and rejects withdrawn context @IMPACT-TRACE-001 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const fixture = await governanceFixture(
    request,
    playwright,
    feedbackSandbox,
    true,
    'earnings',
  );
  try {
    const id = randomUUID(),
      draft = {
        ...fixture.input,
        requestId: randomUUID(),
        content: {
          kind: 'causal-context',
          transmission: transmissionFor('earnings'),
          sector: 'Synthetic sector',
          isin: 'INE002A01018',
          direction: 'mixed',
          horizon: 'Within the reporting period',
          limitations:
            'Synthetic company evidence does not establish a calibrated effect.',
          quantifiedImpact: null,
        },
      };
    const incompatible = await request.put(
      '/api/v1/ops/research-governance/' + randomUUID(),
      {
        headers,
        data: {
          ...draft,
          requestId: randomUUID(),
          content: { ...draft.content, transmission: transmissionFor('flows') },
        },
      },
    );
    expect(incompatible.status()).toBe(400);
    expect(
      (
        await request.put('/api/v1/ops/research-governance/' + id, {
          headers,
          data: draft,
        })
      ).status(),
    ).toBe(200);
    await releaseGovernanceFixture(request, { ...fixture, id });
    const goal = await prepareConnectionAccount(request),
      input = {
        eventId: fixture.eventId,
        eventVersion: fixture.input.eventVersion,
        sector: 'Synthetic sector',
        isin: 'INE002A01018',
        holdingsVersion: 1,
        goalId: goal.id,
        goalVersion: goal.version,
        equityBindings: [],
        acknowledgedLimits: true,
        storageConsent: true,
        causalContext: { id, version: 1 },
      },
      traceId = randomUUID();
    const saved = await request.put(
      '/api/v1/account/impact-traces/' + traceId,
      { headers, data: input },
    );
    expect(saved.status()).toBe(200);
    const receipt = ImpactTraceReceiptSchema.parse(await saved.json());
    expect(receipt.transmission).toMatchObject({
      binding: { family: 'earnings', version: 'qualitative-transmission-v1' },
      holdingAction: 'unchanged',
      goalAction: 'unchanged',
      numericalImpact: null,
      outcome: 'review-before-interpretation',
    });
    expect(receipt.transmission?.reviewId).toBe(id);
    expect(() =>
      ImpactTraceReceiptSchema.parse({
        ...receipt,
        transmission: { ...receipt.transmission!, holdingAction: 'sell' },
      }),
    ).toThrow();
    expect(
      (
        await fixture.reviewer.post(
          `/api/v1/ops/research-governance/${id}/reviews`,
          {
            headers,
            data: {
              requestId: randomUUID(),
              expectedVersion: 1,
              decision: 'withdraw',
              simulationId: null,
              reason:
                'Synthetic withdrawal of original reviewed mechanism binding.',
            },
          },
        )
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
  } finally {
    await fixture.reviewer.dispose();
  }
});
test('E2E-API-1701 seven qualitative policy golden outcomes preserve no action and uncertainty without coefficients @IMPACT-TRACE-001 @TEST-SIMULATION', async () => {
  expect(TRANSMISSION_CATALOG.map((row) => row.family)).toEqual([
    'policy-rate',
    'inflation',
    'gdp',
    'earnings',
    'guidance',
    'regulatory',
    'flows',
  ]);
  for (const entry of TRANSMISSION_CATALOG) {
    const input = {
      reviewId: randomUUID(),
      reviewVersion: 1,
      eventId: randomUUID(),
      eventVersion: 1,
      sector: 'Synthetic sector',
      isin: 'INE002A01018',
      eventFamily: entry.family,
      direction: 'positive',
      stale: false,
      warnings: [] as string[],
    };
    expect(transmissionOutcome(entry, input)).toMatchObject({
      outcome: 'qualitative-context-only',
      holdingAction: 'unchanged',
      goalAction: 'unchanged',
      numericalImpact: null,
    });
    for (const change of [
      { stale: true },
      { direction: 'unknown' },
      { direction: 'mixed' },
      { warnings: ['Conflicting evidence remains unresolved.'] },
    ])
      expect(transmissionOutcome(entry, { ...input, ...change }).outcome).toBe(
        'review-before-interpretation',
      );
    expect(() =>
      transmissionOutcome(
        { ...entry, mechanism: 'Guaranteed stock appreciation.' },
        input,
      ),
    ).toThrow();
    expect(() =>
      transmissionOutcome(entry, { ...input, eventFamily: 'unsupported' }),
    ).toThrow();
  }
});
