import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import {
  prepareReportResearchBrowser,
  chooseResearchReport,
  captureResearchReport,
  reportResearchBase as base,
  reportResearchNote,
} from '../../helpers/report-research-fixture';
import {
  connectionGoal,
  connectionPassword,
  prepareConnectionBrowser,
} from '../../helpers/research-connection-fixture';
import {
  RecordReportV1Schema,
  RecordReportV2Schema,
  ReportJobSchema,
  PrivacyExportSchema,
  issueRecordReport,
} from '../../../../packages/contracts/src/index';
async function call(page: Page, path: string, method = 'GET', body?: unknown) {
  return page.evaluate(
    async ({ path, method, body }) => {
      const response = await fetch(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, body: await response.json() };
    },
    { path, method, body },
  );
}
async function setup(page: Page) {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/v1/'))
      requests.push(request.url());
  });
  return { ...(await prepareReportResearchBrowser(page)), requests };
}
async function reload(page: Page) {
  await page.reload();
  await expect(page.getByLabel('On-device mode')).toBeVisible();
}
const input = (selected?: { id: string; version: number }[]) => ({
  requestId: randomUUID(),
  label: 'Synthetic on-device research report',
  consent: true,
  ...(selected ? { researchConnections: selected } : {}),
});

test('E2E-OFFLINE-330 actual bundle opt-in report review issue and reload persist with zero API network @REPORTS-003', async ({
  page,
}) => {
  const prepared = await setup(page);
  await chooseResearchReport(page, 'Selected research record review', true);
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await expect(
    page.getByRole('dialog', { name: 'Review report selection', exact: true }),
  ).toContainText(prepared.source.sourceHash!);
  await captureResearchReport(page);
  await page
    .getByRole('button', { name: 'Open report', exact: true })
    .click({ timeout: 15000 });
  const reader = page.getByRole('dialog', {
    name: 'Issued record report',
    exact: true,
  });
  await expect(reader).toContainText(reportResearchNote);
  await expect(reader).toContainText('Public bundle saved');
  await expect(reader).toContainText(
    'Current publication and record status are unknown',
  );
  const report = RecordReportV2Schema.parse(
    (await call(page, base)).body.jobs[0].report,
  );
  expect(report.snapshot.researchConnections.bundleGeneratedAt).not.toBeNull();
  const downloadPromise = page.waitForEvent('download');
  await reader
    .getByRole('button', { name: 'Save printable copy', exact: true })
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(
    `saved-record-review-${report.id}.html`,
  );
  const path = await download.path();
  if (!path) throw Error('Missing printable copy');
  const { readFile } = await import('node:fs/promises');
  const html = await readFile(path, 'utf8');
  expect(html).toContain(reportResearchNote);
  expect(html).toContain('Current publication and record status are unknown');
  expect(html).not.toContain('<script');
  await page.keyboard.press('Escape');
  await reload(page);
  expect((await call(page, `${base}/${report.id}/download`)).body).toEqual(
    report,
  );
  expect(prepared.requests).toEqual([]);
});

test('E2E-OFFLINE-331 v1 financial format remains unchanged beside exact reconstructed v2 @REPORTS-003', async ({
  page,
}) => {
  const prepared = await setup(page),
    before = PrivacyExportSchema.parse(
      (await call(page, '/api/v1/account/privacy/export')).body,
    );
  const first = ReportJobSchema.parse(
      (await call(page, base, 'POST', input())).body,
    ),
    second = ReportJobSchema.parse(
      (await call(page, base, 'POST', input(prepared.selected))).body,
    );
  const v1 = RecordReportV1Schema.parse(
      (await call(page, `${base}/${first.id}/download`)).body,
    ),
    v2 = RecordReportV2Schema.parse(
      (await call(page, `${base}/${second.id}/download`)).body,
    );
  expect(v1.snapshot).not.toHaveProperty('researchConnections');
  expect(v1).toEqual(
    issueRecordReport(first.id, first.label, first.snapshot, v1.issuedAt),
  );
  expect(v2).toEqual(
    issueRecordReport(second.id, second.label, second.snapshot, v2.issuedAt),
  );
  expect(v2.goalReviews).toEqual(v1.goalReviews);
  expect(v2.recordedHoldingsCostMinor).toEqual(v1.recordedHoldingsCostMinor);
  const after = PrivacyExportSchema.parse(
    (await call(page, '/api/v1/account/privacy/export')).body,
  );
  expect(after.goals).toEqual(before.goals);
  expect(after.holdings).toEqual(before.holdings);
  expect(after.allocations).toEqual(before.allocations);
  expect(after.researchConnections).toEqual(before.researchConnections);
  expect(prepared.requests).toEqual([]);
});

test('E2E-OFFLINE-332 canonical replay survives reload while different selection conflicts and original receipts remain @REPORTS-003', async ({
  page,
}) => {
  const prepared = await setup(page),
    body = input(prepared.selected),
    saved = ReportJobSchema.parse((await call(page, base, 'POST', body)).body);
  await reload(page);
  const replay = await call(page, base, 'POST', {
    ...body,
    researchConnections: [...prepared.selected].reverse(),
  });
  expect(replay.status).toBe(201);
  expect(replay.body.snapshot).toEqual(saved.snapshot);
  expect(
    (
      await call(page, base, 'POST', {
        ...body,
        researchConnections: [prepared.selected[0]],
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await call(page, base, 'POST', {
        requestId: body.requestId,
        label: body.label,
        consent: true,
      })
    ).status,
  ).toBe(409);
  const revision = prepared.revisions[0]!;
  await call(
    page,
    `/api/v1/account/research-connections/${revision.id}`,
    'PUT',
    { action: 'remove', requestId: randomUUID(), expectedVersion: 1 },
  );
  expect((await call(page, base, 'POST', body)).body.snapshot).toEqual(
    saved.snapshot,
  );
  expect((await call(page, base)).body.jobs).toHaveLength(1);
  expect(prepared.requests).toEqual([]);
});

test('E2E-OFFLINE-333 foreign owned reports and connection selections stay private across account switches @REPORTS-003', async ({
  page,
}) => {
  const prepared = await setup(page),
    saved = ReportJobSchema.parse(
      (await call(page, base, 'POST', input(prepared.selected))).body,
    );
  await call(page, '/api/v1/account/logout', 'POST', {});
  await prepareConnectionBrowser(page);
  expect(
    (await call(page, base, 'POST', input(prepared.selected))).status,
  ).toBe(404);
  expect((await call(page, `${base}/${saved.id}`)).status).toBe(404);
  expect((await call(page, `${base}/${saved.id}/download`)).status).toBe(404);
  expect(
    (
      await call(page, `${base}/${saved.id}`, 'DELETE', {
        expectedVersion: 1,
        confirm: true,
      })
    ).status,
  ).toBe(404);
  expect((await call(page, base)).body.jobs).toEqual([]);
  const exported = PrivacyExportSchema.parse(
    (await call(page, '/api/v1/account/privacy/export')).body,
  );
  expect(JSON.stringify(exported.reports)).not.toContain(reportResearchNote);
  expect(prepared.requests).toEqual([]);
});

test('E2E-OFFLINE-334 edited or removed selected revisions fail without capture and strict bounds keep notes inert @REPORTS-003', async ({
  page,
}) => {
  const prepared = await setup(page),
    body = input(prepared.selected),
    revision = prepared.revisions[0]!;
  for (const invalid of [
    { ...body, researchConnections: [] },
    {
      ...body,
      researchConnections: [prepared.selected[0], prepared.selected[0]],
    },
    {
      ...body,
      researchConnections: Array.from({ length: 21 }, () => ({
        id: randomUUID(),
        version: 1,
      })),
    },
    {
      ...body,
      researchConnections: [{ ...prepared.selected[0], body: 'untrusted' }],
    },
    { ...body, consent: false },
  ])
    expect((await call(page, base, 'POST', invalid)).status).toBe(400);
  const note = '<img src=x onerror="window.localReportInjection=true">';
  expect(
    (
      await call(
        page,
        `/api/v1/account/research-connections/${revision.id}`,
        'PUT',
        {
          action: 'edit',
          requestId: randomUUID(),
          expectedVersion: 1,
          note,
          storageConsent: true,
        },
      )
    ).status,
  ).toBe(200);
  expect((await call(page, base, 'POST', body)).status).toBe(409);
  const saved = ReportJobSchema.parse(
    (await call(page, base, 'POST', input([{ id: revision.id, version: 2 }])))
      .body,
  );
  await page.goto('/#reports');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await page
    .getByRole('button', { name: 'Open report', exact: true })
    .click({ timeout: 15000 });
  await expect(
    page.getByRole('dialog', { name: 'Issued record report', exact: true }),
  ).toContainText(note);
  expect(await page.evaluate(() => 'localReportInjection' in window)).toBe(
    false,
  );
  await call(
    page,
    `/api/v1/account/research-connections/${revision.id}`,
    'PUT',
    { action: 'remove', requestId: randomUUID(), expectedVersion: 2 },
  );
  expect(
    (await call(page, base, 'POST', input([{ id: revision.id, version: 3 }])))
      .status,
  ).toBe(404);
  expect((await call(page, `${base}/${saved.id}/download`)).status).toBe(200);
  expect(prepared.requests).toEqual([]);
});

test('E2E-OFFLINE-335 changed and removed goals produce dated review flags without rewriting earlier issued reports @REPORTS-003', async ({
  page,
}) => {
  const prepared = await setup(page),
    goal = prepared.revisions.find((r) => r.target.binding.kind === 'goal')!
      .target.binding;
  const old = ReportJobSchema.parse(
      (await call(page, base, 'POST', input(prepared.selected))).body,
    ),
    oldReport = (await call(page, `${base}/${old.id}/download`)).body;
  expect(
    (
      await call(page, `/api/v1/account/goals/${goal.id}`, 'PUT', {
        expectedVersion: 1,
        goal: { ...connectionGoal, monthlyMinor: '9999' },
      })
    ).status,
  ).toBe(200);
  const changed = RecordReportV2Schema.parse(
    (
      await call(
        page,
        `${base}/${ReportJobSchema.parse((await call(page, base, 'POST', input(prepared.selected))).body).id}/download`,
      )
    ).body,
  );
  const receipt = changed.snapshot.researchConnections.receipts.find(
    (r) => r.revision.target.binding.kind === 'goal',
  )!;
  expect(receipt.reviewReasons.join(' ')).toContain('changed');
  expect(receipt.targetAtCapture!.binding.version).toBe(2);
  expect(receipt.revision.target.binding.version).toBe(1);
  await call(page, `/api/v1/account/goals/${goal.id}`, 'DELETE', {
    expectedVersion: 2,
  });
  const removed = ReportJobSchema.parse(
    (await call(page, base, 'POST', input(prepared.selected))).body,
  );
  if (!('researchConnections' in removed.snapshot)) throw Error('Expected v2');
  expect(
    removed.snapshot.researchConnections.receipts.find(
      (r) => r.revision.target.binding.kind === 'goal',
    )!.targetAtCapture,
  ).toBeNull();
  expect((await call(page, `${base}/${old.id}/download`)).body).toEqual(
    oldReport,
  );
  expect(prepared.requests).toEqual([]);
});

test('E2E-OFFLINE-336 cancelled v2 preparation deletion tombstone and new request preserve connections through reload @REPORTS-003', async ({
  page,
}) => {
  const prepared = await setup(page),
    body = input(prepared.selected),
    queued = ReportJobSchema.parse((await call(page, base, 'POST', body)).body);
  expect(
    (
      await call(page, `${base}/${queued.id}`, 'DELETE', {
        expectedVersion: queued.version,
        confirm: true,
      })
    ).status,
  ).toBe(409);
  const cancelled = ReportJobSchema.parse(
    (
      await call(page, `${base}/${queued.id}/cancel`, 'POST', {
        expectedVersion: queued.version,
      })
    ).body,
  );
  const removed = await call(page, `${base}/${queued.id}`, 'DELETE', {
    expectedVersion: cancelled.version,
    confirm: true,
  });
  expect(removed.status).toBe(200);
  await reload(page);
  expect((await call(page, base, 'POST', body)).status).toBe(410);
  expect((await call(page, `${base}/${queued.id}/download`)).status).toBe(404);
  expect((await call(page, base)).body.capacity.used).toBe(0);
  expect(
    (await call(page, base, 'POST', input(prepared.selected))).status,
  ).toBe(201);
  expect(
    (await call(page, '/api/v1/account/research-connections')).body.connections,
  ).toHaveLength(2);
  expect(prepared.requests).toEqual([]);
});

test('E2E-OFFLINE-337 private v1 v2 export account deletion and UUID reuse leave no retained report notes @REPORTS-003', async ({
  page,
}) => {
  const prepared = await setup(page),
    bodies = [input(), input(prepared.selected)];
  for (const body of bodies) await call(page, base, 'POST', body);
  await call(page, base);
  const exported = PrivacyExportSchema.parse(
    (await call(page, '/api/v1/account/privacy/export')).body,
  );
  expect(exported.reports.jobs.map((j) => j.report!.policy).sort()).toEqual([
    'saved-record-review-v1',
    'saved-record-review-v2',
  ]);
  expect(
    (
      await call(page, '/api/v1/account', 'DELETE', {
        password: connectionPassword,
      })
    ).status,
  ).toBe(200);
  await reload(page);
  expect((await call(page, base)).status).toBe(401);
  await prepareConnectionBrowser(page);
  const after = PrivacyExportSchema.parse(
    (await call(page, '/api/v1/account/privacy/export')).body,
  );
  expect(after.reports.jobs).toEqual([]);
  expect(after.reports.deletions).toEqual([]);
  expect(after.researchConnections.revisions).toEqual([]);
  expect(
    (
      await call(page, base, 'POST', {
        requestId: bodies[1]!.requestId,
        label: 'Fresh account same UUID',
        consent: true,
      })
    ).status,
  ).toBe(201);
  expect(prepared.requests).toEqual([]);
});

test('E2E-OFFLINE-338 actual local bounded capacity allows deletion but preserves hourly request quota @REPORTS-003', async ({
  page,
}) => {
  test.setTimeout(90000);
  const prepared = await setup(page);
  const result = await page.evaluate(
    async ({ base, selected }) => {
      const send = async (path: string, method: string, body: unknown) => {
        const r = await fetch(path, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        return { status: r.status, body: await r.json() };
      };
      const firstInput = {
        requestId: crypto.randomUUID(),
        label: 'Synthetic capacity report0',
        consent: true,
        researchConnections: selected,
      };
      const first = await send(base, 'POST', firstInput);
      if (first.status !== 201) throw Error('Initial report did not capture');
      for (let i = 1; i < 100; i++) {
        const r = await send(base, 'POST', {
          ...firstInput,
          requestId: crypto.randomUUID(),
          label: `Synthetic capacity report${i}`,
        });
        if (r.status !== 201) throw Error(`Capacity fixture ${i}: ${r.status}`);
      }
      const full = await send(base, 'POST', {
        ...firstInput,
        requestId: crypto.randomUUID(),
      });
      const replay = await send(base, 'POST', firstInput);
      const cancelled = await send(`${base}/${first.body.id}/cancel`, 'POST', {
        expectedVersion: first.body.version,
      });
      const removed = await send(`${base}/${first.body.id}`, 'DELETE', {
        expectedVersion: cancelled.body.version,
        confirm: true,
      });
      const quota = await send(base, 'POST', {
        ...firstInput,
        requestId: crypto.randomUUID(),
      });
      return {
        full: full.status,
        replay: replay.status,
        removed: removed.status,
        quota: quota.status,
      };
    },
    { base, selected: [prepared.selected[0]] },
  );
  expect(result).toEqual({ full: 400, replay: 201, removed: 200, quota: 429 });
  expect(prepared.requests).toEqual([]);
});

test('E2E-OFFLINE-339 actual local adapter captures synthetic bundle withdrawal and issues only its saved historical context @REPORTS-003 @TEST-SIMULATION', async () => {
  const { readFile } = await import('node:fs/promises');
  const { reportsHandler } =
    await import('../../../../apps/web/src/offline/reports');
  const { handleResearchConnections } =
    await import('../../../../apps/web/src/offline/research-connections');
  const { handleFinance } =
    await import('../../../../apps/web/src/offline/finance');
  const { connectionSource } =
    await import('../../../../packages/contracts/src/index');
  const bundle = JSON.parse(
    await readFile(
      new URL(
        '../../../../apps/web/src/offline/content-bundle.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as import('../../../../apps/web/src/offline/types').OfflineBundle;
  const source = bundle.feed.find(
    (item) => item.id.startsWith('fed-') && connectionSource(item),
  )!;
  const user = {
    id: randomUUID(),
    username: 'synthetic_report_adapter',
    createdAt: new Date().toISOString(),
    consentedAt: new Date().toISOString(),
    passwordHash: 'synthetic-unused',
    passwordSalt: 'synthetic-unused',
  };
  const state: import('../../../../apps/web/src/offline/types').LocalState = {
    schemaVersion: 1,
    revision: 0,
    users: { [user.id]: user },
    sessionUserId: user.id,
    data: {},
  };
  const req = (path: string, method: string, body?: unknown) => ({
    path,
    method,
    body,
    headers: new Headers(),
    query: new URLSearchParams(),
  });
  const goal = (await handleFinance(
    req('/api/v1/account/goals', 'POST', connectionGoal),
    state,
    bundle,
  ))!.body as { id: string };
  const connectionId = randomUUID();
  const connection = (await handleResearchConnections(
    req(`/api/v1/account/research-connections/${connectionId}`, 'PUT', {
      action: 'create',
      requestId: randomUUID(),
      expectedVersion: 0,
      source: {
        itemId: source.id,
        version: source.version,
        sourceHash: source.sourceHash,
      },
      target: { kind: 'goal', id: goal.id, version: 1 },
      note: 'Synthetic adapter research receipt.',
      storageConsent: true,
    }),
    state,
    bundle,
  ))!.body;
  const body = input([{ id: connectionId, version: 1 }]);
  const before = ReportJobSchema.parse(
    (await reportsHandler(req(base, 'POST', body), state, bundle))!.body,
  );
  const changed = {
    ...bundle,
    generatedAt: new Date().toISOString(),
    feed: bundle.feed.filter((item) => item.id !== source.id),
    histories: {
      ...bundle.histories,
      [source.id]: [
        ...(bundle.histories[source.id] ?? []),
        {
          ...source,
          version: source.version + 1,
          status: 'withdrawn' as const,
          correctionNote: 'Synthetic rebuilt-bundle withdrawal.',
        },
      ],
    },
  };
  const after = ReportJobSchema.parse(
    (await reportsHandler(
      req(base, 'POST', input([{ id: connectionId, version: 1 }])),
      state,
      changed,
    ))!.body,
  );
  if (!('researchConnections' in after.snapshot))
    throw Error('Expected v2 capture');
  expect(
    after.snapshot.researchConnections.receipts[0]!.sourceAtCapture,
  ).toBeNull();
  expect(after.snapshot.researchConnections.receipts[0]!.revision).toEqual(
    connection,
  );
  expect(
    after.snapshot.researchConnections.receipts[0]!.reviewReasons.join(' '),
  ).toContain('withdrawn');
  const issued = RecordReportV2Schema.parse(
    (await reportsHandler(
      req(`${base}/${before.id}/download`, 'GET'),
      state,
      changed,
    ))!.body,
  );
  expect(issued.snapshot).toEqual(before.snapshot);
  expect(
    issued.snapshot.researchConnections.receipts[0]!.sourceAtCapture,
  ).not.toBeNull();
  expect(JSON.stringify(after.snapshot.researchConnections)).not.toContain(
    source.title,
  );
  expect(
    ReportJobSchema.parse(
      (await reportsHandler(req(base, 'POST', body), state, changed))!.body,
    ).snapshot,
  ).toEqual(before.snapshot);
});
