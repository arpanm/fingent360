import { test, expect } from '../../helpers/app-fixture';
import { randomUUID } from 'node:crypto';
import { analyticalScenarioFixture } from '../../helpers/analytical-reader';
import {
  connectionDatabase,
  reviseConnectionSourceFixture,
} from '../../helpers/research-connection-fixture';
import { eventHeaders } from '../../helpers/event-fixture';
import { EvidenceExplanationSchema } from '../../../../packages/contracts/src/index';
const path = (id: string, version: number) =>
  `/api/v1/discovery/items/${id}/explanation?expectedVersion=${version}`;
test('E2E-API-1500 reviewed historical scenario projects only into its exact source edition with limits @DEV-016 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const fixture = await analyticalScenarioFixture(request, feedbackSandbox);
  const response = await request.get(
    path(fixture.source.id, fixture.source.version),
  );
  expect(response.status()).toBe(200);
  const value = EvidenceExplanationSchema.parse(await response.json());
  expect(value.analysis.scenarios).toBe('reviewed');
  expect(value.analysis.expectations).toBe('unavailable');
  expect(value.analysis.quantifiedPortfolioImpact).toBe('unavailable');
  expect(value.reviewedScenarios[0]?.receipt?.result.delta).toBe('-0.5');
  expect(value.reviewedScenarios[0]?.reviewReasons.join(' ')).toContain(
    'Historical',
  );
  expect(
    value.reviewedScenarios[0]?.receipt?.event.event?.sources,
  ).toContainEqual(fixture.source);
  expect(value.conflictAssessment).toBe('not-assessed');
  const forged = {
    ...value,
    edition: { ...value.edition, sourceHash: 'a'.repeat(64) },
  };
  expect(EvidenceExplanationSchema.safeParse(forged).success).toBe(false);
});
test('E2E-API-1501 source revision and scenario withdrawal remove dependent analysis without exposing old content @DEV-016 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const f = await analyticalScenarioFixture(request, feedbackSandbox);
  await request.post(`/api/v1/ops/event-scenarios/${f.scenario.id}/review`, {
    headers: eventHeaders,
    data: {
      requestId: randomUUID(),
      expectedVersion: 1,
      decision: 'withdraw',
      reason: 'Synthetic withdrawal of reader projection.',
    },
  });
  let value = EvidenceExplanationSchema.parse(
    await (await request.get(path(f.source.id, 1))).json(),
  );
  expect(value.reviewedScenarios).toEqual([]);
  const revised = await reviseConnectionSourceFixture(
    feedbackSandbox,
    f.source,
    'published',
  );
  expect((await request.get(path(f.source.id, 1))).status()).toBe(409);
  value = EvidenceExplanationSchema.parse(
    await (await request.get(path(revised.id, revised.version))).json(),
  );
  expect(value.reviewedScenarios).toEqual([]);
});
test('E2E-API-1502 withdrawal of another cited source removes analysis from the still-published source @DEV-016 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const f = await analyticalScenarioFixture(request, feedbackSandbox),
    other = f.event.event!.sources.find((s) => s.id !== f.source.id)!;
  await reviseConnectionSourceFixture(feedbackSandbox, other, 'withdrawn');
  const value = EvidenceExplanationSchema.parse(
    await (await request.get(path(f.source.id, 1))).json(),
  );
  expect(value.reviewedScenarios).toEqual([]);
  expect(value.analysis.scenarios).toBe('unavailable');
  const db = await connectionDatabase(feedbackSandbox);
  try {
    expect(
      (
        await db.query(
          'SELECT 1 FROM event_scenario_versions WHERE scenario_id=$1',
          [f.scenario.id],
        )
      ).rowCount,
    ).toBe(1);
  } finally {
    await db.end();
  }
});
