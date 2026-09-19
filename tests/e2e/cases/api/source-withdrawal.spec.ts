import { test, expect } from '../../helpers/app-fixture';
import { randomUUID } from 'node:crypto';
import {
  withdrawalFixture,
  withdrawReview,
  withdrawalMedia,
  waitForBlocked,
  waitForQueryBlocked,
} from '../../helpers/withdrawal-fixture';
import {
  connectionDatabase,
  connectionHeaders as headers,
  prepareConnectionAccount,
  connectionPassword,
} from '../../helpers/research-connection-fixture';
import { beaStorage } from '../../helpers/bea-fixture';
import {
  openAuthDatabase,
  registerRecoverable,
  resetAheadOfOperation,
  signInRecovered,
  recoveredPassword,
  authGoal,
} from '../../helpers/auth-wait';
import {
  FeedItemSchema,
  DiscoveryEvidenceSchema,
  LibrarySchema,
  PrivacyExportSchema,
  connectionSource,
} from '../../../../packages/contracts/src/index';
const base = '/api/v1/discovery/items',
  library = '/api/v1/account/library';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });

test('E2E-API-370 withdrawal public tombstones retained originals and explicit republication @SOURCE-WITHDRAWAL-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const { first, body } = await withdrawalFixture(request, feedbackSandbox);
  await withdrawalMedia(request, feedbackSandbox, first);
  const old = await (await request.get(`${base}/${first.id}/history`)).json();
  expect(old[0].title).toBe(first.title);
  const withdrawn = await withdrawReview(request, first, 'withdrawn');
  for (const suffix of ['', '/history']) {
    const r = await request.get(`${base}/${first.id}${suffix}`);
    expect(r.status()).toBe(200);
    const text = await r.text();
    expect(text).not.toContain(first.title);
    expect(text).not.toContain(first.summary);
    expect(text).not.toContain(first.body);
  }
  for (const suffix of ['/evidence', '/media', '/context'])
    expect((await request.get(`${base}/${first.id}${suffix}`)).status()).toBe(
      404,
    );
  expect(
    (await (await request.get('/api/v1/discovery/feed')).json()).items.some(
      (v: { id: string }) => v.id === first.id,
    ),
  ).toBe(false);
  const retained = await (
    await request.get(`/api/v1/ops/discovery/items/${first.id}/history`)
  ).json();
  expect(
    retained.find((v: { version: number }) => v.version === first.version),
  ).toEqual(first);
  expect(
    (
      await (
        await request.get(
          `/api/v1/ops/discovery/items/${first.id}/evidence?version=${first.version}`,
        )
      ).json()
    ).body,
  ).toBe(body);
  expect((await request.get(`/api/v1/ops/media/${first.id}`)).status()).toBe(
    200,
  );
  const restored = await withdrawReview(request, withdrawn, 'published');
  expect(
    FeedItemSchema.parse(
      await (await request.get(`${base}/${first.id}`)).json(),
    ),
  ).toEqual(restored);
  const history = await (
    await request.get(`${base}/${first.id}/history`)
  ).json();
  expect(
    history.find((v: { status: string }) => v.status === 'withdrawn').title,
  ).toBe('Withdrawn source item');
  expect(
    history.find((v: { version: number }) => v.version === first.version),
  ).toEqual(first);
  const pool = await connectionDatabase(feedbackSandbox);
  try {
    expect(
      (
        await pool.query(
          'SELECT data FROM discovery_versions WHERE item_id=$1 AND version=$2',
          [first.id, first.version],
        )
      ).rows[0].data,
    ).toEqual(first);
  } finally {
    await pool.end();
  }
});
test('E2E-API-371 shared RSS sibling evidence exposes only its selected published edition @SOURCE-WITHDRAWAL-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const { first, sibling, hash, body } = await withdrawalFixture(
    request,
    feedbackSandbox,
  );
  await withdrawReview(request, first, 'withdrawn');
  const evidence = DiscoveryEvidenceSchema.parse(
    await (await request.get(`${base}/${sibling.id}/evidence`)).json(),
  );
  expect(evidence.scope).toBe('published-edition');
  expect(evidence.hash).toBe(hash);
  expect(evidence.body).toContain(sibling.title);
  expect(evidence.body).not.toContain(first.title);
  expect(evidence.body).not.toBe(body);
  const original = await (
    await request.get(`/api/v1/ops/discovery/items/${sibling.id}/evidence`)
  ).json();
  expect(original.scope).toBe('retained-original');
  expect(original.body).toBe(body);
});
test('E2E-API-372 saved reminder replay edit cancel notifications and export redact without rewriting snapshots @SOURCE-WITHDRAWAL-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await prepareConnectionAccount(request);
  const { first } = await withdrawalFixture(request, feedbackSandbox);
  expect(
    (
      await request.put(`${library}/items/${first.id}/save`, {
        headers,
        data: { version: first.version },
      })
    ).status(),
  ).toBe(200);
  const input = {
    itemId: first.id,
    dueAt: new Date(Date.now() + 3600000).toISOString(),
    timeZone: 'Asia/Kolkata',
    idempotencyKey: randomUUID(),
  };
  const saved = await (
    await request.post(`${library}/reminders`, { headers, data: input })
  ).json();
  const before = PrivacyExportSchema.parse(
    await (await request.get('/api/v1/account/privacy/export')).json(),
  );
  const pool = await connectionDatabase(feedbackSandbox);
  try {
    await pool.query(
      'INSERT INTO library_notifications(id,user_id,reminder_id,item_id,title) VALUES($1,$2,$3,$4,$5)',
      [randomUUID(), before.account.id, saved.id, first.id, first.title],
    );
  } finally {
    await pool.end();
  }
  await withdrawReview(request, first, 'withdrawn');
  const state = LibrarySchema.parse(await (await request.get(library)).json());
  expect(state.saved[0]?.summary).toBe('');
  expect(state.saved[0]?.version).toBe(first.version);
  expect(state.reminders[0]?.currentStatus).toBe('withdrawn');
  expect(state.notifications[0]?.title).toBe('Withdrawn source item');
  const replay = await (
    await request.post(`${library}/reminders`, { headers, data: input })
  ).json();
  expect(replay.id).toBe(saved.id);
  expect(replay.title).toBe('Withdrawn source item');
  const edited = await (
    await request.patch(`${library}/reminders/${saved.id}`, {
      headers,
      data: {
        expectedVersion: saved.version,
        dueAt: new Date(Date.now() + 7200000).toISOString(),
        timeZone: 'Asia/Kolkata',
      },
    })
  ).json();
  expect(edited.title).toBe('Withdrawn source item');
  const cancelled = await (
    await request.delete(`${library}/reminders/${saved.id}`, {
      headers,
      data: { expectedVersion: edited.version },
    })
  ).json();
  expect(cancelled.title).toBe('Withdrawn source item');
  expect(cancelled.status).toBe('cancelled');
  const exported = PrivacyExportSchema.parse(
    await (await request.get('/api/v1/account/privacy/export')).json(),
  );
  expect(JSON.stringify(exported.library)).not.toContain(first.title);
  expect(exported.holdings).toEqual(before.holdings);
  expect(exported.goals).toEqual(before.goals);
  const check = await connectionDatabase(feedbackSandbox);
  try {
    expect(
      (
        await check.query(
          'SELECT snapshot FROM library_saved WHERE user_id=$1',
          [before.account.id],
        )
      ).rows[0].snapshot.summary,
    ).toBe(first.summary);
    expect(
      (
        await check.query('SELECT title FROM library_reminders WHERE id=$1', [
          saved.id,
        ])
      ).rows[0].title,
    ).toBe(first.title);
  } finally {
    await check.end();
  }
});
test('E2E-API-373 actual publication wait ordering denies all public disclosure after withdrawal commit @SOURCE-WITHDRAWAL-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  test.setTimeout(120000);
  for (const suffix of [
    '',
    '/history',
    '/evidence',
    '/media',
    '/context',
    'feed',
  ]) {
    const { first } = await withdrawalFixture(request, feedbackSandbox);
    if (suffix === '/media')
      await withdrawalMedia(request, feedbackSandbox, first);
    const pool = await connectionDatabase(feedbackSandbox);
    let writing: ReturnType<typeof request.put> | undefined,
      reading: ReturnType<typeof request.get> | undefined;
    try {
      await pool.query('BEGIN');
      await pool.query(
        'SELECT id FROM discovery_items WHERE id=$1 FOR UPDATE',
        [first.id],
      );
      writing = request.put(`/api/v1/ops/discovery/items/${first.id}`, {
        headers,
        data: {
          expectedVersion: first.version,
          status: 'withdrawn',
          correctionNote: 'Synthetic queued withdrawal.',
        },
      });
      void writing.catch(() => undefined);
      await waitForBlocked(pool, 1);
      reading = request.get(
        suffix === 'feed'
          ? '/api/v1/discovery/feed'
          : `${base}/${first.id}${suffix}`,
      );
      void reading.catch(() => undefined);
      await waitForBlocked(pool, 2);
      await pool.query('COMMIT');
      expect((await writing).status()).toBe(200);
      const result = await reading;
      expect(result.status()).toBe(
        ['/evidence', '/media', '/context'].includes(suffix) ? 404 : 200,
      );
      expect(await result.text()).not.toContain(first.title);
    } finally {
      await pool.query('ROLLBACK').catch(() => {});
      await Promise.allSettled([writing, reading].filter(Boolean));
      await pool.end();
    }
  }
});
test('E2E-API-374 session expired during publication wait cannot save reading or return private state @SOURCE-WITHDRAWAL-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await prepareConnectionAccount(request);
  const { first } = await withdrawalFixture(request, feedbackSandbox);
  const owner = (await (await request.get('/api/v1/account')).json()).user.id;
  const pool = await connectionDatabase(feedbackSandbox);
  let pending: ReturnType<typeof request.put> | undefined;
  try {
    await pool.query('BEGIN');
    await pool.query('SELECT id FROM discovery_items WHERE id=$1 FOR UPDATE', [
      first.id,
    ]);
    pending = request.put(`${library}/items/${first.id}/save`, {
      headers,
      data: { version: first.version },
    });
    void pending.catch(() => undefined);
    await waitForBlocked(pool, 1);
    await pool.query(
      "UPDATE app_sessions SET expires_at=clock_timestamp()-interval '1 second' WHERE user_id=$1",
      [owner],
    );
    await pool.query('COMMIT');
    expect((await pending).status()).toBe(401);
    expect(
      Number(
        (
          await pool.query(
            'SELECT count(*) FROM library_saved WHERE user_id=$1',
            [owner],
          )
        ).rows[0].count,
      ),
    ).toBe(0);
  } finally {
    await pool.query('ROLLBACK').catch(() => {});
    await pending?.catch(() => undefined);
    await pool.end();
  }
});
test('E2E-API-375 own notes selected report and review receipts remain immutable through withdrawal @SOURCE-WITHDRAWAL-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const goal = await prepareConnectionAccount(request),
    { first } = await withdrawalFixture(request, feedbackSandbox),
    id = randomUUID();
  const r = await request.put(`/api/v1/account/research-connections/${id}`, {
    headers,
    data: {
      requestId: randomUUID(),
      expectedVersion: 0,
      action: 'create',
      source: {
        itemId: first.id,
        version: first.version,
        sourceHash: first.sourceHash,
      },
      target: { kind: 'goal', id: goal.id, version: goal.version },
      note: 'My own retained note',
      storageConsent: true,
    },
  });
  expect(r.status()).toBe(200);
  const revision = await r.json();
  expect(revision.source).toEqual(connectionSource(first));
  const report = await (
    await request.post('/api/v1/account/reports', {
      headers,
      data: {
        requestId: randomUUID(),
        label: 'Synthetic personal receipt',
        consent: true,
        researchConnections: [{ id, version: 1 }],
      },
    })
  ).json();
  await expect
    .poll(
      async () =>
        (
          await (
            await request.get(`/api/v1/account/reports/${report.id}`)
          ).json()
        ).status,
      { timeout: 15000 },
    )
    .toBe('succeeded');
  const issued = await (
    await request.get(`/api/v1/account/reports/${report.id}`)
  ).json();
  await withdrawReview(request, first, 'withdrawn');
  const current = await (
    await request.get('/api/v1/account/research-connections')
  ).json();
  expect(current.connections[0].currentSource).toBeNull();
  expect(current.connections[0].revision).toEqual(revision);
  const check = await request.post('/api/v1/account/connection-reviews/check', {
    headers,
    data: { requestId: randomUUID() },
  });
  expect(check.status()).toBe(201);
  expect(JSON.stringify(await check.json())).not.toContain(first.title);
  const exported = PrivacyExportSchema.parse(
    await (await request.get('/api/v1/account/privacy/export')).json(),
  );
  expect(exported.researchConnections.revisions[0]).toEqual(revision);
  expect(
    exported.reports.jobs.find((j) => j.id === report.id)?.snapshot,
  ).toEqual(report.snapshot);
  expect(exported.reports.jobs.find((j) => j.id === report.id)?.report).toEqual(
    issued.report,
  );
  expect(
    (
      await request.delete('/api/v1/account', {
        headers,
        data: { password: connectionPassword },
      })
    ).status(),
  ).toBe(200);
});
test('E2E-API-376 final snapshot admission omits concurrently withdrawn content and unpublished media @SOURCE-WITHDRAWAL-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const { first, sibling } = await withdrawalFixture(request, feedbackSandbox),
    asset = await withdrawalMedia(request, feedbackSandbox, sibling);
  const captured = {
    generatedAt: new Date().toISOString(),
    feed: [first, sibling],
    histories: { [first.id]: [first], [sibling.id]: [sibling] },
    evidence: {
      [first.id]: await (
        await request.get(`${base}/${first.id}/evidence`)
      ).json(),
      [sibling.id]: await (
        await request.get(`${base}/${sibling.id}/evidence`)
      ).json(),
    },
    media: { [sibling.id]: asset },
  };
  await withdrawReview(request, first, 'withdrawn');
  expect(
    (
      await request.put(`/api/v1/ops/media/${sibling.id}`, {
        headers,
        data: { assetId: asset.id, publish: false },
      })
    ).status(),
  ).toBe(200);
  const manifest = await (
    await request.get('/api/v1/discovery/publication-manifest')
  ).json();
  const { finalizePublicSnapshot } = await import(
    new URL(
      '../../../../scripts/lib/finalize-public-snapshot.mjs',
      import.meta.url,
    ).href
  );
  const final = finalizePublicSnapshot(captured, manifest);
  expect(final.feed.map((v: { id: string }) => v.id)).toEqual([sibling.id]);
  expect(final.media).toEqual({});
  expect(JSON.stringify(final)).not.toContain(first.title);
  await withdrawReview(request, sibling, 'published');
  const changed = await (
    await request.get('/api/v1/discovery/publication-manifest')
  ).json();
  expect(() => finalizePublicSnapshot(captured, changed)).toThrow(
    /Publication changed/,
  );
});
test('E2E-API-377 protected originals reject guest and expired operator waiting on publication @SOURCE-WITHDRAWAL-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
  playwright,
}) => {
  const { first } = await withdrawalFixture(request, feedbackSandbox),
    guest = await playwright.request.newContext({
      baseURL: feedbackSandbox.apiOrigin,
    });
  try {
    expect(
      (
        await guest.get(`/api/v1/ops/discovery/items/${first.id}/history`)
      ).status(),
    ).toBe(401);
    expect(
      (
        await guest.get(`/api/v1/ops/discovery/items/${first.id}/evidence`)
      ).status(),
    ).toBe(401);
  } finally {
    await guest.dispose();
  }
  const pool = await connectionDatabase(feedbackSandbox);
  let pending: ReturnType<typeof request.get> | undefined;
  try {
    await pool.query('BEGIN');
    await pool.query('SELECT id FROM discovery_items WHERE id=$1 FOR UPDATE', [
      first.id,
    ]);
    pending = request.get(`/api/v1/ops/discovery/items/${first.id}/evidence`);
    void pending.catch(() => undefined);
    await waitForBlocked(pool, 1);
    await pool.query(
      "UPDATE operator_sessions SET expires_at=clock_timestamp()-interval '1 second'",
    );
    await pool.query('COMMIT');
    expect((await pending).status()).toBe(401);
  } finally {
    await pool.query('ROLLBACK').catch(() => {});
    await pending?.catch(() => undefined);
    await pool.end();
  }
});
test('E2E-API-378 delayed assistance selection rechecks actual publication before returning text @SOURCE-WITHDRAWAL-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await prepareConnectionAccount(request);
  const { first } = await withdrawalFixture(request, feedbackSandbox),
    pool = await connectionDatabase(feedbackSandbox);
  const term = FeedItemSchema.parse({
    ...first,
    id: `term-withdrawal-${randomUUID().slice(0, 8)}`,
    version: 1,
    kind: 'term',
    sourceHash: null,
    title: 'Synthetic inflation explanation',
    summary:
      'Synthetic inflation explanation for this isolated withdrawal test.',
    body: 'Synthetic educational text.',
    status: 'draft',
  });
  try {
    await pool.query('INSERT INTO discovery_items(id,version) VALUES($1,1)', [
      term.id,
    ]);
    await pool.query(
      'INSERT INTO discovery_versions(item_id,version,data) VALUES($1,1,$2)',
      [term.id, term],
    );
  } finally {
    await pool.end();
  }
  const published = await withdrawReview(request, term, 'published'),
    storage = await beaStorage(feedbackSandbox);
  const [{ AccountStore }, { AssistanceController }] = await Promise.all([
    import(
      new URL('../../../../apps/api/dist/accounts.js', import.meta.url).href
    ),
    import(
      new URL('../../../../apps/api/dist/assistance.js', import.meta.url).href
    ),
  ]);
  const account = new AccountStore({
    ...feedbackSandbox.privateDataKeys,
    DATABASE_URL: feedbackSandbox.databaseUrl,
    WEB_ORIGIN: headers.Origin,
  });
  const controller = new AssistanceController(account, {
    AI_PROVIDER: 'openai',
    OPENAI_API_KEY: 'synthetic-transport-only',
    OPENAI_MODEL: 'synthetic',
  });
  const cookie = (await request.storageState()).cookies
      .filter((c) => c.name === 'f360_session')
      .map((c) => `${c.name}=${c.value}`)
      .join('; '),
    original = globalThis.fetch;
  let enter!: () => void, release!: () => void;
  const entered = new Promise<void>((r) => (enter = r)),
    gate = new Promise<void>((r) => (release = r));
  let pending:
    Promise<{ provider: string; suggestions: unknown[] }> | undefined;
  try {
    globalThis.fetch = async (input, options) => {
      if (String(input) !== 'https://api.openai.com/v1/responses')
        throw Error('Unexpected test provider URL.');
      const body = JSON.parse(String(options?.body)),
        references = JSON.parse(body.input).references,
        selected = references.find(
          (r: { sourceId: string }) => r.sourceId === `content-${term.id}`,
        );
      if (!selected) throw Error('Synthetic source candidate missing.');
      enter();
      await gate;
      return Response.json({
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: JSON.stringify({
                  suggestions: [
                    {
                      sourceId: selected.sourceId,
                      text: selected.text,
                      type: 'explanation',
                    },
                  ],
                }),
              },
            ],
          },
        ],
      });
    };
    pending = controller.suggest(
      {
        query: 'synthetic inflation explanation',
        provider: 'openai',
        scope: 'learning',
        useHistory: false,
      },
      headers.Origin,
      cookie,
    );
    void pending!.catch(() => undefined);
    await Promise.race([
      entered,
      pending!.then(() => {
        throw Error('Provider selection was not entered.');
      }),
    ]);
    await withdrawReview(request, published, 'withdrawn');
    release();
    const result = await pending!;
    expect(result.provider).toBe('openai');
    expect(result.suggestions).toEqual([]);
  } finally {
    release?.();
    await pending?.catch(() => undefined);
    globalThis.fetch = original;
    await account.onApplicationShutdown();
    await storage.close();
  }
});
test('E2E-API-379 protected publication and existing visual generation reject an operator expired during their final lock wait @SOURCE-WITHDRAWAL-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  for (const operation of ['publication', 'media'] as const) {
    const { first } = await withdrawalFixture(request, feedbackSandbox),
      asset =
        operation === 'media'
          ? await withdrawalMedia(request, feedbackSandbox, first)
          : null,
      pool = await connectionDatabase(feedbackSandbox);
    let pending: ReturnType<typeof request.put> | undefined;
    try {
      await pool.query('BEGIN');
      await pool.query(
        operation === 'publication'
          ? 'SELECT id FROM discovery_items WHERE id=$1 FOR UPDATE'
          : 'SELECT id FROM discovery_media WHERE id=$1 FOR UPDATE',
        [asset?.id ?? first.id],
      );
      pending =
        operation === 'publication'
          ? request.put(`/api/v1/ops/discovery/items/${first.id}`, {
              headers,
              data: {
                expectedVersion: first.version,
                status: 'withdrawn',
                correctionNote: 'Synthetic rejected review.',
              },
            })
          : request.post(`/api/v1/ops/media/${first.id}`, {
              headers,
              data: {},
            });
      void pending.catch(() => undefined);
      await waitForBlocked(pool, 1);
      await pool.query(
        "UPDATE operator_sessions SET expires_at=clock_timestamp()-interval '1 second'",
      );
      await pool.query('COMMIT');
      expect((await pending).status()).toBe(401);
      expect(
        (
          await pool.query('SELECT version FROM discovery_items WHERE id=$1', [
            first.id,
          ])
        ).rows[0].version,
      ).toBe(first.version);
      if (asset)
        expect(
          (
            await pool.query('SELECT data FROM discovery_media WHERE id=$1', [
              asset.id,
            ])
          ).rows[0].data.captions,
        ).toEqual(asset.captions);
    } finally {
      await pool.query('ROLLBACK').catch(() => {});
      await pending?.catch(() => undefined);
      await pool.end();
    }
  }
});
test('E2E-API-380 coherent privacy export queued behind actual recovery reset cannot use the old repeatable-read session @SOURCE-WITHDRAWAL-001 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const owner = await registerRecoverable(request),
    db = await openAuthDatabase(feedbackSandbox),
    resetRequest = await playwright.request.newContext({
      baseURL: feedbackSandbox.apiOrigin,
    });
  try {
    expect(
      (
        await request.post('/api/v1/account/goals', { headers, data: authGoal })
      ).status(),
    ).toBe(201);
    const { first } = await withdrawalFixture(request, feedbackSandbox);
    await request.put(`${library}/items/${first.id}/save`, {
      headers,
      data: { version: first.version },
    });
    const before = PrivacyExportSchema.parse(
      await (await request.get('/api/v1/account/privacy/export')).json(),
    );
    await resetAheadOfOperation({
      db,
      owner,
      resetRequest,
      operation: () =>
        request.get('/api/v1/account/privacy/export', { timeout: 10000 }),
    });
    await signInRecovered(request, owner.username);
    const after = PrivacyExportSchema.parse(
      await (await request.get('/api/v1/account/privacy/export')).json(),
    );
    expect(after.goals).toEqual(before.goals);
    expect(after.library).toEqual(before.library);
  } finally {
    await resetRequest.dispose();
    await db.close();
  }
});
test('E2E-API-381 export admitted before a source wait keeps account then session locks until the private response is assembled @SOURCE-WITHDRAWAL-001 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const owner = await registerRecoverable(request),
    { first } = await withdrawalFixture(request, feedbackSandbox),
    pool = await connectionDatabase(feedbackSandbox),
    resetRequest = await playwright.request.newContext({
      baseURL: feedbackSandbox.apiOrigin,
    });
  let exporting: ReturnType<typeof request.get> | undefined,
    resetting: ReturnType<typeof request.post> | undefined;
  try {
    await request.put(`${library}/items/${first.id}/save`, {
      headers,
      data: { version: first.version },
    });
    await pool.query('BEGIN');
    await pool.query('SELECT id FROM discovery_items WHERE id=$1 FOR UPDATE', [
      first.id,
    ]);
    exporting = request.get('/api/v1/account/privacy/export');
    void exporting.catch(() => undefined);
    await waitForBlocked(pool, 1);
    resetting = resetRequest.post('/api/v1/account/recovery/reset', {
      headers,
      data: {
        username: owner.username,
        code: owner.code,
        newPassword: recoveredPassword,
      },
    });
    void resetting.catch(() => undefined);
    await waitForBlocked(pool, 2);
    await pool.query('COMMIT');
    const exported = await exporting;
    expect(exported.status()).toBe(200);
    expect(
      PrivacyExportSchema.parse(await exported.json()).library.data?.saved[0]
        ?.summary,
    ).toBe(first.summary);
    expect((await resetting).status()).toBe(200);
    expect((await request.get('/api/v1/account/privacy/export')).status()).toBe(
      401,
    );
  } finally {
    await pool.query('ROLLBACK').catch(() => {});
    await Promise.allSettled([exporting, resetting].filter(Boolean));
    await resetRequest.dispose();
    await pool.end();
  }
});
test('E2E-API-382 personalized feed does not admit newly published sources outside its locked source set @SOURCE-WITHDRAWAL-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await prepareConnectionAccount(request);
  const { first } = await withdrawalFixture(request, feedbackSandbox),
    initial = await connectionDatabase(feedbackSandbox),
    later = await connectionDatabase(feedbackSandbox);
  let reading: ReturnType<typeof request.get> | undefined,
    withdrawing: ReturnType<typeof request.put> | undefined;
  try {
    await initial.query('BEGIN');
    await initial.query(
      'SELECT id FROM discovery_items WHERE id=$1 FOR UPDATE',
      [first.id],
    );
    reading = request.get(`${library}/feed?view=explore`);
    void reading.catch(() => undefined);
    await waitForBlocked(initial, 1);
    const added = await withdrawalFixture(request, feedbackSandbox);
    await later.query('BEGIN');
    await later.query('SELECT id FROM discovery_items WHERE id=$1 FOR UPDATE', [
      added.first.id,
    ]);
    withdrawing = request.put(`/api/v1/ops/discovery/items/${added.first.id}`, {
      headers,
      data: {
        expectedVersion: added.first.version,
        status: 'withdrawn',
        correctionNote: 'Synthetic concurrent publication.',
      },
    });
    void withdrawing.catch(() => undefined);
    await waitForBlocked(later, 1);
    await initial.query('COMMIT');
    const response = await reading;
    expect(response.status()).toBe(200);
    const text = await response.text();
    expect(text).not.toContain(added.first.title);
    expect(text).not.toContain(added.sibling.title);
    await later.query('COMMIT');
    expect((await withdrawing).status()).toBe(200);
  } finally {
    await initial.query('ROLLBACK').catch(() => {});
    await later.query('ROLLBACK').catch(() => {});
    await Promise.allSettled([reading, withdrawing].filter(Boolean));
    await initial.end();
    await later.end();
  }
});
test.describe('Manually admitted withdrawal worker', () => {
  test.use({ manualWorkers: true }); // WORKER-HEALTH-001 fixture dependency, integrated by the parent.
  test('E2E-API-383 due reminder worker and private cancellation share account source reminder lock order across withdrawal @SOURCE-WITHDRAWAL-001 @TEST-SIMULATION', async ({
    request,
    feedbackSandbox,
  }) => {
    await prepareConnectionAccount(request);
    const { first } = await withdrawalFixture(request, feedbackSandbox),
      storage = await beaStorage(feedbackSandbox),
      blocker = await connectionDatabase(feedbackSandbox),
      editor = await connectionDatabase(feedbackSandbox);
    const [{ AccountStore }, { LibraryReminderWorker }] = await Promise.all([
        import(
          new URL('../../../../apps/api/dist/accounts.js', import.meta.url).href
        ),
        import(
          new URL(
            '../../../../apps/api/dist/library-worker.js',
            import.meta.url,
          ).href
        ),
      ]),
      account = new AccountStore({
        DATABASE_URL: feedbackSandbox.databaseUrl,
        WEB_ORIGIN: headers.Origin,
      }),
      worker = new LibraryReminderWorker(account);
    let withdrawing: ReturnType<typeof request.put> | undefined,
      cancelling: ReturnType<typeof request.delete> | undefined,
      delivering: Promise<void> | undefined;
    try {
      const reminder = await (
        await request.post(`${library}/reminders`, {
          headers,
          data: {
            itemId: first.id,
            dueAt: new Date(Date.now() + 3600000).toISOString(),
            timeZone: 'Asia/Kolkata',
            idempotencyKey: randomUUID(),
          },
        })
      ).json();
      await blocker.query('BEGIN');
      await blocker.query(
        'SELECT id FROM discovery_items WHERE id=$1 FOR UPDATE',
        [first.id],
      );
      withdrawing = request.put(`/api/v1/ops/discovery/items/${first.id}`, {
        headers,
        data: {
          expectedVersion: first.version,
          status: 'withdrawn',
          correctionNote: 'Synthetic withdrawal before delivery.',
        },
      });
      void withdrawing.catch(() => undefined);
      const blockerPid = Number(
          (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid,
        ),
        withdrawalPid = await waitForQueryBlocked(
          blocker,
          'SELECT version FROM discovery_items WHERE id=$1 FOR UPDATE',
          [blockerPid],
        );
      await editor.query(
        "UPDATE library_reminders SET due_at=clock_timestamp()-interval '1 second' WHERE id=$1",
        [reminder.id],
      );
      delivering = worker.deliver();
      void delivering!.catch(() => undefined);
      const workerPid = await waitForQueryBlocked(
        blocker,
        'SELECT id FROM discovery_items WHERE id=ANY($1::text[]) ORDER BY id FOR SHARE',
        [blockerPid, withdrawalPid],
      );
      cancelling = request.delete(`${library}/reminders/${reminder.id}`, {
        headers,
        data: { expectedVersion: reminder.version },
      });
      void cancelling.catch(() => undefined);
      await waitForQueryBlocked(
        blocker,
        'SELECT id FROM app_users WHERE id=$1 FOR UPDATE',
        [workerPid],
      );
      await blocker.query('COMMIT');
      expect((await withdrawing).status()).toBe(200);
      await delivering;
      expect((await cancelling).status()).toBe(409);
      const current = LibrarySchema.parse(
        await (await request.get(library)).json(),
      );
      expect(current.reminders[0]?.status).toBe('cancelled');
      expect(current.reminders[0]?.currentStatus).toBe('withdrawn');
      expect(current.notifications).toEqual([]);
      expect(
        (
          await editor.query(
            'SELECT title FROM library_reminders WHERE id=$1',
            [reminder.id],
          )
        ).rows[0].title,
      ).toBe(first.title);
    } finally {
      await blocker.query('ROLLBACK').catch(() => {});
      await Promise.allSettled(
        [withdrawing, cancelling, delivering].filter(Boolean),
      );
      await account.onApplicationShutdown();
      await storage.close();
      await blocker.end();
      await editor.end();
    }
  });
});
