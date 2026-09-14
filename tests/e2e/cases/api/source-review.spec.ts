import { test, expect } from '../../helpers/app-fixture';
import {
  withdrawalFixture,
  withdrawReview,
} from '../../helpers/withdrawal-fixture';
import { SourceReviewComparisonSchema } from '../../../../packages/contracts/src/index';
import { connectionHeaders } from '../../helpers/research-connection-fixture';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-API-460 exact stored first/public/withdrawn review and stale mutation @SOURCE-REVIEW-DIFF-001', async ({
  request,
  feedbackSandbox,
}) => {
  const { first } = await withdrawalFixture(request, feedbackSandbox);
  const path = `/api/v1/ops/discovery/items/${first.id}`;
  const original = await (await request.get(`${path}/history`)).json();
  const initial = SourceReviewComparisonSchema.parse(
    await (
      await request.get(`${path}/comparison?expectedVersion=${first.version}`)
    ).json(),
  );
  expect(initial.head).toEqual(first);
  expect(initial.previous).toBeNull();
  const withdrawn = await withdrawReview(request, first, 'withdrawn');
  expect(
    (
      await request.get(`${path}/comparison?expectedVersion=${first.version}`)
    ).status(),
  ).toBe(409);
  const after = SourceReviewComparisonSchema.parse(
    await (
      await request.get(
        `${path}/comparison?expectedVersion=${withdrawn.version}`,
      )
    ).json(),
  );
  expect(after.previous).toEqual(first);
  expect(after.differences.find((d) => d.field === 'status')?.changed).toBe(
    true,
  );
  const republished = await withdrawReview(request, withdrawn, 'published');
  const last = SourceReviewComparisonSchema.parse(
    await (
      await request.get(
        `${path}/comparison?expectedVersion=${republished.version}`,
      )
    ).json(),
  );
  expect(last.previous?.status).toBe('withdrawn');
  expect(last.previous?.body).toBe(first.body);
  expect(
    (
      await request.put(path, {
        headers: connectionHeaders,
        data: {
          expectedVersion: withdrawn.version,
          status: 'published',
          correctionNote: 'Stale review',
        },
      })
    ).status(),
  ).toBe(409);
  const history = await (await request.get(`${path}/history`)).json();
  for (const old of original) expect(history).toContainEqual(old);
  expect(
    (
      await request.get(
        `${path}/comparison?expectedVersion=${republished.version}&extra=x`,
      )
    ).status(),
  ).toBe(400);
  expect(
    (await request.get(`${path}/comparison?expectedVersion=0`)).status(),
  ).toBe(400);
  expect(
    (
      await request.get(
        '/api/v1/ops/discovery/items/unknown-synthetic-review/comparison?expectedVersion=1',
      )
    ).status(),
  ).toBe(404);
  const { connectionDatabase } =
    await import('../../helpers/research-connection-fixture');
  const pool = await connectionDatabase(feedbackSandbox);
  try {
    for (let n = 1; n <= 2; n++) {
      const draft = {
        ...republished,
        version: republished.version + n,
        status: 'draft',
        title: `Synthetic draft ${n}`,
        reviewedAt: null,
      };
      await pool.query(
        'INSERT INTO discovery_versions(item_id,version,data) VALUES($1,$2,$3)',
        [draft.id, draft.version, draft],
      );
      await pool.query('UPDATE discovery_items SET version=$2 WHERE id=$1', [
        draft.id,
        draft.version,
      ]);
    }
  } finally {
    await pool.end();
  }
  const draftComparison = SourceReviewComparisonSchema.parse(
    await (
      await request.get(
        `${path}/comparison?expectedVersion=${republished.version + 2}`,
      )
    ).json(),
  );
  expect(draftComparison.head.status).toBe('draft');
  expect(draftComparison.previous).toEqual(republished);
});
test('E2E-API-461 actual source-lock expiry denies protected original @SOURCE-REVIEW-DIFF-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const { connectionDatabase } =
    await import('../../helpers/research-connection-fixture');
  const { waitForQueryBlocked } =
    await import('../../helpers/withdrawal-fixture');
  const { first } = await withdrawalFixture(request, feedbackSandbox);
  const blocker = await connectionDatabase(feedbackSandbox),
    observer = await connectionDatabase(feedbackSandbox);
  let pending: ReturnType<typeof request.get> | undefined;
  try {
    await blocker.query('BEGIN');
    const pid = Number(
      (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid,
    );
    await blocker.query(
      'SELECT id FROM discovery_items WHERE id=$1 FOR UPDATE',
      [first.id],
    );
    pending = request.get(
      `/api/v1/ops/discovery/items/${first.id}/comparison?expectedVersion=${first.version}`,
    );
    void pending.catch(() => {});
    await waitForQueryBlocked(
      observer,
      'SELECT version FROM discovery_items WHERE id=$1 FOR SHARE',
      [pid],
    );
    await observer.query(
      "UPDATE operator_sessions SET expires_at=clock_timestamp()-interval '1 second'",
    );
    await blocker.query('COMMIT');
    const response = await pending;
    expect(response.status()).toBe(401);
    expect(await response.text()).not.toContain(first.body);
  } finally {
    await blocker.query('ROLLBACK');
    if (pending) await pending.then((r) => r.body()).catch(() => {});
    await blocker.end();
    await observer.end();
  }
});

test('E2E-API-462 actual retained-version table wait rechecks expiry before disclosing protected originals @SOURCE-REVIEW-DIFF-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const { connectionDatabase } =
    await import('../../helpers/research-connection-fixture');
  const { waitForQueryBlocked } =
    await import('../../helpers/withdrawal-fixture');
  const { first } = await withdrawalFixture(request, feedbackSandbox);
  const blocker = await connectionDatabase(feedbackSandbox),
    observer = await connectionDatabase(feedbackSandbox);
  let pending: ReturnType<typeof request.get> | undefined;
  try {
    await blocker.query('BEGIN');
    const pid = Number(
      (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid,
    );
    await blocker.query(
      'LOCK TABLE discovery_versions IN ACCESS EXCLUSIVE MODE',
    );
    pending = request.get(
      `/api/v1/ops/discovery/items/${first.id}/comparison?expectedVersion=${first.version}`,
    );
    void pending.catch(() => {});
    await waitForQueryBlocked(
      observer,
      "SELECT data FROM discovery_versions WHERE item_id=$1 AND (version=$2 OR (version<$2 AND data->>'status'<>'draft')) ORDER BY version DESC LIMIT 2",
      [pid],
    );
    // This exact waiter has already acquired the source head and completed its
    // first authorization; only the retained-version read is held here.
    await observer.query(
      "UPDATE operator_sessions SET expires_at=clock_timestamp()-interval '1 second'",
    );
    await blocker.query('COMMIT');
    const response = await pending;
    expect(response.status()).toBe(401);
    const body = await response.text();
    expect(body).not.toContain(first.title);
    expect(body).not.toContain(first.body);
  } finally {
    await blocker.query('ROLLBACK');
    if (pending)
      await pending.then((response) => response.body()).catch(() => {});
    await blocker.end();
    await observer.end();
  }
});
