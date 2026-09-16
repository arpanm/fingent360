import type { APIRequestContext } from '@playwright/test';
import { expect } from '@playwright/test';
import { indiaGdpInput, retentionHeaders } from './india-gdp';
import { connectionDatabase } from './research-connection-fixture';
import type { FeedbackSandbox } from './feedback-fixture';
/** Isolated volume copies of one captured fixture; not101 genuine releases. */
export async function seedIndiaMacroPages(
  request: APIRequestContext,
  sandbox: FeedbackSandbox,
) {
  const input = indiaGdpInput();
  expect(
    (
      await request.post('/api/v1/ops/india-macro/gdp', {
        headers: retentionHeaders,
        data: input,
      })
    ).status(),
  ).toBe(201);
  const rejected = {
    ...input,
    requestId: crypto.randomUUID(),
    releaseHtml: input.releaseHtml.replace('81.36', '91.36'),
  };
  expect(
    (
      await request.post('/api/v1/ops/india-macro/gdp', {
        headers: retentionHeaders,
        data: rejected,
      })
    ).status(),
  ).toBe(201);
  const db = await connectionDatabase(sandbox);
  try {
    await db.query(
      "WITH ids AS MATERIALIZED (SELECT gen_random_uuid() AS id,n FROM generate_series(1,100) n) INSERT INTO india_macro_editions(id,kind,fingerprint,actor_id,payload,created_at) SELECT ids.id,e.kind,'synthetic-queue-volume',e.actor_id,jsonb_set(e.payload,'{id}',to_jsonb(ids.id::text)),e.created_at+ids.n*interval '1 microsecond' FROM ids CROSS JOIN india_macro_editions e WHERE e.id=$1",
      [input.requestId],
    );
    await db.query(
      "WITH ids AS MATERIALIZED (SELECT gen_random_uuid() AS id,n FROM generate_series(1,100) n) INSERT INTO india_macro_attempts(id,hash,reason,actor_id,fingerprint,created_at) SELECT ids.id,e.hash,e.reason,e.actor_id,'synthetic-attempt-volume',e.created_at+ids.n*interval '1 microsecond' FROM ids CROSS JOIN india_macro_attempts e WHERE e.id=$1",
      [rejected.requestId],
    );
    return { retained: input.requestId, rejected: rejected.requestId };
  } finally {
    await db.end();
  }
}
