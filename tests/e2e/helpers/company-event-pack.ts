import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';
import { expect } from '@playwright/test';
import { sourceHash } from '../../../apps/api/src/discovery-provider';
import { parseHistoricalFiu } from '../../../apps/api/src/fiu-history-provider';
import {
  INFOSYS_FY25_SOURCE,
  INFOSYS_ISIN,
  FIU_PIB_SOURCE,
  SecurityIdentitySchema,
  FeedItemSchema,
  EventPublicSchema,
} from '../../../packages/contracts/src/index';
import { connectionDatabase } from './research-connection-fixture';
import { operatorKey } from './operator';
import { eventHeaders } from './event-fixture';
import type { FeedbackSandbox } from './feedback-fixture';
export async function companyPackSources() {
  const pack = JSON.parse(
    await readFile(
      new URL(
        '../../../packages/contracts/test/fixtures/infosys-fy25-event-pack.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as { revenueQuote: string; guidanceQuote: string; rights: string };
  const at = new Date().toISOString();
  const source = FeedItemSchema.parse({
    id: 'infosys-historical-test-' + randomUUID(),
    version: 1,
    kind: 'news',
    title: 'Historical Infosys reported revenue and guidance',
    summary: pack.revenueQuote,
    body: pack.revenueQuote + '\n' + pack.guidanceQuote,
    topics: ['Earnings'],
    publishedAt: at,
    effectiveLabel:
      '2025-04-17 original release date; precise publication time unavailable; synthetic test admission timestamp',
    source: {
      name: 'Infosys Limited',
      url: INFOSYS_FY25_SOURCE,
      retrievedAt: at,
      rights: pack.rights,
    },
    sourceHash: sourceHash(
      INFOSYS_FY25_SOURCE,
      pack.revenueQuote + '\n' + pack.guidanceQuote,
    ),
    importance: 1,
    relatedIds: [],
    status: 'published',
    reviewedAt: at,
    correctionNote: null,
  });
  const identity = SecurityIdentitySchema.parse({
    isin: INFOSYS_ISIN,
    version: 1,
    resolution: 'matched',
    candidates: [
      {
        figi: 'BBG000000001',
        name: 'Infosys — TEST-SIMULATION identity admission',
        ticker: 'INFY',
        exchCode: 'IN',
        securityType: 'Common Stock',
        marketSector: 'Equity',
        compositeFIGI: null,
        shareClassFIGI: null,
      },
    ],
    retrievedAt: at,
    checkedAt: at,
    sourceHash: sourceHash('test-only-identity', INFOSYS_ISIN),
    source: 'OpenFIGI',
    sourceUrl: 'https://api.openfigi.com/v3/mapping',
    termsUrl: 'https://www.openfigi.com/docs/terms-of-service',
    mappingPolicy: 'india-common-stock-v1',
  });
  return { source, identity, quotes: [pack.revenueQuote, pack.guidanceQuote] };
}
export async function governancePackSource() {
  const body = await readFile(
    new URL(
      '../../../packages/contracts/test/fixtures/fiu-2010719.html.txt',
      import.meta.url,
    ),
    'utf8',
  );
  return {
    ...parseHistoricalFiu({
      url: FIU_PIB_SOURCE,
      body,
      hash: sourceHash(FIU_PIB_SOURCE, body),
      retrievedAt: new Date().toISOString(),
    }),
    status: 'published' as const,
    reviewedAt: new Date().toISOString(),
  };
}
export async function companyEventFixture(
  request: APIRequestContext,
  sandbox: FeedbackSandbox,
  governance = false,
) {
  const company = governance ? null : await companyPackSources(),
    source = company?.source ?? (await governancePackSource()),
    quotes = company?.quotes ?? [source.body],
    db = await connectionDatabase(sandbox);
  try {
    await db.query('INSERT INTO discovery_items(id,version) VALUES($1,1)', [
      source.id,
    ]);
    await db.query(
      'INSERT INTO discovery_versions(item_id,version,data) VALUES($1,1,$2)',
      [source.id, source],
    );
    if (company) {
      await db.query(
        'INSERT INTO security_identities(isin,version,checked_at) VALUES($1,1,$2)',
        [company.identity.isin, company.identity.checkedAt],
      );
      await db.query(
        'INSERT INTO security_identity_revisions(isin,version,fingerprint,payload) VALUES($1,1,$2,$3)',
        [company.identity.isin, company.identity.sourceHash, company.identity],
      );
    }
  } finally {
    await db.end();
  }
  expect(
    (
      await request.post('/api/v1/ops/session', {
        headers: eventHeaders,
        data: { key: await operatorKey() },
      })
    ).status(),
  ).toBe(200);
  const id = randomUUID(),
    editorial = {
      title: governance
        ? 'Historical FIU bank enforcement'
        : 'Historical Infosys reported and guided values',
      family: governance ? 'regulatory' : 'earnings',
      geography: ['India'],
      claimKind: 'fact',
      explanation: governance
        ? 'Historical official FIU bank-specific disclosure, no listed-parent inference.'
        : 'Reported consolidated IFRS quarter and separate forward constant-currency guidance, with synthetic identity/source admission and no live permission claim.',
      announcedAt: governance ? source.publishedAt : null,
      effectiveAt: null,
      citations: quotes.map((quote) => ({
        sourceId: source.id,
        version: 1,
        hash: source.sourceHash!,
        field: 'body',
        quote,
      })),
      links: company
        ? [
            {
              kind: 'instrument',
              isin: company.identity.isin,
              identityVersion: 1,
              citation: 0,
              rationale:
                'Actual issuer ISIN verified against issuer FAQ; canonical resolver admission simulated for test only.',
            },
          ]
        : [],
    };
  expect(
    (
      await request.put('/api/v1/ops/events/' + id, {
        headers: eventHeaders,
        data: {
          requestId: randomUUID(),
          expectedVersion: 0,
          revisionReason: 'Historical factual pack source-bound test.',
          editorial,
        },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.post(`/api/v1/ops/events/${id}/review`, {
        headers: eventHeaders,
        data: {
          requestId: randomUUID(),
          expectedVersion: 1,
          status: 'published',
          note: 'Original factual source excerpts independently reviewed in isolated test.',
        },
      })
    ).status(),
  ).toBe(201);
  return EventPublicSchema.parse(
    await (await request.get('/api/v1/events/' + id)).json(),
  );
}
