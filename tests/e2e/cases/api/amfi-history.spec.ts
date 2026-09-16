import { randomUUID } from 'node:crypto';
import {
  test,
  expect,
  retentionHeaders,
  indiaActors,
  historyInput,
} from '../../helpers/amfi-history';
import {
  FundDetailSchema,
  FundsSnapshotSchema,
  parseAmfiNav,
} from '../../../../packages/contracts/src/index';
test.use({ namedOperators: true });
test('E2E-API-1540 historical NAV retains multiple dates independent review revisions and withdrawal @SRC-015 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox),
    data = historyInput();
  try {
    const capture = await request.post('/api/v1/ops/funds/import', {
      headers: retentionHeaders,
      data,
    });
    expect(capture.status(), await capture.text()).toBe(201);
    expect(
      (
        await request.post('/api/v1/ops/funds/import', {
          headers: retentionHeaders,
          data,
        })
      ).status(),
    ).toBe(201);
    const review = {
      requestId: randomUUID(),
      editionId: data.requestId,
      decision: 'publish',
      reason: 'Synthetic independent history source review.',
    };
    expect(
      (
        await request.post('/api/v1/ops/funds/review', {
          headers: retentionHeaders,
          data: review,
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await reviewer.post('/api/v1/ops/funds/review', {
          headers: retentionHeaders,
          data: review,
        })
      ).status(),
    ).toBe(201);
    const detail = FundDetailSchema.parse(
      await (await request.get('/api/v1/funds/900001')).json(),
    );
    expect(detail.history.map((row) => row.observation.nav)).toEqual([
      '10.3000',
      '10.2000',
      '10.1000',
    ]);
    expect(detail.reconciliation.distinctDates).toBe(3);
    const snapshot = FundsSnapshotSchema.parse(
      await (await request.get('/api/v1/funds/snapshot')).json(),
    );
    expect(snapshot.funds[0]?.observation.nav).toBe('10.3000');
    expect(snapshot.history).toHaveLength(3);
    expect(
      (
        await (
          await request.get(`/api/v1/ops/funds/${data.requestId}/evidence`)
        ).json()
      ).body,
    ).toBe(data.body);
    const revision = {
      ...data,
      requestId: randomUUID(),
      body: data.body.replace('10.2000', '10.2500'),
    };
    expect(
      (
        await request.post('/api/v1/ops/funds/import', {
          headers: retentionHeaders,
          data: revision,
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await reviewer.post('/api/v1/ops/funds/review', {
          headers: retentionHeaders,
          data: {
            ...review,
            requestId: randomUUID(),
            editionId: revision.requestId,
          },
        })
      ).status(),
    ).toBe(201);
    const revised = FundDetailSchema.parse(
      await (await request.get('/api/v1/funds/900001')).json(),
    );
    expect(revised.reconciliation.conflictingDates).toEqual(['2026-09-10']);
    expect(
      (
        await reviewer.post('/api/v1/ops/funds/review', {
          headers: retentionHeaders,
          data: {
            ...review,
            requestId: randomUUID(),
            editionId: revision.requestId,
            decision: 'withdraw',
          },
        })
      ).status(),
    ).toBe(201);
    expect(
      FundDetailSchema.parse(
        await (await request.get('/api/v1/funds/900001')).json(),
      ).reconciliation.conflictingDates,
    ).toEqual([]);
  } finally {
    await reviewer.dispose();
  }
});
test('E2E-API-1541 historical NAV rejects changed headers duplicate dates unsupported URL scope and interval leakage @SRC-015 @TEST-SIMULATION', async () => {
  const data = historyInput();
  expect(parseAmfiNav(data.body, data.sourceUrl)).toHaveLength(3);
  for (const body of [
    data.body.replace('NAV Name', 'Scheme Name'),
    data.body.replace('10-Sep-2026', '09-Sep-2026'),
    data.body.replace('09-Sep-2026', '08-Sep-2026'),
    data.body.replace('SBI Mutual Fund', 'Unverified AMC'),
    data.body.replace('10.3000;', '10.3000;unexpected;'),
  ])
    expect(() => parseAmfiNav(body, data.sourceUrl)).toThrow();
  for (const url of [
    undefined,
    data.sourceUrl.replace('mf=22', 'mf=1'),
    data.sourceUrl.replace('tp=1', 'tp=2'),
    data.sourceUrl + '&mf=22',
    data.sourceUrl.replace('09-Sep', '01-Jan'),
    data.sourceUrl.replace('portal.amfiindia.com', 'example.org'),
  ])
    expect(() => parseAmfiNav(data.body, url)).toThrow();
});
test('E2E-API-1542 published catalog admits each AMC and each type while preserving exact all-AMC date semantics @SRC-015 @TEST-SIMULATION', async () => {
  const { AMFI_HISTORY_CATALOG, amfiHistoryUrl } =
    await import('../../../../packages/contracts/src/index');
  const base = historyInput();
  expect(AMFI_HISTORY_CATALOG.amcs).toHaveLength(76);
  for (const amc of AMFI_HISTORY_CATALOG.amcs)
    for (const type of AMFI_HISTORY_CATALOG.types) {
      const url = amfiHistoryUrl(
        amc.code,
        type.code,
        '2026-09-09',
        '2026-09-11',
      );
      const body = base.body
        .replace('SBI Mutual Fund', amc.name)
        .replace('Open Ended Schemes', type.categoryPrefix);
      expect(parseAmfiNav(body, url)).toHaveLength(3);
    }
  const all = amfiHistoryUrl('', '', '2026-09-11', '');
  expect(all).toBe(
    'https://portal.amfiindia.com/DownloadNAVHistoryReport_Po.aspx?frmdt=11-Sep-2026',
  );
  expect(() => parseAmfiNav(base.body, all)).toThrow();
  expect(() =>
    amfiHistoryUrl('999', '1', '2026-09-09', '2026-09-11'),
  ).toThrow();
  expect(() => amfiHistoryUrl('9', '4', '2026-09-09', '2026-09-11')).toThrow();
});
test('E2E-API-1543 non-SBI history persists catalog provenance through independent publication @SRC-015 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const { AMFI_HISTORY_CATALOG, amfiHistoryUrl } =
    await import('../../../../packages/contracts/src/index');
  const reviewer = await indiaActors(request, playwright, feedbackSandbox),
    base = historyInput();
  const data = {
    ...base,
    sourceUrl: amfiHistoryUrl('9', '2', '2026-09-09', '2026-09-11'),
    body: base.body
      .replace('SBI Mutual Fund', 'HDFC Mutual Fund')
      .replace('Open Ended Schemes', 'Close Ended Schemes'),
  };
  try {
    const capture = await request.post('/api/v1/ops/funds/import', {
      headers: retentionHeaders,
      data,
    });
    expect(capture.status(), await capture.text()).toBe(201);
    expect((await capture.json()).historyCatalog).toMatchObject({
      version: AMFI_HISTORY_CATALOG.version,
      sourceHash: AMFI_HISTORY_CATALOG.sourceHash,
    });
    expect(
      (
        await reviewer.post('/api/v1/ops/funds/review', {
          headers: retentionHeaders,
          data: {
            requestId: randomUUID(),
            editionId: data.requestId,
            decision: 'publish',
            reason:
              'Synthetic independently reviewed HDFC close-ended history.',
          },
        })
      ).status(),
    ).toBe(201);
    const snapshot = FundsSnapshotSchema.parse(
      await (await request.get('/api/v1/funds/snapshot')).json(),
    );
    expect(snapshot.history?.[0]?.edition.historyCatalog?.version).toBe(
      AMFI_HISTORY_CATALOG.version,
    );
    expect(snapshot.history?.[0]?.observation.amc).toBe('HDFC Mutual Fund');
  } finally {
    await reviewer.dispose();
  }
});
