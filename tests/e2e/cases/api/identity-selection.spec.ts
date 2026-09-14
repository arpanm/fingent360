import { randomUUID } from 'node:crypto';
import {
  test,
  expect,
  eventHeaders as headers,
  seedSelectionIdentity,
  saveSelection,
  applySelection,
} from '../../helpers/identity-selection';
import { eventFixture } from '../../helpers/event-fixture';
import { connectionDatabase } from '../../helpers/research-connection-fixture';
import {
  EventPublicSchema,
  IdentitySelectionPublicSchema,
} from '../../../../packages/contracts/src/index';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-API-870 editorial selection preserves provider ambiguity and explicitly admits then withdraws event context @IDENTITY-ADJUDICATION-001', async ({
  request,
  feedbackSandbox,
}) => {
  const fixture = await eventFixture(request, feedbackSandbox),
    provider = await seedSelectionIdentity(feedbackSandbox);
  expect(
    (
      await request.post('/api/v1/account/register', {
        headers,
        data: {
          username: 'selection_' + randomUUID().slice(0, 8),
          password: 'Synthetic-selection-investor-2026',
          consent: true,
        },
      })
    ).status(),
  ).toBe(201);
  expect(
    (
      await request.post('/api/v1/account/goals', {
        headers,
        data: {
          name: 'Synthetic unchanged investor goal',
          type: 'education',
          targetMinor: '100000',
          savedMinor: '1000',
          monthlyMinor: '100',
          horizonMonths: 12,
          currency: 'INR',
          scale: 2,
          assumptions: 'no-growth-nominal-v1',
          storageConsent: true,
        },
      })
    ).status(),
  ).toBe(201);
  const goalsBefore = await (await request.get('/api/v1/account/goals')).json();
  const plan = await saveSelection(request, provider),
    receipt = await applySelection(request, plan);
  expect(await applySelection(request, plan)).toEqual(receipt);
  expect(
    await (await request.get('/api/v1/securities/' + provider.isin)).json(),
  ).toEqual(provider);
  const eventId = randomUUID(),
    editorial = {
      ...fixture.input.editorial,
      links: [
        {
          kind: 'instrument',
          isin: provider.isin,
          identityVersion: 1,
          citation: 0,
          rationale: 'Synthetic explicit editorial connection.',
          selection: receipt,
        },
      ],
    };
  expect(
    (
      await request.put('/api/v1/ops/events/' + eventId, {
        headers,
        data: { ...fixture.input, requestId: randomUUID(), editorial },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.post('/api/v1/ops/events/' + eventId + '/review', {
        headers,
        data: {
          requestId: randomUUID(),
          expectedVersion: 1,
          status: 'published',
          note: 'Synthetic explicit selection context reviewed.',
        },
      })
    ).status(),
  ).toBe(201);
  const published = EventPublicSchema.parse(
    await (await request.get('/api/v1/events/' + eventId)).json(),
  );
  expect(published.event?.graph.nodes[1]?.label).toBe(
    provider.candidates[1]!.name,
  );
  const withdrawn = await applySelection(
    request,
    await saveSelection(request, provider, 1, 'withdraw'),
  );
  expect(withdrawn.status).toBe('withdrawn');
  expect(
    EventPublicSchema.parse(
      await (await request.get('/api/v1/events/' + eventId)).json(),
    ).status,
  ).toBe('unavailable');
  expect(
    await (await request.get('/api/v1/securities/' + provider.isin)).json(),
  ).toEqual(provider);
  expect(
    IdentitySelectionPublicSchema.parse(
      await (
        await request.get('/api/v1/securities/' + provider.isin + '/selection')
      ).json(),
    ).state,
  ).toBe('withdrawn');
  expect(await applySelection(request, plan)).toEqual(receipt);
  expect(await (await request.get('/api/v1/account/goals')).json()).toEqual(
    goalsBefore,
  );
});
test('E2E-API-871 candidate fabrication and changed provider editions cannot be approved @IDENTITY-ADJUDICATION-001', async ({
  request,
  feedbackSandbox,
}) => {
  await eventFixture(request, feedbackSandbox);
  const provider = await seedSelectionIdentity(feedbackSandbox);
  const plan = await saveSelection(request, provider);
  expect(
    (
      await request.put('/api/v1/ops/identity-selections/' + randomUUID(), {
        headers,
        data: { ...plan.input, figi: 'BBG999999999' },
      })
    ).status(),
  ).toBe(409);
  const pool = await connectionDatabase(feedbackSandbox);
  try {
    const revised = { ...provider, version: 2, sourceHash: 'b'.repeat(64) };
    await pool.query(
      'INSERT INTO security_identity_revisions(isin,version,fingerprint,payload) VALUES($1,2,$2,$3)',
      [provider.isin, revised.sourceHash, revised],
    );
    await pool.query('UPDATE security_identities SET version=2 WHERE isin=$1', [
      provider.isin,
    ]);
    expect(
      (
        await request.post(
          '/api/v1/ops/identity-selections/' + plan.id + '/review',
          {
            headers,
            data: { fingerprint: plan.fingerprint, status: 'approved' },
          },
        )
      ).status(),
    ).toBe(409);
    expect(
      (
        await pool.query(
          'SELECT count(*)::int AS n FROM identity_selection_revisions',
        )
      ).rows[0].n,
    ).toBe(0);
  } finally {
    await pool.end();
  }
});
test('E2E-API-872 competing decisions consume one selection base without partial receipts @IDENTITY-ADJUDICATION-001', async ({
  request,
  feedbackSandbox,
}) => {
  await eventFixture(request, feedbackSandbox);
  const provider = await seedSelectionIdentity(feedbackSandbox);
  const plans = [
    await saveSelection(request, provider),
    await saveSelection(request, provider),
  ];
  const replies = await Promise.all(
    plans.map((plan) =>
      request.post('/api/v1/ops/identity-selections/' + plan.id + '/review', {
        headers,
        data: { fingerprint: plan.fingerprint, status: 'approved' },
      }),
    ),
  );
  expect(replies.map((reply) => reply.status()).sort()).toEqual([201, 409]);
  const pool = await connectionDatabase(feedbackSandbox);
  try {
    expect(
      (
        await pool.query(
          'SELECT count(*)::int AS n FROM identity_selection_revisions',
        )
      ).rows[0].n,
    ).toBe(1);
  } finally {
    await pool.end();
  }
});
test('E2E-API-873 unresolved empty provider result cannot invent a selection @IDENTITY-ADJUDICATION-001', async ({
  request,
  feedbackSandbox,
}) => {
  await eventFixture(request, feedbackSandbox);
  const provider = await seedSelectionIdentity(feedbackSandbox, true);
  expect(
    (
      await request.put('/api/v1/ops/identity-selections/' + randomUUID(), {
        headers,
        data: {
          isin: provider.isin,
          action: 'select',
          expectedVersion: 0,
          providerVersion: 1,
          providerHash: provider.sourceHash,
          figi: 'BBG000000001',
          rationale: 'Synthetic invented identity must be refused.',
        },
      })
    ).status(),
  ).toBe(409);
});
test('E2E-API-875 expiry during an actual provider-head wait rolls back selection admission @IDENTITY-ADJUDICATION-001', async ({
  request,
  feedbackSandbox,
}) => {
  await eventFixture(request, feedbackSandbox);
  const provider = await seedSelectionIdentity(feedbackSandbox);
  const plan = await saveSelection(request, provider);
  const blockingPool = await connectionDatabase(feedbackSandbox),
    observer = await connectionDatabase(feedbackSandbox),
    blocker = await blockingPool.connect();
  let released = false,
    pending: Promise<import('@playwright/test').APIResponse> | undefined;
  try {
    await blocker.query('BEGIN');
    await blocker.query(
      'SELECT isin FROM security_identities WHERE isin=$1 FOR UPDATE',
      [provider.isin],
    );
    const pid = (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0]
      .pid;
    pending = request.post(
      '/api/v1/ops/identity-selections/' + plan.id + '/review',
      { headers, data: { fingerprint: plan.fingerprint, status: 'approved' } },
    );
    await expect
      .poll(async () => {
        await observer.query('SELECT pg_stat_clear_snapshot()');
        return (
          await observer.query(
            "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND $1=ANY(pg_blocking_pids(pid)) AND query='SELECT version FROM security_identities WHERE isin=$1 FOR SHARE'",
            [pid],
          )
        ).rows[0].n;
      })
      .toBe(1);
    await observer.query(
      "UPDATE operator_sessions SET expires_at=clock_timestamp()-interval '1 second' WHERE operator_id IS NULL",
    );
    await blocker.query('COMMIT');
    released = true;
    const response = await pending;
    expect(response.status()).toBe(401);
    await response.body();
    expect(
      (
        await observer.query(
          'SELECT count(*)::int AS n FROM identity_selection_revisions',
        )
      ).rows[0].n,
    ).toBe(0);
    expect(
      (
        await observer.query(
          'SELECT payload FROM security_identity_revisions WHERE isin=$1 AND version=1',
          [provider.isin],
        )
      ).rows[0].payload,
    ).toEqual(provider);
  } finally {
    if (!released) await blocker.query('ROLLBACK');
    if (pending)
      await Promise.allSettled([pending.then((response) => response.body())]);
    blocker.release();
    await blockingPool.end();
    await observer.end();
  }
});
