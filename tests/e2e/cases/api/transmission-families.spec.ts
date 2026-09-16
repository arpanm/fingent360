import { randomUUID } from 'node:crypto';
import {
  test,
  expect,
  indiaActors,
  retentionHeaders as headers,
} from '../../helpers/india-macro';
import { connectionDatabase } from '../../helpers/research-connection-fixture';
import { transmissionFamilySource } from '../../helpers/transmission-family-sources';
import {
  TRANSMISSION_CATALOG,
  ResearchGovernanceSnapshotSchema,
} from '../../../../packages/contracts/src/index';
test.use({ namedOperators: true });
for (const [index, mechanism] of TRANSMISSION_CATALOG.entries())
  test(`E2E-API-${1860 + index} retained ${mechanism.family} source reaches independently reviewed exact mechanism binding @EVENT-SCENARIOS-001 @TEST-SIMULATION`, async ({
    request,
    playwright,
    feedbackSandbox,
  }) => {
    const reviewer = await indiaActors(request, playwright, feedbackSandbox);
    try {
      const source = await transmissionFamilySource(mechanism.family),
        db = await connectionDatabase(feedbackSandbox);
      try {
        await db.query('INSERT INTO discovery_items(id,version) VALUES($1,1)', [
          source.id,
        ]);
        await db.query(
          'INSERT INTO discovery_versions(item_id,version,data) VALUES($1,1,$2)',
          [source.id, source],
        );
      } finally {
        await db.end();
      }
      const eventId = randomUUID(),
        contextId = randomUUID();
      const editorial = {
        title: `Historical ${mechanism.family} primary evidence`,
        family: mechanism.family,
        geography: [
          ['gdp', 'inflation'].includes(mechanism.family)
            ? 'United States'
            : 'India',
        ],
        claimKind: 'inference',
        explanation:
          'Test-only educational context attached to researched facts. No company exposure, causal effect or trading outcome is inferred.',
        announcedAt: null,
        effectiveAt: null,
        citations: [
          {
            sourceId: source.id,
            version: 1,
            hash: source.sourceHash!,
            field: 'body',
            quote: source.body.slice(0, 800),
          },
        ],
        links: [
          {
            kind: 'sector',
            label: 'Unattributed educational context',
            citation: 0,
            rationale:
              'Synthetic review label only; no sector or company exposure is claimed.',
          },
        ],
      };
      expect(
        (
          await request.put('/api/v1/ops/events/' + eventId, {
            headers,
            data: {
              requestId: randomUUID(),
              expectedVersion: 0,
              revisionReason:
                'Source-family binding acceptance using researched anchors.',
              editorial,
            },
          })
        ).status(),
      ).toBe(200);
      expect(
        (
          await reviewer.post(`/api/v1/ops/events/${eventId}/review`, {
            headers,
            data: {
              requestId: randomUUID(),
              expectedVersion: 1,
              status: 'published',
              note: 'Separate named review; historical facts and synthetic context are distinct.',
            },
          })
        ).status(),
      ).toBe(201);
      const input = {
        requestId: randomUUID(),
        expectedVersion: 0,
        eventId,
        eventVersion: 1,
        title: 'Reviewed educational transmission context',
        reviewBy: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        rationale:
          'Real retained source binding with explicit uncertainty and no attributed company effect.',
        citations: [0],
        content: {
          kind: 'causal-context',
          transmission: mechanism,
          sector: 'Unattributed educational context',
          isin: null,
          direction: 'unknown',
          horizon: 'No calibrated causal horizon',
          limitations:
            'No quantitative causal effect, company exposure or investment action is established.',
          quantifiedImpact: null,
        },
      };
      expect(
        (
          await request.put('/api/v1/ops/research-governance/' + contextId, {
            headers,
            data: input,
          })
        ).status(),
      ).toBe(200);
      const simulated = await request.post(
        `/api/v1/ops/research-governance/${contextId}/simulations`,
        { headers, data: { requestId: randomUUID(), expectedVersion: 1 } },
      );
      expect(simulated.status()).toBe(201);
      const simulation = await simulated.json();
      expect(simulation.passed).toBe(true);
      expect(
        (
          await reviewer.post(
            `/api/v1/ops/research-governance/${contextId}/reviews`,
            {
              headers,
              data: {
                requestId: randomUUID(),
                expectedVersion: 1,
                decision: 'release',
                simulationId: simulation.id,
                reason:
                  'Independent review of precise source version and qualitative mechanism only.',
              },
            },
          )
        ).status(),
      ).toBe(201);
      const snapshot = ResearchGovernanceSnapshotSchema.parse(
        await (
          await request.get('/api/v1/research-governance/snapshot')
        ).json(),
      );
      const retained = snapshot.contexts.find((row) => row.id === contextId);
      expect(retained?.input.content).toMatchObject({
        transmission: mechanism,
        isin: null,
        quantifiedImpact: null,
      });
      expect(retained?.event.event?.sources).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: source.id,
            version: 1,
            sourceHash: source.sourceHash,
          }),
        ]),
      );
      expect(
        (
          await reviewer.post(
            `/api/v1/ops/research-governance/${contextId}/reviews`,
            {
              headers,
              data: {
                requestId: randomUUID(),
                expectedVersion: 1,
                decision: 'withdraw',
                simulationId: null,
                reason:
                  'Withdraw the exact reviewed family context in regression.',
              },
            },
          )
        ).status(),
      ).toBe(201);
      const withdrawn = ResearchGovernanceSnapshotSchema.parse(
        await (
          await request.get('/api/v1/research-governance/snapshot')
        ).json(),
      );
      expect(withdrawn.contexts.some((row) => row.id === contextId)).toBe(
        false,
      );
    } finally {
      await reviewer.dispose();
    }
  });
