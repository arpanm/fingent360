import { test, expect } from '../../helpers/app-fixture';
import { randomUUID } from 'node:crypto';
import { ingestBea, beaOperator, beaStorage } from '../../helpers/bea-fixture';
import { connectionHeaders as headers } from '../../helpers/research-connection-fixture';
import {
  BeaAttemptPageSchema,
  BeaValidationSchema,
  BeaStageSchema,
} from '../../../../packages/contracts/src/index';
const base = '/api/v1/ops/discovery';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-API-500 linked actual retained BEA revalidation and idempotent staging @BEA-QUARANTINE-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await ingestBea(feedbackSandbox);
  await beaOperator(request);
  const list = BeaAttemptPageSchema.parse(
    await (await request.get(`${base}/bea-attempts`)).json(),
  );
  expect(list.attempts).toHaveLength(1);
  const attempt = list.attempts[0]!;
  expect(attempt.events.map((e) => e.kind)).toEqual([
    'started',
    'retained',
    'parsed',
    'staged',
  ]);
  const input = { requestId: randomUUID() };
  const path = `${base}/bea-attempts/${attempt.id}/revalidate`;
  expect((await request.get(`${base}/bea-attempts?unknown=x`)).status()).toBe(
    400,
  );
  const v = BeaValidationSchema.parse(
    await (await request.post(path, { headers, data: input })).json(),
  );
  expect(v.candidates.length).toBeGreaterThan(0);
  expect(
    await (
      await request.post(
        `${base}/bea-attempts/${attempt.id.toUpperCase()}/revalidate`,
        { headers, data: input },
      )
    ).json(),
  ).toEqual(v);
  expect(
    await (await request.post(path, { headers, data: input })).json(),
  ).toEqual(v);
  const data = {
    requestId: randomUUID(),
    validationId: v.requestId,
    fingerprint: v.fingerprint,
  };
  const responses = await Promise.all([
    request.post(`${base}/bea-staging`, { headers, data }),
    request.post(`${base}/bea-staging`, { headers, data }),
  ]);
  expect(responses.map((r) => r.status())).toEqual([201, 201]);
  const saved = BeaStageSchema.parse(await responses[0]!.json());
  expect(await responses[1]!.json()).toEqual(saved);
  expect(saved.items.every((i) => !i.changed)).toBe(true);
  expect(
    (
      await request.post(`${base}/bea-staging`, {
        headers,
        data: { ...data, fingerprint: '0'.repeat(64) },
      })
    ).status(),
  ).toBe(409);
});
test('E2E-API-501 malformed linked evidence and tamper never stage candidates @BEA-QUARANTINE-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await ingestBea(feedbackSandbox, '<html>synthetic invalid RSS</html>');
  await beaOperator(request);
  const list = BeaAttemptPageSchema.parse(
    await (await request.get(`${base}/bea-attempts`)).json(),
  );
  const attempt = list.attempts[0]!;
  expect(attempt.events.map((e) => e.kind)).toEqual([
    'started',
    'retained',
    'failed',
  ]);
  const path = `${base}/bea-attempts/${attempt.id}`;
  const rejected = BeaValidationSchema.parse(
    await (
      await request.post(`${path}/revalidate`, {
        headers,
        data: { requestId: randomUUID() },
      })
    ).json(),
  );
  expect(rejected.outcome).toBe('rejected');
  expect(rejected.candidates).toEqual([]);
  const storage = await beaStorage(feedbackSandbox);
  try {
    await storage.mongo
      .db()
      .collection('discovery_raw')
      .updateOne(
        { _id: attempt.events.find((e) => e.hash)!.hash as never },
        { $set: { body: 'tampered' } },
      );
  } finally {
    await storage.close();
  }
  expect((await request.get(`${path}/evidence`)).status()).toBe(503);
  expect(
    (
      await request.post(`${path}/revalidate`, {
        headers,
        data: { requestId: randomUUID() },
      })
    ).status(),
  ).toBe(503);
});
test('E2E-API-502 changed current head rejects staging without rewriting originals @BEA-QUARANTINE-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await ingestBea(feedbackSandbox);
  await beaOperator(request);
  const list = BeaAttemptPageSchema.parse(
    await (await request.get(`${base}/bea-attempts`)).json(),
  );
  const validation = BeaValidationSchema.parse(
    await (
      await request.post(
        `${base}/bea-attempts/${list.attempts[0]!.id}/revalidate`,
        { headers, data: { requestId: randomUUID() } },
      )
    ).json(),
  );
  const first = validation.candidates[0]!.baseline!;
  expect(
    (
      await request.put(`${base}/items/${first.id}`, {
        headers,
        data: {
          expectedVersion: first.version,
          status: 'published',
          correctionNote: 'Synthetic concurrent review',
        },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.post(`${base}/bea-staging`, {
        headers,
        data: {
          requestId: randomUUID(),
          validationId: validation.requestId,
          fingerprint: validation.fingerprint,
        },
      })
    ).status(),
  ).toBe(409);
  const { connectionDatabase } =
    await import('../../helpers/research-connection-fixture');
  const pool = await connectionDatabase(feedbackSandbox);
  try {
    expect(
      Number(
        (await pool.query('SELECT count(*) AS n FROM bea_staging_receipts'))
          .rows[0].n,
      ),
    ).toBe(0);
  } finally {
    await pool.end();
  }
});
test('E2E-API-503 gate wait expires actual operator before retained validation @BEA-QUARANTINE-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await ingestBea(feedbackSandbox);
  await beaOperator(request);
  const list = BeaAttemptPageSchema.parse(
    await (await request.get(`${base}/bea-attempts`)).json(),
  );
  const { connectionDatabase } =
    await import('../../helpers/research-connection-fixture');
  const { waitForQueryBlocked } =
    await import('../../helpers/withdrawal-fixture');
  const blocker = await connectionDatabase(feedbackSandbox),
    observer = await connectionDatabase(feedbackSandbox);
  let pending: ReturnType<typeof request.post> | undefined;
  try {
    await blocker.query('BEGIN');
    const pid = Number(
      (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid,
    );
    await blocker.query(
      'SELECT id FROM bea_staging_gate WHERE id=1 FOR UPDATE',
    );
    pending = request.post(
      `${base}/bea-attempts/${list.attempts[0]!.id}/revalidate`,
      { headers, data: { requestId: randomUUID() } },
    );
    void pending.catch(() => {});
    await waitForQueryBlocked(
      observer,
      'SELECT id FROM bea_staging_gate WHERE id=1 FOR UPDATE',
      [pid],
    );
    await observer.query(
      "UPDATE operator_sessions SET expires_at=clock_timestamp()-interval '1 second'",
    );
    await blocker.query('COMMIT');
    expect((await pending).status()).toBe(401);
    expect(
      Number(
        (await observer.query('SELECT count(*) AS n FROM bea_revalidations'))
          .rows[0].n,
      ),
    ).toBe(0);
  } finally {
    await blocker.query('ROLLBACK');
    if (pending) await pending.then((r) => r.body()).catch(() => {});
    await blocker.end();
    await observer.end();
  }
});
test('E2E-API-504 committed draft receipt survives later run finalization failure @BEA-QUARANTINE-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const { connectionDatabase } =
    await import('../../helpers/research-connection-fixture');
  const pool = await connectionDatabase(feedbackSandbox);
  try {
    await pool.query(
      "CREATE FUNCTION synthetic_bea_finalization_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.status='succeeded' THEN RAISE EXCEPTION 'synthetic finalization failure'; END IF; RETURN NEW; END $$",
    );
    await pool.query(
      'CREATE TRIGGER synthetic_bea_finalization_fault BEFORE UPDATE ON discovery_source_runs FOR EACH ROW EXECUTE FUNCTION synthetic_bea_finalization_fault()',
    );
    await ingestBea(feedbackSandbox);
    await beaOperator(request);
    const list = BeaAttemptPageSchema.parse(
      await (await request.get(`${base}/bea-attempts`)).json(),
    );
    expect(list.attempts[0]!.events.map((e) => e.kind)).toEqual([
      'started',
      'retained',
      'parsed',
      'staged',
      'failed',
    ]);
    expect(
      Number(
        (await pool.query('SELECT count(*) AS n FROM discovery_items')).rows[0]
          .n,
      ),
    ).toBeGreaterThan(0);
    expect(
      (await pool.query('SELECT status FROM discovery_source_runs')).rows[0]
        .status,
    ).toBe('failed');
  } finally {
    await pool.query(
      'DROP TRIGGER IF EXISTS synthetic_bea_finalization_fault ON discovery_source_runs',
    );
    await pool.query(
      'DROP FUNCTION IF EXISTS synthetic_bea_finalization_fault()',
    );
    await pool.end();
  }
});
test('E2E-API-505 interrupted and invalid UTF8 responses never receive retained links @BEA-QUARANTINE-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const storage = await beaStorage(feedbackSandbox),
    original = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      new Response(new Uint8Array([0xc3, 0x28]), { status: 200 });
    await storage.store.refresh(['bea']);
    globalThis.fetch = async () =>
      new Response(
        new ReadableStream({
          start(c) {
            c.enqueue(new TextEncoder().encode('<rss>'));
            c.error(new Error('synthetic interrupted stream'));
          },
        }),
        { status: 200 },
      );
    await storage.store.refresh(['bea']);
  } finally {
    globalThis.fetch = original;
    await storage.close();
  }
  await beaOperator(request);
  const list = BeaAttemptPageSchema.parse(
    await (await request.get(`${base}/bea-attempts`)).json(),
  );
  expect(list.attempts).toHaveLength(2);
  for (const a of list.attempts) {
    expect(a.events.map((e) => e.kind)).toEqual(['started', 'failed']);
    expect(a.events[1]!.message).toContain('incomplete');
    expect(
      (await request.get(`${base}/bea-attempts/${a.id}/evidence`)).status(),
    ).toBe(409);
  }
});
test('E2E-API-506 bounded retained-validation history has complete nonduplicating pages @BEA-QUARANTINE-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  test.setTimeout(120000);
  await ingestBea(
    feedbackSandbox,
    '<html>synthetic invalid RSS for history</html>',
  );
  await beaOperator(request);
  const list = BeaAttemptPageSchema.parse(
    await (await request.get(`${base}/bea-attempts`)).json(),
  );
  const id = list.attempts[0]!.id,
    ids: string[] = [];
  for (let n = 0; n < 31; n++) {
    const value = BeaValidationSchema.parse(
      await (
        await request.post(`${base}/bea-attempts/${id}/revalidate`, {
          headers,
          data: { requestId: randomUUID() },
        })
      ).json(),
    );
    expect(value.outcome).toBe('rejected');
    ids.push(value.requestId);
  }
  const { BeaHistorySchema } =
    await import('../../../../packages/contracts/src/index');
  const one = BeaHistorySchema.parse(
    await (await request.get(`${base}/bea-attempts/${id}/history`)).json(),
  );
  expect(one.entries).toHaveLength(30);
  expect(one.next).not.toBeNull();
  const two = BeaHistorySchema.parse(
    await (
      await request.get(`${base}/bea-attempts/${id}/history?after=${one.next}`)
    ).json(),
  );
  expect(two.entries).toHaveLength(1);
  expect(two.next).toBeNull();
  expect([...one.entries, ...two.entries].map((e) => e.id).sort()).toEqual(
    ids.sort(),
  );
});
