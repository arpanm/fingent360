import { test, expect } from '../../helpers/app-fixture';
import { randomUUID } from 'node:crypto';
import { connectionDatabase } from '../../helpers/research-connection-fixture';
import {
  governanceFixture,
  releaseGovernanceFixture,
  governanceHeaders,
} from '../../helpers/research-governance';
import {
  EvidenceExplanationSchema,
  ResearchGovernanceRevisionSchema,
} from '../../../../packages/contracts/src/index';
test.use({ namedOperators: true });
test('E2E-API-1503 released qualitative contexts retain opposing directions and withdraw without numeric impact @DEV-016 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const fixture = await governanceFixture(request, playwright, feedbackSandbox);
  try {
    const source = fixture.revision.event.event!.sources[0]!,
      path = `/api/v1/discovery/items/${source.id}/explanation?expectedVersion=${source.version}`,
      ids = [];
    for (const direction of ['positive', 'negative']) {
      const id = randomUUID(),
        input = {
          ...fixture.input,
          requestId: randomUUID(),
          title: 'Synthetic ' + direction + ' qualitative interpretation',
          content: {
            kind: 'causal-context',
            sector: 'Synthetic sector',
            isin: null,
            direction,
            horizon: 'Same synthetic horizon',
            limitations:
              'Synthetic qualitative interpretation only; no causal magnitude or portfolio outcome is established.',
            quantifiedImpact: null,
          },
        };
      const response = await request.put(
        '/api/v1/ops/research-governance/' + id,
        { headers: governanceHeaders, data: input },
      );
      expect(response.status()).toBe(200);
      const revision = ResearchGovernanceRevisionSchema.parse(
        await response.json(),
      );
      await releaseGovernanceFixture(request, { ...fixture, id, revision });
      ids.push(id);
    }
    let value = EvidenceExplanationSchema.parse(
      await (await request.get(path)).json(),
    );
    expect(value.reviewedContexts).toHaveLength(2);
    expect(value.analysis.causalInference).toBe('reviewed-qualitative');
    expect(value.conflictAssessment).toBe('opposing-reviewed-directions');
    expect(value.analysis.quantifiedPortfolioImpact).toBe('unavailable');
    for (const id of ids) {
      expect(
        (
          await fixture.reviewer.post(
            `/api/v1/ops/research-governance/${id}/reviews`,
            {
              headers: governanceHeaders,
              data: {
                requestId: randomUUID(),
                expectedVersion: 1,
                decision: 'withdraw',
                simulationId: null,
                reason:
                  'Withdraw synthetic interpretation through the actual reviewed workflow.',
              },
            },
          )
        ).status(),
      ).toBe(201);
    }
    value = EvidenceExplanationSchema.parse(
      await (await request.get(path)).json(),
    );
    expect(value.reviewedContexts).toEqual([]);
    expect(value.analysis.causalInference).toBe('unavailable');
    expect(value.conflictAssessment).toBe('not-assessed');
  } finally {
    await fixture.reviewer.dispose();
  }
});

test('E2E-API-1504 unrelated released contexts cannot crowd an exact source out of analytical reading @DEV-016 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const fixture = await governanceFixture(request, playwright, feedbackSandbox);
  try {
    const id = 'ffffffff-ffff-4fff-bfff-fffffffffff0';
    const response = await request.put(
      '/api/v1/ops/research-governance/' + id,
      {
        headers: governanceHeaders,
        data: {
          ...fixture.input,
          requestId: randomUUID(),
          content: {
            kind: 'causal-context',
            sector: 'Synthetic sector',
            isin: null,
            direction: 'positive',
            horizon: 'Synthetic horizon',
            limitations:
              'Synthetic qualitative context; no numerical causal effect established.',
            quantifiedImpact: null,
          },
        },
      },
    );
    expect(response.status()).toBe(200);
    const revision = ResearchGovernanceRevisionSchema.parse(
      await response.json(),
    );
    await releaseGovernanceFixture(request, { ...fixture, id, revision });
    const db = await connectionDatabase(feedbackSandbox);
    try {
      // Deliberately isolated database fault fixture: 100 unrelated heads sort first.
      // They are never represented as actual reviewed research or provider evidence.
      for (let index = 0; index < 100; index++) {
        const unrelated = `00000000-0000-4000-8000-${index.toString().padStart(12, '0')}`;
        const payload = structuredClone(revision);
        payload.event.event!.sources = [];
        await db.query(
          "INSERT INTO research_governance_heads(id,head_version,published_version,state) VALUES($1,1,1,'released')",
          [unrelated],
        );
        await db.query(
          'INSERT INTO research_governance_versions(id,version,request_id,fingerprint,actor_hash,payload) VALUES($1,1,$2,$3,$4,$5::jsonb)',
          [
            unrelated,
            randomUUID(),
            'synthetic-crowding-fixture',
            'synthetic-fixture',
            JSON.stringify(payload),
          ],
        );
      }
    } finally {
      await db.end();
    }
    const source = revision.event.event!.sources[0]!;
    const result = await request.get(
      `/api/v1/discovery/items/${source.id}/explanation?expectedVersion=${source.version}`,
    );
    expect(result.status()).toBe(200);
    const value = EvidenceExplanationSchema.parse(await result.json());
    expect(value.reviewedContexts).toHaveLength(1);
    expect(value.analysis.causalInference).toBe('reviewed-qualitative');
  } finally {
    await fixture.reviewer.dispose();
  }
});
