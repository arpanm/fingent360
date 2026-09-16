import { randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/app-fixture';
import {
  prepareReportResearch,
  issuedResearchReport,
  reportResearchBase as base,
} from '../../helpers/report-research-fixture';
import {
  connectionDatabase,
  connectionHeaders as headers,
  connectionPassword,
  connectionGoal,
  prepareConnectionAccount,
  reviseConnectionSourceFixture,
} from '../../helpers/research-connection-fixture';
import {
  ReportJobSchema,
  RecordReportV1Schema,
  RecordReportV2Schema,
  PrivacyExportSchema,
  issueRecordReport,
  type ReportConnectionSelection,
  type ReportJob,
} from '../../../../packages/contracts/src/index';
const input = (researchConnections?: ReportConnectionSelection[]) => ({
  requestId: randomUUID(),
  label: 'Synthetic selected research report',
  consent: true,
  ...(researchConnections ? { researchConnections } : {}),
});
function capture(job: ReportJob) {
  if (!('researchConnections' in job.snapshot))
    throw Error('Expected an actual captured v2 report');
  return job.snapshot.researchConnections;
}

test('E2E-API-290 v1 stays exact and selected v2 reconstructs actual dated receipts without changing financial arithmetic @REPORTS-003', async ({
  request,
  feedbackSandbox,
}) => {
  const setup = await prepareReportResearch(request, feedbackSandbox);
  const before = PrivacyExportSchema.parse(
    await (await request.get('/api/v1/account/privacy/export')).json(),
  );
  const v1 = ReportJobSchema.parse(
    await (await request.post(base, { headers, data: input() })).json(),
  );
  const v2 = ReportJobSchema.parse(
    await (
      await request.post(base, { headers, data: input(setup.selected) })
    ).json(),
  );
  const issuedV1 = (await issuedResearchReport(request, v1.id)).report!;
  const issuedV2 = (await issuedResearchReport(request, v2.id)).report!;
  expect(RecordReportV1Schema.parse(issuedV1).policy).toBe(
    'saved-record-review-v1',
  );
  expect(issuedV1.snapshot).not.toHaveProperty('researchConnections');
  expect(issuedV1).toEqual(
    issueRecordReport(v1.id, v1.label, v1.snapshot, issuedV1.issuedAt),
  );
  expect(RecordReportV2Schema.parse(issuedV2).snapshot).toEqual(v2.snapshot);
  expect(issuedV2).toEqual(
    issueRecordReport(v2.id, v2.label, v2.snapshot, issuedV2.issuedAt),
  );
  expect(
    capture(v2)
      .receipts.map((r) => r.revision)
      .sort((a, b) => a.id.localeCompare(b.id)),
  ).toEqual([...setup.revisions].sort((a, b) => a.id.localeCompare(b.id)));
  expect(
    capture(v2).receipts.every(
      (r) =>
        r.reviewReasons.length === 0 &&
        r.sourceAtCapture?.sourceHash === setup.source.sourceHash,
    ),
  ).toBe(true);
  expect(capture(v2).bundleGeneratedAt).toBeNull();
  for (const field of [
    'goalReviews',
    'recordedHoldingsCostMinor',
    'allocationReview',
    'allocationsRequireReview',
  ] as const)
    expect(issuedV2[field]).toEqual(issuedV1[field]);
  expect(await (await request.get(`${base}/${v2.id}/download`)).json()).toEqual(
    issuedV2,
  );
  const after = PrivacyExportSchema.parse(
    await (await request.get('/api/v1/account/privacy/export')).json(),
  );
  expect(after.holdings).toEqual(before.holdings);
  expect(after.goals).toEqual(before.goals);
  expect(after.allocations).toEqual(before.allocations);
  expect(after.researchConnections).toEqual(before.researchConnections);
});

test('E2E-API-291 canonical same-request replay preserves capture and rejects changed selection versions labels or v1 mode @REPORTS-003', async ({
  request,
  feedbackSandbox,
}) => {
  const setup = await prepareReportResearch(request, feedbackSandbox),
    body = input(setup.selected);
  const responses = await Promise.all([
    request.post(base, { headers, data: body }),
    request.post(base, {
      headers,
      data: { ...body, researchConnections: [...setup.selected].reverse() },
    }),
  ]);
  expect(responses.map((r) => r.status())).toEqual([201, 201]);
  const first = ReportJobSchema.parse(await responses[0]!.json());
  expect(ReportJobSchema.parse(await responses[1]!.json()).snapshot).toEqual(
    first.snapshot,
  );
  for (const changed of [
    { ...body, researchConnections: [setup.selected[0]] },
    {
      ...body,
      researchConnections: setup.selected.map((r) => ({ ...r, version: 2 })),
    },
    { ...body, label: 'Different label' },
    { requestId: body.requestId, label: body.label, consent: true },
  ])
    expect(
      (await request.post(base, { headers, data: changed })).status(),
    ).toBe(409);
  await request.put(
    `/api/v1/account/research-connections/${setup.revisions[0]!.id}`,
    {
      headers,
      data: { action: 'remove', requestId: randomUUID(), expectedVersion: 1 },
    },
  );
  await reviseConnectionSourceFixture(
    feedbackSandbox,
    setup.source,
    'withdrawn',
  );
  expect(
    ReportJobSchema.parse(
      await (await request.post(base, { headers, data: body })).json(),
    ).snapshot,
  ).toEqual(first.snapshot);
  expect((await (await request.get(base)).json()).capacity.used).toBe(1);
});

test('E2E-API-292 foreign missing removed and stale connections fail atomically without consuming report quota @REPORTS-003', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const setup = await prepareReportResearch(request, feedbackSandbox);
  const other = await playwright.request.newContext({
    baseURL: feedbackSandbox.apiOrigin,
  });
  try {
    await prepareConnectionAccount(other);
    expect(
      (
        await other.post(base, { headers, data: input(setup.selected) })
      ).status(),
    ).toBe(404);
  } finally {
    await other.dispose();
  }
  expect(
    (
      await request.post(base, {
        headers,
        data: input([{ id: randomUUID(), version: 1 }]),
      })
    ).status(),
  ).toBe(404);
  const revision = setup.revisions[0]!;
  await request.put(`/api/v1/account/research-connections/${revision.id}`, {
    headers,
    data: {
      action: 'edit',
      requestId: randomUUID(),
      expectedVersion: 1,
      note: 'Newly edited personal reason',
      storageConsent: true,
    },
  });
  expect(
    (
      await request.post(base, { headers, data: input(setup.selected) })
    ).status(),
  ).toBe(409);
  await request.put(`/api/v1/account/research-connections/${revision.id}`, {
    headers,
    data: { action: 'remove', requestId: randomUUID(), expectedVersion: 2 },
  });
  expect(
    (
      await request.post(base, {
        headers,
        data: input([{ id: revision.id, version: 3 }]),
      })
    ).status(),
  ).toBe(404);
  expect((await (await request.get(base)).json()).jobs).toEqual([]);
  const pool = await connectionDatabase(feedbackSandbox);
  try {
    expect(
      (await pool.query('SELECT * FROM record_report_request_limits')).rows,
    ).toEqual([]);
  } finally {
    await pool.end();
  }
});

test('E2E-API-293 strict opt-in bounds duplicates origin and unknown fields reject unreviewed selections @REPORTS-003', async ({
  request,
  feedbackSandbox,
}) => {
  const setup = await prepareReportResearch(request, feedbackSandbox),
    body = input(setup.selected);
  for (const invalid of [
    { ...body, consent: false },
    { ...body, researchConnections: [] },
    { ...body, researchConnections: [setup.selected[0], setup.selected[0]] },
    {
      ...body,
      researchConnections: Array.from({ length: 21 }, () => ({
        id: randomUUID(),
        version: 1,
      })),
    },
    {
      ...body,
      researchConnections: [{ ...setup.selected[0], sourceText: 'untrusted' }],
    },
    {
      ...body,
      researchConnections: [{ id: setup.selected[0]!.id, version: 0 }],
    },
    { ...body, ownerId: randomUUID() },
  ])
    expect(
      (await request.post(base, { headers, data: invalid })).status(),
    ).toBe(400);
  expect(
    (
      await request.post(base, {
        headers: { Origin: 'https://untrusted.example' },
        data: body,
      })
    ).status(),
  ).toBe(403);
  expect((await (await request.get(base)).json()).jobs).toEqual([]);
});

test('E2E-API-294 source and goal changes at capture retain original bindings with actual review context @REPORTS-003 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const setup = await prepareReportResearch(request, feedbackSandbox);
  const next = await reviseConnectionSourceFixture(
    feedbackSandbox,
    setup.source,
    'published',
  );
  expect(
    (
      await request.put(`/api/v1/account/goals/${setup.goal.id}`, {
        headers,
        data: {
          expectedVersion: 1,
          goal: { ...connectionGoal, name: 'Changed before report capture' },
        },
      })
    ).status(),
  ).toBe(200);
  const first = ReportJobSchema.parse(
    await (
      await request.post(base, { headers, data: input(setup.selected) })
    ).json(),
  );
  const receipt = capture(first).receipts.find(
    (r) => r.revision.target.binding.kind === 'goal',
  )!;
  expect(receipt.revision.target.binding.version).toBe(1);
  expect(receipt.targetAtCapture!.binding.version).toBe(2);
  expect(receipt.sourceAtCapture!.version).toBe(next.version);
  expect(receipt.revision.source.version).toBe(setup.source.version);
  expect(receipt.reviewReasons.join(' ')).toContain('newer');
  expect(receipt.reviewReasons.join(' ')).toContain('changed');
  await reviseConnectionSourceFixture(feedbackSandbox, next, 'withdrawn');
  await request.delete(`/api/v1/account/goals/${setup.goal.id}`, {
    headers,
    data: { expectedVersion: 2 },
  });
  const second = ReportJobSchema.parse(
    await (
      await request.post(base, { headers, data: input(setup.selected) })
    ).json(),
  );
  const withdrawn = capture(second).receipts.find(
    (r) => r.revision.target.binding.kind === 'goal',
  )!;
  expect(withdrawn.sourceAtCapture).toBeNull();
  expect(withdrawn.targetAtCapture).toBeNull();
  expect(withdrawn.reviewReasons.join(' ')).toContain('withdrawn');
  expect(JSON.stringify(capture(second))).not.toContain(setup.source.title);
  expect(withdrawn.revision.source).not.toHaveProperty('body');
  expect((await issuedResearchReport(request, first.id)).snapshot).toEqual(
    first.snapshot,
  );
  expect(
    (await issuedResearchReport(request, second.id)).report!.snapshot,
  ).toEqual(second.snapshot);
});

test('E2E-API-295 source lock waits observe publication and reject a session that expires before snapshot storage @REPORTS-003 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const setup = await prepareReportResearch(request, feedbackSandbox),
    pool = await connectionDatabase(feedbackSandbox),
    blocker = await pool.connect();
  let pending: ReturnType<typeof request.post> | undefined,
    locked = false;
  try {
    await blocker.query('BEGIN');
    locked = true;
    await blocker.query(
      'SELECT id FROM discovery_items WHERE id=$1 FOR UPDATE',
      [setup.source.id],
    );
    const withdrawn = {
      ...setup.source,
      version: setup.source.version + 1,
      status: 'withdrawn',
      correctionNote: 'Synthetic concurrent report capture withdrawal.',
    };
    await blocker.query(
      'INSERT INTO discovery_versions(item_id,version,data) VALUES($1,$2,$3)',
      [setup.source.id, withdrawn.version, withdrawn],
    );
    await blocker.query('UPDATE discovery_items SET version=$2 WHERE id=$1', [
      setup.source.id,
      withdrawn.version,
    ]);
    pending = request.post(base, { headers, data: input(setup.selected) });
    await expect
      .poll(
        async () => {
          await blocker.query('SELECT pg_stat_clear_snapshot()');
          return (
            await blocker.query(
              "SELECT count(*)::int AS count FROM pg_stat_activity a WHERE wait_event_type='Lock' AND query='SELECT id FROM discovery_items WHERE id=ANY($1::text[]) ORDER BY id FOR SHARE' AND EXISTS(SELECT 1 FROM pg_locks l WHERE l.pid=a.pid AND l.relation='discovery_items'::regclass)",
            )
          ).rows[0].count;
        },
        { timeout: 3000 },
      )
      .toBe(1);
    await blocker.query('COMMIT');
    locked = false;
    const response = await pending;
    expect(response.status()).toBe(201);
    const job = ReportJobSchema.parse(await response.json());
    expect(
      capture(job).receipts.every(
        (r) =>
          r.sourceAtCapture === null &&
          r.reviewReasons.join(' ').includes('withdrawn'),
      ),
    ).toBe(true);
    await blocker.query('BEGIN');
    locked = true;
    await blocker.query(
      'SELECT id FROM discovery_items WHERE id=$1 FOR UPDATE',
      [setup.source.id],
    );
    pending = request.post(base, { headers, data: input(setup.selected) });
    await expect
      .poll(
        async () => {
          await blocker.query('SELECT pg_stat_clear_snapshot()');
          return (
            await blocker.query(
              "SELECT count(*)::int AS count FROM pg_stat_activity a WHERE wait_event_type='Lock' AND query='SELECT id FROM discovery_items WHERE id=ANY($1::text[]) ORDER BY id FOR SHARE' AND EXISTS(SELECT 1 FROM pg_locks l WHERE l.pid=a.pid AND l.relation='discovery_items'::regclass)",
            )
          ).rows[0].count;
        },
        { timeout: 3000 },
      )
      .toBe(1);
    // Expire this fixture's admitted session while it waits. The root AUTH-WAIT
    // dependency uses clock_timestamp(), so the transaction start cannot renew it.
    await blocker.query(
      'UPDATE app_sessions SET expires_at=clock_timestamp() WHERE user_id=(SELECT user_id FROM record_report_jobs WHERE id=$1)',
      [job.id],
    );
    await blocker.query('COMMIT');
    locked = false;
    expect((await pending).status()).toBe(401);
    expect(
      (
        await blocker.query(
          'SELECT count(*)::int AS count FROM record_report_jobs',
        )
      ).rows[0].count,
    ).toBe(1);
    expect(
      (await blocker.query('SELECT used FROM record_report_request_limits'))
        .rows[0].used,
    ).toBe(1);
  } finally {
    if (locked) await blocker.query('ROLLBACK').catch(() => {});
    await pending?.catch(() => {});
    blocker.release();
    await pool.end();
  }
});

test('E2E-API-296 worker retry uses only the captured v2 snapshot after later source and record changes @REPORTS-003 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const setup = await prepareReportResearch(request, feedbackSandbox),
    pool = await connectionDatabase(feedbackSandbox);
  const created = ReportJobSchema.parse(
    await (
      await request.post(base, { headers, data: input(setup.selected) })
    ).json(),
  );
  try {
    // Explicit fault state in the owned fixture; the actual worker performs retry.
    await pool.query(
      "UPDATE record_report_jobs SET status='failed',attempts=3,lease_id=NULL,lease_until=NULL,next_attempt_at=NULL,version=version+1 WHERE id=$1",
      [created.id],
    );
    await pool.query('DELETE FROM record_reports WHERE job_id=$1', [
      created.id,
    ]);
    await reviseConnectionSourceFixture(
      feedbackSandbox,
      setup.source,
      'withdrawn',
    );
    await request.put(`/api/v1/account/goals/${setup.goal.id}`, {
      headers,
      data: {
        expectedVersion: 1,
        goal: { ...connectionGoal, monthlyMinor: '9000' },
      },
    });
    const failed = ReportJobSchema.parse(
      await (await request.get(`${base}/${created.id}`)).json(),
    );
    expect(
      (
        await request.post(`${base}/${created.id}/retry`, {
          headers,
          data: { expectedVersion: failed.version },
        })
      ).status(),
    ).toBe(201);
    const issued = await issuedResearchReport(request, created.id);
    expect(issued.snapshot).toEqual(created.snapshot);
    expect(issued.report).toEqual(
      issueRecordReport(
        created.id,
        created.label,
        created.snapshot,
        issued.report!.issuedAt,
      ),
    );
    expect(
      capture(issued).receipts.every(
        (r) => r.sourceAtCapture !== null && r.reviewReasons.length === 0,
      ),
    ).toBe(true);
  } finally {
    await pool.end();
  }
});

test('E2E-API-297 cancellation deletion and actual late finish cannot recreate selected private report content @REPORTS-003 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const setup = await prepareReportResearch(request, feedbackSandbox),
    body = input(setup.selected);
  const job = ReportJobSchema.parse(
      await (await request.post(base, { headers, data: body })).json(),
    ),
    pool = await connectionDatabase(feedbackSandbox),
    lease = randomUUID();
  try {
    await pool.query(
      "UPDATE record_report_jobs SET status='running',lease_id=$2,lease_until=now()+interval '5 minutes',version=version+1 WHERE id=$1",
      [job.id, lease],
    );
    const running = ReportJobSchema.parse(
      await (await request.get(`${base}/${job.id}`)).json(),
    );
    expect(
      (
        await request.delete(`${base}/${job.id}`, {
          headers,
          data: { expectedVersion: running.version, confirm: true },
        })
      ).status(),
    ).toBe(409);
    const cancelled = ReportJobSchema.parse(
      await (
        await request.post(`${base}/${job.id}/cancel`, {
          headers,
          data: { expectedVersion: running.version },
        })
      ).json(),
    );
    const removed = await request.delete(`${base}/${job.id}`, {
      headers,
      data: { expectedVersion: cancelled.version, confirm: true },
    });
    expect(removed.status()).toBe(200);
    const { spawn } = await import('node:child_process'),
      { fileURLToPath } = await import('node:url');
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [
          fileURLToPath(
            new URL('../../helpers/report-finish-process.mjs', import.meta.url),
          ),
        ],
        { stdio: ['pipe', 'ignore', 'ignore'] },
      );
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(Error('Owned late-finish fixture timed out'));
      }, 10000);
      child.once('error', () => {
        clearTimeout(timer);
        reject(Error('Could not start actual late-finish fixture'));
      });
      child.once('exit', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else reject(Error('Actual late finish failed'));
      });
      child.stdin.on('error', () => {});
      child.stdin.end(
        JSON.stringify({
          databaseUrl: feedbackSandbox.databaseUrl,
          schema: feedbackSandbox.schema,
          id: job.id,
          lease,
          report: issueRecordReport(
            job.id,
            job.label,
            job.snapshot,
            new Date().toISOString(),
          ),
        }),
      );
    });
    expect((await request.post(base, { headers, data: body })).status()).toBe(
      410,
    );
    expect((await request.get(`${base}/${job.id}/download`)).status()).toBe(
      404,
    );
    expect(
      (
        await pool.query('SELECT * FROM record_reports WHERE job_id=$1', [
          job.id,
        ])
      ).rows,
    ).toEqual([]);
    const exported = PrivacyExportSchema.parse(
      await (await request.get('/api/v1/account/privacy/export')).json(),
    );
    expect(exported.reports.deletions).toEqual([await removed.json()]);
    expect(exported.reports.jobs).toEqual([]);
    expect(exported.researchConnections.revisions).toHaveLength(2);
  } finally {
    await pool.end();
  }
});

test('E2E-API-298 v2 shares capacity and hourly budget while deletion and identical replay stay available @REPORTS-003 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const setup = await prepareReportResearch(request, feedbackSandbox),
    body = input(setup.selected);
  const first = await issuedResearchReport(
      request,
      ReportJobSchema.parse(
        await (await request.post(base, { headers, data: body })).json(),
      ).id,
    ),
    pool = await connectionDatabase(feedbackSandbox);
  try {
    // Explicit capacity fixture, using the actual captured v2 shape in this owner/schema.
    await pool.query(
      "INSERT INTO record_report_jobs(id,user_id,label,snapshot,status,next_attempt_at) SELECT x,j.user_id,'Synthetic capacity fixture',$3::jsonb,'cancelled',NULL FROM record_report_jobs j CROSS JOIN unnest($2::uuid[]) x WHERE j.id=$1",
      [
        first.id,
        Array.from({ length: 99 }, () => randomUUID()),
        first.snapshot,
      ],
    );
    expect(
      (
        await request.post(base, { headers, data: input(setup.selected) })
      ).status(),
    ).toBe(400);
    expect((await request.post(base, { headers, data: body })).status()).toBe(
      201,
    );
    await pool.query(
      'UPDATE record_report_request_limits SET used=100 WHERE user_id=(SELECT user_id FROM record_report_jobs WHERE id=$1)',
      [first.id],
    );
    expect(
      (
        await request.delete(`${base}/${first.id}`, {
          headers,
          data: { expectedVersion: first.version, confirm: true },
        })
      ).status(),
    ).toBe(200);
    expect((await (await request.get(base)).json()).capacity.used).toBe(99);
    expect(
      (
        await request.post(base, { headers, data: input(setup.selected) })
      ).status(),
    ).toBe(429);
    expect((await request.post(base, { headers, data: body })).status()).toBe(
      410,
    );
  } finally {
    await pool.end();
  }
});

test('E2E-API-299 v1 v2 exports ownership and account cascade preserve immutable issued copies until explicit deletion @REPORTS-003', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const setup = await prepareReportResearch(request, feedbackSandbox);
  const jobs = [];
  for (const body of [input(), input(setup.selected)])
    jobs.push(
      await issuedResearchReport(
        request,
        ReportJobSchema.parse(
          await (await request.post(base, { headers, data: body })).json(),
        ).id,
      ),
    );
  const exported = PrivacyExportSchema.parse(
    await (await request.get('/api/v1/account/privacy/export')).json(),
  );
  expect(exported.reports.jobs).toHaveLength(2);
  for (const job of jobs)
    expect(exported.reports.jobs.find((j) => j.id === job.id)?.report).toEqual(
      job.report,
    );
  const other = await playwright.request.newContext({
    baseURL: feedbackSandbox.apiOrigin,
  });
  try {
    await prepareConnectionAccount(other);
    for (const job of jobs) {
      expect((await other.get(`${base}/${job.id}/download`)).status()).toBe(
        404,
      );
      expect(
        (
          await other.delete(`${base}/${job.id}`, {
            headers,
            data: { expectedVersion: job.version, confirm: true },
          })
        ).status(),
      ).toBe(404);
    }
  } finally {
    await other.dispose();
  }
  expect(
    (
      await request.delete('/api/v1/account', {
        headers,
        data: { password: connectionPassword },
      })
    ).status(),
  ).toBe(200);
  const pool = await connectionDatabase(feedbackSandbox);
  try {
    for (const table of [
      'record_report_jobs',
      'record_report_deletions',
      'record_report_request_limits',
      'app_research_connections',
      'app_research_connection_revisions',
    ])
      expect(
        (
          await pool.query(`SELECT * FROM ${table} WHERE user_id=$1`, [
            exported.account.id,
          ])
        ).rows,
      ).toEqual([]);
    expect(
      (
        await pool.query(
          'SELECT * FROM record_reports WHERE job_id=ANY($1::uuid[])',
          [jobs.map((j) => j.id)],
        )
      ).rows,
    ).toEqual([]);
  } finally {
    await pool.end();
  }
  expect((await request.get(base)).status()).toBe(401);
});
