import { openAuthDatabase } from '../../helpers/auth-wait';
import {
  prepareConnectionAccount,
  seedConnectionSource,
} from '../../helpers/research-connection-fixture';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { test, expect } from '../../helpers/app-fixture';
import {
  HoldingsPreviewSchema,
  HoldingsSnapshotSchema,
  PrivacyExportSchema,
} from '../../../../packages/contracts/src/index';
const { Pool } = createRequire(
  new URL('../../../../apps/api/package.json', import.meta.url),
)('pg') as {
  Pool: new (options: { connectionString: string }) => {
    query: (
      sql: string,
      values?: unknown[],
    ) => Promise<{ rows: Record<string, unknown>[] }>;
    end: () => Promise<void>;
  };
};
const headers = { Origin: process.env.E2E_WEB_URL || 'http://localhost:5173' };
const password = 'Synthetic-reconciliation-2026';
const csv =
  'isin,quantity,total_cost_paise\nINE002A01018,1.000001,9007199254740993\nINE009A01021,2,200\nINE467B01029,3,300';
const replacement =
  'isin,quantity,total_cost_paise\nINE002A01018,0.000001,9007199254740992\nINE009A01021,2.000000,200\nINE040A01034,1,100';
test('E2E-API-400 exact baseline replacement acknowledgement ownership replay and private export @HOLDINGS-RECONCILE-001', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const register = () => ({
    username: `reconcile_${randomUUID().slice(0, 12)}`,
    password,
    consent: true,
  });
  expect(
    (
      await request.post('/api/v1/account/register', {
        headers,
        data: register(),
      })
    ).status(),
  ).toBe(201);
  const preview = async (text: string, version: number) => {
    const response = await request.post('/api/v1/account/holdings/preview', {
      headers,
      data: { csv: text, expectedVersion: version, storageConsent: true },
    });
    expect(response.status()).toBe(201);
    return HoldingsPreviewSchema.parse(await response.json());
  };
  const confirm = (
    p: ReturnType<typeof HoldingsPreviewSchema.parse>,
    ack = false,
  ) =>
    request.post('/api/v1/account/holdings/confirm', {
      headers,
      data: {
        previewId: p.previewId,
        expectedVersion: p.expectedVersion,
        ...(ack ? { acknowledgeRemovals: true } : {}),
      },
    });
  const initial = await preview(csv, 0);
  expect(
    initial.reconciliation?.changes.every((c) => c.status === 'added'),
  ).toBe(true);
  expect((await confirm(initial)).status()).toBe(201);
  const changed = await preview(replacement, 1);
  expect(changed.reconciliation?.baseline.totalCostMinor).toBe(
    '9007199254741493',
  );
  expect(changed.reconciliation?.totalCostDeltaMinor).toBe('-201');
  expect(changed.reconciliation?.changes.map((c) => c.status).sort()).toEqual([
    'added',
    'changed',
    'removed',
    'unchanged',
  ]);
  const pending = PrivacyExportSchema.parse(
    await (await request.get('/api/v1/account/privacy/export')).json(),
  );
  expect(
    pending.holdings.previews.find((p) => p.id === changed.previewId)
      ?.reconciliation,
  ).toEqual(changed.reconciliation);
  expect((await confirm(changed)).status()).toBe(400);
  expect(
    HoldingsSnapshotSchema.parse(
      await (await request.get('/api/v1/account/holdings')).json(),
    ).version,
  ).toBe(1);
  const stranger = await playwright.request.newContext({
    baseURL: feedbackSandbox.apiOrigin,
  });
  try {
    await stranger.post('/api/v1/account/register', {
      headers,
      data: register(),
    });
    expect(
      (
        await stranger.post('/api/v1/account/holdings/confirm', {
          headers,
          data: {
            previewId: changed.previewId,
            expectedVersion: 1,
            acknowledgeRemovals: true,
          },
        })
      ).status(),
    ).toBe(404);
    expect(
      PrivacyExportSchema.parse(
        await (await stranger.get('/api/v1/account/privacy/export')).json(),
      ).holdings.previews,
    ).toEqual([]);
  } finally {
    await stranger.dispose();
  }
  const saved = HoldingsSnapshotSchema.parse(
    await (await confirm(changed, true)).json(),
  );
  expect(saved.version).toBe(2);
  const empty = await preview('isin,quantity,total_cost_paise', 2);
  expect((await confirm(empty, true)).status()).toBe(201);
  expect(await (await confirm(changed)).json()).toEqual(saved);
  const exported = PrivacyExportSchema.parse(
    await (await request.get('/api/v1/account/privacy/export')).json(),
  );
  expect(
    exported.holdings.previews.find((p) => p.id === changed.previewId)
      ?.reconciliation,
  ).toEqual(changed.reconciliation);
  expect(exported.holdings.revisions).toHaveLength(3);
});
test('E2E-API-401 stale expired unreadable previews recover without breaking legacy successful receipts @HOLDINGS-RECONCILE-001', async ({
  request,
  feedbackSandbox,
}) => {
  await request.post('/api/v1/account/register', {
    headers,
    data: {
      username: `reconcile_${randomUUID().slice(0, 12)}`,
      password,
      consent: true,
    },
  });
  const pool = new Pool({ connectionString: feedbackSandbox.databaseUrl });
  const preview = async (version: number) =>
    HoldingsPreviewSchema.parse(
      await (
        await request.post('/api/v1/account/holdings/preview', {
          headers,
          data: { csv, expectedVersion: version, storageConsent: true },
        })
      ).json(),
    );
  const confirm = (p: ReturnType<typeof HoldingsPreviewSchema.parse>) =>
    request.post('/api/v1/account/holdings/confirm', {
      headers,
      data: { previewId: p.previewId, expectedVersion: p.expectedVersion },
    });
  try {
    const first = await preview(0),
      stale = await preview(0);
    const saved = await (await confirm(first)).json();
    expect((await confirm(stale)).status()).toBe(409);
    await pool.query(
      "UPDATE app_holdings_previews SET payload=$2::jsonb,encrypted_payload=NULL,expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
      [first.previewId, JSON.stringify(first.holdings)],
    );
    expect(await (await confirm(first)).json()).toEqual(saved);
    const expired = await preview(1);
    await pool.query(
      "UPDATE app_holdings_previews SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
      [expired.previewId],
    );
    expect((await confirm(expired)).status()).toBe(409);
    const legacy = await preview(1);
    await pool.query(
      'UPDATE app_holdings_previews SET payload=$2::jsonb,encrypted_payload=NULL WHERE id=$1',
      [legacy.previewId, JSON.stringify(legacy.holdings)],
    );
    expect((await confirm(legacy)).status()).toBe(409);
    const altered = await preview(1);
    await pool.query(
      "UPDATE app_holdings_previews SET payload=jsonb_set($2::jsonb,'{reconciliation,baseline,totalCostMinor}','\"0\"'),encrypted_payload=NULL WHERE id=$1",
      [
        altered.previewId,
        JSON.stringify({
          holdings: altered.holdings,
          import: altered.import,
          reconciliation: altered.reconciliation,
        }),
      ],
    );
    expect((await confirm(altered)).status()).toBe(409);
    const recovered = await preview(1);
    const responses = await Promise.all([
      confirm(recovered),
      confirm(recovered),
    ]);
    expect(responses.map((r) => r.status())).toEqual([201, 201]);
    expect(await responses[0]!.json()).toEqual(await responses[1]!.json());
  } finally {
    await pool.end();
  }
});

test('E2E-API-402 dependency consequences are actual dated counts and do not rewrite financial or research receipts @HOLDINGS-RECONCILE-001', async ({
  request,
  feedbackSandbox,
}) => {
  const source = await seedConnectionSource(feedbackSandbox);
  const goal = await prepareConnectionAccount(request);
  expect(
    (
      await request.put('/api/v1/account/allocations', {
        headers,
        data: {
          expectedVersion: 0,
          expectedHoldingsVersion: 1,
          storageConsent: true,
          rows: [
            {
              goalId: goal.id,
              goalVersion: 1,
              isin: 'INE002A01018',
              quantity: '1',
            },
          ],
        },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.put(
        `/api/v1/account/research-connections/${randomUUID()}`,
        {
          headers,
          data: {
            requestId: randomUUID(),
            expectedVersion: 0,
            action: 'create',
            source: {
              itemId: source.id,
              version: source.version,
              sourceHash: source.sourceHash,
            },
            target: { kind: 'holding', id: 'INE002A01018', version: 1 },
            note: 'Synthetic private research question.',
            storageConsent: true,
          },
        },
      )
    ).status(),
  ).toBe(200);
  const before = PrivacyExportSchema.parse(
    await (await request.get('/api/v1/account/privacy/export')).json(),
  );
  const preview = HoldingsPreviewSchema.parse(
    await (
      await request.post('/api/v1/account/holdings/preview', {
        headers,
        data: {
          csv: 'isin,quantity,total_cost_paise',
          expectedVersion: 1,
          storageConsent: true,
        },
      })
    ).json(),
  );
  expect(preview.reconciliation?.dependencies).toMatchObject({
    allocationRows: 1,
    holdingConnections: 1,
  });
  expect(
    (
      await request.post('/api/v1/account/holdings/confirm', {
        headers,
        data: {
          previewId: preview.previewId,
          expectedVersion: 1,
          acknowledgeRemovals: true,
        },
      })
    ).status(),
  ).toBe(201);
  const after = PrivacyExportSchema.parse(
    await (await request.get('/api/v1/account/privacy/export')).json(),
  );
  expect(after.goals).toEqual(before.goals);
  expect(after.allocations).toEqual(before.allocations);
  expect(after.researchConnections).toEqual(before.researchConnections);
  expect(
    (await (await request.get('/api/v1/account/allocations')).json())
      .requiresReview,
  ).toBe(true);
  expect(
    (await (await request.get('/api/v1/account/research-connections')).json())
      .connections[0].reviewReasons.length,
  ).toBeGreaterThan(0);
});

test('E2E-API-403 expiry while retention holds an expired preview denies new preview and rolls cleanup back @HOLDINGS-RECONCILE-001', async ({
  request,
  feedbackSandbox,
}) => {
  await request.post('/api/v1/account/register', {
    headers,
    data: {
      username: `expiry_${randomUUID().slice(0, 12)}`,
      password,
      consent: true,
    },
  });
  const owner = (await (await request.get('/api/v1/account')).json()).user;
  const input = { csv, expectedVersion: 0, storageConsent: true };
  const old = HoldingsPreviewSchema.parse(
    await (
      await request.post('/api/v1/account/holdings/preview', {
        headers,
        data: input,
      })
    ).json(),
  );
  const db = await openAuthDatabase(feedbackSandbox);
  try {
    await db.query(
      "UPDATE app_holdings_previews SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
      [old.previewId],
    );
    const blocker = await db.block('preview', old.previewId);
    let pending: ReturnType<typeof request.post> | undefined;
    try {
      pending = request.post('/api/v1/account/holdings/preview', {
        headers,
        data: input,
      });
      void pending.catch(() => {});
      let pid = 0;
      await expect
        .poll(
          async () => {
            const waiting = await db.query(
              "SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND $1=ANY(pg_blocking_pids(pid)) AND query LIKE 'DELETE FROM app_holdings_previews WHERE user_id=%'",
              [blocker.pid],
            );
            pid = Number(waiting.rows[0]?.pid ?? 0);
            return pid;
          },
          {
            timeout: 2500,
            intervals: [20, 40, 80],
            message:
              'Actual preview cleanup DELETE waits on its owned expired row.',
          },
        )
        .toBeGreaterThan(0);
      const expired = await db.query(
        "UPDATE app_sessions SET expires_at=(SELECT xact_start+interval '1 microsecond' FROM pg_stat_activity WHERE pid=$2) WHERE user_id=$1 RETURNING expires_at> (SELECT xact_start FROM pg_stat_activity WHERE pid=$2) AND expires_at<clock_timestamp() AS expired_after_start",
        [owner.id, pid],
      );
      expect(expired.rows).toEqual([{ expired_after_start: true }]);
      await blocker.release();
      expect((await pending).status()).toBe(401);
    } finally {
      await blocker.release();
      if (pending)
        await Promise.allSettled([pending.then((response) => response.body())]);
    }

    const remaining = await db.query(
      'SELECT id FROM app_holdings_previews WHERE user_id=$1',
      [owner.id],
    );
    expect(remaining.rows.map((row) => row.id)).toEqual([old.previewId]);
    const revisions = await db.query(
      'SELECT version FROM app_holdings_revisions WHERE user_id=$1',
      [owner.id],
    );
    expect(revisions.rows).toEqual([]);
  } finally {
    await db.close();
  }
});
