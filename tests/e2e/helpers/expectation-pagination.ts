import type { APIRequestContext } from '@playwright/test';
import { expect } from '@playwright/test';
import { spfInput, retentionHeaders } from './gdp-expectations';
import { cpiNowcastInput } from './cpi-expectations';
import { connectionDatabase } from './research-connection-fixture';
import type { FeedbackSandbox } from './feedback-fixture';
/** Actual captured original plus100 isolated volume copies; not100 source/review claims. */
export async function seedExpectationQueue(
  domain: 'gdp' | 'cpi',
  request: APIRequestContext,
  sandbox: FeedbackSandbox,
) {
  const input = domain === 'gdp' ? spfInput() : cpiNowcastInput();
  expect(
    (
      await request.post(`/api/v1/ops/${domain}-expectations/import`, {
        headers: retentionHeaders,
        data: input,
      })
    ).status(),
  ).toBe(201);
  const db = await connectionDatabase(sandbox);
  try {
    await db.query(
      `WITH ids AS MATERIALIZED (SELECT gen_random_uuid() AS id,n FROM generate_series(1,100) n) INSERT INTO ${domain}_expectation_editions(id,fingerprint,payload,created_at) SELECT ids.id,'synthetic-page-volume',jsonb_set(e.payload,'{id}',to_jsonb(ids.id::text)),e.created_at+ids.n*interval '1 microsecond' FROM ids CROSS JOIN ${domain}_expectation_editions e WHERE e.id=$1`,
      [input.requestId],
    );
    return input.requestId;
  } finally {
    await db.end();
  }
}
