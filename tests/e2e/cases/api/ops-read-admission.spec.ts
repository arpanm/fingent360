import { test, expect } from '../../helpers/app-fixture';
import {
  DiscoveryOperationsSchema,
  ResearchRunsSchema,
  SourceListSchema,
  FeedSchema,
} from '../../../../packages/contracts/src/index';
import { randomUUID } from 'node:crypto';
import { ingestBea, beaOperator, reviewBea } from '../../helpers/bea-fixture';
import {
  connectionDatabase,
  prepareConnectionAccount,
} from '../../helpers/research-connection-fixture';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
const queries: Record<string, string> = {
  discovery_items:
    'SELECT v.data FROM discovery_items i JOIN discovery_versions v ON v.item_id=i.id AND v.version=i.version ORDER BY v.created_at DESC,i.id',
  discovery_source_runs:
    'SELECT * FROM discovery_source_runs ORDER BY started_at DESC,id DESC LIMIT 100',
  research_sources:
    'SELECT r.* FROM research_sources s JOIN research_source_revisions r ON r.source_id=s.id AND r.revision=s.revision  ORDER BY r.recorded_at DESC,s.id',
  research_source_revisions:
    'SELECT * FROM research_source_revisions WHERE source_id=$1 ORDER BY revision DESC',
};
function stableFeed(value: unknown) {
  const { evaluatedAt, ...stable } = FeedSchema.parse(value);
  expect(evaluatedAt).toEqual(expect.any(String));
  return stable;
}
const source = {
  name: 'Synthetic protected registry record',
  category: 'Synthetic',
  sourceUrl: 'https://example.com/source',
  termsUrl: 'https://example.com/terms',
  rightsStatus: 'unreviewed',
  constraints: 'Synthetic test only',
  reviewEvidence: '',
  reviewedAt: null,
  published: false,
};
for (const [index, table, path] of [
  [0, 'discovery_items', '/api/v1/ops/discovery/items'],
  [1, 'discovery_source_runs', '/api/v1/ops/discovery/runs'],
  [2, 'research_sources', '/api/v1/ops/sources'],
  [3, 'research_source_revisions', 'history'],
] as const) {
  test(`E2E-API-${520 + index} protected ${table} final admission after actual storage wait @OPS-READ-ADMISSION-001 @TEST-SIMULATION`, async ({
    request,
    feedbackSandbox,
  }) => {
    await ingestBea(feedbackSandbox);
    const blocker = await connectionDatabase(feedbackSandbox),
      observer = await connectionDatabase(feedbackSandbox),
      id = randomUUID();
    let pending: ReturnType<typeof request.get> | undefined;
    try {
      await observer.query(
        'INSERT INTO research_sources(id,revision) VALUES($1,1)',
        [id],
      );
      await observer.query(
        'INSERT INTO research_source_revisions(source_id,revision,data) VALUES($1,1,$2)',
        [id, source],
      );
      const url =
        path === 'history' ? `/api/v1/ops/sources/${id}/history` : path;
      await beaOperator(request);
      let preserved: unknown = null;
      if (index === 0) {
        await prepareConnectionAccount(request);
        const head = DiscoveryOperationsSchema.parse(
          await (await request.get('/api/v1/ops/discovery/items')).json(),
        ).items[0]!;
        await reviewBea(request, head, 'published');
        preserved = {
          goals: await (await request.get('/api/v1/account/goals')).json(),
          feed: stableFeed(
            await (await request.get('/api/v1/discovery/feed')).json(),
          ),
        };
      }
      const before = await request.get(url);
      expect(before.status()).toBe(200);
      const expected = await before.json();
      if (table === 'discovery_items')
        expect(
          DiscoveryOperationsSchema.parse(expected).items.length,
        ).toBeGreaterThan(0);
      else if (table === 'discovery_source_runs')
        expect(ResearchRunsSchema.parse(expected).runs.length).toBeGreaterThan(
          0,
        );
      else expect(SourceListSchema.parse(expected).length).toBeGreaterThan(0);
      for (const mode of ['expiry', 'revocation']) {
        await beaOperator(request);
        await blocker.query('BEGIN');
        const pid = Number(
          (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid,
        );
        await blocker.query(`LOCK TABLE ${table} IN ACCESS EXCLUSIVE MODE`);
        pending = request.get(url);
        void pending.catch(() => {});
        await expect
          .poll(
            async () => {
              await observer.query('SELECT pg_stat_clear_snapshot()');
              const found = await observer.query(
                "SELECT count(*)::int AS n FROM pg_stat_activity WHERE wait_event_type='Lock' AND $1=ANY(pg_blocking_pids(pid)) AND query=$2",
                [pid, queries[table]],
              );
              return found.rows[0].n;
            },
            { timeout: 2500 },
          )
          .toBeGreaterThan(0);
        if (mode === 'expiry')
          await observer.query(
            "UPDATE operator_sessions SET expires_at=clock_timestamp()-interval '1 second'",
          );
        else await observer.query('DELETE FROM operator_sessions');
        await blocker.query('COMMIT');
        const denied = await pending;
        expect(denied.status()).toBe(401);
        expect(await denied.text()).not.toContain(source.name);
        await beaOperator(request);
        const fresh = await request.get(url);
        expect(fresh.status()).toBe(200);
        expect(await fresh.json()).toEqual(expected);
      }
      if (index === 0)
        expect({
          goals: await (await request.get('/api/v1/account/goals')).json(),
          feed: stableFeed(
            await (await request.get('/api/v1/discovery/feed')).json(),
          ),
        }).toEqual(preserved);
      expect(
        (
          await observer.query(
            'SELECT data FROM research_source_revisions WHERE source_id=$1',
            [id],
          )
        ).rows[0].data,
      ).toEqual(source);
    } finally {
      await blocker.query('ROLLBACK');
      if (pending) await pending.then((r) => r.body()).catch(() => {});
      await blocker.end();
      await observer.end();
    }
  });
}
