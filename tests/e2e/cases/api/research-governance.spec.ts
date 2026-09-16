import { randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/app-fixture';
import {
  governanceFixture,
  releaseGovernanceFixture,
  governanceHeaders as headers,
} from '../../helpers/research-governance';
import { prepareConnectionAccount } from '../../helpers/research-connection-fixture';
import { actionCentreInput } from '../../helpers/action-centre';
import {
  ResearchGovernanceSnapshotSchema,
  ResearchGovernanceHistorySchema,
  ActionCentreReceiptSchema,
  ActionCentreListSchema,
} from '../../../../packages/contracts/src/index';
test.use({ namedOperators: true, manualWorkers: true });
test('E2E-API-1290 named independent governance release simulation and actual ActionCentre policy binding @DEV-015 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  expect((await request.get('/api/v1/ops/research-governance')).status()).toBe(
    401,
  );
  const fixture = await governanceFixture(request, playwright, feedbackSandbox);
  try {
    const path = `/api/v1/ops/research-governance/${fixture.id}`;
    const review = {
      requestId: randomUUID(),
      expectedVersion: 1,
      decision: 'release',
      simulationId: null,
      reason: 'Synthetic independent review before simulation',
    };
    expect(
      (
        await fixture.reviewer.post(path + '/reviews', {
          headers,
          data: review,
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await request.post(path + '/reviews', { headers, data: review })
      ).status(),
    ).toBe(403);
    const { review: released } = await releaseGovernanceFixture(
      request,
      fixture,
    );
    expect(
      (
        await fixture.reviewer.post(path + '/reviews', {
          headers,
          data: released,
        })
      ).status(),
    ).toBe(201);
    expect(
      ResearchGovernanceSnapshotSchema.parse(
        await (
          await request.get('/api/v1/research-governance/snapshot')
        ).json(),
      ).policies.some((item) => item.id === fixture.id),
    ).toBe(true);
    const finance = await prepareConnectionAccount(request);
    const input = {
        ...actionCentreInput(finance.id),
        researchPolicy: { id: fixture.id, version: 1 },
      },
      id = randomUUID();
    const response = await request.put('/api/v1/account/action-centre/' + id, {
      headers,
      data: input,
    });
    expect(response.status()).toBe(200);
    const receipt = ActionCentreReceiptSchema.parse(await response.json());
    expect(receipt.researchPolicy?.id).toBe(fixture.id);
    expect(
      receipt.result.constraints.find((item) => item.id === 'turnover')?.status,
    ).toBe('breached');
    expect(
      (
        await fixture.reviewer.post(path + '/reviews', {
          headers,
          data: {
            requestId: randomUUID(),
            expectedVersion: 1,
            decision: 'withdraw',
            simulationId: null,
            reason: 'Synthetic withdrawal after review',
          },
        })
      ).status(),
    ).toBe(201);
    const retained = ActionCentreListSchema.parse(
      await (await request.get('/api/v1/account/action-centre')).json(),
    );
    expect(retained.assessments[0]?.reviewReasons.join(' ')).toContain(
      'withdrawn',
    );
    expect(
      (
        await request.put('/api/v1/account/action-centre/' + randomUUID(), {
          headers,
          data: input,
        })
      ).status(),
    ).toBe(409);
    const history = ResearchGovernanceHistorySchema.parse(
      await (await request.get(path + '/history')).json(),
    );
    expect(history.reviews.map((item) => item.decision)).toEqual([
      'withdraw',
      'release',
    ]);
  } finally {
    await fixture.reviewer.dispose();
  }
});
test('E2E-API-1291 causal draft requires actual reviewed sector and rejects fabricated mapping @DEV-015 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const fixture = await governanceFixture(request, playwright, feedbackSandbox);
  try {
    const input = {
      ...fixture.input,
      requestId: randomUUID(),
      content: {
        kind: 'causal-context',
        sector: 'Not in the reviewed event',
        isin: null,
        direction: 'unknown',
        horizon: 'Unspecified economic horizon',
        limitations:
          'Synthetic qualitative interpretation; no proven causal magnitude.',
        quantifiedImpact: null,
      },
    };
    expect(
      (
        await request.put('/api/v1/ops/research-governance/' + randomUUID(), {
          headers,
          data: input,
        })
      ).status(),
    ).toBe(400);
    const id = randomUUID();
    input.content.sector = 'Synthetic sector';
    input.requestId = randomUUID();
    expect(
      (
        await request.put('/api/v1/ops/research-governance/' + id, {
          headers,
          data: input,
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await request.post(
          `/api/v1/ops/research-governance/${id}/simulations`,
          { headers, data: { requestId: randomUUID(), expectedVersion: 1 } },
        )
      ).status(),
    ).toBe(201);
    expect(
      (
        await request.put('/api/v1/ops/research-governance/' + id, {
          headers,
          data: { ...input, requestId: randomUUID() },
        })
      ).status(),
    ).toBe(409);
  } finally {
    await fixture.reviewer.dispose();
  }
});
