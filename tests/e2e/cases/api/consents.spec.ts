import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test, expect } from '../../helpers/app-fixture';
import {
  ConsentReceiptSchema,
  ConsentExportSchema,
  PrivacyExportSchema,
  AssistanceResultSchema,
  FeedItemSchema,
} from '../../../../packages/contracts/src/index';
import {
  consentPath,
  consentView,
  consentWrite,
  consentInput,
  externalPurpose,
  readingPurpose,
  schedulePurpose,
  scheduleConfig,
} from '../../helpers/consent-fixture';
import {
  connectionDatabase,
  connectionHeaders as headers,
  connectionPassword,
  connectionGoal,
  prepareConnectionAccount,
  seedConnectionSource,
} from '../../helpers/research-connection-fixture';
import {
  registerRecoverable,
  resetAheadOfOperation,
  openAuthDatabase,
} from '../../helpers/auth-wait';
import { waitForQueryBlocked } from '../../helpers/withdrawal-fixture';
test.use({
  trace: 'off',
  video: 'off',
  screenshot: 'off',
  manualWorkers: true,
});
function runWorker(sandbox: { databaseUrl: string; schema: string }) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        fileURLToPath(
          new URL('../../helpers/schedule-work-process.mjs', import.meta.url),
        ),
      ],
      { stdio: ['pipe', 'ignore', 'ignore'] },
    );
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(Error('Owned consent schedule worker timed out.'));
    }, 15000);
    child.once('error', () => {
      clearTimeout(timer);
      reject(Error('Owned consent worker could not start.'));
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(Error('Owned consent worker failed.'));
    });
    child.stdin.end(JSON.stringify(sandbox));
  });
}
test('E2E-API-760 consent strict review ownership Origin and exact replay preserve own records @CONSENT-LIFECYCLE-001', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  expect((await request.get(consentPath)).status()).toBe(401);
  await prepareConnectionAccount(request);
  const before = await consentView(request);
  expect(before.purposes).toHaveLength(4);
  expect(before.purposes.every((p) => p.status === 'not-granted')).toBe(true);
  const financial = {
    goals: await (await request.get('/api/v1/account/goals')).json(),
    holdings: await (await request.get('/api/v1/account/holdings')).json(),
  };
  const input = consentInput('grant', 0);
  for (const data of [
    { ...input, reviewed: false },
    { ...input, extra: true },
    { ...input, expectedVersion: -1 },
    { ...input, expiresAt: new Date(Date.now() - 1000).toISOString() },
    {
      ...input,
      expiresAt: new Date(Date.now() + 367 * 86400000).toISOString(),
    },
  ])
    expect(
      (
        await request.post(`${consentPath}/${externalPurpose}`, {
          headers,
          data,
        })
      ).status(),
    ).toBe(400);
  expect(
    (
      await request.post(`${consentPath}/${externalPurpose}`, {
        headers: { Origin: 'https://example.com' },
        data: input,
      })
    ).status(),
  ).toBe(403);
  for (const tail of [
    '?ownerId=' + before.ownerId,
    '/history?after=1',
    '/history?after=2&upper=1',
    '/history?upper=1&upper=2',
    '/history?upper=9223372036854775808',
  ])
    expect((await request.get(consentPath + tail)).status()).toBe(400);
  const responses = await Promise.all(
    [0, 1].map(() =>
      request.post(`${consentPath}/${externalPurpose}`, {
        headers,
        data: input,
      }),
    ),
  );
  expect(responses.map((r) => r.status())).toEqual([201, 201]);
  const receipt = ConsentReceiptSchema.parse(await responses[0]!.json());
  expect(await responses[1]!.json()).toEqual(receipt);
  await consentWrite(request, externalPurpose, 'revoke');
  expect(
    await (
      await request.post(`${consentPath}/${externalPurpose}`, {
        headers,
        data: input,
      })
    ).json(),
  ).toEqual(receipt);
  expect(
    (await consentView(request)).purposes.find(
      (p) => p.record.purpose === externalPurpose,
    )?.status,
  ).toBe('revoked');
  expect(
    (
      await request.post(`${consentPath}/${externalPurpose}`, {
        headers,
        data: {
          ...input,
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        },
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await request.post(`${consentPath}/${externalPurpose}`, {
        headers,
        data: { ...input, requestId: randomUUID() },
      })
    ).status(),
  ).toBe(409);
  const other = await playwright.request.newContext({
    baseURL: feedbackSandbox.apiOrigin,
  });
  try {
    await prepareConnectionAccount(other);
    expect(
      (await consentView(other)).purposes.every(
        (p) => p.status === 'not-granted',
      ),
    ).toBe(true);
    expect(
      ConsentExportSchema.parse(
        await (await other.get(consentPath + '/history')).json(),
      ).events,
    ).toEqual([]);
  } finally {
    await other.dispose();
  }
  expect({
    goals: await (await request.get('/api/v1/account/goals')).json(),
    holdings: await (await request.get('/api/v1/account/holdings')).json(),
  }).toEqual(financial);
});
test('E2E-API-761 actual dated reading opt-in revoke renewal and query assistance remain independent @CONSENT-LIFECYCLE-001', async ({
  request,
  feedbackSandbox,
}) => {
  await prepareConnectionAccount(request);
  const source = await seedConnectionSource(feedbackSandbox);
  const prefs = {
    mode: 'for_you',
    topics: source.topics.slice(0, 1),
    mutedTopics: [],
  };
  expect(
    (
      await request.put('/api/v1/account/library/preferences', {
        headers,
        data: prefs,
      })
    ).status(),
  ).toBe(200);
  let current = (await consentView(request)).purposes.find(
    (p) => p.record.purpose === readingPurpose,
  )!;
  expect(current.status).toBe('active');
  expect(current.record.basis?.kind).toBe('reading-preference-opt-in');
  await consentWrite(request, readingPurpose, 'revoke');
  const feed = await request.get('/api/v1/account/library/feed');
  expect(feed.status()).toBe(200);
  expect(Object.values((await feed.json()).whyShown).join(' ')).toContain(
    'Privacy',
  );
  expect(
    (
      await request.put('/api/v1/account/library/preferences', {
        headers,
        data: prefs,
      })
    ).status(),
  ).toBe(409);
  expect(
    (await (await request.get('/api/v1/account/library')).json()).preferences,
  ).toEqual(prefs);
  const assistance = await request.post('/api/v1/account/assistance', {
    headers,
    data: {
      query: 'Synthetic research goal',
      scope: 'goals',
      provider: 'query',
      useHistory: true,
    },
  });
  expect(assistance.status()).toBe(200);
  const answer = AssistanceResultSchema.parse(await assistance.json());
  expect(answer.provider).toBe('query');
  expect(answer.usedHistory).toBe(true);
  expect(
    (await consentView(request)).purposes.find(
      (p) => p.record.purpose === externalPurpose,
    )?.status,
  ).toBe('not-granted');
  await consentWrite(request, readingPurpose, 'renew');
  expect(
    (
      await request.put('/api/v1/account/library/preferences', {
        headers,
        data: prefs,
      })
    ).status(),
  ).toBe(200);
  current = (await consentView(request)).purposes.find(
    (p) => p.record.purpose === readingPurpose,
  )!;
  expect(current.record.version).toBe(3);
  const holdingHelp = await request.post('/api/v1/account/assistance', {
    headers,
    data: {
      query: 'INE002A01018',
      scope: 'holdings',
      provider: 'query',
      useHistory: true,
    },
  });
  expect(holdingHelp.status()).toBe(200);
  expect(
    AssistanceResultSchema.parse(await holdingHelp.json()).usedHistory,
  ).toBe(true);
  const bundle = JSON.parse(
    await readFile(
      new URL(
        '../../../../apps/web/src/offline/content-bundle.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as { feed: unknown[] };
  const term = bundle.feed
    .map((item) => FeedItemSchema.parse(item))
    .find(
      (item) =>
        item.kind === 'term' &&
        item.status === 'published' &&
        item.summary.length > 0 &&
        item.summary.length <= 700,
    );
  if (!term)
    throw Error('An actual published bundled learning term is required.');
  const pool = await connectionDatabase(feedbackSandbox);
  try {
    await pool.query('INSERT INTO discovery_items(id,version) VALUES($1,$2)', [
      term.id,
      term.version,
    ]);
    await pool.query(
      'INSERT INTO discovery_versions(item_id,version,data) VALUES($1,$2,$3)',
      [term.id, term.version, term],
    );
  } finally {
    await pool.end();
  }
  expect(
    (
      await request.put(`/api/v1/account/library/items/${term.id}/save`, {
        headers,
        data: { version: term.version },
      })
    ).status(),
  ).toBe(200);
  const learning = () =>
    request.post('/api/v1/account/assistance', {
      headers,
      data: {
        query: term.title,
        scope: 'learning',
        provider: 'query',
        useHistory: true,
      },
    });
  let learningResponse = await learning();
  expect(learningResponse.status()).toBe(200);
  expect(
    AssistanceResultSchema.parse(await learningResponse.json()).usedHistory,
  ).toBe(true);
  expect(
    (
      await request.delete(`/api/v1/account/library/items/${term.id}/save`, {
        headers,
      })
    ).status(),
  ).toBe(200);
  learningResponse = await learning();
  expect(learningResponse.status()).toBe(200);
  expect(
    AssistanceResultSchema.parse(await learningResponse.json()).usedHistory,
  ).toBe(false);
});
test('E2E-API-762 bounded immutable consent export follows numeric pages through concurrent additions and account cascade @CONSENT-LIFECYCLE-001', async ({
  request,
  feedbackSandbox,
}) => {
  await prepareConnectionAccount(request);
  await consentWrite(request, externalPurpose, 'grant');
  for (let version = 1; version <= 102; version++)
    expect(
      (
        await request.post(`${consentPath}/${externalPurpose}`, {
          headers,
          data: consentInput('renew', version),
        })
      ).status(),
    ).toBe(201);
  const exported = PrivacyExportSchema.parse(
    await (await request.get('/api/v1/account/privacy/export')).json(),
  );
  let page = exported.consents.history;
  const upper = page.upper,
    all = [...page.events];
  expect(page.events).toHaveLength(100);
  expect(page.next).not.toBeNull();
  await consentWrite(request, externalPurpose, 'revoke');
  while (page.next) {
    page = ConsentExportSchema.parse(
      await (
        await request.get(
          consentPath +
            '/history?' +
            new URLSearchParams({ after: page.next, upper }),
        )
      ).json(),
    );
    all.push(...page.events);
  }
  expect(all).toHaveLength(103);
  expect(new Set(all.map((e) => e.sequence)).size).toBe(103);
  expect(all.at(-1)?.sequence).toBe(upper);
  const pool = await connectionDatabase(feedbackSandbox);
  try {
    await expect(
      pool.query(
        'UPDATE account_consent_events SET payload=payload WHERE user_id=$1',
        [exported.account.id],
      ),
    ).rejects.toThrow();
    expect(
      (
        await request.delete('/api/v1/account', {
          headers,
          data: { password: connectionPassword },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await pool.query(
          'SELECT sequence FROM account_consent_events WHERE user_id=$1',
          [exported.account.id],
        )
      ).rows,
    ).toEqual([]);
    expect(
      (
        await pool.query(
          'SELECT purpose FROM account_consent_heads WHERE user_id=$1',
          [exported.account.id],
        )
      ).rows,
    ).toEqual([]);
  } finally {
    await pool.end();
  }
});
test('E2E-API-763 real schedule worker denies expired purpose and renewal records next future due without catch-up @CONSENT-LIFECYCLE-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await prepareConnectionAccount(request);
  const id = randomUUID();
  const input = {
    requestId: randomUUID(),
    expectedVersion: 0,
    action: 'save',
    config: scheduleConfig,
    consent: true,
  };
  const saved = await request.post(`/api/v1/account/report-schedules/${id}`, {
    headers,
    data: input,
  });
  expect(saved.status()).toBe(201);
  const original = await saved.json();
  expect(
    (await consentView(request)).purposes.find(
      (p) => p.record.purpose === schedulePurpose,
    )?.record.basis?.kind,
  ).toBe('schedule-opt-in');
  const pool = await connectionDatabase(feedbackSandbox);
  try {
    // Clock anomaly fixture alters only the mutable head; no fabricated decision receipt.
    const grantedAt = new Date(Date.now() - 7200000).toISOString(),
      expiresAt = new Date(Date.now() - 3600000).toISOString();
    await pool.query(
      "UPDATE account_consent_heads SET payload=payload || jsonb_build_object('grantedAt',$1::text,'changedAt',$1::text,'expiresAt',$2::text,'basis',jsonb_build_object('kind','review','recordedAt',$1::text)) WHERE purpose=$3",
      [grantedAt, expiresAt, schedulePurpose],
    );
    const due = new Date(Date.now() - 86400000).toISOString();
    await pool.query(
      "UPDATE report_schedules SET next_due_at=$2::text::timestamptz,payload=jsonb_set(payload,'{nextDueAt}',to_jsonb($2::text)) WHERE id=$1",
      [id, due],
    );
    await runWorker(feedbackSandbox);
    expect(
      (await pool.query('SELECT payload FROM report_schedule_occurrences'))
        .rows,
    ).toEqual([]);
    expect(
      (await pool.query('SELECT id FROM record_report_jobs')).rows,
    ).toEqual([]);
    expect(
      (await consentView(request)).purposes.find(
        (p) => p.record.purpose === schedulePurpose,
      )?.status,
    ).toBe('expired');
    const renewed = await consentWrite(request, schedulePurpose, 'renew');
    expect(renewed.receipt.scheduleEffects).toHaveLength(1);
    expect(
      Date.parse(renewed.receipt.scheduleEffects[0]!.nextDueAt),
    ).toBeGreaterThan(Date.now());
    await runWorker(feedbackSandbox);
    expect(
      (await pool.query('SELECT payload FROM report_schedule_occurrences'))
        .rows,
    ).toEqual([]);
    expect(
      (
        await pool.query(
          'SELECT payload FROM report_schedule_editions WHERE schedule_id=$1',
          [id],
        )
      ).rows[0].payload,
    ).toEqual(original.schedule);
    await pool.query(
      "UPDATE report_schedules SET next_due_at=$2::text::timestamptz,payload=jsonb_set(payload,'{nextDueAt}',to_jsonb($2::text)) WHERE id=$1",
      [id, due],
    );
    await runWorker(feedbackSandbox);
    expect(
      (await pool.query('SELECT id FROM record_report_jobs')).rows,
    ).toHaveLength(1);
    await consentWrite(request, schedulePurpose, 'revoke');
    expect(
      (
        await request.post(`/api/v1/account/report-schedules/${id}`, {
          headers,
          data: {
            action: 'pause',
            expectedVersion: 1,
            requestId: randomUUID(),
            consent: true,
          },
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await request.post(`/api/v1/account/report-schedules/${id}`, {
          headers,
          data: {
            action: 'resume',
            expectedVersion: 2,
            requestId: randomUUID(),
            consent: true,
          },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await request.post(`/api/v1/account/report-schedules/${id}`, {
          headers,
          data: {
            action: 'delete',
            expectedVersion: 2,
            requestId: randomUUID(),
            consent: true,
          },
        })
      ).status(),
    ).toBe(201);
    expect(
      (await pool.query('SELECT id FROM record_report_jobs')).rows,
    ).toHaveLength(1);
  } finally {
    await pool.end();
  }
});
test('E2E-API-764 recovery ahead of consent waiter returns401 and rolls back grant and event @CONSENT-LIFECYCLE-001 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const owner = await registerRecoverable(request),
    db = await openAuthDatabase(feedbackSandbox),
    resetRequest = await playwright.request.newContext({
      baseURL: feedbackSandbox.apiOrigin,
    });
  const input = consentInput('grant', 0);
  try {
    await resetAheadOfOperation({
      db,
      owner,
      resetRequest,
      operation: () =>
        request.post(`${consentPath}/${externalPurpose}`, {
          headers,
          data: input,
        }),
    });
    expect(
      (
        await db.query(
          'SELECT sequence FROM account_consent_events WHERE user_id=$1',
          [owner.id],
        )
      ).rows,
    ).toEqual([]);
    expect(
      (
        await db.query(
          'SELECT purpose FROM account_consent_heads WHERE user_id=$1',
          [owner.id],
        )
      ).rows,
    ).toEqual([]);
  } finally {
    await resetRequest.dispose();
    await db.close();
  }
});
test('E2E-API-765 final consent table wait rechecks actual session expiry before private list response @CONSENT-LIFECYCLE-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await prepareConnectionAccount(request);
  await consentWrite(request, externalPurpose, 'grant');
  const pool = await connectionDatabase(feedbackSandbox),
    observer = await connectionDatabase(feedbackSandbox);
  let pending: ReturnType<typeof request.get> | undefined;
  try {
    await pool.query('BEGIN');
    await pool.query(
      'LOCK TABLE account_consent_heads IN ACCESS EXCLUSIVE MODE',
    );
    const pid = Number(
      (await pool.query('SELECT pg_backend_pid() AS pid')).rows[0].pid,
    );
    pending = request.get(consentPath);
    await waitForQueryBlocked(
      observer,
      'SELECT payload FROM account_consent_heads WHERE user_id=$1 AND purpose=$2',
      [pid],
    );
    await observer.query(
      "UPDATE app_sessions SET expires_at=clock_timestamp()-interval '1 second'",
    );
    await pool.query('ROLLBACK');
    const response = await pending;
    expect(response.status()).toBe(401);
    expect(await response.text()).not.toContain('purpose-consent-v1');
  } finally {
    await pool.query('ROLLBACK');
    await pending?.catch(() => {});
    await pool.end();
    await observer.end();
  }
});
test('E2E-API-766 genuine legacy opt-in basis is read without writing and never inferred for external AI @CONSENT-LIFECYCLE-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await prepareConnectionAccount(request);
  const owner = (await consentView(request)).ownerId,
    pool = await connectionDatabase(feedbackSandbox);
  try {
    // Reproduce the actual pre-ledger persisted preference shape, with deliberately unknown date.
    await pool.query(
      'INSERT INTO library_preferences(user_id,data) VALUES($1,$2)',
      [owner, { mode: 'for_you', topics: [], mutedTopics: [] }],
    );
    for (let i = 0; i < 2; i++) {
      const view = await consentView(request),
        reading = view.purposes.find(
          (p) => p.record.purpose === readingPurpose,
        )!;
      expect(reading.status).toBe('legacy-active');
      expect(reading.record.grantedAt).toBeNull();
      expect(reading.record.basis?.kind).toBe('legacy-reading-preference');
      expect(
        view.purposes.find((p) => p.record.purpose === externalPurpose)?.status,
      ).toBe('not-granted');
    }
    expect(
      (await pool.query('SELECT sequence FROM account_consent_events')).rows,
    ).toEqual([]);
    expect(
      (await consentWrite(request, readingPurpose, 'renew')).receipt.before
        .version,
    ).toBe(0);
    expect(
      ConsentExportSchema.parse(
        await (await request.get(consentPath + '/history')).json(),
      ).events,
    ).toHaveLength(1);
  } finally {
    await pool.end();
  }
});
test('E2E-API-768 actual schedule source-record wait followed by purpose expiry rolls back snapshot occurrence and capacity @CONSENT-LIFECYCLE-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await prepareConnectionAccount(request);
  const id = randomUUID();
  expect(
    (
      await request.post(`/api/v1/account/report-schedules/${id}`, {
        headers,
        data: {
          requestId: randomUUID(),
          expectedVersion: 0,
          action: 'save',
          config: scheduleConfig,
          consent: true,
        },
      })
    ).status(),
  ).toBe(201);
  const pool = await connectionDatabase(feedbackSandbox),
    observer = await connectionDatabase(feedbackSandbox);
  let pending: Promise<void> | undefined;
  try {
    const due = new Date(Date.now() - 86400000).toISOString();
    await pool.query(
      "UPDATE report_schedules SET next_due_at=$2::text::timestamptz,payload=jsonb_set(payload,'{nextDueAt}',to_jsonb($2::text)) WHERE id=$1",
      [id, due],
    );
    await pool.query('BEGIN');
    await pool.query('LOCK TABLE app_goal_revisions IN ACCESS EXCLUSIVE MODE');
    const pid = Number(
      (await pool.query('SELECT pg_backend_pid() AS pid')).rows[0].pid,
    );
    pending = runWorker(feedbackSandbox);
    pending.catch(() => {});
    await waitForQueryBlocked(
      observer,
      'SELECT r.payload FROM app_goals g JOIN app_goal_revisions r ON r.goal_id=g.id AND r.version=g.version WHERE g.user_id=$1 AND g.deleted_at IS NULL ORDER BY g.id',
      [pid],
    );
    // Test-only clock-state fault is independent of the held account lock.
    const grantedAt = new Date(Date.now() - 7200000).toISOString(),
      expiresAt = new Date(Date.now() - 1000).toISOString();
    await observer.query(
      "UPDATE account_consent_heads SET payload=payload || jsonb_build_object('grantedAt',$1::text,'changedAt',$1::text,'expiresAt',$2::text,'basis',jsonb_build_object('kind','review','recordedAt',$1::text)) WHERE purpose=$3",
      [grantedAt, expiresAt, schedulePurpose],
    );
    await pool.query('ROLLBACK');
    await pending;
    for (const table of [
      'record_report_jobs',
      'record_report_request_limits',
      'report_schedule_occurrences',
    ])
      expect(
        (await observer.query(`SELECT count(*)::int AS count FROM ${table}`))
          .rows[0].count,
      ).toBe(0);
    expect(
      (
        await observer.query(
          'SELECT next_due_at FROM report_schedules WHERE id=$1',
          [id],
        )
      ).rows[0].next_due_at.toISOString(),
    ).toBe(due);
  } finally {
    await pool.query('ROLLBACK');
    await pending?.catch(() => {});
    await pool.end();
    await observer.end();
  }
});
test('E2E-API-767 actual controller dispatch admission blocks revoked sharing and discards results after consent or saved goal changes @CONSENT-LIFECYCLE-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const goal = await prepareConnectionAccount(request);
  const storage = await request.storageState(),
    cookie = storage.cookies.find((c) => c.name === 'f360_session');
  if (!cookie) throw Error('Actual owned account session required.');
  const run = (hold: boolean, holdBeforeDispatch = false) => {
    const child = spawn(
      process.execPath,
      [
        fileURLToPath(
          new URL(
            '../../helpers/consent-dispatch-process.mjs',
            import.meta.url,
          ),
        ),
      ],
      { stdio: ['pipe', 'pipe', 'ignore'] },
    );
    let dispatch!: () => void,
      loaded!: () => void,
      complete!: (v: {
        calls: number;
        network: number;
        result: unknown;
      }) => void,
      failed!: (e: Error) => void;
    const beforeDispatch = new Promise<void>((resolve) => {
      loaded = resolve;
    });
    const dispatched = new Promise<void>((resolve) => {
        dispatch = resolve;
      }),
      result = new Promise<{ calls: number; network: number; result: unknown }>(
        (resolve, reject) => {
          complete = resolve;
          failed = reject;
        },
      );
    let buffer = '';
    child.stdout.on('data', (chunk) => {
      buffer += String(chunk);
      for (;;) {
        const end = buffer.indexOf('\n');
        if (end < 0) break;
        const value = JSON.parse(buffer.slice(0, end));
        buffer = buffer.slice(end + 1);
        if (value.phase === 'dispatched') dispatch();
        if (value.phase === 'loaded') loaded();
        if (value.phase === 'result') complete(value);
        if (value.phase === 'failure') failed(Error(JSON.stringify(value)));
      }
    });
    const exited = new Promise<void>((resolve) => {
      child.once('error', () => {
        failed(Error('Owned consent simulation could not start.'));
        resolve();
      });
      child.once('exit', (code) => {
        if (code !== 0) failed(Error('Owned consent simulation failed.'));
        resolve();
      });
    });
    const timer = setTimeout(() => {
      failed(Error('Owned consent simulation timed out.'));
      child.kill('SIGKILL');
    }, 15000);
    void exited.then(() => clearTimeout(timer));
    result.catch(() => {});
    child.stdin.write(
      JSON.stringify({
        databaseUrl: feedbackSandbox.databaseUrl,
        schema: feedbackSandbox.schema,
        origin: headers.Origin,
        cookie: `f360_session=${cookie.value}`,
        hold,
        holdBeforeDispatch,
      }) + '\n',
    );
    let released = false;
    return {
      dispatched,
      beforeDispatch,
      result,
      release() {
        if (!released) {
          released = true;
          child.stdin.end('release\n');
        }
      },
      async close() {
        if (child.exitCode === null) child.kill('SIGTERM');
        await exited;
      },
    };
  };
  const blocked = run(false);
  try {
    const result = await blocked.result;
    expect(result.calls).toBe(0);
    expect(result.network).toBe(0);
    expect(AssistanceResultSchema.parse(result.result).usedHistory).toBe(true);
  } finally {
    await blocked.close();
  }
  await consentWrite(request, externalPurpose, 'grant');
  const admitted = run(true);
  try {
    await Promise.race([
      admitted.dispatched,
      admitted.result.then(() => {
        throw Error('Private dispatch was not admitted.');
      }),
    ]);
    // These real HTTP writes must finish while the synthetic transport remains pending.
    await consentWrite(request, externalPurpose, 'revoke');
    await consentWrite(request, externalPurpose, 'renew');
    admitted.release();
    const output = await admitted.result;
    expect(output.calls).toBe(1);
    expect(output.network).toBe(0);
    const result = AssistanceResultSchema.parse(output.result);
    expect(result.provider).toBe('query');
    expect(result.fallback).toBe(true);
    expect(result.message).toContain('discarded');
    expect(result.usedHistory).toBe(true);
  } finally {
    admitted.release();
    await admitted.close();
  }
  const changed = run(true);
  try {
    await Promise.race([
      changed.dispatched,
      changed.result.then(() => {
        throw Error('Private dispatch was not admitted.');
      }),
    ]);
    expect(
      (
        await request.delete(`/api/v1/account/goals/${goal.id}`, {
          headers,
          data: { expectedVersion: goal.version },
        })
      ).status(),
    ).toBe(200);
    changed.release();
    const output = await changed.result,
      result = AssistanceResultSchema.parse(output.result);
    expect(output.calls).toBe(1);
    expect(output.network).toBe(0);
    expect(result.usedHistory).toBe(false);
    expect(JSON.stringify(result)).not.toContain('Synthetic research goal');
  } finally {
    changed.release();
    await changed.close();
  }
  const created = await request.post('/api/v1/account/goals', {
    headers,
    data: connectionGoal,
  });
  expect(created.status()).toBe(201);
  const nextGoal = await created.json();
  const before = run(false, true);
  try {
    await Promise.race([
      before.beforeDispatch,
      before.result.then(() => {
        throw Error('Private candidate load was not observed.');
      }),
    ]);
    expect(
      (
        await request.put(`/api/v1/account/goals/${nextGoal.id}`, {
          headers,
          data: {
            expectedVersion: nextGoal.version,
            goal: { ...connectionGoal, name: 'Changed private goal name' },
          },
        })
      ).status(),
    ).toBe(200);
    before.release();
    const output = await before.result;
    expect(output.calls).toBe(0);
    expect(output.network).toBe(0);
    expect(JSON.stringify(output.result)).not.toContain(
      'Synthetic research goal',
    );
  } finally {
    before.release();
    await before.close();
  }
});
