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
  ImpactTraceListSchema,
} from '../../../../packages/contracts/src/index';
test.use({ namedOperators: true, manualWorkers: true });
test('E2E-API-1330 released actual causal mapping binds holding goal and withdrawal preserves historical trace @IMPACT-TRACE-001 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const fixture = await governanceFixture(
    request,
    playwright,
    feedbackSandbox,
    true,
  );
  try {
    const id = randomUUID(),
      draft = {
        ...fixture.input,
        requestId: randomUUID(),
        content: {
          kind: 'causal-context',
          sector: 'Synthetic sector',
          isin: 'INE002A01018',
          direction: 'mixed',
          horizon: 'Over the next year',
          limitations:
            'Synthetic interpretation; no calibrated numerical sensitivity.',
          quantifiedImpact: null,
        },
      };
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
        eventVersion: 1,
        sector: 'Synthetic sector',
        isin: 'INE002A01018',
        holdingsVersion: 1,
        goalId: goal.id,
        goalVersion: goal.version,
        equityBindings: [],
        acknowledgedLimits: true,
        storageConsent: true,
        causalContext: { id, version: 1 },
      };
    const saved = await request.put(
      '/api/v1/account/impact-traces/' + randomUUID(),
      { headers, data: input },
    );
    expect(saved.status()).toBe(200);
    const receipt = ImpactTraceReceiptSchema.parse(await saved.json());
    expect(receipt.causalContext?.id).toBe(id);
    expect(receipt.chain[2]?.explanation).toContain('mixed');
    expect(receipt.quantifiedImpact).toBeNull();
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
              reason: 'Synthetic withdrawal of causal interpretation.',
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
    const list = ImpactTraceListSchema.parse(
      await (await request.get('/api/v1/account/impact-traces')).json(),
    );
    expect(list.traces[0]?.reviewReasons.join(' ')).toContain('withdrawn');
    expect(list.traces[0]?.receipt).toEqual(receipt);
  } finally {
    await fixture.reviewer.dispose();
  }
});
