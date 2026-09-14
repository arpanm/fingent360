import { createHash, randomUUID } from 'node:crypto';
import {
  test,
  expect,
  extractionHeaders as headers,
  extractionPath as base,
  extractionInput,
  extractionFixture,
  prepareExtraction,
  extractionDraft,
  extractionDatabase,
  extractionStorage,
  extractionFinancialDigest,
} from '../../helpers/event-extraction';
import {
  prepareConnectionAccount,
  reviseConnectionSourceFixture,
} from '../../helpers/research-connection-fixture';
import { operatorKey } from '../../helpers/operator';
import { waitForQueryBlocked } from '../../helpers/withdrawal-fixture';
import {
  EventExtractionAttemptSchema,
  EventExtractionViewSchema,
  EventExtractionListSchema,
  EventOperationsSchema,
  EventPublicSchema,
  EVENT_EXTRACTION_METHOD,
  eventExtractionMaterial,
  buildEventExtractionCandidate,
  type EventExtractionSelection,
  type EventExtractionView,
} from '../../../../packages/contracts/src/index';

test.use({ trace: 'off', video: 'off', screenshot: 'off' });

test('E2E-API-850 exact template becomes an explicit human draft before separate publication and leaves populated finances unchanged @EVENT-EXTRACTION-001', async ({
  request,
  feedbackSandbox,
}) => {
  const { source } = await extractionFixture(request, feedbackSandbox);
  await prepareConnectionAccount(request);
  const financial = await extractionFinancialDigest(feedbackSandbox),
    prepared = await prepareExtraction(request, source);
  expect(prepared).toMatchObject({
    currentSource: 'current',
    decision: null,
    attempt: {
      status: 'prepared',
      outcome: 'template',
      provider: null,
      model: null,
      methodVersion: EVENT_EXTRACTION_METHOD,
    },
  });
  const candidate = prepared.attempt.candidate!;
  expect(candidate).toEqual(
    buildEventExtractionCandidate(source, candidate.eventId),
  );
  expect(
    (await request.get('/api/v1/events/' + candidate.eventId)).status(),
  ).toBe(404);
  const decision = extractionDraft(prepared),
    path = `${base}/${prepared.attempt.requestId}/decision`;
  const saved = await request.post(path, { headers, data: decision });
  expect(saved.status()).toBe(201);
  const view = EventExtractionViewSchema.parse(await saved.json());
  expect(view.decision).toMatchObject({
    kind: 'draft',
    eventId: candidate.eventId,
    eventVersion: 1,
  });
  expect(view.attempt).toEqual(prepared.attempt);
  expect(
    EventExtractionViewSchema.parse(
      await (await request.post(path, { headers, data: decision })).json(),
    ),
  ).toEqual(view);
  const draft = EventOperationsSchema.parse(
    await (await request.get('/api/v1/ops/events/' + candidate.eventId)).json(),
  );
  expect(draft.state.status).toBe('never-published');
  expect(draft.latest.editorial).toEqual(decision.editorial);
  expect(draft.latest.graph.events[0]?.publicationState).toBe('candidate');
  expect(
    (await request.get('/api/v1/events/' + candidate.eventId)).status(),
  ).toBe(404);
  const review = await request.post(
    '/api/v1/ops/events/' + candidate.eventId + '/review',
    {
      headers,
      data: {
        requestId: randomUUID(),
        expectedVersion: 1,
        status: 'published',
        note: 'Separate human publication of the synthetic editorial draft.',
      },
    },
  );
  expect(review.status()).toBe(201);
  const published = EventPublicSchema.parse(
    await (await request.get('/api/v1/events/' + candidate.eventId)).json(),
  );
  expect(published.status).toBe('published');
  expect(published.event?.version).toBe(2);
  expect(published.event?.editorial).toEqual(decision.editorial);
  expect(await extractionFinancialDigest(feedbackSandbox)).toBe(financial);
});

test('E2E-API-851 immutable prepare and decline replay reject conflicting reuse without creating any event @EVENT-EXTRACTION-001', async ({
  request,
  feedbackSandbox,
}) => {
  const { source } = await extractionFixture(request, feedbackSandbox),
    id = randomUUID();
  const prepared = await prepareExtraction(request, source, id);
  expect(await prepareExtraction(request, source, id)).toEqual(prepared);
  expect(
    (
      await request.put(`${base}/${id}`, {
        headers,
        data: {
          ...extractionInput(source),
          expectedVersion: source.version + 1,
        },
      })
    ).status(),
  ).toBe(409);
  const decision = {
    requestId: randomUUID(),
    kind: 'decline',
    reason: 'Human chose not to turn this source into an event.',
  };
  const response = await request.post(`${base}/${id}/decision`, {
    headers,
    data: decision,
  });
  expect(response.status()).toBe(201);
  const declined = EventExtractionViewSchema.parse(await response.json());
  expect(declined.decision).toMatchObject({
    kind: 'decline',
    eventId: null,
    eventVersion: null,
  });
  expect(
    EventExtractionViewSchema.parse(
      await (
        await request.post(`${base}/${id}/decision`, {
          headers,
          data: decision,
        })
      ).json(),
    ),
  ).toEqual(declined);
  expect(
    (
      await request.post(`${base}/${id}/decision`, {
        headers,
        data: { ...decision, reason: 'Changed decision with reused identity.' },
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await request.post(`${base}/${id}/decision`, {
        headers,
        data: extractionDraft(prepared),
      })
    ).status(),
  ).toBe(409);
  const pool = await extractionDatabase(feedbackSandbox);
  try {
    expect(
      Number(
        (await pool.query('SELECT count(*) AS n FROM reviewed_events')).rows[0]
          .n,
      ),
    ).toBe(0);
    expect(
      Number(
        (
          await pool.query(
            'SELECT count(*) AS n FROM event_extraction_requests',
          )
        ).rows[0].n,
      ),
    ).toBe(1);
    expect(
      Number(
        (
          await pool.query(
            'SELECT count(*) AS n FROM event_extraction_decisions',
          )
        ).rows[0].n,
      ),
    ).toBe(1);
  } finally {
    await pool.end();
  }
});

test('E2E-API-852 withdrawn source keeps its historical operator receipt but cannot create a current event draft @EVENT-EXTRACTION-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const { source } = await extractionFixture(request, feedbackSandbox),
    prepared = await prepareExtraction(request, source);
  await reviseConnectionSourceFixture(feedbackSandbox, source, 'withdrawn');
  const replay = await prepareExtraction(
    request,
    source,
    prepared.attempt.requestId,
  );
  expect(replay.currentSource).toBe('withdrawn');
  expect(replay.attempt).toEqual(prepared.attempt);
  expect(
    (
      await request.post(`${base}/${prepared.attempt.requestId}/decision`, {
        headers,
        data: extractionDraft(prepared),
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await request.put(`${base}/${randomUUID()}`, {
        headers,
        data: extractionInput(source),
      })
    ).status(),
  ).toBe(409);
  const decline = await request.post(
    `${base}/${prepared.attempt.requestId}/decision`,
    {
      headers,
      data: {
        requestId: randomUUID(),
        kind: 'decline',
        reason: 'Discarding a candidate after its source withdrawal.',
      },
    },
  );
  expect(decline.status()).toBe(201);
  expect(
    EventExtractionViewSchema.parse(await decline.json()).currentSource,
  ).toBe('withdrawn');
  const pool = await extractionDatabase(feedbackSandbox);
  try {
    expect(
      Number(
        (await pool.query('SELECT count(*) AS n FROM reviewed_events')).rows[0]
          .n,
      ),
    ).toBe(0);
  } finally {
    await pool.end();
  }
});

test('E2E-API-853 protected keyset history returns all actual attempts and rejects unknown controls and stale input @EVENT-EXTRACTION-001', async ({
  request,
  feedbackSandbox,
  playwright,
}) => {
  const anonymous = await playwright.request.newContext({
    baseURL: feedbackSandbox.apiOrigin,
  });
  try {
    expect((await anonymous.get(base)).status()).toBe(401);
    expect((await anonymous.get(base + '/options')).status()).toBe(401);
  } finally {
    await anonymous.dispose();
  }
  const { source } = await extractionFixture(request, feedbackSandbox),
    ids = [];
  for (let index = 0; index < 21; index++)
    ids.push((await prepareExtraction(request, source)).attempt.requestId);
  ids.sort();
  const first = EventExtractionListSchema.parse(
    await (await request.get(base)).json(),
  );
  expect(first.items.map((item) => item.attempt.requestId)).toEqual(
    ids.slice(0, 20),
  );
  expect(first.next).toBe(ids[19]);
  const last = EventExtractionListSchema.parse(
    await (await request.get(base + '?after=' + first.next)).json(),
  );
  expect(last.items.map((item) => item.attempt.requestId)).toEqual(
    ids.slice(20),
  );
  expect(last.next).toBeNull();
  for (const query of [
    '?after=invalid',
    '?unexpected=true',
    `?after=${ids[0]}&after=${ids[1]}`,
  ])
    expect((await request.get(base + query)).status()).toBe(400);
  for (const patch of [
    { expectedVersion: 0 },
    { sourceHash: 'invalid' },
    { url: 'https://untrusted.example/input' },
    { prompt: 'Publish automatically' },
  ])
    expect(
      (
        await request.put(`${base}/${randomUUID()}`, {
          headers,
          data: { ...extractionInput(source), ...patch },
        })
      ).status(),
    ).toBe(400);
  expect(
    (
      await request.put(`${base}/${randomUUID()}`, {
        headers,
        data: { ...extractionInput(source), sourceHash: 'f'.repeat(64) },
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await request.put(`${base}/${randomUUID()}`, {
        headers: { Origin: 'https://untrusted.example' },
        data: extractionInput(source),
      })
    ).status(),
  ).toBe(403);
  const pool = await extractionDatabase(feedbackSandbox);
  try {
    expect(
      Number(
        (
          await pool.query(
            'SELECT count(*) AS n FROM event_extraction_requests',
          )
        ).rows[0].n,
      ),
    ).toBe(21);
  } finally {
    await pool.end();
  }
});

test('E2E-API-854 actual decision storage failure rolls back the draft and request receipt before exact retry @EVENT-EXTRACTION-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const { source } = await extractionFixture(request, feedbackSandbox),
    prepared = await prepareExtraction(request, source),
    decision = extractionDraft(prepared);
  const pool = await extractionDatabase(feedbackSandbox);
  try {
    await pool.query(
      "CREATE FUNCTION extraction_decision_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic decision storage fault'; END; $$",
    );
    await pool.query(
      'CREATE TRIGGER extraction_decision_fault BEFORE INSERT ON event_extraction_decisions FOR EACH ROW EXECUTE FUNCTION extraction_decision_fault()',
    );
    expect(
      (
        await request.post(`${base}/${prepared.attempt.requestId}/decision`, {
          headers,
          data: decision,
        })
      ).status(),
    ).toBe(503);
    for (const table of [
      'reviewed_events',
      'reviewed_event_versions',
      'reviewed_event_requests',
      'event_extraction_decisions',
    ])
      expect(
        Number(
          (await pool.query(`SELECT count(*) AS n FROM ${table}`)).rows[0].n,
        ),
      ).toBe(0);
    await pool.query(
      'DROP TRIGGER extraction_decision_fault ON event_extraction_decisions',
    );
    expect(
      (
        await request.post(`${base}/${prepared.attempt.requestId}/decision`, {
          headers,
          data: decision,
        })
      ).status(),
    ).toBe(201);
    expect(
      Number(
        (await pool.query('SELECT count(*) AS n FROM reviewed_event_versions'))
          .rows[0].n,
      ),
    ).toBe(1);
    await expect(
      pool.query(
        "UPDATE event_extraction_requests SET status='failed' WHERE id=$1",
        [prepared.attempt.requestId],
      ),
    ).rejects.toThrow();
    await expect(
      pool.query('DELETE FROM event_extraction_decisions'),
    ).rejects.toThrow();
  } finally {
    try {
      await pool.query(
        'DROP TRIGGER IF EXISTS extraction_decision_fault ON event_extraction_decisions',
      );
      await pool.query('DROP FUNCTION IF EXISTS extraction_decision_fault()');
    } finally {
      await pool.end();
    }
  }
});

test('E2E-API-855 actual source-lock waiter loses operator authority before creating an extraction receipt @EVENT-EXTRACTION-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const { source } = await extractionFixture(request, feedbackSandbox),
    id = randomUUID();
  const blocker = await extractionDatabase(feedbackSandbox),
    observer = await extractionDatabase(feedbackSandbox);
  let pending: ReturnType<typeof request.put> | undefined;
  try {
    await blocker.query('BEGIN');
    const pid = Number(
      (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid,
    );
    await blocker.query(
      'SELECT id FROM discovery_items WHERE id=$1 FOR UPDATE',
      [source.id],
    );
    pending = request.put(`${base}/${id}`, {
      headers,
      data: extractionInput(source),
    });
    void pending.catch(() => {});
    await waitForQueryBlocked(
      observer,
      'SELECT id FROM discovery_items WHERE id=ANY($1::text[]) ORDER BY id FOR SHARE',
      [pid],
    );
    await observer.query(
      "UPDATE operator_sessions SET expires_at=clock_timestamp()-interval '1 second' WHERE operator_id IS NULL",
    );
    await blocker.query('ROLLBACK');
    const response = await pending;
    expect(response.status()).toBe(401);
    expect(await response.text()).not.toContain(source.title);
    expect(
      Number(
        (
          await observer.query(
            'SELECT count(*) AS n FROM event_extraction_requests',
          )
        ).rows[0].n,
      ),
    ).toBe(0);
    expect(
      Number(
        (await observer.query('SELECT count(*) AS n FROM reviewed_events'))
          .rows[0].n,
      ),
    ).toBe(0);
  } finally {
    try {
      await blocker.query('ROLLBACK');
      if (pending)
        await pending.then((response) => response.body()).catch(() => {});
    } finally {
      await Promise.all([blocker.end(), observer.end()]);
    }
  }
});

test('E2E-API-856 expiry during the final decision write rolls back its normal event draft and permits authenticated exact retry @EVENT-EXTRACTION-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const { source } = await extractionFixture(request, feedbackSandbox),
    prepared = await prepareExtraction(request, source),
    decision = extractionDraft(prepared);
  const blocker = await extractionDatabase(feedbackSandbox),
    observer = await extractionDatabase(feedbackSandbox);
  let pending: ReturnType<typeof request.post> | undefined;
  try {
    await observer.query(
      'CREATE FUNCTION extraction_decision_wait() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_advisory_xact_lock(360856); RETURN NEW; END; $$',
    );
    await observer.query(
      'CREATE TRIGGER extraction_decision_wait BEFORE INSERT ON event_extraction_decisions FOR EACH ROW EXECUTE FUNCTION extraction_decision_wait()',
    );
    await blocker.query('BEGIN');
    const pid = Number(
      (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid,
    );
    await blocker.query('SELECT pg_advisory_xact_lock(360856)');
    pending = request.post(`${base}/${prepared.attempt.requestId}/decision`, {
      headers,
      data: decision,
    });
    void pending.catch(() => {});
    await waitForQueryBlocked(
      observer,
      'INSERT INTO event_extraction_decisions(request_id,extraction_id,fingerprint,payload) VALUES($1,$2,$3,$4)',
      [pid],
    );
    await observer.query(
      "UPDATE operator_sessions SET expires_at=clock_timestamp()-interval '1 second' WHERE operator_id IS NULL",
    );
    await blocker.query('ROLLBACK');
    const response = await pending;
    expect(response.status()).toBe(401);
    expect(await response.text()).not.toContain(
      prepared.attempt.candidate!.title,
    );
    for (const table of [
      'reviewed_events',
      'reviewed_event_versions',
      'reviewed_event_requests',
      'event_extraction_decisions',
    ])
      expect(
        Number(
          (await observer.query(`SELECT count(*) AS n FROM ${table}`)).rows[0]
            .n,
        ),
      ).toBe(0);
    expect(
      (
        await observer.query(
          'SELECT status FROM event_extraction_requests WHERE id=$1',
          [prepared.attempt.requestId],
        )
      ).rows[0].status,
    ).toBe('prepared');
    await observer.query(
      'DROP TRIGGER extraction_decision_wait ON event_extraction_decisions',
    );
    expect(
      (
        await request.post('/api/v1/ops/session', {
          headers,
          data: { key: await operatorKey() },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await request.post(`${base}/${prepared.attempt.requestId}/decision`, {
          headers,
          data: decision,
        })
      ).status(),
    ).toBe(201);
  } finally {
    try {
      await blocker.query('ROLLBACK');
      if (pending)
        await pending.then((response) => response.body()).catch(() => {});
      await observer.query(
        'DROP TRIGGER IF EXISTS extraction_decision_wait ON event_extraction_decisions',
      );
      await observer.query(
        'DROP FUNCTION IF EXISTS extraction_decision_wait()',
      );
    } finally {
      await Promise.all([blocker.end(), observer.end()]);
    }
  }
});

test('E2E-API-857 actual no-key store uses a labelled template and repairs a simulated interrupted attempt without dispatch @EVENT-EXTRACTION-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const { source } = await extractionFixture(request, feedbackSandbox);
  let calls = 0;
  const storage = await extractionStorage(
    feedbackSandbox,
    request,
    async () => {
      calls++;
      throw Error('No provider may be called by this fixture.');
    },
  );
  const pool = await extractionDatabase(feedbackSandbox);
  try {
    const body = extractionInput(source, 'auto'),
      firstId = randomUUID();
    const value = await storage.store.prepare(firstId, body, storage.authorize);
    expect(value.attempt).toMatchObject({
      status: 'prepared',
      outcome: 'not-configured',
      provider: null,
      model: null,
    });
    expect(
      await storage.store.prepare(firstId, body, storage.authorize),
    ).toEqual(value);
    expect(calls).toBe(0);
    const interruptedId = randomUUID(),
      running = EventExtractionAttemptSchema.parse({
        requestId: interruptedId,
        methodVersion: EVENT_EXTRACTION_METHOD,
        source: {
          id: source.id,
          version: source.version,
          hash: source.sourceHash,
        },
        requestedMethod: 'auto',
        startedAt: new Date().toISOString(),
        finishedAt: null,
        status: 'running',
        outcome: 'pending',
        provider: null,
        model: null,
        candidate: null,
      });
    // Explicit crash-state simulation in real owned storage; this is not an actual provider request.
    await pool.query(
      "INSERT INTO event_extraction_requests(id,fingerprint,input,status,payload) VALUES($1,$2,$3,'running',$4)",
      [
        interruptedId,
        createHash('sha256').update(JSON.stringify(body)).digest('hex'),
        body,
        running,
      ],
    );
    const repaired = await storage.store.prepare(
      interruptedId,
      body,
      storage.authorize,
    );
    expect(repaired.attempt).toMatchObject({
      requestId: interruptedId,
      status: 'failed',
      outcome: 'interrupted',
      candidate: null,
    });
    expect(
      await storage.store.prepare(interruptedId, body, storage.authorize),
    ).toEqual(repaired);
    expect(calls).toBe(0);
    expect(
      EventExtractionViewSchema.parse(
        await (await request.get(`${base}/${interruptedId}`)).json(),
      ),
    ).toEqual(repaired);
    expect(
      Number(
        (await pool.query('SELECT count(*) AS n FROM reviewed_events')).rows[0]
          .n,
      ),
    ).toBe(0);
  } finally {
    await pool.end();
    await storage.close();
  }
});

test('E2E-API-858 injected selection dispatch keeps exact ordered citations and labels invalid-output and transport fallbacks @EVENT-EXTRACTION-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const { source } = await extractionFixture(request, feedbackSandbox),
    material = eventExtractionMaterial(source);
  expect(material.title.length).toBeGreaterThanOrEqual(8);
  const template = buildEventExtractionCandidate(source, randomUUID()),
    bodyExcerpt = template.excerpts[0]!;
  expect(bodyExcerpt.field).toBe('body');
  expect(bodyExcerpt.quote.length).toBeGreaterThan(8);
  const selections: EventExtractionSelection[] = [
    { field: 'title', start: 0, end: material.title.length },
    {
      field: bodyExcerpt.field,
      start: bodyExcerpt.start,
      end: bodyExcerpt.end,
    },
  ];
  let mode: 'model' | 'invalid' | 'throw' = 'model',
    calls = 0;
  const storage = await extractionStorage(
    feedbackSandbox,
    request,
    async (_config, provider, instructions, supplied) => {
      calls++;
      expect(provider).toBe('openai');
      expect(instructions).toContain('untrusted');
      expect(JSON.parse(supplied)).toEqual(material);
      expect(Buffer.byteLength(supplied, 'utf8')).toBeLessThanOrEqual(24576);
      if (mode === 'throw')
        throw Error('Synthetic controlled transport failure');
      return mode === 'invalid'
        ? JSON.stringify({
            selections,
            rawSecret: 'SYNTHETIC_UNVALIDATED_OUTPUT',
          })
        : JSON.stringify({ selections });
    },
    { remote: true },
  );
  try {
    const id = randomUUID(),
      input = extractionInput(source, 'openai'),
      prepared = await storage.store.prepare(id, input, storage.authorize);
    expect(prepared.attempt).toMatchObject({
      status: 'prepared',
      outcome: 'model',
      provider: 'openai',
      model: 'synthetic-excerpt-selector',
    });
    expect(prepared.attempt.candidate).toEqual(
      buildEventExtractionCandidate(
        source,
        prepared.attempt.candidate!.eventId,
        selections,
      ),
    );
    expect(await storage.store.prepare(id, input, storage.authorize)).toEqual(
      prepared,
    );
    expect(calls).toBe(1);
    const draft = extractionDraft(prepared),
      path = `${base}/${id}/decision`;
    // All of these alternatives still quote real source text, but none preserve
    // the retained candidate's complete ordered excerpt selection.
    for (const citations of [
      [...draft.editorial.citations].reverse(),
      draft.editorial.citations.slice(0, 1),
      [
        draft.editorial.citations[0]!,
        {
          ...draft.editorial.citations[1]!,
          quote: draft.editorial.citations[1]!.quote.slice(1),
        },
      ],
    ])
      expect(
        (
          await request.post(path, {
            headers,
            data: {
              ...draft,
              requestId: randomUUID(),
              editorial: { ...draft.editorial, citations },
            },
          })
        ).status(),
      ).toBe(400);
    expect((await request.post(path, { headers, data: draft })).status()).toBe(
      201,
    );
    expect(
      (
        await request.get(
          '/api/v1/events/' + prepared.attempt.candidate!.eventId,
        )
      ).status(),
    ).toBe(404);
    mode = 'invalid';
    const invalid = await storage.store.prepare(
      randomUUID(),
      input,
      storage.authorize,
    );
    expect(invalid.attempt.outcome).toBe('invalid-selection');
    expect(invalid.attempt.status).toBe('prepared');
    expect(invalid.attempt.candidate).toEqual(
      buildEventExtractionCandidate(source, invalid.attempt.candidate!.eventId),
    );
    expect(JSON.stringify(invalid)).not.toContain(
      'SYNTHETIC_UNVALIDATED_OUTPUT',
    );
    mode = 'throw';
    const failedProvider = await storage.store.prepare(
      randomUUID(),
      input,
      storage.authorize,
    );
    expect(failedProvider.attempt).toMatchObject({
      status: 'prepared',
      outcome: 'provider-failed',
      provider: 'openai',
      model: 'synthetic-excerpt-selector',
    });
    expect(failedProvider.attempt.candidate).toEqual(
      buildEventExtractionCandidate(
        source,
        failedProvider.attempt.candidate!.eventId,
      ),
    );
    expect(calls).toBe(3);
  } finally {
    await storage.close();
  }
});

test('E2E-API-859 actual cross-instance remote gate and hourly bound leave templates and no-key fallback independent @EVENT-EXTRACTION-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const { source } = await extractionFixture(request, feedbackSandbox);
  const excerpt = buildEventExtractionCandidate(source, randomUUID())
    .excerpts[0]!;
  const output = JSON.stringify({
    selections: [
      { field: excerpt.field, start: excerpt.start, end: excerpt.end },
    ],
  });
  let release!: () => void,
    entered = false,
    firstCalls = 0,
    secondCalls = 0;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const stores: Awaited<ReturnType<typeof extractionStorage>>[] = [];
  let pending: Promise<EventExtractionView> | undefined;
  const pool = await extractionDatabase(feedbackSandbox);
  try {
    const first = await extractionStorage(
      feedbackSandbox,
      request,
      async () => {
        firstCalls++;
        entered = true;
        await gate;
        return output;
      },
      { remote: true },
    );
    stores.push(first);
    const second = await extractionStorage(
      feedbackSandbox,
      request,
      async () => {
        secondCalls++;
        return output;
      },
      { remote: true },
    );
    stores.push(second);
    const firstId = randomUUID(),
      blockedId = randomUUID(),
      input = extractionInput(source, 'openai');
    pending = first.store.prepare(firstId, input, first.authorize);
    void pending.catch(() => {});
    await expect.poll(() => entered).toBe(true);
    await expect(
      second.store.prepare(firstId, input, second.authorize),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      second.store.prepare(blockedId, input, second.authorize),
    ).rejects.toMatchObject({ status: 409 });
    expect(secondCalls).toBe(0);
    expect(
      Number(
        (
          await pool.query(
            'SELECT count(*) AS n FROM event_extraction_requests WHERE id=$1',
            [blockedId],
          )
        ).rows[0].n,
      ),
    ).toBe(0);
    expect(
      (
        await second.store.prepare(
          randomUUID(),
          extractionInput(source),
          second.authorize,
        )
      ).attempt.outcome,
    ).toBe('template');
    release();
    expect((await pending).attempt.outcome).toBe('model');
    // Explicit bounded-limit fault setup, not20 invented provider requests.
    await pool.query(
      "UPDATE event_extraction_remote_window SET starts=20,resets_at=clock_timestamp()+interval '1 hour' WHERE id=1",
    );
    const limited = randomUUID();
    await expect(
      second.store.prepare(limited, input, second.authorize),
    ).rejects.toMatchObject({ status: 429 });
    expect(
      Number(
        (
          await pool.query(
            'SELECT count(*) AS n FROM event_extraction_requests WHERE id=$1',
            [limited],
          )
        ).rows[0].n,
      ),
    ).toBe(0);
    expect(
      (
        await second.store.prepare(
          randomUUID(),
          extractionInput(source),
          second.authorize,
        )
      ).attempt.outcome,
    ).toBe('template');
    const noKey = await extractionStorage(
      feedbackSandbox,
      request,
      async () => {
        throw Error('No-key fallback must never dispatch.');
      },
    );
    stores.push(noKey);
    expect(
      (
        await noKey.store.prepare(
          randomUUID(),
          extractionInput(source, 'auto'),
          noKey.authorize,
        )
      ).attempt.outcome,
    ).toBe('not-configured');
    await pool.query(
      "UPDATE event_extraction_remote_window SET resets_at=clock_timestamp()-interval '1 second' WHERE id=1",
    );
    expect(
      (await second.store.prepare(randomUUID(), input, second.authorize))
        .attempt.outcome,
    ).toBe('model');
    expect(
      (
        await pool.query(
          'SELECT starts FROM event_extraction_remote_window WHERE id=1',
        )
      ).rows[0].starts,
    ).toBe(1);
    expect(firstCalls).toBe(1);
    expect(secondCalls).toBe(1);
  } finally {
    release();
    await pending?.catch(() => {});
    await pool.end();
    await Promise.all(stores.map((storage) => storage.close()));
  }
});

test('E2E-API-860 source withdrawal while injected dispatch is pending prevents any candidate or event and replays without redispatch @EVENT-EXTRACTION-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const { source } = await extractionFixture(request, feedbackSandbox);
  const excerpt = buildEventExtractionCandidate(source, randomUUID())
    .excerpts[0]!;
  let release!: () => void,
    entered = false,
    calls = 0;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const storage = await extractionStorage(
    feedbackSandbox,
    request,
    async () => {
      calls++;
      entered = true;
      await gate;
      return JSON.stringify({
        selections: [
          { field: excerpt.field, start: excerpt.start, end: excerpt.end },
        ],
      });
    },
    { remote: true },
  );
  let pending: Promise<EventExtractionView> | undefined;
  try {
    const id = randomUUID(),
      input = extractionInput(source, 'openai');
    pending = storage.store.prepare(id, input, storage.authorize);
    void pending.catch(() => {});
    await expect.poll(() => entered).toBe(true);
    await reviseConnectionSourceFixture(feedbackSandbox, source, 'withdrawn');
    release();
    const result = await pending;
    expect(result).toMatchObject({
      currentSource: 'withdrawn',
      decision: null,
      attempt: { status: 'failed', outcome: 'source-changed', candidate: null },
    });
    expect(await storage.store.prepare(id, input, storage.authorize)).toEqual(
      result,
    );
    expect(calls).toBe(1);
    const actual = EventExtractionViewSchema.parse(
      await (await request.get(`${base}/${id}`)).json(),
    );
    expect(actual).toEqual(result);
    expect(JSON.stringify(actual)).not.toContain(excerpt.quote);
    const pool = await extractionDatabase(feedbackSandbox);
    try {
      expect(
        Number(
          (await pool.query('SELECT count(*) AS n FROM reviewed_events'))
            .rows[0].n,
        ),
      ).toBe(0);
    } finally {
      await pool.end();
    }
  } finally {
    release();
    await pending?.catch(() => {});
    await storage.close();
  }
});

test('E2E-API-861 actual final candidate storage failure leaves a safe immutable failure receipt and no partial event @EVENT-EXTRACTION-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const { source } = await extractionFixture(request, feedbackSandbox),
    id = randomUUID(),
    pool = await extractionDatabase(feedbackSandbox);
  try {
    await pool.query(
      "CREATE FUNCTION extraction_prepare_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic final candidate storage fault'; END; $$",
    );
    await pool.query(
      "CREATE TRIGGER extraction_prepare_fault BEFORE UPDATE ON event_extraction_requests FOR EACH ROW WHEN (NEW.status='prepared') EXECUTE FUNCTION extraction_prepare_fault()",
    );
    expect(
      (
        await request.put(`${base}/${id}`, {
          headers,
          data: extractionInput(source),
        })
      ).status(),
    ).toBe(503);
    const stored = EventExtractionAttemptSchema.parse(
      (
        await pool.query(
          'SELECT payload FROM event_extraction_requests WHERE id=$1',
          [id],
        )
      ).rows[0].payload,
    );
    expect(stored).toMatchObject({
      status: 'failed',
      outcome: 'storage',
      candidate: null,
    });
    expect(
      Number(
        (await pool.query('SELECT count(*) AS n FROM reviewed_events')).rows[0]
          .n,
      ),
    ).toBe(0);
    await pool.query(
      'DROP TRIGGER extraction_prepare_fault ON event_extraction_requests',
    );
    const replay = EventExtractionViewSchema.parse(
      await (
        await request.put(`${base}/${id}`, {
          headers,
          data: extractionInput(source),
        })
      ).json(),
    );
    expect(replay.attempt).toEqual(stored);
    expect(replay.currentSource).toBe('current');
    expect(
      Number(
        (
          await pool.query(
            'SELECT count(*) AS n FROM event_extraction_requests',
          )
        ).rows[0].n,
      ),
    ).toBe(1);
  } finally {
    try {
      await pool.query(
        'DROP TRIGGER IF EXISTS extraction_prepare_fault ON event_extraction_requests',
      );
      await pool.query('DROP FUNCTION IF EXISTS extraction_prepare_fault()');
    } finally {
      await pool.end();
    }
  }
});

test.describe('Extraction uses existing independent named publication', () => {
  test.use({ namedOperators: true });
  test('E2E-API-862 named human draft still requires a distinct real publisher and retains its original extraction decision @EVENT-EXTRACTION-001 @NAMED-OPERATORS-001', async ({
    request,
    feedbackSandbox,
    playwright,
  }) => {
    const { source } = await extractionFixture(request, feedbackSandbox),
      prepared = await prepareExtraction(request, source),
      decision = extractionDraft(prepared);
    const response = await request.post(
      `${base}/${prepared.attempt.requestId}/decision`,
      { headers, data: decision },
    );
    expect(response.status()).toBe(201);
    const decided = EventExtractionViewSchema.parse(await response.json()),
      id = prepared.attempt.candidate!.eventId;
    const review = {
      requestId: randomUUID(),
      expectedVersion: 1,
      status: 'published',
      note: 'Independent named review of the human-edited extracted context.',
    };
    expect(
      (
        await request.post('/api/v1/ops/events/' + id + '/review', {
          headers,
          data: review,
        })
      ).status(),
    ).toBe(403);
    const proposal = randomUUID();
    expect(
      (
        await request.put('/api/v1/ops/proposals/' + proposal, {
          headers,
          data: { kind: 'event', target: id, body: review },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await request.post('/api/v1/ops/proposals/' + proposal + '/approve', {
          headers,
          data: { note: 'Same actor may not independently publish.' },
        })
      ).status(),
    ).toBe(403);
    const credentials = {
      username: 'extract_pub_' + randomUUID().slice(0, 8),
      password: 'Synthetic-extraction-publisher-2026',
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
    try {
      expect(
        (
          await publisher.post('/api/v1/ops/session', {
            headers,
            data: credentials,
          })
        ).status(),
      ).toBe(200);
      const approved = await publisher.post(
        '/api/v1/ops/proposals/' + proposal + '/approve',
        {
          headers,
          data: {
            note: 'Distinct actor reviewed and approved the normal draft.',
          },
        },
      );
      expect(approved.status()).toBe(201);
      const current = EventPublicSchema.parse(
        await (await request.get('/api/v1/events/' + id)).json(),
      );
      expect(current.status).toBe('published');
      expect(current.event?.version).toBe(2);
      const receipt = EventExtractionViewSchema.parse(
        await (
          await request.get(`${base}/${prepared.attempt.requestId}`)
        ).json(),
      );
      expect(receipt.decision).toEqual(decided.decision);
      expect(receipt.decision?.eventVersion).toBe(1);
    } finally {
      await publisher.dispose();
    }
  });
});
