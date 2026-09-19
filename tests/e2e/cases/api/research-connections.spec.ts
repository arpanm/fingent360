import { randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/app-fixture';
import {
  connectionDatabase,
  connectionGoal,
  connectionHeaders as headers,
  connectionPassword,
  prepareConnectionAccount,
  seedConnectionSource,
  reviseConnectionSourceFixture,
} from '../../helpers/research-connection-fixture';
import {
  ResearchConnectionHistorySchema,
  ResearchConnectionRevisionSchema,
  ResearchConnectionsSchema,
  PrivacyExportSchema,
  connectionSource,
  type FeedItem,
} from '../../../../packages/contracts/src/index';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
const base = '/api/v1/account/research-connections';
const create = (source: FeedItem, goalId?: string) => ({
  requestId: randomUUID(),
  expectedVersion: 0,
  action: 'create',
  source: {
    itemId: source.id,
    version: source.version,
    sourceHash: source.sourceHash,
  },
  target: goalId
    ? { kind: 'goal', id: goalId, version: 1 }
    : { kind: 'holding', id: 'INE002A01018', version: 1 },
  note: 'My research question, not a claim of financial impact.',
  storageConsent: true,
});

test('E2E-API-260 actual published dated source binds exact owned holding and replay preserves financial records @EVIDENCE-LINKS-001', async ({
  request,
  feedbackSandbox,
}) => {
  const source = await seedConnectionSource(feedbackSandbox);
  await prepareConnectionAccount(request);
  const before = PrivacyExportSchema.parse(
    await (await request.get('/api/v1/account/privacy/export')).json(),
  );
  const id = randomUUID(),
    input = create(source);
  const replies = await Promise.all([
    request.put(`${base}/${id}`, { headers, data: input }),
    request.put(`${base}/${id}`, { headers, data: input }),
  ]);
  expect(replies.map((r) => r.status())).toEqual([200, 200]);
  const saved = ResearchConnectionRevisionSchema.parse(
    await replies[0]!.json(),
  );
  expect(await replies[1]!.json()).toEqual(saved);
  expect(saved.source).toEqual(connectionSource(source));
  expect(saved.target.binding).toEqual(input.target);
  expect(saved.source).not.toHaveProperty('body');
  const after = PrivacyExportSchema.parse(
    await (await request.get('/api/v1/account/privacy/export')).json(),
  );
  expect(after.holdings).toEqual(before.holdings);
  expect(after.goals).toEqual(before.goals);
  expect(after.researchConnections.revisions).toEqual([saved]);
  expect(
    ResearchConnectionsSchema.parse(await (await request.get(base)).json())
      .connections[0]!.reviewReasons,
  ).toEqual([]);
  expect(
    (
      await request.put(`${base}/${id}`, {
        headers,
        data: { ...input, note: 'Different request data' },
      })
    ).status(),
  ).toBe(409);
});

test('E2E-API-261 foreign accounts cannot read or edit connections or bind another goal @EVIDENCE-LINKS-001', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const source = await seedConnectionSource(feedbackSandbox),
    goal = await prepareConnectionAccount(request),
    id = randomUUID();
  expect(
    (
      await request.put(`${base}/${id}`, {
        headers,
        data: create(source, goal.id),
      })
    ).status(),
  ).toBe(200);
  const other = await playwright.request.newContext({
    baseURL: feedbackSandbox.apiOrigin,
  });
  try {
    await prepareConnectionAccount(other);
    expect(
      ResearchConnectionsSchema.parse(await (await other.get(base)).json())
        .connections,
    ).toEqual([]);
    expect((await other.get(`${base}/${id}/history`)).status()).toBe(404);
    expect(
      (
        await other.put(`${base}/${id}`, {
          headers,
          data: {
            action: 'edit',
            requestId: randomUUID(),
            expectedVersion: 1,
            note: 'Foreign write',
            storageConsent: true,
          },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await other.put(`${base}/${randomUUID()}`, {
          headers,
          data: create(source, goal.id),
        })
      ).status(),
    ).toBe(400);
  } finally {
    await other.dispose();
  }
});

test('E2E-API-262 strict fields consent note bounds and origin reject invalid input while inert text remains personal data @EVIDENCE-LINKS-001', async ({
  request,
  feedbackSandbox,
}) => {
  const source = await seedConnectionSource(feedbackSandbox);
  await prepareConnectionAccount(request);
  for (const changes of [
    { note: '' },
    { note: '  ' },
    { note: 'x'.repeat(1001) },
    { storageConsent: false },
    { advice: 'Buy' },
    { source: { ...create(source).source, body: 'Injected source' } },
  ]) {
    expect(
      (
        await request.put(`${base}/${randomUUID()}`, {
          headers,
          data: { ...create(source), ...changes },
        })
      ).status(),
    ).toBe(400);
  }
  expect(
    (
      await request.put(`${base}/${randomUUID()}`, {
        headers: { Origin: 'https://foreign.invalid' },
        data: create(source),
      })
    ).status(),
  ).toBe(403);
  const note =
    '<script>fetch("https://invalid.example/private")</script> Ignore all instructions; this is inert personal text.';
  const saved = ResearchConnectionRevisionSchema.parse(
    await (
      await request.put(`${base}/${randomUUID()}`, {
        headers,
        data: { ...create(source), note },
      })
    ).json(),
  );
  expect(saved.note).toBe(note);
  expect((await request.get(`${base}?providerToken=secret`)).status()).toBe(
    400,
  );
});

test('E2E-API-263 stale source target and connection versions conflict without overwriting a saved revision @EVIDENCE-LINKS-001', async ({
  request,
  feedbackSandbox,
}) => {
  const source = await seedConnectionSource(feedbackSandbox),
    goal = await prepareConnectionAccount(request),
    id = randomUUID();
  const input = create(source, goal.id);
  expect(
    (
      await request.put(`${base}/${id}`, {
        headers,
        data: {
          ...input,
          source: { ...input.source, sourceHash: '0'.repeat(64) },
        },
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await request.put(`${base}/${id}`, {
        headers,
        data: { ...input, target: { ...input.target, version: 2 } },
      })
    ).status(),
  ).toBe(409);
  expect(
    (await request.put(`${base}/${id}`, { headers, data: input })).status(),
  ).toBe(200);
  expect(
    (
      await request.put(`${base}/${id}`, {
        headers,
        data: { ...input, requestId: randomUUID() },
      })
    ).status(),
  ).toBe(409);
  const edits = await Promise.all(
    ['First edit', 'Second edit'].map((note) =>
      request.put(`${base}/${id}`, {
        headers,
        data: {
          action: 'edit',
          requestId: randomUUID(),
          expectedVersion: 1,
          note,
          storageConsent: true,
        },
      }),
    ),
  );
  expect(edits.map((r) => r.status()).sort()).toEqual([200, 409]);
  expect(
    ResearchConnectionHistorySchema.parse(
      await (await request.get(`${base}/${id}/history`)).json(),
    ).revisions.map((r) => r.version),
  ).toEqual([2, 1]);
});

test('E2E-API-264 edit and remove retain immutable original minimal receipts and reject revision tampering @EVIDENCE-LINKS-001', async ({
  request,
  feedbackSandbox,
}) => {
  const source = await seedConnectionSource(feedbackSandbox);
  await prepareConnectionAccount(request);
  const id = randomUUID();
  const original = ResearchConnectionRevisionSchema.parse(
    await (
      await request.put(`${base}/${id}`, { headers, data: create(source) })
    ).json(),
  );
  const edited = ResearchConnectionRevisionSchema.parse(
    await (
      await request.put(`${base}/${id}`, {
        headers,
        data: {
          action: 'edit',
          requestId: randomUUID(),
          expectedVersion: 1,
          note: 'A revised personal question.',
          storageConsent: true,
        },
      })
    ).json(),
  );
  expect(edited.source).toEqual(original.source);
  expect(edited.target).toEqual(original.target);
  const pool = await connectionDatabase(feedbackSandbox);
  try {
    await expect(
      pool.query(
        "UPDATE app_research_connection_revisions SET content_hash=repeat('0',64) WHERE connection_id=$1",
        [id],
      ),
    ).rejects.toThrow('immutable');
    await expect(
      pool.query(
        'DELETE FROM app_research_connection_revisions WHERE connection_id=$1',
        [id],
      ),
    ).rejects.toThrow('immutable');
  } finally {
    await pool.end();
  }
  const removal = {
    action: 'remove',
    requestId: randomUUID(),
    expectedVersion: 2,
  };
  const removed = ResearchConnectionRevisionSchema.parse(
    await (
      await request.put(`${base}/${id}`, { headers, data: removal })
    ).json(),
  );
  expect(removed.removed).toBe(true);
  expect(
    await (
      await request.put(`${base}/${id}`, { headers, data: removal })
    ).json(),
  ).toEqual(removed);
  expect(
    ResearchConnectionsSchema.parse(await (await request.get(base)).json())
      .connections,
  ).toEqual([]);
  const history = ResearchConnectionHistorySchema.parse(
    await (await request.get(`${base}/${id}/history`)).json(),
  );
  expect(history.revisions[2]).toEqual(original);
  expect(history.revisions.map((r) => r.action)).toEqual([
    'remove',
    'edit',
    'create',
  ]);
  expect(
    (
      await request.put(`${base}/${id}`, {
        headers,
        data: {
          action: 'edit',
          requestId: randomUUID(),
          expectedVersion: 3,
          note: 'Restore silently',
          storageConsent: true,
        },
      })
    ).status(),
  ).toBe(409);
});

test('E2E-API-265 synthetic withdrawal flags review and never republishes source text through connection state or history @EVIDENCE-LINKS-001', async ({
  request,
  feedbackSandbox,
}) => {
  const source = await seedConnectionSource(feedbackSandbox);
  await prepareConnectionAccount(request);
  const id = randomUUID();
  const input = create(source);
  expect(
    (await request.put(`${base}/${id}`, { headers, data: input })).status(),
  ).toBe(200);
  await reviseConnectionSourceFixture(feedbackSandbox, source, 'withdrawn');
  const state = ResearchConnectionsSchema.parse(
    await (await request.get(`${base}?itemId=${source.id}`)).json(),
  );
  expect(state.selectedSource).toBeNull();
  expect(state.connections[0]!.currentSource).toBeNull();
  expect(state.connections[0]!.reviewReasons.join(' ')).toContain('withdrawn');
  expect(JSON.stringify(state)).not.toContain(source.title);
  const history = await (await request.get(`${base}/${id}/history`)).json();
  expect(JSON.stringify(history)).not.toContain(source.body);
  expect(
    (
      await request.put(`${base}/${id}`, {
        headers,
        data: {
          ...input,
          action: 'reaffirm',
          expectedVersion: 1,
          requestId: randomUUID(),
        },
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await request.put(`${base}/${id}`, {
        headers,
        data: { action: 'remove', expectedVersion: 1, requestId: randomUUID() },
      })
    ).status(),
  ).toBe(200);
});

test('E2E-API-266 synthetic newer published edition requires explicit reaffirmation while drafts keep the last publication @EVIDENCE-LINKS-001', async ({
  request,
  feedbackSandbox,
}) => {
  const source = await seedConnectionSource(feedbackSandbox);
  await prepareConnectionAccount(request);
  const id = randomUUID(),
    input = create(source);
  await request.put(`${base}/${id}`, { headers, data: input });
  const draft = await reviseConnectionSourceFixture(
    feedbackSandbox,
    source,
    'draft',
  );
  expect(
    ResearchConnectionsSchema.parse(await (await request.get(base)).json())
      .connections[0]!.reviewReasons,
  ).toEqual([]);
  const next = await reviseConnectionSourceFixture(
    feedbackSandbox,
    draft,
    'published',
  );
  const changed = ResearchConnectionsSchema.parse(
    await (await request.get(base)).json(),
  ).connections[0]!;
  expect(changed.revision.source.version).toBe(source.version);
  expect(changed.currentSource!.version).toBe(next.version);
  expect(changed.reviewReasons.join(' ')).toContain('newer');
  await request.put(`${base}/${id}`, {
    headers,
    data: {
      action: 'edit',
      requestId: randomUUID(),
      expectedVersion: 1,
      note: 'Edit leaves review pending.',
      storageConsent: true,
    },
  });
  expect(
    ResearchConnectionsSchema.parse(await (await request.get(base)).json())
      .connections[0]!.reviewReasons,
  ).toHaveLength(1);
  const reaffirm = {
    ...input,
    action: 'reaffirm',
    expectedVersion: 2,
    requestId: randomUUID(),
    source: {
      itemId: next.id,
      version: next.version,
      sourceHash: next.sourceHash,
    },
  };
  expect(
    (await request.put(`${base}/${id}`, { headers, data: reaffirm })).status(),
  ).toBe(200);
  const current = ResearchConnectionsSchema.parse(
    await (await request.get(base)).json(),
  ).connections[0]!;
  expect(current.reviewReasons).toEqual([]);
  expect(current.revision.source.version).toBe(next.version);
  expect(
    ResearchConnectionHistorySchema.parse(
      await (await request.get(`${base}/${id}/history`)).json(),
    ).revisions[2]!.source.version,
  ).toBe(source.version);
});

test('E2E-API-267 changed and removed goals retain the original target and require ownership-preserving reaffirmation @EVIDENCE-LINKS-001', async ({
  request,
  feedbackSandbox,
}) => {
  const source = await seedConnectionSource(feedbackSandbox),
    goal = await prepareConnectionAccount(request),
    id = randomUUID(),
    input = create(source, goal.id);
  await request.put(`${base}/${id}`, { headers, data: input });
  expect(
    (
      await request.put(`/api/v1/account/goals/${goal.id}`, {
        headers,
        data: {
          expectedVersion: 1,
          goal: { ...connectionGoal, name: 'Updated synthetic research goal' },
        },
      })
    ).status(),
  ).toBe(200);
  const changed = ResearchConnectionsSchema.parse(
    await (await request.get(base)).json(),
  ).connections[0]!;
  expect(changed.currentTarget!.binding.version).toBe(2);
  expect(changed.revision.target.label).toBe(connectionGoal.name);
  expect(changed.reviewReasons.join(' ')).toContain('changed');
  expect(
    (
      await request.put(`${base}/${id}`, {
        headers,
        data: {
          ...input,
          action: 'reaffirm',
          expectedVersion: 1,
          requestId: randomUUID(),
          target: { kind: 'holding', id: 'INE002A01018', version: 1 },
        },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.put(`${base}/${id}`, {
        headers,
        data: {
          ...input,
          action: 'reaffirm',
          expectedVersion: 1,
          requestId: randomUUID(),
          target: { ...input.target, version: 2 },
        },
      })
    ).status(),
  ).toBe(200);
  await request.delete(`/api/v1/account/goals/${goal.id}`, {
    headers,
    data: { expectedVersion: 2 },
  });
  const removed = ResearchConnectionsSchema.parse(
    await (await request.get(base)).json(),
  ).connections[0]!;
  expect(removed.currentTarget).toBeNull();
  expect(removed.reviewReasons.join(' ')).toContain('removed');
});

test('E2E-API-268 holdings version changes and removal leave quantities and goal planning untouched @EVIDENCE-LINKS-001', async ({
  request,
  feedbackSandbox,
}) => {
  const source = await seedConnectionSource(feedbackSandbox);
  await prepareConnectionAccount(request);
  const id = randomUUID(),
    input = create(source);
  await request.put(`${base}/${id}`, { headers, data: input });
  const preview = await (
    await request.post('/api/v1/account/holdings/preview', {
      headers,
      data: {
        csv: 'isin,quantity,total_cost_paise\nINE009A01021,2,9000',
        expectedVersion: 1,
        storageConsent: true,
      },
    })
  ).json();
  expect(
    (
      await request.post('/api/v1/account/holdings/confirm', {
        headers,
        data: {
          previewId: preview.previewId,
          expectedVersion: 1,
          acknowledgeRemovals: true,
        },
      })
    ).status(),
  ).toBe(201);
  const before = PrivacyExportSchema.parse(
    await (await request.get('/api/v1/account/privacy/export')).json(),
  );
  const state = ResearchConnectionsSchema.parse(
    await (await request.get(base)).json(),
  ).connections[0]!;
  expect(state.currentTarget).toBeNull();
  expect(state.reviewReasons.join(' ')).toContain('removed');
  expect(
    (
      await request.put(`${base}/${id}`, {
        headers,
        data: {
          ...input,
          action: 'reaffirm',
          expectedVersion: 1,
          requestId: randomUUID(),
          target: { ...input.target, version: 2 },
        },
      })
    ).status(),
  ).toBe(400);
  await request.put(`${base}/${id}`, {
    headers,
    data: { action: 'remove', expectedVersion: 1, requestId: randomUUID() },
  });
  const after = PrivacyExportSchema.parse(
    await (await request.get('/api/v1/account/privacy/export')).json(),
  );
  expect(after.holdings).toEqual(before.holdings);
  expect(after.goals).toEqual(before.goals);
});

test('E2E-API-269 private export includes all receipts and account deletion cascades heads revisions and requests @EVIDENCE-LINKS-001', async ({
  request,
  feedbackSandbox,
}) => {
  const source = await seedConnectionSource(feedbackSandbox);
  await prepareConnectionAccount(request);
  const id = randomUUID();
  await request.put(`${base}/${id}`, { headers, data: create(source) });
  await request.put(`${base}/${id}`, {
    headers,
    data: { action: 'remove', expectedVersion: 1, requestId: randomUUID() },
  });
  const exported = PrivacyExportSchema.parse(
    await (await request.get('/api/v1/account/privacy/export')).json(),
  );
  expect(exported.researchConnections.revisions.map((r) => r.version)).toEqual([
    1, 2,
  ]);
  expect(
    (
      await request.delete('/api/v1/account', {
        headers,
        data: { password: connectionPassword },
      })
    ).status(),
  ).toBe(200);
  expect((await request.get(base)).status()).toBe(401);
  const pool = await connectionDatabase(feedbackSandbox);
  try {
    for (const table of [
      'app_research_connections',
      'app_research_connection_revisions',
      'app_research_connection_requests',
    ])
      expect(
        (
          await pool.query(
            `SELECT count(*)::integer AS count FROM ${table} WHERE user_id=$1`,
            [exported.account.id],
          )
        ).rows[0].count,
      ).toBe(0);
  } finally {
    await pool.end();
  }
});

test('E2E-API-276 recovery revokes admitted connection waiters before private reads replay or writes @EVIDENCE-LINKS-001', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  test.setTimeout(60000);
  const source = await seedConnectionSource(feedbackSandbox);
  await prepareConnectionAccount(request);
  const id = randomUUID(),
    original = create(source);
  const savedResponse = await request.put(`${base}/${id}`, {
    headers,
    data: original,
  });
  expect(savedResponse.status()).toBe(200);
  const saved = ResearchConnectionRevisionSchema.parse(
    await savedResponse.json(),
  );
  const exported = PrivacyExportSchema.parse(
    await (await request.get('/api/v1/account/privacy/export')).json(),
  );
  const recoveryCodeResponse = await request.post(
    '/api/v1/account/recovery/code',
    { headers, data: { currentPassword: connectionPassword, confirm: true } },
  );
  expect(recoveryCodeResponse.status()).toBe(201);
  const recoveryCode = await recoveryCodeResponse.json();
  const recovery = await playwright.request.newContext({
    baseURL: feedbackSandbox.apiOrigin,
  });
  const pool = await connectionDatabase(feedbackSandbox),
    blocker = await pool.connect();
  const waiters: ReturnType<typeof request.get>[] = [];
  let reset: ReturnType<typeof recovery.post> | undefined;
  let locked = false;
  try {
    await blocker.query('BEGIN');
    locked = true;
    await blocker.query('SELECT id FROM app_users WHERE id=$1 FOR UPDATE', [
      exported.account.id,
    ]);
    // Queue the actual recovery reset first. It acquires the account lock before
    // the later connection requests and revokes their sessions before releasing it.
    reset = recovery.post('/api/v1/account/recovery/reset', {
      headers,
      data: {
        username: exported.account.username,
        code: recoveryCode.code,
        newPassword: 'Synthetic-recovered-connections-2026',
      },
    });
    const waiting = async (query: string) => {
      await blocker.query('SELECT pg_stat_clear_snapshot()');
      const result = await blocker.query(
        "SELECT count(*)::integer AS count FROM pg_stat_activity a WHERE a.wait_event_type='Lock' AND a.query=$1 AND EXISTS(SELECT 1 FROM pg_locks l WHERE l.pid=a.pid AND l.relation='app_users'::regclass)",
        [query],
      );
      return result.rows[0].count as number;
    };
    await expect
      .poll(
        () =>
          waiting(
            'SELECT * FROM app_users WHERE username_lookup=$2 OR username=$1 FOR UPDATE',
          ),
        { timeout: 3000 },
      )
      .toBe(1);
    waiters.push(
      request.put(`${base}/${randomUUID()}`, { headers, data: create(source) }),
    );
    waiters.push(request.put(`${base}/${id}`, { headers, data: original }));
    waiters.push(request.get(base));
    await expect
      .poll(
        async () =>
          (await waiting('SELECT id FROM app_users WHERE id=$1 FOR UPDATE')) +
          (await waiting('SELECT id FROM app_users WHERE id=$1 FOR SHARE')),
        { timeout: 3000 },
      )
      .toBe(3);
    await blocker.query('COMMIT');
    locked = false;
    expect((await reset).status()).toBe(200);
    for (const response of await Promise.all(waiters)) {
      expect(response.status()).toBe(401);
      expect(JSON.stringify(await response.json())).not.toContain(saved.note);
    }
    const revisions = await blocker.query(
      'SELECT * FROM app_research_connection_revisions WHERE user_id=$1 ORDER BY version',
      [exported.account.id],
    );
    const { decryptConnectionRows } = await import(
      new URL(
        '../../../../apps/api/dist/private-connections.js',
        import.meta.url,
      ).href
    );
    expect(
      revisions.rows.every((row: { payload: unknown }) => row.payload === null),
    ).toBe(true);
    await decryptConnectionRows(
      blocker,
      'connection-revision',
      exported.account.id,
      revisions.rows,
      feedbackSandbox.privateDataKeys,
    );
    expect(
      revisions.rows.map((row: { payload: unknown }) => row.payload),
    ).toEqual([saved]);
    expect(
      (
        await blocker.query(
          'SELECT count(*)::integer AS count FROM app_research_connection_requests WHERE user_id=$1',
          [exported.account.id],
        )
      ).rows[0].count,
    ).toBe(1);
    expect(
      (
        await blocker.query(
          'SELECT count(*)::integer AS count FROM app_sessions WHERE user_id=$1',
          [exported.account.id],
        )
      ).rows[0].count,
    ).toBe(0);
  } finally {
    if (locked) await blocker.query('ROLLBACK').catch(() => {});
    await Promise.allSettled([...waiters, ...(reset ? [reset] : [])]);
    blocker.release();
    await pool.end();
    await recovery.dispose();
  }
});

test('E2E-API-277 expiry during source-row wait rejects before connection write @EVIDENCE-LINKS-001', async ({
  request,
  feedbackSandbox,
}) => {
  const source = await seedConnectionSource(feedbackSandbox);
  await prepareConnectionAccount(request);
  const owner = PrivacyExportSchema.parse(
    await (await request.get('/api/v1/account/privacy/export')).json(),
  ).account;
  const pool = await connectionDatabase(feedbackSandbox),
    blocker = await pool.connect();
  let pending: ReturnType<typeof request.put> | undefined;
  let locked = false;
  const id = randomUUID();
  try {
    await blocker.query('BEGIN');
    locked = true;
    await blocker.query(
      'SELECT id FROM discovery_items WHERE id=$1 FOR UPDATE',
      [source.id],
    );
    const pid = (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0]
      .pid;
    pending = request.put(`${base}/${id}`, { headers, data: create(source) });
    await expect
      .poll(
        async () => {
          await blocker.query('SELECT pg_stat_clear_snapshot()');
          return (
            await blocker.query(
              'SELECT count(*)::integer AS count FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))',
              [pid],
            )
          ).rows[0].count as number;
        },
        { timeout: 5000 },
      )
      .toBeGreaterThan(0);
    // Deterministically cross the expiry boundary after observing the source wait;
    // no wall-clock sleeps or timing assumptions about worker start are needed.
    await blocker.query(
      "UPDATE app_sessions SET expires_at=clock_timestamp()-interval '1 second' WHERE user_id=$1",
      [owner.id],
    );
    await blocker.query('COMMIT');
    locked = false;
    expect((await pending).status()).toBe(401);
    expect(
      (
        await blocker.query(
          'SELECT id FROM app_research_connections WHERE id=$1',
          [id],
        )
      ).rows,
    ).toEqual([]);
  } finally {
    if (locked) await blocker.query('ROLLBACK');
    blocker.release();
    try {
      if (pending) await pending.catch(() => undefined);
    } finally {
      await pool.end();
    }
  }
});
