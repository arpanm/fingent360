import { randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/app-fixture';
import {
  MaterialReceiptSchema,
  MaterialExportSchema,
  PrivacyExportSchema,
} from '../../../../packages/contracts/src/index';
import {
  connectionDatabase,
  connectionHeaders,
  connectionPassword,
  prepareConnectionAccount,
} from '../../helpers/research-connection-fixture';
import {
  materialPath,
  materialView,
  materialWrite,
  followMaterial,
  configureMaterial,
  seedMaterialObservation,
  seedActualMaterial,
  gdp,
  cpi,
} from '../../helpers/material-alert-fixture';
import {
  openAuthDatabase,
  registerRecoverable,
  resetAheadOfOperation,
} from '../../helpers/auth-wait';
import { waitForQueryBlocked } from '../../helpers/withdrawal-fixture';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });

test('E2E-API-660 material opt-in validates ownership bounds consent and exact request replay without changing financial records @MATERIAL-ALERTS-001 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  expect((await request.get(materialPath)).status()).toBe(401);
  await prepareConnectionAccount(request);
  await followMaterial(request);
  await seedMaterialObservation(feedbackSandbox, 2020, '1');
  const financialBefore = {
    goals: await (await request.get('/api/v1/account/goals')).json(),
    holdings: await (await request.get('/api/v1/account/holdings')).json(),
  };
  const initial = await materialView(request);
  expect(initial.state.version).toBe(0);
  expect(initial.state.notices).toEqual([]);
  for (const suffix of [
    '?extra=1',
    '/history?after=1',
    '/history?after=2&upper=1',
    '/history?upper=9223372036854775808',
    '/history?upper=1&upper=2',
    '/history?ownerId=' + randomUUID(),
  ])
    expect((await request.get(materialPath + suffix)).status()).toBe(400);
  const input = {
    action: 'configure',
    requestId: randomUUID(),
    expectedVersion: 0,
    policies: [{ indicator: gdp, thresholdPoints: '1' }],
    storageConsent: true,
  };
  for (const data of [
    { ...input, extra: true },
    { ...input, storageConsent: false },
    { ...input, policies: [{ indicator: gdp, thresholdPoints: '0' }] },
    { ...input, policies: [{ indicator: gdp, thresholdPoints: '101' }] },
    { ...input, policies: [...input.policies, ...input.policies] },
  ])
    expect(
      (
        await request.post(materialPath, { headers: connectionHeaders, data })
      ).status(),
    ).toBe(400);
  expect(
    (
      await request.post(materialPath, {
        headers: { Origin: 'https://example.com' },
        data: input,
      })
    ).status(),
  ).toBe(403);
  const saved = await request.post(materialPath, {
    headers: connectionHeaders,
    data: input,
  });
  expect(saved.status()).toBe(200);
  const receipt = MaterialReceiptSchema.parse(await saved.json());
  expect(receipt.state.baselines[0]?.observation?.value).toBe('1');
  expect(
    await (
      await request.post(materialPath, {
        headers: connectionHeaders,
        data: input,
      })
    ).json(),
  ).toEqual(receipt);
  expect(
    (
      await request.post(materialPath, {
        headers: connectionHeaders,
        data: { ...input, policies: [] },
      })
    ).status(),
  ).toBe(409);
  const other = await playwright.request.newContext({
    baseURL: feedbackSandbox.apiOrigin,
  });
  try {
    await prepareConnectionAccount(other);
    await followMaterial(other);
    expect((await materialView(other)).state.policies).toEqual([]);
    expect(
      (await other.get(materialPath + '?ownerId=' + randomUUID())).status(),
    ).toBe(400);
    expect(
      MaterialExportSchema.parse(
        await (await other.get(materialPath + '/history')).json(),
      ).events,
    ).toEqual([]);
  } finally {
    await other.dispose();
  }
  expect({
    goals: await (await request.get('/api/v1/account/goals')).json(),
    holdings: await (await request.get('/api/v1/account/holdings')).json(),
  }).toEqual(financialBefore);
});

test('E2E-API-661 exact two-series batch advances below-threshold baseline handles revisions and coalesces immutable acknowledged notices @MATERIAL-ALERTS-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await prepareConnectionAccount(request);
  await followMaterial(request);
  await seedMaterialObservation(feedbackSandbox, 2020, '1');
  await seedMaterialObservation(
    feedbackSandbox,
    2020,
    '-0.000000000000000000000000000001',
    cpi,
  );
  await configureMaterial(request, [gdp, cpi]);
  await seedMaterialObservation(feedbackSandbox, 2021, '1.6');
  await seedMaterialObservation(feedbackSandbox, 2021, '1', cpi);
  let { receipt } = await materialWrite(request, { action: 'check' });
  expect(receipt.outcomes.find((r) => r.indicator === gdp)?.outcome).toBe(
    'below-threshold',
  );
  expect(
    receipt.outcomes.find((r) => r.indicator === cpi)?.differencePoints,
  ).toBe('1.000000000000000000000000000001');
  await seedMaterialObservation(feedbackSandbox, 2022, '2.2');
  receipt = (await materialWrite(request, { action: 'check' })).receipt;
  expect(receipt.outcomes.find((r) => r.indicator === gdp)?.before?.value).toBe(
    '1.6',
  );
  expect(receipt.outcomes.find((r) => r.indicator === gdp)?.outcome).toBe(
    'below-threshold',
  );
  await seedMaterialObservation(feedbackSandbox, 2022, '8');
  receipt = (await materialWrite(request, { action: 'check' })).receipt;
  expect(receipt.outcomes.find((r) => r.indicator === gdp)?.outcome).toBe(
    'revision',
  );
  expect(receipt.state.notices.some((n) => n.indicator === gdp)).toBe(false);
  await seedMaterialObservation(feedbackSandbox, 2023, '10');
  const first = await materialWrite(request, { action: 'check' });
  await materialWrite(request, {
    action: 'acknowledge',
    indicator: gdp,
    noticeVersion: 1,
    read: true,
  });
  await materialWrite(request, {
    action: 'acknowledge',
    indicator: gdp,
    noticeVersion: 1,
    read: false,
  });
  await seedMaterialObservation(feedbackSandbox, 2024, '12');
  receipt = (await materialWrite(request, { action: 'check' })).receipt;
  expect(receipt.state.notices.filter((n) => n.indicator === gdp)).toHaveLength(
    1,
  );
  expect(receipt.state.notices.find((n) => n.indicator === gdp)?.version).toBe(
    2,
  );
  const current = await materialView(request);
  expect(
    (
      await request.post(materialPath, {
        headers: connectionHeaders,
        data: {
          action: 'acknowledge',
          requestId: randomUUID(),
          expectedVersion: current.state.version,
          indicator: gdp,
          noticeVersion: 1,
          read: true,
        },
      })
    ).status(),
  ).toBe(409);
  expect(
    await (
      await request.post(materialPath, {
        headers: connectionHeaders,
        data: first.input,
      })
    ).json(),
  ).toEqual(first.receipt);
  expect((await materialView(request)).state.version).toBe(
    current.state.version,
  );
});

test('E2E-API-662 missing stale and future evidence preserves the immutable valid baseline without a false material result @MATERIAL-ALERTS-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await prepareConnectionAccount(request);
  await followMaterial(request, [gdp]);
  const original = await seedMaterialObservation(feedbackSandbox, 2020, '1');
  await configureMaterial(request);
  await seedMaterialObservation(feedbackSandbox, 2021, null);
  let receipt = (await materialWrite(request, { action: 'check' })).receipt;
  expect(receipt.outcomes[0]?.outcome).toBe('missing');
  expect(receipt.state.baselines[0]?.observation).toEqual(original);
  await seedMaterialObservation(feedbackSandbox, 2021, '5');
  const pool = await connectionDatabase(feedbackSandbox);
  try {
    await pool.query(
      "UPDATE macro_runs SET finished_at=clock_timestamp()-interval '8 days' WHERE indicator=$1",
      [gdp],
    );
  } finally {
    await pool.end();
  }
  receipt = (await materialWrite(request, { action: 'check' })).receipt;
  expect(receipt.outcomes[0]?.outcome).toBe('stale');
  expect(receipt.state.baselines[0]?.observation).toEqual(original);
  await seedMaterialObservation(feedbackSandbox, 2021, '6', gdp, {
    retrievedAt: new Date(Date.now() + 86400000).toISOString(),
  });
  receipt = (await materialWrite(request, { action: 'check' })).receipt;
  expect(receipt.outcomes[0]?.outcome).toBe('future-data');
  expect(receipt.state.notices).toEqual([]);
  await seedMaterialObservation(
    feedbackSandbox,
    new Date().getUTCFullYear() + 1,
    '6',
  );
  receipt = (await materialWrite(request, { action: 'check' })).receipt;
  expect(receipt.outcomes[0]?.outcome).toBe('future-data');
  expect(receipt.state.baselines[0]?.observation).toEqual(original);
});

test('E2E-API-663 mute freeze unmute baseline unfollow history paging immutability and account cascade @MATERIAL-ALERTS-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await prepareConnectionAccount(request);
  await followMaterial(request, [gdp]);
  await seedMaterialObservation(feedbackSandbox, 2020, '1');
  await configureMaterial(request);
  const mute = async (muted: boolean) =>
    expect(
      (
        await request.put('/api/v1/account/alert-preferences', {
          headers: connectionHeaders,
          data: { indicator: gdp, muted },
        })
      ).status(),
    ).toBe(200);
  await mute(true);
  await seedMaterialObservation(feedbackSandbox, 2021, '8');
  const receipt = (await materialWrite(request, { action: 'check' })).receipt;
  expect(receipt.outcomes[0]?.outcome).toBe('muted');
  expect(receipt.state.baselines[0]?.observation?.year).toBe(2020);
  await mute(false);
  expect(
    (await materialView(request)).state.baselines[0]?.observation?.year,
  ).toBe(2021);
  expect(
    (await materialWrite(request, { action: 'check' })).receipt.outcomes[0]
      ?.outcome,
  ).toBe('unchanged');
  for (let i = 0; i < 101; i++)
    await materialWrite(request, { action: 'check' });
  await followMaterial(request, []);
  expect((await materialView(request)).state.policies).toEqual([]);
  const privacy = PrivacyExportSchema.parse(
    await (await request.get('/api/v1/account/privacy/export')).json(),
  );
  let page = privacy.materialAlerts;
  const owner = page.ownerId,
    all = [...page.events];
  expect(page.events).toHaveLength(100);
  expect(page.next).not.toBeNull();
  const upper = page.upper;
  await materialWrite(request, { action: 'check' });
  while (page.next) {
    page = MaterialExportSchema.parse(
      await (
        await request.get(
          materialPath +
            '/history?' +
            new URLSearchParams({ after: page.next, upper }),
        )
      ).json(),
    );
    all.push(...page.events);
  }
  expect(new Set(all.map((e) => e.sequence)).size).toBe(all.length);
  expect(all.length).toBeGreaterThan(100);
  expect(all.at(-1)?.sequence).toBe(upper);
  const pool = await connectionDatabase(feedbackSandbox);
  try {
    await expect(
      pool.query(
        'UPDATE material_alert_events SET payload=payload WHERE user_id=$1',
        [owner],
      ),
    ).rejects.toThrow();
    expect(
      (
        await request.delete('/api/v1/account', {
          headers: connectionHeaders,
          data: { password: connectionPassword },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await pool.query(
          'SELECT count(*)::int AS count FROM material_alert_events WHERE user_id=$1',
          [owner],
        )
      ).rows[0].count,
    ).toBe(0);
    expect(
      (
        await pool.query(
          'SELECT count(*)::int AS count FROM material_alert_heads WHERE user_id=$1',
          [owner],
        )
      ).rows[0].count,
    ).toBe(0);
  } finally {
    await pool.end();
  }
});

test('E2E-API-664 account lock serializes concurrent replay and rejects stale competing configuration @MATERIAL-ALERTS-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await prepareConnectionAccount(request);
  await followMaterial(request, [gdp]);
  await seedMaterialObservation(feedbackSandbox, 2020, '1');
  await configureMaterial(request);
  await seedMaterialObservation(feedbackSandbox, 2021, '3');
  const input = {
    action: 'check',
    requestId: randomUUID(),
    expectedVersion: (await materialView(request)).state.version,
  };
  const responses = await Promise.all([
    request.post(materialPath, { headers: connectionHeaders, data: input }),
    request.post(materialPath, { headers: connectionHeaders, data: input }),
  ]);
  expect(responses.map((r) => r.status())).toEqual([200, 200]);
  expect(await responses[0]!.json()).toEqual(await responses[1]!.json());
  expect(
    (
      await request.post(materialPath, {
        headers: connectionHeaders,
        data: { ...input, requestId: randomUUID() },
      })
    ).status(),
  ).toBe(409);
  const history = MaterialExportSchema.parse(
    await (await request.get(materialPath + '/history')).json(),
  );
  expect(
    history.events.filter((r) => r.receipt.requestId === input.requestId),
  ).toHaveLength(1);
});

test('E2E-API-665 recovery ahead of material waiter returns real401 and rolls back private head and receipt writes @MATERIAL-ALERTS-001 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const owner = await registerRecoverable(request);
  await followMaterial(request, [gdp]);
  await seedMaterialObservation(feedbackSandbox, 2020, '1');
  await configureMaterial(request);
  const input = {
    action: 'check',
    requestId: randomUUID(),
    expectedVersion: (await materialView(request)).state.version,
  };
  const db = await openAuthDatabase(feedbackSandbox),
    resetRequest = await playwright.request.newContext({
      baseURL: feedbackSandbox.apiOrigin,
    });
  const before = (
    await db.query(
      'SELECT payload FROM material_alert_heads WHERE user_id=$1',
      [owner.id],
    )
  ).rows;
  try {
    await resetAheadOfOperation({
      db,
      owner,
      resetRequest,
      operation: () =>
        request.post(materialPath, { headers: connectionHeaders, data: input }),
    });
    expect(
      (
        await db.query(
          'SELECT payload FROM material_alert_heads WHERE user_id=$1',
          [owner.id],
        )
      ).rows,
    ).toEqual(before);
    expect(
      (
        await db.query(
          'SELECT sequence FROM material_alert_events WHERE request_id=$1',
          [input.requestId],
        )
      ).rows,
    ).toEqual([]);
  } finally {
    await resetRequest.dispose();
    await db.close();
  }
});

test('E2E-API-666 late stored-observation lock expiry denies material write without a receipt @MATERIAL-ALERTS-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await prepareConnectionAccount(request);
  await followMaterial(request, [gdp]);
  await seedMaterialObservation(feedbackSandbox, 2020, '1');
  await configureMaterial(request);
  const input = {
    action: 'check',
    requestId: randomUUID(),
    expectedVersion: (await materialView(request)).state.version,
  };
  const pool = await connectionDatabase(feedbackSandbox),
    observer = await connectionDatabase(feedbackSandbox);
  let pending: ReturnType<typeof request.post> | undefined;
  try {
    await pool.query('BEGIN');
    await pool.query('LOCK TABLE macro_observations IN ACCESS EXCLUSIVE MODE');
    const pid = Number(
      (await pool.query('SELECT pg_backend_pid() AS pid')).rows[0].pid,
    );
    pending = request.post(materialPath, {
      headers: connectionHeaders,
      data: input,
    });
    await expect
      .poll(
        async () => {
          await observer.query('SELECT pg_stat_clear_snapshot()');
          return (
            await observer.query(
              "SELECT pid FROM pg_stat_activity WHERE wait_event_type='Lock' AND pg_blocking_pids(pid) && $1::int[] AND query LIKE '%FROM unnest($1::text[]) AS keys(indicator)%'",
              [[pid]],
            )
          ).rows.length;
        },
        { timeout: 2500 },
      )
      .toBe(1);
    await observer.query(
      "UPDATE app_sessions SET expires_at=clock_timestamp()-interval '1 second'",
    );
    await pool.query('ROLLBACK');
    expect((await pending).status()).toBe(401);
    expect(
      (
        await observer.query(
          'SELECT sequence FROM material_alert_events WHERE request_id=$1',
          [input.requestId],
        )
      ).rows,
    ).toEqual([]);
  } finally {
    await pool.query('ROLLBACK');
    await pending?.catch(() => {});
    await pool.end();
    await observer.end();
  }
});

test('E2E-API-668 actual material storage lock timeout returns503 then same request succeeds exactly once @MATERIAL-ALERTS-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await prepareConnectionAccount(request);
  await followMaterial(request, [gdp]);
  await seedMaterialObservation(feedbackSandbox, 2020, '1');
  const input = {
    action: 'configure',
    requestId: randomUUID(),
    expectedVersion: 0,
    policies: [{ indicator: gdp, thresholdPoints: '1' }],
    storageConsent: true,
  };
  const pool = await connectionDatabase(feedbackSandbox);
  let pending: ReturnType<typeof request.post> | undefined;
  try {
    await pool.query('BEGIN');
    await pool.query(
      'LOCK TABLE material_alert_heads IN ACCESS EXCLUSIVE MODE',
    );
    const pid = Number(
      (await pool.query('SELECT pg_backend_pid() AS pid')).rows[0].pid,
    );
    pending = request.post(materialPath, {
      headers: connectionHeaders,
      data: input,
    });
    await waitForQueryBlocked(
      pool,
      'SELECT payload FROM material_alert_heads WHERE user_id=$1',
      [pid],
    );
    expect((await pending).status()).toBe(503);
  } finally {
    await pool.query('ROLLBACK');
    await pending?.catch(() => {});
    await pool.end();
  }
  expect(
    (
      await request.post(materialPath, {
        headers: connectionHeaders,
        data: input,
      })
    ).status(),
  ).toBe(200);
  const history = MaterialExportSchema.parse(
    await (await request.get(materialPath + '/history')).json(),
  );
  expect(history.events).toHaveLength(1);
});

test('E2E-API-667 genuine dated public bundle observations retain all provenance and are never relabelled as current refreshes @MATERIAL-ALERTS-001', async ({
  request,
  feedbackSandbox,
}) => {
  await prepareConnectionAccount(request);
  await followMaterial(request);
  const actual = await seedActualMaterial(feedbackSandbox);
  const view = await materialView(request);
  for (const source of actual.sources) {
    const latest = [...source.observations].sort(
      (a, b) => b.year - a.year || b.revision - a.revision,
    )[0];
    expect(view.sources.find((s) => s.indicator === source.indicator)).toEqual({
      indicator: source.indicator,
      latest,
      lastSuccessAt: source.lastSuccessAt,
    });
  }
  expect(view.state.notices).toEqual([]);
});
