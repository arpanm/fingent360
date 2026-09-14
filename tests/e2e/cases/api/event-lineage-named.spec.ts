import { randomUUID } from 'node:crypto';
import {
  test,
  expect,
  eventHeaders as headers,
} from '../../helpers/event-fixture';
import { seedConnectionSource } from '../../helpers/research-connection-fixture';
import { saveLineage } from '../../helpers/event-lineage';
test.use({
  namedOperators: true,
  trace: 'off',
  video: 'off',
  screenshot: 'off',
});
test('E2E-API-833 lineage publication uses distinct named approval and replay preserves one application @EVENT-LINEAGE-001 @NAMED-OPERATORS-001', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const source = await seedConnectionSource(feedbackSandbox);
  await request.post('/api/v1/ops/session', {
    headers,
    data: feedbackSandbox.namedCredentials,
  });
  const credentials = {
    username: 'lineage_' + randomUUID().slice(0, 8),
    password: 'Synthetic-lineage-publisher-2026',
  };
  expect(
    (
      await request.post('/api/v1/ops/operators', {
        headers,
        data: { ...credentials, role: 'publisher' },
      })
    ).status(),
  ).toBe(201);
  const publisher = await playwright.request.newContext({
    baseURL: feedbackSandbox.apiOrigin,
  });
  const editorial = {
    title: 'Synthetic named lineage',
    family: 'Policy',
    geography: ['India'],
    claimKind: 'inference',
    explanation: 'Synthetic source-bound context for independent review.',
    announcedAt: null,
    effectiveAt: null,
    citations: [
      {
        sourceId: source.id,
        version: source.version,
        hash: source.sourceHash,
        field: 'title',
        quote: source.title,
      },
    ],
    links: [],
  };
  try {
    await publisher.post('/api/v1/ops/session', { headers, data: credentials });
    const inputs = [];
    for (let index = 0; index < 2; index++) {
      const id = randomUUID(),
        proposal = randomUUID();
      expect(
        (
          await request.put('/api/v1/ops/events/' + id, {
            headers,
            data: {
              requestId: randomUUID(),
              expectedVersion: 0,
              revisionReason: 'Synthetic original review',
              editorial,
            },
          })
        ).status(),
      ).toBe(200);
      expect(
        (
          await request.put('/api/v1/ops/proposals/' + proposal, {
            headers,
            data: {
              kind: 'event',
              target: id,
              body: {
                requestId: randomUUID(),
                expectedVersion: 1,
                status: 'published',
                note: 'Synthetic independent review',
              },
            },
          })
        ).status(),
      ).toBe(200);
      expect(
        (
          await publisher.post(
            '/api/v1/ops/proposals/' + proposal + '/approve',
            { headers, data: { note: 'Independent original approval' } },
          )
        ).status(),
      ).toBe(201);
      inputs.push({ id, version: 2 });
    }
    const plan = await saveLineage(request, {
      kind: 'merge',
      inputs,
      outputs: [{ id: randomUUID(), editorial }],
      reason: 'Synthetic duplicate consolidation after review',
    });
    expect(
      (
        await request.post(
          '/api/v1/ops/event-lineage/' + plan.id + '/approve',
          { headers, data: { fingerprint: plan.fingerprint } },
        )
      ).status(),
    ).toBe(403);
    const proposal = randomUUID();
    expect(
      (
        await request.put('/api/v1/ops/proposals/' + proposal, {
          headers,
          data: {
            kind: 'event-lineage',
            target: plan.id,
            body: { fingerprint: plan.fingerprint },
          },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await request.post('/api/v1/ops/proposals/' + proposal + '/approve', {
          headers,
          data: { note: 'Same identity must fail' },
        })
      ).status(),
    ).toBe(403);
    const approved = await publisher.post(
      '/api/v1/ops/proposals/' + proposal + '/approve',
      { headers, data: { note: 'Independent complete lineage approval' } },
    );
    expect(approved.status()).toBe(201);
    const receipt = await approved.json();
    expect(
      await (
        await publisher.post('/api/v1/ops/proposals/' + proposal + '/approve', {
          headers,
          data: { note: 'Independent complete lineage approval' },
        })
      ).json(),
    ).toEqual(receipt);
    expect(
      (await request.get('/api/v1/events/' + plan.outputs[0]!.id)).status(),
    ).toBe(200);
  } finally {
    await publisher.dispose();
  }
});
test('E2E-API-835 three concurrent named lineage reads retain final admission without nested pool exhaustion @EVENT-LINEAGE-001', async ({
  request,
  feedbackSandbox,
}) => {
  const { connectionDatabase } =
    await import('../../helpers/research-connection-fixture');
  expect(
    (
      await request.post('/api/v1/ops/session', {
        headers,
        data: feedbackSandbox.namedCredentials,
      })
    ).status(),
  ).toBe(200);
  const blockerPool = await connectionDatabase(feedbackSandbox),
    observer = await connectionDatabase(feedbackSandbox);
  const blocker = await blockerPool.connect();
  let released = false;
  const pending: Promise<import('@playwright/test').APIResponse>[] = [];
  try {
    await blocker.query('BEGIN');
    await blocker.query(
      'LOCK TABLE event_lineage_plans IN ACCESS EXCLUSIVE MODE',
    );
    const pid = (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0]
      .pid;
    for (let index = 0; index < 3; index++)
      pending.push(request.get('/api/v1/ops/event-lineage'));
    await expect
      .poll(async () => {
        await observer.query('SELECT pg_stat_clear_snapshot()');
        const result = await observer.query(
          "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND $1=ANY(pg_blocking_pids(pid)) AND query LIKE 'SELECT p.id,p.payload AS plan,r.payload AS receipt FROM event_lineage_plans%'",
          [pid],
        );
        return result.rows[0].n;
      })
      .toBe(3);
    await blocker.query('COMMIT');
    released = true;
    const responses = await Promise.all(pending);
    for (const response of responses) {
      expect(response.status()).toBe(200);
      expect(await response.json()).toEqual({ plans: [], next: null });
    }
  } finally {
    if (!released) await blocker.query('ROLLBACK');
    await Promise.allSettled(pending);
    blocker.release();
    await blockerPool.end();
    await observer.end();
  }
});
