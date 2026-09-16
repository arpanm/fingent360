import { connectionDatabase } from '../../helpers/research-connection-fixture';
import { test, expect } from '../../helpers/app-fixture';
import {
  RegulatoryMetadataSchema,
  RegulatoryEditionSchema,
} from '../../../../packages/contracts/src/index';
import {
  regulatoryCapture,
  regulatoryFixture,
  regulatoryReview,
  syntheticRegulatoryHtml,
} from '../../helpers/regulatory-sources';
import { governanceHeaders as headers } from '../../helpers/research-governance';
test('E2E-API-1680 strict regulatory original URL and precision contract refuses invented precision @SRC-014 @TEST-SIMULATION', async () => {
  const m = regulatoryCapture().metadata;
  expect(RegulatoryMetadataSchema.parse(m).effective).toEqual({
    precision: 'unknown',
    value: null,
  });
  expect(
    RegulatoryMetadataSchema.safeParse({
      ...m,
      effective: { precision: 'day', value: '2026' },
    }).success,
  ).toBe(false);
  for (const sourceUrl of [
    'https://www.incometax.gov.in.evil.invalid/a',
    'https://user:password@www.incometax.gov.in/a',
    'http://www.incometax.gov.in/a',
    'https://www.incometax.gov.in:8443/a',
  ])
    expect(
      RegulatoryMetadataSchema.safeParse({ ...m, sourceUrl }).success,
    ).toBe(false);
});
test('E2E-API-1681 disabled regulatory source capture and reader preserve activation boundary @SRC-014 @TEST-SIMULATION', async ({
  request,
}) => {
  expect(
    (
      await request.post('/api/v1/ops/regulatory-sources/import', {
        headers,
        data: regulatoryCapture(),
      })
    ).status(),
  ).toBe(503);
  expect(
    await (await request.get('/api/v1/regulatory-sources')).json(),
  ).toEqual({ enabled: false, editions: [], nextCursor: null });
});
test.describe('Synthetic source permission', () => {
  test.use({ namedOperators: true, regulatorySimulation: true });
  test('E2E-API-1682 actual original retention independent publication supersession and withdrawal do not revive prior source @SRC-014 @TEST-SIMULATION', async ({
    request,
    playwright,
    feedbackSandbox,
  }) => {
    const f = await regulatoryFixture(request, playwright, feedbackSandbox);
    try {
      const evidence = await request.get(
        `/api/v1/ops/regulatory-sources/${f.id}/evidence`,
      );
      expect(evidence.status()).toBe(200);
      expect(
        Buffer.from((await evidence.json()).bodyBase64, 'base64').toString(),
      ).toBe(syntheticRegulatoryHtml);
      expect(
        (
          await request.post(`/api/v1/ops/regulatory-sources/${f.id}/review`, {
            headers,
            data: regulatoryReview(),
          })
        ).status(),
      ).toBe(403);
      const decision = regulatoryReview();
      expect(
        (
          await f.reviewer.post(
            `/api/v1/ops/regulatory-sources/${f.id}/review`,
            { headers, data: decision },
          )
        ).status(),
      ).toBe(201);
      expect(
        (
          await f.reviewer.post(
            `/api/v1/ops/regulatory-sources/${f.id}/review`,
            { headers, data: decision },
          )
        ).status(),
      ).toBe(201);
      const next = regulatoryCapture(f.id);
      next.metadata.title = 'Synthetic second source revision';
      expect(
        (
          await request.post('/api/v1/ops/regulatory-sources/import', {
            headers,
            data: next,
          })
        ).status(),
      ).toBe(201);
      expect(
        (
          await f.reviewer.post(
            `/api/v1/ops/regulatory-sources/${next.requestId}/review`,
            { headers, data: regulatoryReview() },
          )
        ).status(),
      ).toBe(201);
      expect(
        (
          await f.reviewer.post(
            `/api/v1/ops/regulatory-sources/${next.requestId}/review`,
            { headers, data: { ...regulatoryReview(), decision: 'withdraw' } },
          )
        ).status(),
      ).toBe(201);
      const list = await (
        await request.get('/api/v1/regulatory-sources?history=true')
      ).json();
      expect(
        list.editions.find((e: { id: string }) => e.id === f.id).state,
      ).toBe('superseded');
      expect(
        list.editions.find((e: { id: string }) => e.id === next.requestId)
          .state,
      ).toBe('withdrawn');
      for (const e of list.editions) {
        expect(RegulatoryEditionSchema.parse(e).adviceEnabled).toBe(false);
        expect(e).not.toHaveProperty('rightsReference');
      }
    } finally {
      await f.reviewer.dispose();
    }
  });
  test('E2E-API-1683 malformed bytes and unreviewed date annotations cannot publish @SRC-014 @TEST-SIMULATION', async ({
    request,
    playwright,
    feedbackSandbox,
  }) => {
    const f = await regulatoryFixture(request, playwright, feedbackSandbox);
    try {
      expect(
        (
          await f.reviewer.post(
            `/api/v1/ops/regulatory-sources/${f.id}/review`,
            {
              headers,
              data: { ...regulatoryReview(), originalReviewed: false },
            },
          )
        ).status(),
      ).toBe(409);
      const bad = regulatoryCapture();
      bad.bodyBase64 = Buffer.from(
        'Synthetic not an original HTML envelope',
      ).toString('base64');
      const capture = await request.post(
        '/api/v1/ops/regulatory-sources/import',
        { headers, data: bad },
      );
      expect(capture.status()).toBe(201);
      expect((await capture.json()).state).toBe('quarantined');
      expect(
        (
          await f.reviewer.post(
            `/api/v1/ops/regulatory-sources/${bad.requestId}/review`,
            { headers, data: regulatoryReview() },
          )
        ).status(),
      ).toBe(409);
    } finally {
      await f.reviewer.dispose();
    }
  });
  test('E2E-API-1684 source queue continuation cannot hide the published public revision behind drafts @SRC-014 @TEST-SIMULATION', async ({
    request,
    playwright,
    feedbackSandbox,
  }) => {
    const f = await regulatoryFixture(request, playwright, feedbackSandbox);
    try {
      expect(
        (
          await f.reviewer.post(
            `/api/v1/ops/regulatory-sources/${f.id}/review`,
            { headers, data: regulatoryReview() },
          )
        ).status(),
      ).toBe(201);
      for (let i = 0; i < 25; i++) {
        const draft = regulatoryCapture();
        draft.metadata.documentKey = 'synthetic-page-' + i;
        expect(
          (
            await request.post('/api/v1/ops/regulatory-sources/import', {
              headers,
              data: draft,
            })
          ).status(),
        ).toBe(201);
      }
      const page = await (
        await request.get('/api/v1/ops/regulatory-sources')
      ).json();
      expect(page.editions).toHaveLength(25);
      expect(page.nextCursor).toBeTruthy();
      const older = await (
        await request.get(
          '/api/v1/ops/regulatory-sources?after=' +
            encodeURIComponent(page.nextCursor),
        )
      ).json();
      expect(older.editions.some((e: { id: string }) => e.id === f.id)).toBe(
        true,
      );
      const publicPage = await (
        await request.get('/api/v1/regulatory-sources')
      ).json();
      expect(publicPage.editions).toHaveLength(1);
      expect(publicPage.editions[0].id).toBe(f.id);
    } finally {
      await f.reviewer.dispose();
    }
  });
  test('E2E-API-1685 actual blocked capture and review replay recheck expired operator admission @SRC-014 @TEST-SIMULATION', async ({
    request,
    playwright,
    feedbackSandbox,
  }) => {
    const f = await regulatoryFixture(request, playwright, feedbackSandbox),
      blocker = await connectionDatabase(feedbackSandbox),
      observer = await connectionDatabase(feedbackSandbox);
    let pending: ReturnType<typeof request.post> | undefined;
    try {
      const review = regulatoryReview();
      expect(
        (
          await f.reviewer.post(
            `/api/v1/ops/regulatory-sources/${f.id}/review`,
            { headers, data: review },
          )
        ).status(),
      ).toBe(201);
      for (const kind of ['capture', 'review']) {
        expect(
          (
            await request.post('/api/v1/ops/session', {
              headers,
              data: feedbackSandbox.namedCredentials,
            })
          ).status(),
        ).toBe(200);
        expect(
          (
            await f.reviewer.post('/api/v1/ops/session', {
              headers,
              data: f.credentials,
            })
          ).status(),
        ).toBe(200);
        await blocker.query('BEGIN');
        const pid = Number(
          (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid,
        );
        await blocker.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
          kind === 'capture'
            ? 'regulatory:' + f.id
            : 'regulatory-review:' + review.requestId,
        ]);
        pending =
          kind === 'capture'
            ? request.post('/api/v1/ops/regulatory-sources/import', {
                headers,
                data: f.input,
              })
            : f.reviewer.post(`/api/v1/ops/regulatory-sources/${f.id}/review`, {
                headers,
                data: review,
              });
        void pending.catch(() => {});
        await expect
          .poll(
            async () => {
              await observer.query('SELECT pg_stat_clear_snapshot()');
              return Number(
                (
                  await observer.query(
                    "SELECT count(*)::int AS n FROM pg_stat_activity WHERE wait_event_type='Lock' AND $1=ANY(pg_blocking_pids(pid))",
                    [pid],
                  )
                ).rows[0].n,
              );
            },
            { timeout: 2500 },
          )
          .toBeGreaterThan(0);
        await observer.query(
          "UPDATE operator_sessions SET expires_at=clock_timestamp()-interval '1 second'",
        );
        await blocker.query('COMMIT');
        const denied = await pending;
        expect(denied.status()).toBe(401);
        expect(await denied.text()).not.toContain(f.input.metadata.title);
      }
    } finally {
      await blocker.query('ROLLBACK');
      if (pending) await pending.then((r) => r.body()).catch(() => {});
      await blocker.end();
      await observer.end();
      await f.reviewer.dispose();
    }
  });
});
