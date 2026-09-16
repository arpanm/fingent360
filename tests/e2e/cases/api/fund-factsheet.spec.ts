import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import {
  test,
  expect,
  headers,
  factsheetFixture,
  factsheetInput,
} from '../../helpers/fund-factsheet';
import {
  parseKotakFactsheet,
  FactsheetValuesSchema,
} from '../../../../packages/contracts/src/index';
test.use({ namedOperators: true });
test('E2E-API-1915 oversized complete factsheet snapshot explicitly fails instead of omitting older admitted captures @SRC-016 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const f = await factsheetFixture(request, playwright, feedbackSandbox);
  const { Pool } = createRequire(
    new URL('../../../../apps/api/package.json', import.meta.url),
  )('pg');
  const pool = new Pool({
    connectionString: feedbackSandbox.databaseUrl,
    max: 1,
  });
  try {
    expect(
      (
        await request.post('/api/v1/ops/fund-factsheets/import', {
          headers,
          data: f.input,
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await f.reviewer.post(
          `/api/v1/ops/fund-factsheets/${f.input.requestId}/review`,
          { headers, data: f.review },
        )
      ).status(),
    ).toBe(201);
    // Explicit volume simulation inside the disposable schema: duplicate a real retained/reviewed source binding.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('search_path',$1,true)", [
        feedbackSandbox.schema,
      ]);
      await client.query(
        "WITH copies AS (INSERT INTO fund_factsheet_editions(id,hash,source_url,retrieved_at,parsed_values,error,prepared_by,permission_reference) SELECT gen_random_uuid(),hash,source_url,retrieved_at,parsed_values,error,prepared_by,permission_reference FROM fund_factsheet_editions CROSS JOIN generate_series(1,100) WHERE id=$1 RETURNING id) INSERT INTO fund_factsheet_reviews(request_id,edition_id,fingerprint,decision,mappings,reason,reviewer) SELECT gen_random_uuid(),copies.id,'explicit-volume-fixture','publish',r.mappings,'Explicit synthetic volume fixture',r.reviewer FROM copies CROSS JOIN fund_factsheet_reviews r WHERE r.edition_id=$1",
        [f.input.requestId],
      );
      await client.query('COMMIT');
    } finally {
      client.release();
    }
    const snapshot = await request.get('/api/v1/fund-factsheets/snapshot');
    expect(snapshot.status()).toBe(503);
    expect(await snapshot.text()).toContain('exceeds100');
    const page = await (
      await request.get('/api/v1/fund-factsheets?schemeCode=908001')
    ).json();
    expect(page.editions).toHaveLength(30);
    expect(page.nextCursor).not.toBeNull();
  } finally {
    await pool.end();
    await f.reviewer.dispose();
  }
});
test('E2E-API-1910 retained factsheet independent plan mapping original receipt and NAV withdrawal control public fees @SRC-016 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const f = await factsheetFixture(request, playwright, feedbackSandbox);
  try {
    const captured = await request.post('/api/v1/ops/fund-factsheets/import', {
      headers,
      data: f.input,
    });
    expect(captured.status(), await captured.text()).toBe(201);
    expect((await captured.json()).state).toBe('draft');
    const path = `/api/v1/ops/fund-factsheets/${f.input.requestId}/review`;
    expect(
      (await request.post(path, { headers, data: f.review })).status(),
    ).toBe(403);
    expect(
      (
        await f.reviewer.post(path, {
          headers,
          data: {
            ...f.review,
            plans: [
              { plan: 'Direct', schemeCode: '908002' },
              { plan: 'Regular', schemeCode: '908001' },
            ],
          },
        })
      ).status(),
    ).toBe(409);
    expect(
      (await f.reviewer.post(path, { headers, data: f.review })).status(),
    ).toBe(201);
    const result = await (
      await request.get('/api/v1/fund-factsheets?schemeCode=908001')
    ).json();
    expect(result.editions[0].values).toMatchObject({
      aumCrore: '2644.66',
      averageAumCrore: '2641.18',
      expenseBasis: 'base-expense-ratio-excludes-brokerage-transaction-costs',
    });
    expect(result.editions[0].mappings[0].navEditionId).toBe(f.navId);
    expect(
      (
        await (
          await request.get(
            `/api/v1/ops/fund-factsheets/${f.input.requestId}/evidence`,
          )
        ).json()
      ).body,
    ).toBe(f.input.body);
    expect(
      (
        await f.reviewer.post('/api/v1/ops/funds/review', {
          headers,
          data: {
            requestId: randomUUID(),
            editionId: f.navId,
            decision: 'withdraw',
            reason: 'Synthetic source identity withdrawal.',
          },
        })
      ).status(),
    ).toBe(201);
    expect(
      (await (await request.get('/api/v1/fund-factsheets')).json()).editions,
    ).toEqual([]);
  } finally {
    await f.reviewer.dispose();
  }
});
test('E2E-API-1914 factsheet operations and scheme reader continue deterministic bounded pages without duplicates @SRC-016 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const f = await factsheetFixture(request, playwright, feedbackSandbox);
  try {
    const ids = [];
    for (let i = 0; i < 3; i++) {
      const capture = { ...f.input, requestId: randomUUID() };
      ids.push(capture.requestId);
      expect(
        (
          await request.post('/api/v1/ops/fund-factsheets/import', {
            headers,
            data: capture,
          })
        ).status(),
      ).toBe(201);
      expect(
        (
          await f.reviewer.post(
            `/api/v1/ops/fund-factsheets/${capture.requestId}/review`,
            { headers, data: { ...f.review, requestId: randomUUID() } },
          )
        ).status(),
      ).toBe(201);
    }
    for (const base of [
      '/api/v1/ops/fund-factsheets?',
      '/api/v1/fund-factsheets?schemeCode=908001&',
    ]) {
      const first = await (await request.get(base + 'limit=2')).json();
      expect(first.editions).toHaveLength(2);
      expect(first.nextCursor).not.toBeNull();
      const second = await (
        await request.get(
          base + 'limit=2&cursor=' + encodeURIComponent(first.nextCursor),
        )
      ).json();
      expect(second.editions).toHaveLength(1);
      expect(second.nextCursor).toBeNull();
      expect(
        new Set(
          [...first.editions, ...second.editions].map(
            (e: { id: string }) => e.id,
          ),
        ),
      ).toEqual(new Set(ids));
      expect((await request.get(base + 'limit=31')).status()).toBe(400);
      expect((await request.get(base + 'cursor=malformed')).status()).toBe(400);
    }
    expect(
      (await (await request.get('/api/v1/fund-factsheets/snapshot')).json())
        .editions,
    ).toHaveLength(3);
  } finally {
    await f.reviewer.dispose();
  }
});
test('E2E-API-1911 factsheet month expense totals and serialized cost basis fail closed @SRC-016 @TEST-SIMULATION', async () => {
  const input = factsheetInput(),
    parsed = parseKotakFactsheet(input.body, input.sourceUrl);
  expect(parsed.plans).toEqual([
    {
      plan: 'Direct',
      schemePercent: '0.40',
      underlyingPercent: '0.62',
      combinedPercent: '1.02',
    },
    {
      plan: 'Regular',
      schemePercent: '1.14',
      underlyingPercent: '0.62',
      combinedPercent: '1.76',
    },
  ]);
  for (const body of [
    input.body.replace('1.02%', '1.03%'),
    input.body.replace('31st August', '31st July'),
    input.body.replace('Base Expense Ratio (BER)', 'Total Expense Ratio'),
  ])
    expect(() => parseKotakFactsheet(body, input.sourceUrl)).toThrow();
  expect(
    FactsheetValuesSchema.safeParse({
      ...parsed,
      plans: [parsed.plans[0], parsed.plans[0]],
    }).success,
  ).toBe(false);
});
test('E2E-API-1912 inconsistent factsheet retains quarantined original and valid published edition can withdraw @SRC-016 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const f = await factsheetFixture(request, playwright, feedbackSandbox);
  try {
    const broken = {
      ...f.input,
      requestId: randomUUID(),
      body: f.input.body.replace('1.02%', '1.03%'),
    };
    const response = await request.post('/api/v1/ops/fund-factsheets/import', {
      headers,
      data: broken,
    });
    expect(response.status()).toBe(201);
    expect((await response.json()).state).toBe('quarantined');
    expect(
      (
        await f.reviewer.post(
          `/api/v1/ops/fund-factsheets/${broken.requestId}/review`,
          { headers, data: f.review },
        )
      ).status(),
    ).toBe(409);
    expect(
      (
        await request.post('/api/v1/ops/fund-factsheets/import', {
          headers,
          data: f.input,
        })
      ).status(),
    ).toBe(201);
    const path = `/api/v1/ops/fund-factsheets/${f.input.requestId}/review`;
    expect(
      (await f.reviewer.post(path, { headers, data: f.review })).status(),
    ).toBe(201);
    expect(
      (
        await f.reviewer.post(path, {
          headers,
          data: {
            requestId: randomUUID(),
            decision: 'withdraw',
            reason: 'Independent reviewer withdraws disclosed fees.',
          },
        })
      ).status(),
    ).toBe(201);
    expect(
      (await (await request.get('/api/v1/fund-factsheets')).json()).editions,
    ).toEqual([]);
  } finally {
    await f.reviewer.dispose();
  }
});
test('E2E-API-1916 actual storage wait expires factsheet review replay and capture replay before any projected response @SRC-016 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const f = await factsheetFixture(request, playwright, feedbackSandbox),
    { connectionDatabase } =
      await import('../../helpers/research-connection-fixture'),
    blocker = await connectionDatabase(feedbackSandbox),
    observer = await connectionDatabase(feedbackSandbox);
  let pending: ReturnType<typeof request.post> | undefined;
  try {
    expect(
      (
        await request.post('/api/v1/ops/fund-factsheets/import', {
          headers,
          data: f.input,
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await f.reviewer.post(
          '/api/v1/ops/fund-factsheets/' + f.input.requestId + '/review',
          { headers, data: f.review },
        )
      ).status(),
    ).toBe(201);
    for (const mode of ['review', 'capture']) {
      await request.post('/api/v1/ops/session', {
        headers,
        data: feedbackSandbox.namedCredentials,
      });
      await f.reviewer.post('/api/v1/ops/session', {
        headers,
        data: f.credentials,
      });
      await blocker.query('BEGIN');
      const pid = (await blocker.query('SELECT pg_backend_pid() AS pid'))
        .rows[0].pid;
      if (mode === 'review')
        await blocker.query(
          'SELECT id FROM fund_factsheet_editions WHERE id=$1 FOR UPDATE',
          [f.input.requestId],
        );
      else
        await blocker.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
          'fund-factsheet:' + f.input.requestId,
        ]);
      pending =
        mode === 'review'
          ? f.reviewer.post(
              '/api/v1/ops/fund-factsheets/' + f.input.requestId + '/review',
              { headers, data: f.review },
            )
          : request.post('/api/v1/ops/fund-factsheets/import', {
              headers,
              data: f.input,
            });
      void pending.catch(() => {});
      await expect
        .poll(
          async () => {
            await observer.query('SELECT pg_stat_clear_snapshot()');
            return (
              await observer.query(
                "SELECT count(*)::int n FROM pg_stat_activity WHERE wait_event_type='Lock' AND $1=ANY(pg_blocking_pids(pid))",
                [pid],
              )
            ).rows[0].n;
          },
          { timeout: 3000 },
        )
        .toBeGreaterThan(0);
      await observer.query(
        "UPDATE operator_sessions SET expires_at=clock_timestamp()-interval '1 second'",
      );
      await blocker.query('COMMIT');
      const response = await pending;
      expect(response.status()).toBe(401);
      expect(await response.text()).not.toContain('aumCrore');
      pending = undefined;
    }
    expect(
      (
        await observer.query(
          'SELECT count(*)::int n FROM fund_factsheet_reviews WHERE edition_id=$1',
          [f.input.requestId],
        )
      ).rows[0].n,
    ).toBe(1);
  } finally {
    await blocker.query('ROLLBACK').catch(() => {});
    if (pending) await pending.catch(() => {});
    await blocker.end();
    await observer.end();
    await f.reviewer.dispose();
  }
});
