import { randomUUID } from 'node:crypto';
import {
  test,
  expect,
  eventFixture,
  eventHeaders as headers,
} from '../../helpers/event-fixture';
import {
  connectionDatabase,
  reviseConnectionSourceFixture,
} from '../../helpers/research-connection-fixture';
import {
  EventOperationsSchema,
  EventReceiptSchema,
  EventPublicSchema,
  EventListSchema,
  DomainEvidenceGraphSchema,
} from '../../../../packages/contracts/src/index';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-API-700 actual source draft exact review replay public context and withdrawal protection @EVENT-REVIEW-001', async ({
  request,
  feedbackSandbox,
}) => {
  const fixture = await eventFixture(request, feedbackSandbox),
    path = '/api/v1/ops/events/' + fixture.id;
  const saved = await request.put(path, { headers, data: fixture.input });
  expect(saved.status()).toBe(200);
  const draft = EventOperationsSchema.parse(await saved.json());
  DomainEvidenceGraphSchema.parse(draft.latest.graph);
  expect(draft.latest.graph.edges[0]?.direction).toBe('unknown');
  expect((await request.get('/api/v1/events/' + fixture.id)).status()).toBe(
    404,
  );
  expect(
    await (await request.put(path, { headers, data: fixture.input })).json(),
  ).toEqual(draft);
  const review = {
    requestId: randomUUID(),
    expectedVersion: 1,
    status: 'published',
    note: 'Synthetic explicit review of stored source context',
  };
  const response = await request.post(path + '/review', {
    headers,
    data: review,
  });
  expect(response.status()).toBe(201);
  const receipt = EventReceiptSchema.parse(await response.json());
  expect(receipt.version).toBe(2);
  expect(
    await (
      await request.post(path + '/review', { headers, data: review })
    ).json(),
  ).toEqual(receipt);
  const published = EventPublicSchema.parse(
    await (await request.get('/api/v1/events/' + fixture.id)).json(),
  );
  expect(published.event?.editorial.title).toBe(fixture.input.editorial.title);
  expect(published.event?.graph.events[0]?.publicationState).toBe('published');
  expect(
    (
      await (
        await request.get('/api/v1/events/' + fixture.id + '/history')
      ).json()
    ).revisions.map((row: { version: number }) => row.version),
  ).toEqual([2]);
  expect(
    (await (await request.get(path + '/history')).json()).revisions.map(
      (row: { version: number }) => row.version,
    ),
  ).toEqual([2, 1]);
  expect(
    (
      await request.get(
        '/api/v1/events/' + fixture.id + '/history?before=2147483648',
      )
    ).status(),
  ).toBe(400);
  const list = EventListSchema.parse(
    await (
      await request.get(
        '/api/v1/events?sector=' +
          encodeURIComponent('Synthetic sector context'),
      )
    ).json(),
  );
  expect(list.items.map((row) => row.id)).toContain(fixture.id);
  await reviseConnectionSourceFixture(
    feedbackSandbox,
    fixture.source,
    'withdrawn',
  );
  const unavailable = EventPublicSchema.parse(
    await (await request.get('/api/v1/events/' + fixture.id)).json(),
  );
  expect(unavailable.event).toBeNull();
  expect(unavailable.status).toBe('unavailable');
  const hidden = EventListSchema.parse(
    await (
      await request.get(
        '/api/v1/events?sector=' +
          encodeURIComponent('Synthetic sector context'),
      )
    ).json(),
  );
  expect(hidden.items).toEqual([]);
  const db = await connectionDatabase(feedbackSandbox);
  try {
    expect(
      (
        await db.query(
          'SELECT count(*)::int AS n FROM reviewed_event_versions WHERE event_id=$1',
          [fixture.id],
        )
      ).rows[0].n,
    ).toBe(2);
  } finally {
    await db.end();
  }
});
test('E2E-API-701 fabricated quote unknown identity stale revision and immutable history rejected @EVENT-REVIEW-001', async ({
  request,
  feedbackSandbox,
}) => {
  const fixture = await eventFixture(request, feedbackSandbox),
    path = '/api/v1/ops/events/' + fixture.id;
  const invalid = structuredClone(fixture.input);
  invalid.editorial.citations[0]!.quote =
    'Synthetic nonexistent exact source assertion';
  expect((await request.put(path, { headers, data: invalid })).status()).toBe(
    409,
  );
  expect(
    (await request.put(path, { headers, data: fixture.input })).status(),
  ).toBe(200);
  expect(
    (
      await request.put(path, {
        headers,
        data: { ...fixture.input, requestId: randomUUID() },
      })
    ).status(),
  ).toBe(409);
  const unknown = {
    ...fixture.input,
    requestId: randomUUID(),
    expectedVersion: 1,
    editorial: {
      ...fixture.input.editorial,
      links: [
        {
          kind: 'instrument',
          isin: 'INE002A01018',
          identityVersion: 1,
          citation: 0,
          rationale: 'Synthetic unknown identity must fail',
        },
      ],
    },
  };
  expect((await request.put(path, { headers, data: unknown })).status()).toBe(
    409,
  );
  const db = await connectionDatabase(feedbackSandbox);
  try {
    await expect(
      db.query(
        'UPDATE reviewed_event_versions SET payload=payload WHERE event_id=$1',
        [fixture.id],
      ),
    ).rejects.toThrow('immutable');
  } finally {
    await db.end();
  }
});

test('E2E-API-703 expiry during actual source lock wait rolls back event publication @EVENT-REVIEW-001', async ({
  request,
  feedbackSandbox,
}) => {
  const { createHash } = await import('node:crypto');
  const fixture = await eventFixture(request, feedbackSandbox),
    path = '/api/v1/ops/events/' + fixture.id;
  await request.put(path, { headers, data: fixture.input });
  const token = (await request.storageState()).cookies.find(
    (cookie) => cookie.name === 'f360_ops',
  )!.value;
  const blocker = await connectionDatabase(feedbackSandbox),
    observer = await connectionDatabase(feedbackSandbox);
  let pending: ReturnType<typeof request.post> | undefined;
  try {
    await blocker.query('BEGIN');
    const pid = (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0]
      .pid;
    await blocker.query(
      'SELECT id FROM discovery_items WHERE id=$1 FOR UPDATE',
      [fixture.source.id],
    );
    pending = request.post(path + '/review', {
      headers,
      data: {
        requestId: randomUUID(),
        expectedVersion: 1,
        status: 'published',
        note: 'Synthetic blocked source review',
      },
    });
    await expect
      .poll(async () => {
        await observer.query('SELECT pg_stat_clear_snapshot()');
        return (
          await observer.query(
            "SELECT pid FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid)) AND query LIKE 'SELECT id FROM discovery_items WHERE id=ANY%FOR SHARE%'",
            [pid],
          )
        ).rows.length;
      })
      .toBe(1);
    await observer.query(
      "UPDATE operator_sessions SET expires_at=clock_timestamp()-interval '1 second' WHERE token_hash=$1",
      [createHash('sha256').update(token).digest('hex')],
    );
    await blocker.query('COMMIT');
    const response = await pending;
    expect(response.status()).toBe(401);
    await response.body();
    expect(
      (
        await observer.query(
          'SELECT head_version,status FROM reviewed_events WHERE id=$1',
          [fixture.id],
        )
      ).rows[0],
    ).toEqual({ head_version: 1, status: 'never-published' });
  } finally {
    await blocker.query('ROLLBACK').catch(() => {});
    if (pending)
      await pending.then((response) => response.body()).catch(() => {});
    await blocker.end();
    await observer.end();
  }
});

test('E2E-API-704 actual retained instrument identity binds context and changed identity hides event @EVENT-REVIEW-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const { readFile } = await import('node:fs/promises');
  const { SecurityDirectorySchema } =
    await import('../../../../packages/contracts/src/index');
  const bundle = JSON.parse(
    await readFile(
      new URL(
        '../../../../apps/web/src/offline/content-bundle.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  const identity = SecurityDirectorySchema.parse(bundle.securities).items.find(
    (row) => row.resolution === 'matched' && row.candidates.length === 1,
  )!;
  expect(identity).toBeTruthy();
  const fixture = await eventFixture(request, feedbackSandbox),
    path = '/api/v1/ops/events/' + fixture.id;
  const db = await connectionDatabase(feedbackSandbox);
  try {
    await db.query(
      'INSERT INTO security_identities(isin,version,checked_at) VALUES($1,$2,$3)',
      [identity.isin, identity.version, identity.checkedAt],
    );
    await db.query(
      'INSERT INTO security_identity_revisions(isin,version,fingerprint,payload) VALUES($1,$2,$3,$4)',
      [identity.isin, identity.version, identity.sourceHash, identity],
    );
    const input = {
      ...fixture.input,
      editorial: {
        ...fixture.input.editorial,
        links: [
          {
            kind: 'instrument',
            isin: identity.isin,
            identityVersion: identity.version,
            citation: 0,
            rationale:
              'Synthetic researcher-authored association; no holdings or causal claim.',
          },
        ],
      },
    };
    expect((await request.put(path, { headers, data: input })).status()).toBe(
      200,
    );
    expect(
      (
        await request.post(path + '/review', {
          headers,
          data: {
            requestId: randomUUID(),
            expectedVersion: 1,
            status: 'published',
            note: 'Synthetic identity and source review',
          },
        })
      ).status(),
    ).toBe(201);
    const value = EventPublicSchema.parse(
      await (await request.get('/api/v1/events/' + fixture.id)).json(),
    );
    expect(value.event?.identities).toEqual([identity]);
    expect(
      EventListSchema.parse(
        await (
          await request.get('/api/v1/events?isin=' + identity.isin)
        ).json(),
      ).items.map((row) => row.id),
    ).toContain(fixture.id);
    const next = { ...identity, version: identity.version + 1 };
    await db.query(
      'INSERT INTO security_identity_revisions(isin,version,fingerprint,payload) VALUES($1,$2,$3,$4)',
      [identity.isin, next.version, identity.sourceHash, next],
    );
    await db.query('UPDATE security_identities SET version=$2 WHERE isin=$1', [
      identity.isin,
      next.version,
    ]);
    expect(
      EventPublicSchema.parse(
        await (await request.get('/api/v1/events/' + fixture.id)).json(),
      ).event,
    ).toBeNull();
  } finally {
    await db.end();
  }
});
