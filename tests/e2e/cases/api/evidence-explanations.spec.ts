import { test, expect } from '../../helpers/app-fixture';
import {
  seedConnectionSource,
  reviseConnectionSourceFixture,
  connectionDatabase,
} from '../../helpers/research-connection-fixture';
import { waitForQueryBlocked } from '../../helpers/withdrawal-fixture';
import {
  EvidenceExplanationSchema,
  FeedItemSchema,
} from '../../../../packages/contracts/src/index';
const path = (id: string, version: number) =>
  `/api/v1/discovery/items/${id}/explanation?expectedVersion=${version}`;

test('E2E-API-620 genuine dated edition excerpts preserve exact source provenance and unsupported analysis @EVIDENCE-LAYERS-001', async ({
  request,
  feedbackSandbox,
}) => {
  const source = await seedConnectionSource(feedbackSandbox);
  const response = await request.get(path(source.id, source.version));
  expect(response.status()).toBe(200);
  const value = EvidenceExplanationSchema.parse(await response.json());
  expect(value.edition).toEqual(source);
  expect(value.bundleGeneratedAt).toBeNull();
  expect(value.analysis).toEqual({
    independentVerification: 'unavailable',
    expectations: 'unavailable',
    scenarios: 'unavailable',
    causalInference: 'unavailable',
    quantifiedPortfolioImpact: 'unavailable',
  });
  for (const excerpt of value.excerpts)
    expect(excerpt.text).toBe(
      source[excerpt.field].slice(excerpt.start, excerpt.end),
    );
  expect(value.previous).toBeNull();
  expect(value.conflictAssessment).toBe('not-assessed');
  const pool = await connectionDatabase(feedbackSandbox);
  try {
    expect(
      (
        await pool.query(
          'SELECT data FROM discovery_versions WHERE item_id=$1 AND version=$2',
          [source.id, source.version],
        )
      ).rows[0].data,
    ).toEqual(source);
  } finally {
    await pool.end();
  }
});

test('E2E-API-621 strict edition query handles current revisions drafts withdrawal and republication without old text @EVIDENCE-LAYERS-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const source = await seedConnectionSource(feedbackSandbox);
  for (const suffix of [
    '',
    '?expectedVersion=0',
    '?expectedVersion=01',
    '?expectedVersion=2&extra=true',
    '?expectedVersion=2&expectedVersion=3',
  ])
    expect(
      (
        await request.get(
          `/api/v1/discovery/items/${source.id}/explanation${suffix}`,
        )
      ).status(),
    ).toBe(400);
  const draft = await reviseConnectionSourceFixture(
    feedbackSandbox,
    source,
    'draft',
  );
  expect((await request.get(path(source.id, source.version))).status()).toBe(
    200,
  );
  const revised = await reviseConnectionSourceFixture(
    feedbackSandbox,
    draft,
    'published',
  );
  const conflict = await request.get(path(source.id, source.version));
  expect(conflict.status()).toBe(409);
  expect(await conflict.text()).not.toContain(source.title);
  const current = EvidenceExplanationSchema.parse(
    await (await request.get(path(source.id, revised.version))).json(),
  );
  expect(current.previous?.version).toBe(source.version);
  const withdrawal = await reviseConnectionSourceFixture(
    feedbackSandbox,
    revised,
    'withdrawn',
  );
  const denied = await request.get(path(source.id, revised.version));
  expect(denied.status()).toBe(404);
  expect(await denied.text()).not.toContain(source.title);
  const restored = await reviseConnectionSourceFixture(
    feedbackSandbox,
    withdrawal,
    'published',
  );
  const value = EvidenceExplanationSchema.parse(
    await (await request.get(path(source.id, restored.version))).json(),
  );
  expect(value.previous?.status).toBe('withdrawn');
  expect(value.previous?.changedFields).toEqual([]);
  expect(Object.keys(value.previous!)).not.toContain('body');
});

test('E2E-API-622 explanation queued behind source withdrawal admits the new status and reveals no old text @EVIDENCE-LAYERS-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const source = await seedConnectionSource(feedbackSandbox);
  const pool = await connectionDatabase(feedbackSandbox);
  let pending: ReturnType<typeof request.get> | undefined;
  try {
    await pool.query('BEGIN');
    const pid = Number(
      (await pool.query('SELECT pg_backend_pid() AS pid')).rows[0].pid,
    );
    await pool.query('SELECT id FROM discovery_items WHERE id=$1 FOR UPDATE', [
      source.id,
    ]);
    pending = request.get(path(source.id, source.version));
    await waitForQueryBlocked(
      pool,
      'SELECT id FROM discovery_items WHERE id=ANY($1::text[]) ORDER BY id FOR SHARE',
      [pid],
    );
    const withdrawn = FeedItemSchema.parse({
      ...source,
      version: source.version + 1,
      status: 'withdrawn',
      correctionNote: 'Synthetic withdrawal race.',
    });
    await pool.query(
      'INSERT INTO discovery_versions(item_id,version,data) VALUES($1,$2,$3)',
      [source.id, withdrawn.version, withdrawn],
    );
    await pool.query('UPDATE discovery_items SET version=$2 WHERE id=$1', [
      source.id,
      withdrawn.version,
    ]);
    await pool.query('COMMIT');
    const response = await pending;
    expect(response.status()).toBe(404);
    expect(await response.text()).not.toContain(source.title);
    expect(
      (
        await pool.query(
          'SELECT data FROM discovery_versions WHERE item_id=$1 AND version=$2',
          [source.id, source.version],
        )
      ).rows[0].data,
    ).toEqual(source);
  } finally {
    await pool.query('ROLLBACK');
    await pending?.catch(() => {});
    await pool.end();
  }
});

test('E2E-API-623 actual unavailable source storage gives retryable failure without changing editions @EVIDENCE-LAYERS-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const source = await seedConnectionSource(feedbackSandbox);
  const pool = await connectionDatabase(feedbackSandbox);
  let pending: ReturnType<typeof request.get> | undefined;
  try {
    await pool.query('BEGIN');
    const pid = Number(
      (await pool.query('SELECT pg_backend_pid() AS pid')).rows[0].pid,
    );
    await pool.query('LOCK TABLE discovery_items IN ACCESS EXCLUSIVE MODE');
    pending = request.get(path(source.id, source.version));
    await waitForQueryBlocked(
      pool,
      'SELECT id FROM discovery_items WHERE id=ANY($1::text[]) ORDER BY id FOR SHARE',
      [pid],
    );
    expect((await pending).status()).toBe(503);
  } finally {
    await pool.query('ROLLBACK');
    await pending?.catch(() => {});
    await pool.end();
  }
  const value = EvidenceExplanationSchema.parse(
    await (await request.get(path(source.id, source.version))).json(),
  );
  expect(value.edition).toEqual(source);
});
