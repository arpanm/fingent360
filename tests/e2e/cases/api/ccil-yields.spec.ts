import { connectionDatabase } from '../../helpers/research-connection-fixture';
import { test, expect } from '../../helpers/app-fixture';
import { randomUUID } from 'node:crypto';
import { parseCcilYields } from '../../../../packages/contracts/src/index';
import {
  syntheticCcilHtml,
  publishedCcilFixture,
} from '../../helpers/ccil-yields';
import { governanceHeaders as headers } from '../../helpers/research-governance';
test('E2E-API-1570 original-layout synthetic yields preserve conventions and reject ambiguity @SRC-017 @TEST-SIMULATION', async () => {
  const input = syntheticCcilHtml(),
    parsed = parseCcilYields(input);
  expect(parsed.rows[0]).toMatchObject({
    ytmPercent: '6.1234',
    isin: null,
    cleanPrice: null,
    convention: 'primary-auction-cutoff',
  });
  expect(parsed.rows[4]?.convention).toBe('indicative-benchmark');
  expect(() => parseCcilYields(input.replace('YTM (%)', 'Price'))).toThrow();
  expect(() =>
    parseCcilYields(input.replace('91D</td>', '182D</td>')),
  ).toThrow();
  expect(() =>
    parseCcilYields(
      input.replace('6.1234</td>', '<script>bad()</script></td>'),
    ),
  ).toThrow();
  expect(() =>
    parseCcilYields(
      input.replace('2026-09-11 00:00:00.0', '2026-09-12 00:00:00.0'),
    ),
  ).toThrow();
});
test('E2E-API-1571 disabled deployment cannot retain or distribute CCIL evidence @SRC-017 @TEST-SIMULATION', async ({
  request,
}) => {
  expect(
    (
      await request.post('/api/v1/ops/bond-yields/import', {
        headers,
        data: { requestId: randomUUID(), body: syntheticCcilHtml() },
      })
    ).status(),
  ).toBe(503);
  expect(await (await request.get('/api/v1/bond-yields')).json()).toEqual({
    enabled: false,
    editions: [],
  });
});
test.describe('Synthetic permitted deployment', () => {
  test.use({ namedOperators: true, ccilSimulation: true });
  test('E2E-API-1572 source retention independent publication replay and withdrawal use actual storage @SRC-017 @TEST-SIMULATION', async ({
    request,
    playwright,
    feedbackSandbox,
  }) => {
    const f = await publishedCcilFixture(request, playwright, feedbackSandbox);
    try {
      const original = await request.get(
        `/api/v1/ops/bond-yields/${f.id}/evidence`,
      );
      expect((await original.json()).body).toBe(syntheticCcilHtml());
      expect(
        (await (await request.get('/api/v1/bond-yields')).json()).editions,
      ).toHaveLength(1);
      expect(
        (
          await request.post(`/api/v1/ops/bond-yields/${f.id}/review`, {
            headers,
            data: {
              requestId: randomUUID(),
              decision: 'publish',
              reason: 'Original author cannot independently publish.',
            },
          })
        ).status(),
      ).toBe(403);
      const bad = randomUUID();
      expect(
        (
          await (
            await request.post('/api/v1/ops/bond-yields/import', {
              headers,
              data: {
                requestId: bad,
                body: syntheticCcilHtml().replace('YTM (%)', 'Price'),
              },
            })
          ).json()
        ).state,
      ).toBe('quarantined');
      expect(
        (
          await f.reviewer.post(`/api/v1/ops/bond-yields/${bad}/review`, {
            headers,
            data: {
              requestId: randomUUID(),
              decision: 'publish',
              reason: 'Malformed source cannot be published.',
            },
          })
        ).status(),
      ).toBe(409);
      const input = {
        requestId: randomUUID(),
        decision: 'withdraw',
        reason: 'Synthetic independent source withdrawal.',
      };
      expect(
        (
          await f.reviewer.post(`/api/v1/ops/bond-yields/${f.id}/review`, {
            headers,
            data: input,
          })
        ).status(),
      ).toBe(201);
      expect(
        (
          await f.reviewer.post(`/api/v1/ops/bond-yields/${f.id}/review`, {
            headers,
            data: input,
          })
        ).status(),
      ).toBe(201);
      expect(
        (await (await request.get('/api/v1/bond-yields/snapshot')).json())
          .editions,
      ).toEqual([]);
    } finally {
      await f.reviewer.dispose();
    }
  });
});
test.describe('CCIL replay final admission', () => {
  test.use({ namedOperators: true, ccilSimulation: true });
  test('E2E-API-1573 actual blocked original replay rechecks expired named operator before returning evidence @SRC-017 @TEST-SIMULATION', async ({
    request,
    playwright,
    feedbackSandbox,
  }) => {
    const f = await publishedCcilFixture(request, playwright, feedbackSandbox),
      blocker = await connectionDatabase(feedbackSandbox),
      observer = await connectionDatabase(feedbackSandbox);
    let pending: ReturnType<typeof request.post> | undefined;
    try {
      await blocker.query('BEGIN');
      const pid = Number(
        (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid,
      );
      await blocker.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        'ccil:' + f.id,
      ]);
      pending = request.post('/api/v1/ops/bond-yields/import', {
        headers,
        data: { requestId: f.id, body: syntheticCcilHtml() },
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
      expect(await denied.text()).not.toContain('6.1234');
    } finally {
      await blocker.query('ROLLBACK');
      if (pending) await pending.then((r) => r.body()).catch(() => {});
      await blocker.end();
      await observer.end();
      await f.reviewer.dispose();
    }
  });
});
