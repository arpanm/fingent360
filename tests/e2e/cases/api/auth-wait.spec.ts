import { randomUUID } from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';
import { test as isolated, expect } from '../../helpers/app-fixture';
import {
  authGoal,
  authHeaders,
  authImport,
  authPassword,
  openAuthDatabase,
  registerRecoverable,
  resetAheadOfOperation,
  signInRecovered,
  expireDuringWait,
  type OwnedAuthDatabase,
} from '../../helpers/auth-wait';
import {
  AllocationStateSchema,
  HoldingsPreviewSchema,
  HoldingsSnapshotSchema,
  ReportDeletionSchema,
  ReportJobSchema,
  SavedGoalSchema,
  holdingsWorkbookTemplate,
  workbookBase64,
} from '../../../../packages/contracts/src/index';

const test = isolated.extend<{
  authDb: OwnedAuthDatabase;
  resetRequest: APIRequestContext;
}>({
  authDb: async ({ feedbackSandbox }, use) => {
    const db = await openAuthDatabase(feedbackSandbox);
    try {
      await use(db);
    } finally {
      await db.close();
    }
  },
  resetRequest: async ({ playwright, feedbackSandbox }, use) => {
    const context = await playwright.request.newContext({
      baseURL: feedbackSandbox.apiOrigin,
    });
    try {
      await use(context);
    } finally {
      await context.dispose();
    }
  },
});
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test.describe.configure({ timeout: 90000 });

async function financialRecords(request: APIRequestContext) {
  const goalResponse = await request.post('/api/v1/account/goals', {
    headers: authHeaders,
    data: authGoal,
  });
  expect(goalResponse.status()).toBe(201);
  const goal = SavedGoalSchema.parse(await goalResponse.json());
  const previewResponse = await request.post(
    '/api/v1/account/holdings/preview',
    { headers: authHeaders, data: authImport },
  );
  expect(previewResponse.status()).toBe(201);
  const preview = HoldingsPreviewSchema.parse(await previewResponse.json());
  const confirm = { previewId: preview.previewId, expectedVersion: 0 };
  const holdingResponse = await request.post(
    '/api/v1/account/holdings/confirm',
    { headers: authHeaders, data: confirm },
  );
  expect(holdingResponse.status()).toBe(201);
  const holdings = HoldingsSnapshotSchema.parse(await holdingResponse.json());
  const allocationInput = {
    expectedVersion: 0,
    expectedHoldingsVersion: holdings.version,
    storageConsent: true,
    rows: [
      {
        goalId: goal.id,
        goalVersion: goal.version,
        isin: 'INE002A01018',
        quantity: '1.000001',
      },
    ],
  };
  const allocationResponse = await request.put('/api/v1/account/allocations', {
    headers: authHeaders,
    data: allocationInput,
  });
  expect(allocationResponse.status()).toBe(200);
  const allocations = AllocationStateSchema.parse(
    await allocationResponse.json(),
  );
  return { goal, holdings, confirm, allocationInput, allocations };
}

async function issuedReport(request: APIRequestContext) {
  const input = {
    requestId: randomUUID(),
    label: 'Synthetic authorization report',
    consent: true,
  };
  expect(
    (
      await request.post('/api/v1/account/reports', {
        headers: authHeaders,
        data: input,
      })
    ).status(),
  ).toBe(201);
  await expect
    .poll(
      async () =>
        ReportJobSchema.parse(
          await (
            await request.get(`/api/v1/account/reports/${input.requestId}`)
          ).json(),
        ).status,
      {
        timeout: 20000,
        message: 'The actual isolated worker must issue the fixture report.',
      },
    )
    .toBe('succeeded');
  const job = ReportJobSchema.parse(
    await (
      await request.get(`/api/v1/account/reports/${input.requestId}`)
    ).json(),
  );
  expect(job.report).not.toBeNull();
  return { input, job };
}

test('E2E-API-300 CSV and workbook previews reject sessions revoked behind account locks @AUTH-WAIT-001', async ({
  request,
  resetRequest,
  authDb,
}) => {
  for (const format of ['csv', 'xlsx'] as const) {
    const owner = await registerRecoverable(request);
    const records = await financialRecords(request);
    const input =
      format === 'csv'
        ? { ...authImport, expectedVersion: 1 }
        : {
            format: 'xlsx',
            workbookBase64: workbookBase64(holdingsWorkbookTemplate(true)),
            expectedVersion: 1,
            storageConsent: true,
          };
    const operation = () =>
      request.post('/api/v1/account/holdings/preview', {
        headers: authHeaders,
        data: input,
        timeout: 10000,
      });
    const before = await authDb.privateDigest(owner.id);
    await resetAheadOfOperation({ db: authDb, owner, resetRequest, operation });
    expect(
      await authDb.privateDigest(owner.id),
      `${format} rejection preserves every private record and preview`,
    ).toBe(before);
    await signInRecovered(request, owner.username);
    const response = await operation();
    expect(response.status()).toBe(201);
    expect(
      HoldingsPreviewSchema.parse(await response.json()).expectedVersion,
    ).toBe(records.holdings.version);
    expect(
      HoldingsSnapshotSchema.parse(
        await (await request.get('/api/v1/account/holdings')).json(),
      ),
    ).toEqual(records.holdings);
  }
});

test('E2E-API-301 fresh holdings confirmation and confirmed replay reauthorize after waits @AUTH-WAIT-001', async ({
  request,
  resetRequest,
  authDb,
}) => {
  for (const replay of [false, true]) {
    const owner = await registerRecoverable(request);
    const records = await financialRecords(request);
    let input = records.confirm;
    if (!replay) {
      const preview = HoldingsPreviewSchema.parse(
        await (
          await request.post('/api/v1/account/holdings/preview', {
            headers: authHeaders,
            data: { ...authImport, expectedVersion: 1 },
          })
        ).json(),
      );
      input = { previewId: preview.previewId, expectedVersion: 1 };
    }
    const operation = () =>
      request.post('/api/v1/account/holdings/confirm', {
        headers: authHeaders,
        data: input,
        timeout: 10000,
      });
    const before = await authDb.privateDigest(owner.id);
    await resetAheadOfOperation({ db: authDb, owner, resetRequest, operation });
    expect(await authDb.privateDigest(owner.id)).toBe(before);
    await signInRecovered(request, owner.username);
    const response = await operation();
    expect(response.status()).toBe(201);
    const saved = HoldingsSnapshotSchema.parse(await response.json());
    expect(saved.version).toBe(replay ? 1 : 2);
    expect(saved.totalCostMinor).toBe('10001');
    if (replay) {
      expect(saved).toEqual(records.holdings);
      expect(await authDb.privateDigest(owner.id)).toBe(before);
    }
  }
});

test('E2E-API-302 goal creation cannot resume with a recovery-revoked session @AUTH-WAIT-001', async ({
  request,
  resetRequest,
  authDb,
}) => {
  const owner = await registerRecoverable(request);
  await financialRecords(request);
  const operation = () =>
    request.post('/api/v1/account/goals', {
      headers: authHeaders,
      data: { ...authGoal, name: 'Second synthetic goal' },
      timeout: 10000,
    });
  const before = await authDb.privateDigest(owner.id);
  await resetAheadOfOperation({ db: authDb, owner, resetRequest, operation });
  expect(await authDb.privateDigest(owner.id)).toBe(before);
  await signInRecovered(request, owner.username);
  const response = await operation();
  expect(response.status()).toBe(201);
  expect(SavedGoalSchema.parse(await response.json()).version).toBe(1);
});

test('E2E-API-303 goal updates and removals reauthorize before private mutations @AUTH-WAIT-001', async ({
  request,
  resetRequest,
  authDb,
}) => {
  for (const action of ['update', 'remove'] as const) {
    const owner = await registerRecoverable(request);
    const { goal } = await financialRecords(request);
    const operation = () =>
      request.fetch(`/api/v1/account/goals/${goal.id}`, {
        method: action === 'update' ? 'PUT' : 'DELETE',
        headers: authHeaders,
        data:
          action === 'update'
            ? {
                expectedVersion: 1,
                goal: { ...authGoal, monthlyMinor: '33333' },
              }
            : { expectedVersion: 1 },
        timeout: 10000,
      });
    const before = await authDb.privateDigest(owner.id);
    await resetAheadOfOperation({ db: authDb, owner, resetRequest, operation });
    expect(await authDb.privateDigest(owner.id)).toBe(before);
    await signInRecovered(request, owner.username);
    const response = await operation();
    expect(response.status()).toBe(200);
    if (action === 'update')
      expect(SavedGoalSchema.parse(await response.json()).monthlyMinor).toBe(
        '33333',
      );
    else expect(await response.json()).toEqual({ ok: true });
  }
});

test('E2E-API-304 allocation reads and writes reject recovery-revoked account waiters @AUTH-WAIT-001', async ({
  request,
  resetRequest,
  authDb,
}) => {
  for (const action of ['read', 'save'] as const) {
    await test.step(`recovery-revoked allocation ${action}`, async () => {
      const owner = await registerRecoverable(request);
      const records = await financialRecords(request);
      const operation = () =>
        request.fetch('/api/v1/account/allocations', {
          method: action === 'read' ? 'GET' : 'PUT',
          headers: authHeaders,
          ...(action === 'save'
            ? {
                data: {
                  ...records.allocationInput,
                  expectedVersion: 1,
                  rows: [],
                },
              }
            : {}),
          timeout: 10000,
        });
      const before = await authDb.privateDigest(owner.id);
      await resetAheadOfOperation({
        db: authDb,
        owner,
        resetRequest,
        operation,
      });
      expect(await authDb.privateDigest(owner.id)).toBe(before);
      await signInRecovered(request, owner.username);
      const response = await operation();
      expect(response.status()).toBe(200);
      const result = AllocationStateSchema.parse(await response.json());
      expect(result.snapshot.version).toBe(action === 'read' ? 1 : 2);
      if (action === 'read') {
        expect(result).toEqual(records.allocations);
        expect(await authDb.privateDigest(owner.id)).toBe(before);
      } else expect(result.snapshot.rows).toEqual([]);
    });
  }
});

test('E2E-API-305 report creation and issued replay require authorization after account waits @AUTH-WAIT-001', async ({
  request,
  resetRequest,
  authDb,
}) => {
  for (const replay of [false, true]) {
    const owner = await registerRecoverable(request);
    await financialRecords(request);
    const existing = replay ? await issuedReport(request) : null;
    const input = existing?.input ?? {
      requestId: randomUUID(),
      label: 'Synthetic new authorization report',
      consent: true,
    };
    const operation = () =>
      request.post('/api/v1/account/reports', {
        headers: authHeaders,
        data: input,
        timeout: 10000,
      });
    const before = await authDb.privateDigest(owner.id);
    await resetAheadOfOperation({ db: authDb, owner, resetRequest, operation });
    expect(await authDb.privateDigest(owner.id)).toBe(before);
    await signInRecovered(request, owner.username);
    const response = await operation();
    expect(response.status()).toBe(201);
    const result = ReportJobSchema.parse(await response.json());
    expect(result.id).toBe(input.requestId);
    if (existing) {
      expect(result).toEqual(existing.job);
      expect(await authDb.privateDigest(owner.id)).toBe(before);
    } else {
      // Drain real background preparation before fixture API shutdown.
      await expect
        .poll(
          async () =>
            ReportJobSchema.parse(
              await (
                await request.get(`/api/v1/account/reports/${result.id}`)
              ).json(),
            ).status,
          { timeout: 20000 },
        )
        .toBe('succeeded');
    }
  }
});

test('E2E-API-306 report deletion and tombstone replay reject revoked lock waiters @AUTH-WAIT-001', async ({
  request,
  resetRequest,
  authDb,
}) => {
  for (const replay of [false, true]) {
    const owner = await registerRecoverable(request);
    await financialRecords(request);
    const { job } = await issuedReport(request);
    const operation = () =>
      request.delete(`/api/v1/account/reports/${job.id}`, {
        headers: authHeaders,
        data: { expectedVersion: job.version, confirm: true },
        timeout: 10000,
      });
    const original = replay
      ? ReportDeletionSchema.parse(await (await operation()).json())
      : null;
    const before = await authDb.privateDigest(owner.id);
    await resetAheadOfOperation({ db: authDb, owner, resetRequest, operation });
    expect(await authDb.privateDigest(owner.id)).toBe(before);
    await signInRecovered(request, owner.username);
    const response = await operation();
    expect(response.status()).toBe(200);
    const receipt = ReportDeletionSchema.parse(await response.json());
    expect(receipt.id).toBe(job.id);
    if (original) {
      expect(receipt).toEqual(original);
      expect(await authDb.privateDigest(owner.id)).toBe(before);
    }
  }
});

for (const [id, action] of [
  [307, 'cancel'],
  [308, 'retry'],
] as const) {
  test(`E2E-API-${id} report ${action} cannot resume after reset while a job row was unavailable @AUTH-WAIT-001`, async ({
    request,
    resetRequest,
    authDb,
  }) => {
    const owner = await registerRecoverable(request);
    await financialRecords(request);
    const { job } = await issuedReport(request);
    // Explicit owned-storage fault: roll a real captured/issued fixture back to
    // pre-issuance queued/failed state. This does not simulate production success.
    await authDb.query(
      `WITH removed AS (DELETE FROM record_reports WHERE job_id=$1)
      UPDATE record_report_jobs SET status=$2,version=version+1,attempts=$3,
      next_attempt_at=CASE WHEN $2='queued' THEN now()+interval '1 hour' ELSE NULL END,
      lease_id=NULL,lease_until=NULL,message='Synthetic pre-issuance fault for authorization test'
      WHERE id=$1 AND user_id=$4`,
      [
        job.id,
        action === 'cancel' ? 'queued' : 'failed',
        action === 'cancel' ? 0 : 3,
        owner.id,
      ],
    );
    const current = ReportJobSchema.parse(
      await (await request.get(`/api/v1/account/reports/${job.id}`)).json(),
    );
    const operation = () =>
      request.post(`/api/v1/account/reports/${job.id}/${action}`, {
        headers: authHeaders,
        data: { expectedVersion: current.version },
        timeout: 10000,
      });
    const before = await authDb.privateDigest(owner.id);
    await resetAheadOfOperation({
      db: authDb,
      owner,
      resetRequest,
      operation,
      reportId: job.id,
    });
    expect(await authDb.privateDigest(owner.id)).toBe(before);
    await signInRecovered(request, owner.username);
    const response = await operation();
    expect(response.status()).toBe(201);
    const result = ReportJobSchema.parse(await response.json());
    expect(result.status).toBe(action === 'cancel' ? 'cancelled' : 'queued');
    expect(result.version).toBe(current.version + 1);
    if (action === 'retry')
      await expect
        .poll(
          async () =>
            ReportJobSchema.parse(
              await (
                await request.get(`/api/v1/account/reports/${job.id}`)
              ).json(),
            ).status,
          { timeout: 20000 },
        )
        .toBe('succeeded');
  });
}

test('E2E-API-309 a session expiring during a lock wait is checked against database wall time @AUTH-WAIT-001', async ({
  request,
  authDb,
}) => {
  test.setTimeout(120000);
  for (const scenario of [
    'allocation',
    'holding-preview',
    'goal-row',
    'report-request-replay',
    'report-delete-replay',
    'report-delete-job',
    'report-cancel-job',
  ] as const) {
    await test.step(scenario, async () => {
      const owner = await registerRecoverable(request);
      const records = await financialRecords(request);
      let kind: Parameters<OwnedAuthDatabase['block']>[0] = 'account';
      let id = owner.id;
      let expectedStatus = 200;
      let replay = scenario === 'allocation';
      let operation = () =>
        request.get('/api/v1/account/allocations', { timeout: 10000 });
      if (scenario === 'holding-preview') {
        const preview = HoldingsPreviewSchema.parse(
          await (
            await request.post('/api/v1/account/holdings/preview', {
              headers: authHeaders,
              data: { ...authImport, expectedVersion: 1 },
            })
          ).json(),
        );
        kind = 'preview';
        id = preview.previewId;
        expectedStatus = 201;
        operation = () =>
          request.post('/api/v1/account/holdings/confirm', {
            headers: authHeaders,
            data: { previewId: preview.previewId, expectedVersion: 1 },
            timeout: 10000,
          });
      } else if (scenario === 'goal-row') {
        kind = 'goal';
        id = records.goal.id;
        operation = () =>
          request.put(`/api/v1/account/goals/${id}`, {
            headers: authHeaders,
            data: {
              expectedVersion: 1,
              goal: { ...authGoal, monthlyMinor: '33333' },
            },
            timeout: 10000,
          });
      } else if (scenario.startsWith('report-')) {
        const { input, job } = await issuedReport(request);
        id = job.id;
        if (scenario === 'report-request-replay') {
          kind = 'advisory';
          expectedStatus = 201;
          replay = true;
          operation = () =>
            request.post('/api/v1/account/reports', {
              headers: authHeaders,
              data: input,
              timeout: 10000,
            });
        } else if (scenario === 'report-cancel-job') {
          kind = 'report';
          expectedStatus = 201;
          // Owned fault state: unavailable pre-issuance job, never a fake success.
          await authDb.query(
            `WITH removed AS (DELETE FROM record_reports WHERE job_id=$1)
            UPDATE record_report_jobs SET status='queued',version=version+1,attempts=0,
            next_attempt_at=now()+interval '1 hour',lease_id=NULL,lease_until=NULL,
            message='Synthetic queued fault for expiry test' WHERE id=$1 AND user_id=$2`,
            [id, owner.id],
          );
          operation = () =>
            request.post(`/api/v1/account/reports/${id}/cancel`, {
              headers: authHeaders,
              data: { expectedVersion: job.version + 1 },
              timeout: 10000,
            });
        } else {
          kind = scenario === 'report-delete-replay' ? 'advisory' : 'report';
          operation = () =>
            request.delete(`/api/v1/account/reports/${id}`, {
              headers: authHeaders,
              data: { expectedVersion: job.version, confirm: true },
              timeout: 10000,
            });
          if (scenario === 'report-delete-replay') {
            expect((await operation()).status()).toBe(200);
            replay = true;
          }
        }
      }
      const before = await authDb.privateDigest(owner.id);
      await expireDuringWait({
        db: authDb,
        userId: owner.id,
        kind,
        id,
        operation,
      });
      expect(
        await authDb.privateDigest(owner.id),
        `${scenario} preserves all private state`,
      ).toBe(before);
      expect(
        (
          await request.post('/api/v1/account/login', {
            headers: authHeaders,
            data: { username: owner.username, password: authPassword },
          })
        ).status(),
      ).toBe(200);
      const positive = await operation();
      expect(positive.status()).toBe(expectedStatus);
      await positive.body();
      if (replay) expect(await authDb.privateDigest(owner.id)).toBe(before);
    });
  }
});
