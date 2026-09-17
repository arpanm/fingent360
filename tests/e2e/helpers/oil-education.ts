import { publishNamedEvent } from './publish-named-event';
import { randomUUID, createHash } from 'node:crypto';
import type { APIRequestContext, PlaywrightWorkerArgs } from '@playwright/test';
import { expect } from '@playwright/test';
import {
  EventPublicSchema,
  FeedItemSchema,
  ResearchGovernanceRevisionSchema,
  ResearchSimulationSchema,
  OIL_EDUCATION_ANCHOR,
  OIL_EDUCATION_ISIN,
} from '../../../packages/contracts/src/index';
import { indiaActors, retentionHeaders as headers } from './india-macro';
import { connectionDatabase } from './research-connection-fixture';
import type { FeedbackSandbox } from './feedback-fixture';
export { headers };
export function oilEducationInput() {
  return {
    requestId: randomUUID(),
    body:
      '<!-- TEST-SIMULATION reconstructed markup, actual minimal issuer excerpt; not original page bytes. --><p>National, 1 April 2026:</p><p>' +
      OIL_EDUCATION_ANCHOR +
      '</p>',
    rightsEvidence:
      'TEST-SIMULATION original excerpt and reconstructed markup; no live permission asserted.',
    rightsConfirmed: true,
  };
}
export async function oilEducationFixture(
  request: APIRequestContext,
  playwright: PlaywrightWorkerArgs['playwright'],
  sandbox: FeedbackSandbox,
) {
  const reviewer = await indiaActors(request, playwright, sandbox);
  try {
    const input = oilEducationInput();
    expect(
      (
        await request.post('/api/v1/ops/oil-education/capture', {
          headers,
          data: input,
        })
      ).status(),
    ).toBe(201);
    const review = {
      requestId: randomUUID(),
      id: input.requestId,
      decision: 'publish',
      reason: 'Independent source layout and permission simulation.',
      rightsVerified: true,
    };
    expect(
      (
        await request.post('/api/v1/ops/oil-education/review', {
          headers,
          data: review,
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await reviewer.post('/api/v1/ops/oil-education/review', {
          headers,
          data: review,
        })
      ).status(),
    ).toBe(201);
    const source = FeedItemSchema.parse(
        await (
          await request.get(
            '/api/v1/discovery/items/oil-education-' + input.requestId,
          )
        ).json(),
      ),
      at = new Date().toISOString();
    const identity = {
      isin: OIL_EDUCATION_ISIN,
      version: 1,
      resolution: 'matched',
      candidates: [
        {
          figi: 'BBG000000001',
          name: 'InterGlobe Aviation Limited — synthetic identity-provider admission',
          ticker: 'INDIGO',
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
        .update(
          'Synthetic provider admission; actual issuer ISIN and symbol verified in official NSE filing.',
        )
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
    const id = randomUUID(),
      editorial = {
        title: 'Historical IndiGo fuel-cost pass-through disclosure',
        family: 'Aviation fuel input-cost pressure',
        geography: ['India'],
        claimKind: 'fact',
        explanation:
          'The issuer reports incomplete pass-through of aviation fuel costs; this does not predict stock-price or goal effects.',
        announcedAt: null,
        effectiveAt: null,
        citations: [
          {
            sourceId: source.id,
            version: source.version,
            hash: source.sourceHash,
            field: 'body',
            quote: OIL_EDUCATION_ANCHOR,
          },
        ],
        links: [
          {
            kind: 'sector',
            label: 'Airlines',
            citation: 0,
            rationale:
              'The issuer airline reports fuel-related operating-cost pressure.',
          },
          {
            kind: 'instrument',
            isin: OIL_EDUCATION_ISIN,
            identityVersion: 1,
            citation: 0,
            rationale:
              'Actual issuer subject; identity-provider admission is simulated only for this isolated test.',
          },
        ],
      };
    expect(
      (
        await request.put('/api/v1/ops/events/' + id, {
          headers,
          data: {
            requestId: randomUUID(),
            expectedVersion: 0,
            revisionReason:
              'Historical issuer source with simulated identity-provider admission.',
            editorial,
          },
        })
      ).status(),
    ).toBe(200);
    await publishNamedEvent(
      request,
      reviewer,
      id,
      'Independent exact historical issuer subject and qualitative mechanism.',
    );
    const event = EventPublicSchema.parse(
        await (await request.get('/api/v1/events/' + id)).json(),
      ),
      contextId = randomUUID(),
      contextInput = {
        requestId: randomUUID(),
        expectedVersion: 0,
        eventId: id,
        eventVersion: event.event!.version,
        title: 'Issuer fuel-cost and partial fare offset context',
        reviewBy: new Date(Date.now() + 30 * 86400000)
          .toISOString()
          .slice(0, 10),
        rationale:
          'Actual issuer reports only partial pass-through. Direction depends on fuel, demand, competition and currency; no universal coefficient.',
        citations: [0],
        content: {
          kind: 'causal-context',
          sector: 'Airlines',
          isin: OIL_EDUCATION_ISIN,
          direction: 'mixed',
          horizon:
            'Historical issuer disclosure; current conditions require fresh evidence.',
          limitations:
            'No quantified share-price or goal impact. Fuel mix, FX and demand may change the sign or scale.',
          quantifiedImpact: null,
        },
      };
    const saved = await request.put(
      '/api/v1/ops/research-governance/' + contextId,
      { headers, data: contextInput },
    );
    expect(saved.status(), await saved.text()).toBe(200);
    const context = ResearchGovernanceRevisionSchema.parse(await saved.json()),
      simulation = ResearchSimulationSchema.parse(
        await (
          await request.post(
            `/api/v1/ops/research-governance/${contextId}/simulations`,
            {
              headers,
              data: {
                requestId: randomUUID(),
                expectedVersion: context.version,
              },
            },
          )
        ).json(),
      );
    expect(
      (
        await reviewer.post(
          `/api/v1/ops/research-governance/${contextId}/reviews`,
          {
            headers,
            data: {
              requestId: randomUUID(),
              expectedVersion: context.version,
              decision: 'release',
              simulationId: simulation.id,
              reason:
                'Independent source-bound qualitative mechanism; no forecast claim.',
            },
          },
        )
      ).status(),
    ).toBe(201);
    return { reviewer, input, event, context, source };
  } catch (cause) {
    await reviewer.dispose();
    throw cause;
  }
}
