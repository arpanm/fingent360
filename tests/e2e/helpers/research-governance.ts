import { randomUUID, createHash } from 'node:crypto';
import {
  expect,
  type APIRequestContext,
  type PlaywrightWorkerArgs,
} from '@playwright/test';
import {
  EventPublicSchema,
  ResearchGovernanceRevisionSchema,
  ResearchSimulationSchema,
} from '../../../packages/contracts/src/index';
import {
  connectionDatabase,
  seedConnectionSource,
  connectionHeaders as headers,
} from './research-connection-fixture';
import type { FeedbackSandbox } from './feedback-fixture';
export { headers as governanceHeaders };
export async function governanceFixture(
  request: APIRequestContext,
  playwright: PlaywrightWorkerArgs['playwright'],
  sandbox: FeedbackSandbox,
  includeCompany = false,
  eventFamily = 'Synthetic operations acceptance',
) {
  expect(sandbox.namedCredentials).toBeDefined();
  expect(
    (
      await request.post('/api/v1/ops/session', {
        headers,
        data: sandbox.namedCredentials,
      })
    ).status(),
  ).toBe(200);
  const username = 'reviewer_' + randomUUID().slice(0, 8),
    password = 'Synthetic-governance-reviewer-2026';
  expect(
    (
      await request.post('/api/v1/ops/operators', {
        headers,
        data: { username, password, role: 'publisher' },
      })
    ).status(),
  ).toBe(201);
  const reviewer = await playwright.request.newContext({
    baseURL: sandbox.apiOrigin,
  });
  try {
    expect(
      (
        await reviewer.post('/api/v1/ops/session', {
          headers,
          data: { username, password },
        })
      ).status(),
    ).toBe(200);
    const source = await seedConnectionSource(sandbox),
      eventId = randomUUID();
    if (includeCompany) {
      const at = new Date().toISOString(),
        identity = {
          isin: 'INE002A01018',
          version: 1,
          resolution: 'matched',
          candidates: [
            {
              figi: 'BBG000000001',
              name: 'Synthetic impact company',
              ticker: 'SYN',
              exchCode: 'IN',
              securityType: 'Common Stock',
              marketSector: 'Equity',
              compositeFIGI: null,
              shareClassFIGI: null,
            },
          ],
          retrievedAt: at,
          checkedAt: at,
          sourceHash: createHash('sha256')
            .update('Synthetic governance identity')
            .digest('hex'),
          source: 'OpenFIGI',
          sourceUrl: 'https://api.openfigi.com/v3/mapping',
          termsUrl: 'https://www.openfigi.com/docs/terms-of-service',
          mappingPolicy: 'india-common-stock-v1',
        };
      const db = await connectionDatabase(sandbox);
      try {
        await db.query(
          'INSERT INTO security_identities(isin,version,checked_at) VALUES($1,1,$2)',
          [identity.isin, at],
        );
        await db.query(
          'INSERT INTO security_identity_revisions(isin,version,fingerprint,payload) VALUES($1,1,$2,$3)',
          [identity.isin, identity.sourceHash, identity],
        );
      } finally {
        await db.end();
      }
    }
    const editorial = {
      title: 'Synthetic governance source-bound event',
      family: eventFamily,
      geography: ['India'],
      claimKind: 'inference',
      explanation:
        'Synthetic interpretation of real retained source, not economic causality.',
      announcedAt: null,
      effectiveAt: null,
      citations: [
        {
          sourceId: source.id,
          version: source.version,
          hash: source.sourceHash!,
          field: 'title',
          quote: source.title,
        },
      ],
      links: [
        ...(includeCompany
          ? [
              {
                kind: 'instrument',
                isin: 'INE002A01018',
                identityVersion: 1,
                citation: 0,
                rationale:
                  'Synthetic reviewed source-bound company association.',
              },
            ]
          : []),
        {
          kind: 'sector',
          label: 'Synthetic sector',
          citation: 0,
          rationale:
            'Synthetic qualitative mapping for isolated review acceptance.',
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
            revisionReason: 'Synthetic governance fixture',
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
            note: 'Separate named review of isolated synthetic interpretation.',
          },
        })
      ).status(),
    ).toBe(201);
    const admittedEvent = EventPublicSchema.parse(
      await (await request.get('/api/v1/events/' + eventId)).json(),
    );
    const id = randomUUID(),
      input = {
        requestId: randomUUID(),
        expectedVersion: 0,
        eventId,
        eventVersion: admittedEvent.event!.version,
        title: 'Synthetic conservative educational limits',
        reviewBy: new Date(Date.now() + 30 * 86400000)
          .toISOString()
          .slice(0, 10),
        rationale:
          'Synthetic editorial limits for invariant acceptance, not legal limits or investment advice.',
        citations: [0],
        content: {
          kind: 'educational-policy',
          rules: {
            maximumConcentrationBps: 5000,
            turnoverBudgetBps: 1000,
            minimumCooldownDays: 10,
            minimumDownsideStressBps: 2000,
          },
          adviceEnabled: false,
          tradeExecution: false,
        },
      };
    const response = await request.put(
      '/api/v1/ops/research-governance/' + id,
      { headers, data: input },
    );
    expect(response.status()).toBe(200);
    const revision = ResearchGovernanceRevisionSchema.parse(
      await response.json(),
    );
    return {
      id,
      input,
      eventId,
      revision,
      reviewer,
      credentials: { username, password },
    };
  } catch (error) {
    await reviewer.dispose();
    throw error;
  }
}
export async function releaseGovernanceFixture(
  request: APIRequestContext,
  fixture: Awaited<ReturnType<typeof governanceFixture>>,
) {
  const response = await request.post(
    `/api/v1/ops/research-governance/${fixture.id}/simulations`,
    { headers, data: { requestId: randomUUID(), expectedVersion: 1 } },
  );
  expect(response.status()).toBe(201);
  const simulation = ResearchSimulationSchema.parse(await response.json());
  const review = {
    requestId: randomUUID(),
    expectedVersion: 1,
    decision: 'release',
    simulationId: simulation.id,
    reason:
      'Independent named review of evidence and deterministic invariant simulation.',
  };
  expect(
    (
      await fixture.reviewer.post(
        `/api/v1/ops/research-governance/${fixture.id}/reviews`,
        { headers, data: review },
      )
    ).status(),
  ).toBe(201);
  return { simulation, review };
}
