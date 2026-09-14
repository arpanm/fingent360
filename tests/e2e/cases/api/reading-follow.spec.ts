import { randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/app-fixture';
import {
  ReadingFollowViewSchema,
  ReadingFollowReceiptSchema,
  ReadingFollowExportSchema,
  PrivacyExportSchema,
} from '../../../../packages/contracts/src/index';
import {
  seedConnectionSource,
  reviseConnectionSourceFixture,
  connectionHeaders as headers,
} from '../../helpers/research-connection-fixture';
import { readingPaginationSources } from '../../helpers/reading-follow-fixture';
const base = '/api/v1/account/reading-follow';
const registration = () => ({
  username: `follow_${randomUUID().slice(0, 12)}`,
  password: 'Synthetic-follow-2026',
  consent: true,
});
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-API-440 actual reviewed editions coalesce ack reopen withdrawal mute and replay without source text @READING-FOLLOW-001', async ({
  request,
  feedbackSandbox,
}) => {
  let source = await seedConnectionSource(feedbackSandbox);
  expect(
    (
      await request.post('/api/v1/account/register', {
        headers,
        data: registration(),
      })
    ).status(),
  ).toBe(201);
  const save = (version: number, muted = false) =>
    request.put(base, {
      headers,
      data: {
        requestId: randomUUID(),
        expectedVersion: version,
        sources: ['fed'],
        topics: [],
        muted,
        consent: true,
      },
    });
  expect((await save(0)).status()).toBe(200);
  expect(
    ReadingFollowViewSchema.parse(await (await request.get(base)).json()).items,
  ).toEqual([]);
  const checkInput = { requestId: randomUUID(), expectedVersion: 1 };
  const check = () =>
    request.post(base + '/check', { headers, data: checkInput });
  expect((await check()).status()).toBe(201);
  source = await reviseConnectionSourceFixture(
    feedbackSandbox,
    source,
    'published',
  );
  const changedInput = { requestId: randomUUID(), expectedVersion: 1 };
  const changed = await request.post(base + '/check', {
    headers,
    data: changedInput,
  });
  const receipt = ReadingFollowReceiptSchema.parse(await changed.json());
  expect(receipt.changed).toBe(1);
  let view = ReadingFollowViewSchema.parse(
    await (await request.get(base)).json(),
  );
  expect(view.items).toHaveLength(1);
  const notice = view.items[0]!;
  expect(notice.status).toBe('open');
  expect(view.availableIds).toEqual([source.id]);
  const ack = { requestId: randomUUID(), expectedVersion: notice.version };
  expect(
    (
      await request.post(`${base}/notices/${source.id}/acknowledge`, {
        headers,
        data: ack,
      })
    ).status(),
  ).toBe(201);
  expect(
    (
      await request.post(base + '/check', {
        headers,
        data: { requestId: randomUUID(), expectedVersion: 1 },
      })
    ).status(),
  ).toBe(201);
  view = ReadingFollowViewSchema.parse(await (await request.get(base)).json());
  expect(view.items[0]?.status).toBe('acknowledged');
  expect(view.publishedReading).toEqual([
    {
      id: source.id,
      edition: source.version,
      title: source.title,
      sourceName: source.source.name,
    },
  ]);
  source = await reviseConnectionSourceFixture(
    feedbackSandbox,
    source,
    'withdrawn',
  );
  await request.post(base + '/check', {
    headers,
    data: { requestId: randomUUID(), expectedVersion: 1 },
  });
  view = ReadingFollowViewSchema.parse(await (await request.get(base)).json());
  expect(view.items[0]?.reason).toBe('withdrawn');
  expect(view.items[0]?.status).toBe('open');
  expect(view.availableIds).toEqual([]);
  expect(view.publishedReading).toEqual([]);
  expect(
    await (
      await request.post(base + '/check', { headers, data: changedInput })
    ).json(),
  ).toEqual(receipt);
  expect(
    ReadingFollowViewSchema.parse(await (await request.get(base)).json())
      .items[0]?.reason,
  ).toBe('withdrawn');
  expect((await save(1, true)).status()).toBe(200);
  expect(
    (
      await request.post(base + '/check', {
        headers,
        data: { requestId: randomUUID(), expectedVersion: 2 },
      })
    ).status(),
  ).toBe(409);
  source = await reviseConnectionSourceFixture(
    feedbackSandbox,
    source,
    'published',
  );
  expect((await save(2, false)).status()).toBe(200);
  await request.post(base + '/check', {
    headers,
    data: { requestId: randomUUID(), expectedVersion: 3 },
  });
  expect(
    ReadingFollowViewSchema.parse(
      await (await request.get(base)).json(),
    ).items.every((i) => i.status !== 'open'),
  ).toBe(true);
  const exported = PrivacyExportSchema.parse(
    await (await request.get('/api/v1/account/privacy/export')).json(),
  );
  expect(exported.readingFollow.events.length).toBeGreaterThan(0);
  expect(JSON.stringify(exported.readingFollow)).not.toContain(source.title);
  if (source.body)
    expect(JSON.stringify(exported.readingFollow)).not.toContain(source.body);
});
test('E2E-API-441 owned complete event pagination survives over100 operations, conflicts and account deletion @READING-FOLLOW-001', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  test.setTimeout(180000);
  await seedConnectionSource(feedbackSandbox);
  const owner = registration();
  await request.post('/api/v1/account/register', { headers, data: owner });
  await request.put(base, {
    headers,
    data: {
      requestId: randomUUID(),
      expectedVersion: 0,
      sources: ['fed'],
      topics: [],
      muted: false,
      consent: true,
    },
  });
  const input = { requestId: randomUUID(), expectedVersion: 1 };
  const both = await Promise.all([
    request.post(base + '/check', { headers, data: input }),
    request.post(base + '/check', { headers, data: input }),
  ]);
  expect(both.map((r) => r.status())).toEqual([201, 201]);
  expect(await both[0]!.json()).toEqual(await both[1]!.json());
  expect(
    (
      await request.post(base + '/check', {
        headers,
        data: { ...input, expectedVersion: 0 },
      })
    ).status(),
  ).toBe(409);
  for (let n = 0; n < 101; n++)
    expect(
      (
        await request.post(base + '/check', {
          headers,
          data: { requestId: randomUUID(), expectedVersion: 1 },
        })
      ).status(),
    ).toBe(201);
  let page = ReadingFollowExportSchema.parse(
    await (await request.get(base + '/export')).json(),
  );
  expect(page.events).toHaveLength(100);
  expect(page.next).not.toBeNull();
  const sequences = page.events.map((e) => e.sequence);
  while (page.next) {
    page = ReadingFollowExportSchema.parse(
      await (
        await request.get(
          base +
            '/export?' +
            new URLSearchParams({ after: page.next, upper: page.upper }),
        )
      ).json(),
    );
    sequences.push(...page.events.map((e) => e.sequence));
  }
  expect(new Set(sequences).size).toBe(sequences.length);
  expect(sequences.length).toBeGreaterThan(103);
  const other = await playwright.request.newContext({
    baseURL: feedbackSandbox.apiOrigin,
  });
  try {
    await other.post('/api/v1/account/register', {
      headers,
      data: registration(),
    });
    expect(
      ReadingFollowExportSchema.parse(
        await (await other.get(base + '/export')).json(),
      ).events,
    ).toEqual([]);
    expect(
      (
        await other.post(`${base}/notices/not-owned/acknowledge`, {
          headers,
          data: { requestId: randomUUID(), expectedVersion: 1 },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await request.delete('/api/v1/account', {
          headers,
          data: { password: owner.password },
        })
      ).status(),
    ).toBe(200);
    expect((await request.get(base)).status()).toBe(401);
    await request.post('/api/v1/account/register', {
      headers,
      data: registration(),
    });
    expect(
      ReadingFollowExportSchema.parse(
        await (await request.get(base + '/export')).json(),
      ).events,
    ).toEqual([]);
  } finally {
    await other.dispose();
  }
});

test('E2E-API-442 natural session expiry during actual publication admission rolls baseline creation back @READING-FOLLOW-001', async ({
  request,
  feedbackSandbox,
}) => {
  const { connectionDatabase } =
    await import('../../helpers/research-connection-fixture');
  const source = await seedConnectionSource(feedbackSandbox);
  await request.post('/api/v1/account/register', {
    headers,
    data: registration(),
  });
  const user = (await (await request.get('/api/v1/account')).json()).user;
  const pool = await connectionDatabase(feedbackSandbox),
    observer = await connectionDatabase(feedbackSandbox),
    client = await pool.connect();
  let pending: ReturnType<typeof request.put> | undefined;
  try {
    await client.query('BEGIN');
    await client.query(
      'SELECT id FROM discovery_items WHERE id=$1 FOR UPDATE',
      [source.id],
    );
    const blocker = (await client.query('SELECT pg_backend_pid() AS pid'))
      .rows[0].pid;
    pending = request.put(base, {
      headers,
      data: {
        requestId: randomUUID(),
        expectedVersion: 0,
        sources: ['fed'],
        topics: [],
        muted: false,
        consent: true,
      },
    });
    void pending.catch(() => {});
    let waiter = 0;
    await expect
      .poll(
        async () => {
          const r = await observer.query(
            "SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND $1=ANY(pg_blocking_pids(pid)) AND query LIKE 'SELECT id FROM discovery_items%'",
            [blocker],
          );
          waiter = Number(r.rows[0]?.pid ?? 0);
          return waiter;
        },
        { timeout: 2500, intervals: [20, 40, 80] },
      )
      .toBeGreaterThan(0);
    await observer.query(
      "UPDATE app_sessions SET expires_at=(SELECT xact_start+interval '1 microsecond' FROM pg_stat_activity WHERE pid=$2) WHERE user_id=$1",
      [user.id, waiter],
    );
    await client.query('ROLLBACK');
    expect((await pending).status()).toBe(401);
    expect(
      (
        await observer.query(
          'SELECT 1 FROM reading_follow_events WHERE user_id=$1',
          [user.id],
        )
      ).rows,
    ).toEqual([]);
    expect(
      (
        await observer.query(
          'SELECT 1 FROM reading_follow_configs WHERE user_id=$1',
          [user.id],
        )
      ).rows,
    ).toEqual([]);
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
    if (pending) await Promise.allSettled([pending.then((r) => r.body())]);
    await pool.end();
    await observer.end();
  }
});

test('E2E-API-443 unrelated follow edits and mute preserve open observations until explicit unmute baseline @READING-FOLLOW-001', async ({
  request,
  feedbackSandbox,
}) => {
  let source = await seedConnectionSource(feedbackSandbox);
  await request.post('/api/v1/account/register', {
    headers,
    data: registration(),
  });
  const save = (version: number, sources: string[], muted = false) =>
    request.put(base, {
      headers,
      data: {
        requestId: randomUUID(),
        expectedVersion: version,
        sources,
        topics: [],
        muted,
        consent: true,
      },
    });
  await save(0, ['fed']);
  source = await reviseConnectionSourceFixture(
    feedbackSandbox,
    source,
    'published',
  );
  await request.post(base + '/check', {
    headers,
    data: { requestId: randomUUID(), expectedVersion: 1 },
  });
  const open = ReadingFollowViewSchema.parse(
    await (await request.get(base)).json(),
  ).items[0]!;
  expect(open.status).toBe('open');
  expect((await save(1, ['fed', 'world-bank'])).status()).toBe(200);
  expect(
    ReadingFollowViewSchema.parse(await (await request.get(base)).json())
      .items[0],
  ).toEqual(open);
  expect((await save(2, ['fed', 'world-bank'], true)).status()).toBe(200);
  expect(
    ReadingFollowViewSchema.parse(await (await request.get(base)).json())
      .items[0],
  ).toEqual(open);
  source = await reviseConnectionSourceFixture(
    feedbackSandbox,
    source,
    'published',
  );
  expect(
    (
      await request.post(base + '/check', {
        headers,
        data: { requestId: randomUUID(), expectedVersion: 3 },
      })
    ).status(),
  ).toBe(409);
  expect((await save(3, ['fed', 'world-bank'])).status()).toBe(200);
  const resumed = ReadingFollowViewSchema.parse(
    await (await request.get(base)).json(),
  ).items[0]!;
  expect(resumed.status).toBe('resolved');
  expect(resumed.edition).toBe(source.version);
});

test('E2E-API-444 overlapping retained topic preserves notice and acknowledgement identifies its observed config @READING-FOLLOW-001', async ({
  request,
  feedbackSandbox,
}) => {
  let source = await seedConnectionSource(feedbackSandbox);
  await request.post('/api/v1/account/register', {
    headers,
    data: registration(),
  });
  const save = (expectedVersion: number, sources: string[], topics: string[]) =>
    request.put(base, {
      headers,
      data: {
        requestId: randomUUID(),
        expectedVersion,
        sources,
        topics,
        muted: false,
        consent: true,
      },
    });
  expect((await save(0, ['fed'], [])).status()).toBe(200);
  source = await reviseConnectionSourceFixture(
    feedbackSandbox,
    source,
    'published',
  );
  await request.post(base + '/check', {
    headers,
    data: { requestId: randomUUID(), expectedVersion: 1 },
  });
  const original = ReadingFollowViewSchema.parse(
    await (await request.get(base)).json(),
  ).items[0]!;
  expect((await save(1, ['fed'], [source.topics[0]!])).status()).toBe(200);
  expect((await save(2, [], [source.topics[0]!])).status()).toBe(200);
  expect(
    ReadingFollowViewSchema.parse(await (await request.get(base)).json())
      .items[0],
  ).toEqual(original);
  const ack = ReadingFollowReceiptSchema.parse(
    await (
      await request.post(`${base}/notices/${source.id}/acknowledge`, {
        headers,
        data: { requestId: randomUUID(), expectedVersion: original.version },
      })
    ).json(),
  );
  expect(ack.configVersion).toBe(original.configVersion);
  expect(ack.configVersion).toBe(1);
});

test('E2E-API-445 complete multi-batch checks produce bounded unique notice pages and frozen export boundaries @READING-FOLLOW-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  test.setTimeout(120000);
  expect(
    (
      await request.post('/api/v1/account/register', {
        headers,
        data: registration(),
      })
    ).status(),
  ).toBe(201);
  expect(
    (
      await request.put(base, {
        headers,
        data: {
          requestId: randomUUID(),
          expectedVersion: 0,
          sources: ['fed'],
          topics: [],
          muted: false,
          consent: true,
        },
      })
    ).status(),
  ).toBe(200);
  const sources = await readingPaginationSources(feedbackSandbox);
  const result = await request.post(base + '/check', {
    headers,
    data: { requestId: randomUUID(), expectedVersion: 1 },
  });
  expect(result.status()).toBe(201);
  expect(
    ReadingFollowReceiptSchema.parse(await result.json()).examined,
  ).toBeGreaterThan(200);
  let view = ReadingFollowViewSchema.parse(
    await (await request.get(base)).json(),
  );
  expect(view.items).toHaveLength(100);
  const ids: string[] = [];
  while (true) {
    ids.push(...view.items.map((item) => item.itemId));
    if (!view.next) break;
    view = ReadingFollowViewSchema.parse(
      await (
        await request.get(
          base + '?' + new URLSearchParams({ after: view.next }),
        )
      ).json(),
    );
  }
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids.filter((id) => id.startsWith('fed-reading-page-')).sort()).toEqual(
    sources.map((item) => item.id).sort(),
  );
  let page = ReadingFollowExportSchema.parse(
    await (await request.get(base + '/export')).json(),
  );
  const upper = page.upper,
    sequences = page.events.map((event) => event.sequence),
    laterId = randomUUID();
  expect(page.next).not.toBeNull();
  expect(
    (
      await request.post(base + '/check', {
        headers,
        data: { requestId: laterId, expectedVersion: 1 },
      })
    ).status(),
  ).toBe(201);
  while (page.next) {
    page = ReadingFollowExportSchema.parse(
      await (
        await request.get(
          base + '/export?' + new URLSearchParams({ after: page.next, upper }),
        )
      ).json(),
    );
    expect(page.upper).toBe(upper);
    expect(
      page.events.every((event) => BigInt(event.sequence) <= BigInt(upper)),
    ).toBe(true);
    expect(
      page.events.some(
        (event) =>
          event.record.kind === 'operation' &&
          event.record.receipt.requestId === laterId,
      ),
    ).toBe(false);
    sequences.push(...page.events.map((event) => event.sequence));
  }
  expect(new Set(sequences).size).toBe(sequences.length);
  expect(sequences.length).toBeGreaterThan(200);
});
