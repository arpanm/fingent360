import { createHash, randomUUID } from 'node:crypto';
import { test as base, expect, eventHeaders } from './event-fixture';
import { connectionDatabase } from './research-connection-fixture';
import type { FeedbackSandbox } from './feedback-fixture';
import type { APIRequestContext } from '@playwright/test';
import {
  SecurityIdentitySchema,
  IdentitySelectionPlanSchema,
  IdentitySelectionReceiptSchema,
} from '../../../packages/contracts/src/index';
export const test = base.extend({
  context: async ({ context, feedbackSandbox }, use) => {
    await context.route(/\/api\/v1\/securities(?:[/?]|$)/, (route) => {
      const url = new URL(route.request().url());
      return route.continue({
        url: feedbackSandbox.apiOrigin + url.pathname + url.search,
      });
    });
    await use(context);
  },
});
export { expect, eventHeaders };
export async function seedSelectionIdentity(
  sandbox: FeedbackSandbox,
  empty = false,
) {
  const at = new Date().toISOString();
  const candidates = empty
    ? []
    : ['BBG000000001', 'BBG000000002'].map((figi, index) => ({
        figi,
        name: 'Synthetic candidate ' + index,
        ticker: 'SYN' + index,
        exchCode: 'IN',
        securityType: 'Common Stock',
        marketSector: 'Equity',
        compositeFIGI: null,
        shareClassFIGI: null,
      }));
  const provider = SecurityIdentitySchema.parse({
    isin: 'INE002A01018',
    version: 1,
    resolution: empty ? 'unresolved' : 'ambiguous',
    candidates,
    retrievedAt: at,
    checkedAt: at,
    sourceHash: createHash('sha256')
      .update(JSON.stringify({ synthetic: true, candidates, at }))
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
      [provider.isin, at],
    );
    await pool.query(
      'INSERT INTO security_identity_revisions(isin,version,fingerprint,payload) VALUES($1,1,$2,$3)',
      [provider.isin, provider.sourceHash, provider],
    );
  } finally {
    await pool.end();
  }
  return provider;
}
export async function saveSelection(
  request: APIRequestContext,
  provider: ReturnType<typeof SecurityIdentitySchema.parse>,
  expectedVersion = 0,
  action: 'select' | 'withdraw' = 'select',
) {
  const response = await request.put(
    '/api/v1/ops/identity-selections/' + randomUUID(),
    {
      headers: eventHeaders,
      data: {
        isin: provider.isin,
        action,
        expectedVersion,
        providerVersion: provider.version,
        providerHash: provider.sourceHash,
        figi: provider.candidates[1]!.figi,
        rationale:
          'Synthetic editorial judgement among retained candidates; not externally verified.',
      },
    },
  );
  expect(response.status(), await response.text()).toBe(200);
  return IdentitySelectionPlanSchema.parse(await response.json());
}
export async function applySelection(
  request: APIRequestContext,
  plan: ReturnType<typeof IdentitySelectionPlanSchema.parse>,
) {
  const response = await request.post(
    '/api/v1/ops/identity-selections/' + plan.id + '/review',
    {
      headers: eventHeaders,
      data: {
        fingerprint: plan.fingerprint,
        status: plan.input.action === 'select' ? 'approved' : 'withdrawn',
      },
    },
  );
  expect(response.status(), await response.text()).toBe(201);
  return IdentitySelectionReceiptSchema.parse(await response.json());
}
