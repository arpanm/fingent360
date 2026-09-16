import { randomUUID } from 'node:crypto';
import {
  test,
  expect,
  retentionHeaders,
  indiaActors,
  filingRights,
  runFilingTick,
} from '../../helpers/filing-watch';
import {
  companyCohortInput,
  loadCompanyCohort,
} from '../../helpers/equity-company-cohort';
import {
  FilingWatchStatusSchema,
  EquityCompanySchema,
} from '../../../../packages/contracts/src/index';
test.use({ namedOperators: true, manualWorkers: true });
test('E2E-API-1990 original filing schedule retains partial outcomes corrections unchanged receipts and independent publication @SRC-004 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox),
    cohort = (await loadCompanyCohort()).slice(0, 3),
    first = await companyCohortInput(cohort[0]!);
  try {
    const gate = {
      enabled: true,
      sourceIds: cohort.map((c) => c.symbol),
      rightsEvidence: filingRights,
    };
    expect(
      (
        await request.post('/api/v1/ops/filing-watch/gate', {
          headers: retentionHeaders,
          data: gate,
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await request.put('/api/v1/ops/research-auto', {
          headers: retentionHeaders,
          data: {
            sourceId: 'equity-filing-watch',
            enabled: true,
            intervalMinutes: 1440,
          },
        })
      ).status(),
    ).toBe(200);
    const originals = {
      [cohort[0]!.sourceUrl]: first.body,
      [cohort[1]!.sourceUrl]: '<html>Unsupported retained source layout</html>',
      [cohort[2]!.sourceUrl]: Error('Synthetic source unavailable'),
    };
    expect(await runFilingTick(feedbackSandbox, originals)).toBe(3);
    let view = FilingWatchStatusSchema.parse(
      await (await request.get('/api/v1/ops/filing-watch')).json(),
    );
    expect(new Set(view.attempts.map((a) => a.status))).toEqual(
      new Set(['draft', 'quarantine', 'unavailable']),
    );
    const draft = view.attempts.find((a) => a.status === 'draft')!,
      quarantine = view.attempts.find((a) => a.status === 'quarantine')!;
    expect(
      (
        await reviewer.get(
          '/api/v1/ops/filing-watch/' + quarantine.id + '/evidence',
        )
      ).status(),
    ).toBe(200);
    const review = {
      requestId: randomUUID(),
      editionId: draft.editionId,
      decision: 'publish',
      reason:
        'Independent exact original issuer/cells and watch permission reviewed.',
    };
    expect(
      (
        await request.post('/api/v1/ops/equities/review', {
          headers: retentionHeaders,
          data: review,
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await reviewer.post('/api/v1/ops/equities/review', {
          headers: retentionHeaders,
          data: { ...review, requestId: randomUUID() },
        })
      ).status(),
    ).toBe(201);
    expect(
      EquityCompanySchema.parse(
        await (await request.get('/api/v1/equities/' + cohort[0]!.isin)).json(),
      ).records.length,
    ).toBeGreaterThan(0);
    await runFilingTick(feedbackSandbox, originals);
    view = FilingWatchStatusSchema.parse(
      await (await request.get('/api/v1/ops/filing-watch')).json(),
    );
    expect(
      view.attempts
        .filter((a) => a.status === 'unchanged')
        .map((a) => a.editionId),
    ).toContain(draft.editionId);
    originals[cohort[0]!.sourceUrl] = first.body.replace(
      cohort[0]!.revenue[0]!,
      '3,438.77',
    );
    await runFilingTick(feedbackSandbox, originals);
    view = FilingWatchStatusSchema.parse(
      await (await request.get('/api/v1/ops/filing-watch')).json(),
    );
    expect(
      new Set(view.attempts.filter((a) => a.editionId).map((a) => a.editionId))
        .size,
    ).toBe(2);
    expect(
      view.attempts.filter((a) => a.editionState === 'published'),
    ).toHaveLength(2);
    expect(
      (
        await request.post('/api/v1/ops/filing-watch/gate', {
          headers: retentionHeaders,
          data: { ...gate, enabled: false },
        })
      ).status(),
    ).toBe(201);
    const hidden = await request.get('/api/v1/equities/' + cohort[0]!.isin);
    expect(hidden.status()).toBe(404);
    expect(
      (await (await request.get('/api/v1/equities')).json()).companies,
    ).toHaveLength(0);
    expect(
      (await (await request.get('/api/v1/equities/snapshot')).json()).companies,
    ).toHaveLength(0);
  } finally {
    await reviewer.dispose();
  }
});
test('E2E-API-1991 permission change during watched original fetch prevents admission and unregistered URL selection is rejected @SRC-004 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox),
    entry = (await loadCompanyCohort())[0]!,
    input = await companyCohortInput(entry),
    gate = {
      enabled: true,
      sourceIds: [entry.symbol],
      rightsEvidence: filingRights,
    };
  try {
    expect(
      (
        await request.post('/api/v1/ops/filing-watch/gate', {
          headers: retentionHeaders,
          data: { ...gate, sourceIds: ['https://127.0.0.1/private'] },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await request.post('/api/v1/ops/filing-watch/gate', {
          headers: retentionHeaders,
          data: gate,
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await request.put('/api/v1/ops/research-auto', {
          headers: retentionHeaders,
          data: {
            sourceId: 'equity-filing-watch',
            enabled: true,
            intervalMinutes: 1440,
          },
        })
      ).status(),
    ).toBe(200);
    await expect(
      runFilingTick(
        feedbackSandbox,
        { [entry.sourceUrl]: input.body },
        async () => {
          expect(
            (
              await request.post('/api/v1/ops/filing-watch/gate', {
                headers: retentionHeaders,
                data: { ...gate, enabled: false },
              })
            ).status(),
          ).toBe(201);
        },
      ),
    ).rejects.toThrow();
    expect(
      FilingWatchStatusSchema.parse(
        await (await request.get('/api/v1/ops/filing-watch')).json(),
      ).attempts,
    ).toHaveLength(0);
  } finally {
    await reviewer.dispose();
  }
});

test('E2E-API-1992 original attempt pagination preserves equal timestamps and rejects unknown cursors @SRC-004 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const { connectionDatabase } =
      await import('../../helpers/research-connection-fixture'),
    reviewer = await indiaActors(request, playwright, feedbackSandbox),
    pool = await connectionDatabase(feedbackSandbox),
    entry = (await loadCompanyCohort())[0]!;
  try {
    const ids = Array.from({ length: 22 }, () => randomUUID());
    for (const id of ids)
      await pool.query(
        "INSERT INTO filing_watch_attempts(id,source_id,source_url,rights_hash,gate_version,status,message,created_at) VALUES($1,$2,$3,'synthetic-no-rights',1,'unavailable','TEST-SIMULATION transport failure for equal timestamp pagination','2026-09-15T00:00:00Z')",
        [id, entry.symbol, entry.sourceUrl],
      );
    const first = FilingWatchStatusSchema.parse(
      await (await request.get('/api/v1/ops/filing-watch')).json(),
    );
    expect(first.attempts).toHaveLength(20);
    expect(first.next).not.toBeNull();
    const second = FilingWatchStatusSchema.parse(
      await (
        await request.get('/api/v1/ops/filing-watch?after=' + first.next)
      ).json(),
    );
    expect(second.attempts).toHaveLength(2);
    expect(second.next).toBeNull();
    expect([...first.attempts, ...second.attempts].map((a) => a.id)).toEqual(
      [...ids].sort().reverse(),
    );
    expect(
      (
        await request.get('/api/v1/ops/filing-watch?after=' + randomUUID())
      ).status(),
    ).toBe(404);
  } finally {
    await pool.end();
    await reviewer.dispose();
  }
});
