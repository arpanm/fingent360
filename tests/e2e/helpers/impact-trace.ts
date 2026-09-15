import { randomUUID, createHash } from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';
import {
  SecurityIdentitySchema,
  EventPublicSchema,
  EventSaveSchema,
} from '../../../packages/contracts/src/index';
import { eventFixture, eventHeaders } from './event-fixture';
import { connectionDatabase } from './research-connection-fixture';
import type { FeedbackSandbox } from './feedback-fixture';
export async function impactEventFixture(
  request: APIRequestContext,
  sandbox: FeedbackSandbox,
) {
  const fixture = await eventFixture(request, sandbox),
    at = new Date().toISOString();
  const identity = SecurityIdentitySchema.parse({
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
      .update('Synthetic impact identity')
      .digest('hex'),
    source: 'OpenFIGI',
    sourceUrl: 'https://api.openfigi.com/v3/mapping',
    termsUrl: 'https://www.openfigi.com/docs/terms-of-service',
    mappingPolicy: 'india-common-stock-v1',
  });
  const pool = await connectionDatabase(sandbox);
  try {
    await pool.query(
      'INSERT INTO security_identities(isin,version,checked_at) VALUES($1,1,$2)',
      [identity.isin, at],
    );
    await pool.query(
      'INSERT INTO security_identity_revisions(isin,version,fingerprint,payload) VALUES($1,1,$2,$3)',
      [identity.isin, identity.sourceHash, identity],
    );
  } finally {
    await pool.end();
  }
  const input = EventSaveSchema.parse({
    ...fixture.input,
    editorial: {
      ...fixture.input.editorial,
      links: [
        ...fixture.input.editorial.links,
        {
          kind: 'instrument',
          isin: identity.isin,
          identityVersion: 1,
          citation: 0,
          rationale:
            'Synthetic reviewed association, no quantified company impact.',
        },
      ],
    },
  });
  const path = '/api/v1/ops/events/' + fixture.id;
  const draft = await request.put(path, { headers: eventHeaders, data: input });
  if (!draft.ok())
    throw Error('Impact fixture draft failed: ' + (await draft.text()));
  const review = await request.post(path + '/review', {
    headers: eventHeaders,
    data: {
      requestId: randomUUID(),
      expectedVersion: 1,
      status: 'published',
      note: 'Synthetic explicit source and identity review.',
    },
  });
  if (!review.ok())
    throw Error('Impact fixture review failed: ' + (await review.text()));
  const event = EventPublicSchema.parse(
    await (await request.get('/api/v1/events/' + fixture.id)).json(),
  );
  return { ...fixture, event, identity };
}
