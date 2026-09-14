import { randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/app-fixture';
import {
  ReportComparisonSchema,
  ReportComparisonOptionsSchema,
  CurrentAccountSchema,
  ReportJobSchema,
} from '../../../../packages/contracts/src/index';
import {
  prepareConnectionAccount,
  connectionHeaders,
  reviseConnectionSourceFixture,
} from '../../helpers/research-connection-fixture';
import { prepareReportResearch } from '../../helpers/report-research-fixture';
import {
  openAuthDatabase,
  registerRecoverable,
  resetAheadOfOperation,
  signInRecovered,
  expireDuringWait,
} from '../../helpers/auth-wait';
import {
  apiComparisonCall,
  changeComparisonRecords,
  comparisonBase,
  comparisonPath,
  issueComparisonReport,
} from '../../helpers/report-comparison';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test.describe.configure({ timeout: 90000 });

test('E2E-API-420 actual issued originals produce exact reversed input cost quantity and allocation differences without writes @REPORT-COMPARE-001', async ({
  request,
  feedbackSandbox,
}) => {
  await prepareConnectionAccount(request);
  const call = apiComparisonCall(request);
  const first = await issueComparisonReport(call);
  await changeComparisonRecords(call);
  const second = await issueComparisonReport(call, 'Synthetic later');
  const db = await openAuthDatabase(feedbackSandbox);
  try {
    const owner = CurrentAccountSchema.parse(
      await (await request.get('/api/v1/account')).json(),
    ).user!;
    const before = await db.privateDigest(owner.id);
    const response = await request.get(comparisonPath(second.id, first.id));
    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control']).toBe('no-store');
    const result = ReportComparisonSchema.parse(await response.json());
    expect(result.earlier.id).toBe(first.id);
    expect(result.later.id).toBe(second.id);
    expect(result.recordedCost.difference).toBe('-1');
    expect(
      result.holdings[0]!.fields.find((f) => f.field === 'quantity')!
        .difference,
    ).toBe('1');
    expect(
      result.goals[0]!.fields.find((f) => f.field === 'projected')!.difference,
    ).toBe('246');
    expect(
      result.goals[0]!.fields.find((f) => f.field === 'gap')!.difference,
    ).toBe('-246');
    expect(result.allocations[0]!.status).toBe('added');
    expect(
      result.allocations[0]!.fields.every((f) => f.difference === null),
    ).toBe(true);
    expect(result.research).toEqual({
      earlierCapturedAt: null,
      laterCapturedAt: null,
      comparable: false,
      rows: [],
    });
    const forward = ReportComparisonSchema.parse(
      await (await request.get(comparisonPath(first.id, second.id))).json(),
    );
    expect({ ...forward, checkedAt: result.checkedAt }).toEqual(result);
    const choices = ReportComparisonOptionsSchema.parse(
      await (await request.get(`${comparisonBase}/options`)).json(),
    );
    expect(choices.reports).toHaveLength(2);
    expect(JSON.stringify(choices)).not.toContain('monthlyMinor');
    expect(
      ReportJobSchema.parse(
        (await call(`/api/v1/account/reports/${first.id}`)).body,
      ).report,
    ).toEqual(first.report);
    expect(
      ReportJobSchema.parse(
        (await call(`/api/v1/account/reports/${second.id}`)).body,
      ).report,
    ).toEqual(second.report);
    expect(await db.privateDigest(owner.id)).toBe(before);
  } finally {
    await db.close();
  }
});

test('E2E-API-421 strict query guest foreign deleted and unsupported method never disclose private originals @REPORT-COMPARE-001', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const guest = await playwright.request.newContext({
    baseURL: feedbackSandbox.apiOrigin,
  });
  try {
    expect((await guest.get(`${comparisonBase}/options`)).status()).toBe(401);
    expect(
      (await guest.get(comparisonPath(randomUUID(), randomUUID()))).status(),
    ).toBe(401);
    await prepareConnectionAccount(request);
    const call = apiComparisonCall(request),
      a = await issueComparisonReport(call),
      b = await issueComparisonReport(call);
    for (const path of [
      `${comparisonBase}?first=${a.id}&second=${a.id}`,
      `${comparisonBase}?first=bad&second=${b.id}`,
      `${comparisonPath(a.id, b.id)}&extra=yes`,
      `${comparisonPath(a.id, b.id)}&first=${b.id}`,
    ])
      expect((await request.get(path)).status()).toBe(400);
    expect(
      (
        await request.post(comparisonBase, {
          headers: connectionHeaders,
          data: { first: a.id, second: b.id },
        })
      ).status(),
    ).toBe(404);
    await prepareConnectionAccount(guest);
    const foreign = await issueComparisonReport(apiComparisonCall(guest));
    const foreignResult = await request.get(comparisonPath(a.id, foreign.id));
    expect(foreignResult.status()).toBe(404);
    expect(JSON.stringify(await foreignResult.json())).not.toContain(
      foreign.label,
    );
    expect(
      (
        await request.delete(`/api/v1/account/reports/${b.id}`, {
          headers: connectionHeaders,
          data: { expectedVersion: b.version, confirm: true },
        })
      ).status(),
    ).toBe(200);
    expect((await request.get(comparisonPath(a.id, b.id))).status()).toBe(404);
    expect(
      ReportComparisonOptionsSchema.parse(
        await (await request.get(`${comparisonBase}/options`)).json(),
      ).reports.map((r) => r.id),
    ).toEqual([a.id]);
  } finally {
    await guest.dispose();
  }
});

test('E2E-API-422 comparison never issues a queued or cancelled report @REPORT-COMPARE-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await prepareConnectionAccount(request);
  const call = apiComparisonCall(request),
    issued = await issueComparisonReport(call),
    db = await openAuthDatabase(feedbackSandbox),
    id = randomUUID();
  try {
    await db.query(
      `CREATE FUNCTION comparison_defer_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id='${id}'::uuid THEN NEW.next_attempt_at=clock_timestamp()+interval '1 hour'; END IF; RETURN NEW; END $$`,
    );
    await db.query(
      'CREATE TRIGGER comparison_defer_fixture BEFORE INSERT ON record_report_jobs FOR EACH ROW EXECUTE FUNCTION comparison_defer_fixture()',
    );
    const pending = ReportJobSchema.parse(
      (
        await call('/api/v1/account/reports', 'POST', {
          requestId: id,
          label: 'Synthetic queued report',
          consent: true,
        })
      ).body,
    );
    expect(pending.status).toBe('queued');
    expect((await request.get(comparisonPath(issued.id, id))).status()).toBe(
      409,
    );
    expect(
      ReportJobSchema.parse((await call(`/api/v1/account/reports/${id}`)).body)
        .status,
    ).toBe('queued');
    const cancelled = await call(
      `/api/v1/account/reports/${id}/cancel`,
      'POST',
      { expectedVersion: pending.version },
    );
    expect(cancelled.status).toBe(201);
    expect((await request.get(comparisonPath(issued.id, id))).status()).toBe(
      409,
    );
    expect(
      ReportComparisonOptionsSchema.parse(
        await (await request.get(`${comparisonBase}/options`)).json(),
      ).reports.map((r) => r.id),
    ).toEqual([issued.id]);
  } finally {
    await db.query(
      'DROP TRIGGER IF EXISTS comparison_defer_fixture ON record_report_jobs',
    );
    await db.query('DROP FUNCTION IF EXISTS comparison_defer_fixture()');
    await db.close();
  }
});

test('E2E-API-423 recovery ahead of actual comparison account wait rejects stale session and preserves originals @REPORT-COMPARE-001', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const owner = await registerRecoverable(request),
    call = apiComparisonCall(request),
    a = await issueComparisonReport(call),
    b = await issueComparisonReport(call),
    db = await openAuthDatabase(feedbackSandbox),
    reset = await playwright.request.newContext({
      baseURL: feedbackSandbox.apiOrigin,
    });
  try {
    const before = await db.privateDigest(owner.id);
    await resetAheadOfOperation({
      db,
      owner,
      resetRequest: reset,
      operation: () => request.get(comparisonPath(a.id, b.id)),
    });
    expect(await db.privateDigest(owner.id)).toBe(before);
    await signInRecovered(request, owner.username);
    expect((await request.get(comparisonPath(a.id, b.id))).status()).toBe(200);
  } finally {
    await reset.dispose();
    await db.close();
  }
});

test('E2E-API-424 session expiry during final report row wait and options account wait denies private read @REPORT-COMPARE-001', async ({
  request,
  feedbackSandbox,
}) => {
  const db = await openAuthDatabase(feedbackSandbox);
  try {
    for (const kind of ['report', 'account'] as const) {
      const owner = await registerRecoverable(request),
        call = apiComparisonCall(request),
        a = await issueComparisonReport(call),
        b = await issueComparisonReport(call);
      const before = await db.privateDigest(owner.id);
      await expireDuringWait({
        db,
        userId: owner.id,
        kind,
        id: kind === 'report' ? a.id : owner.id,
        operation: () =>
          request.get(
            kind === 'report'
              ? comparisonPath(a.id, b.id)
              : `${comparisonBase}/options`,
          ),
      });
      expect(await db.privateDigest(owner.id)).toBe(before);
    }
  } finally {
    await db.close();
  }
});

test('E2E-API-425 v2 notes are compared from actual issued receipts after source withdrawal without current-source inference @REPORT-COMPARE-001', async ({
  request,
  feedbackSandbox,
}) => {
  const p = await prepareReportResearch(request, feedbackSandbox),
    call = apiComparisonCall(request),
    a = await issueComparisonReport(call, 'Earlier research', p.selected),
    revision = p.revisions[0]!;
  expect(
    (
      await request.put(`/api/v1/account/research-connections/${revision.id}`, {
        headers: connectionHeaders,
        data: {
          action: 'edit',
          requestId: randomUUID(),
          expectedVersion: revision.version,
          note: 'Synthetic later research question',
          storageConsent: true,
        },
      })
    ).status(),
  ).toBe(200);
  const b = await issueComparisonReport(
    call,
    'Later research',
    p.selected.map((r) =>
      r.id === revision.id ? { id: r.id, version: r.version + 1 } : r,
    ),
  );
  await reviseConnectionSourceFixture(feedbackSandbox, p.source, 'withdrawn');
  const response = await request.get(comparisonPath(a.id, b.id));
  expect(response.status()).toBe(200);
  const result = ReportComparisonSchema.parse(await response.json());
  expect(result.research.comparable).toBe(true);
  expect(
    result.research.rows
      .find((r) => r.key === revision.id)!
      .fields.find((f) => f.field === 'note')!.after,
  ).toBe('Synthetic later research question');
  expect(
    result.research.rows
      .find((r) => r.key === revision.id)!
      .fields.find((f) => f.field === 'sourceHash')!.before,
  ).toBe(p.source.sourceHash);
  expect(JSON.stringify(result)).not.toContain('withdrawn');
});

test('E2E-API-426 actual deletion queued ahead of comparison wins atomically without reviving either original @REPORT-COMPARE-001', async ({
  request,
  feedbackSandbox,
}) => {
  await prepareConnectionAccount(request);
  const call = apiComparisonCall(request),
    a = await issueComparisonReport(call),
    b = await issueComparisonReport(call),
    owner = CurrentAccountSchema.parse(
      await (await request.get('/api/v1/account')).json(),
    ).user!,
    db = await openAuthDatabase(feedbackSandbox);
  const blocker = await db.block('account', owner.id);
  const pending: Array<Promise<import('@playwright/test').APIResponse>> = [];
  try {
    const deletion = request.delete(`/api/v1/account/reports/${b.id}`, {
      headers: connectionHeaders,
      data: { expectedVersion: b.version, confirm: true },
    });
    pending.push(deletion);
    void deletion.catch(() => {});
    const deletePid = await db.waitFor([blocker.pid], false);
    const comparison = request.get(comparisonPath(a.id, b.id));
    pending.push(comparison);
    void comparison.catch(() => {});
    await db.waitFor([deletePid], false);
    await blocker.release();
    expect((await deletion).status()).toBe(200);
    expect((await comparison).status()).toBe(404);
    expect(
      ReportJobSchema.parse(
        (await call(`/api/v1/account/reports/${a.id}`)).body,
      ).report,
    ).toEqual(a.report);
    expect(
      (await request.get(`/api/v1/account/reports/${b.id}`)).status(),
    ).toBe(404);
  } finally {
    await blocker.release();
    await Promise.allSettled(pending.map(async (p) => (await p).body()));
    await db.close();
  }
});
