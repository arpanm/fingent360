import { test, expect, eventFixture } from '../../helpers/event-fixture';
import { connectionDatabase } from '../../helpers/research-connection-fixture';
import { FeedItemSchema } from '../../../../packages/contracts/src/index';

test('E2E-API-1250 capture storage outage reports safe incident and retry retains exact edition @READER-DIAGNOSTICS-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const fixture = await eventFixture(request, feedbackSandbox);
  const pool = await connectionDatabase(feedbackSandbox);
  let renamed = false;
  try {
    // The fixture helper proves this is the case-owned schema, never the user's database.
    await pool.query(
      'ALTER TABLE evaluation_public_views RENAME TO evaluation_public_views_unavailable',
    );
    renamed = true;
    const response = await request.get(
      '/api/v1/discovery/items/' + fixture.source.id,
    );
    expect(response.status()).toBe(503);
    const body = await response.json();
    expect(body.code).toBe('READING_SCHEMA');
    expect(body.phase).toBe('capture');
    expect(body.incident).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.message).toBe(
      'Reading is unavailable right now. Please try again shortly.',
    );
    expect(JSON.stringify(body)).not.toMatch(
      /evaluation_public|42P01|INSERT INTO|postgres/i,
    );
    await pool.query(
      'ALTER TABLE evaluation_public_views_unavailable RENAME TO evaluation_public_views',
    );
    renamed = false;
    const recovered = await request.get(
      '/api/v1/discovery/items/' + fixture.source.id,
    );
    expect(recovered.status(), await recovered.text()).toBe(200);
    const item = FeedItemSchema.parse(await recovered.json());
    expect(item.id).toBe(fixture.source.id);
    const repeated = await request.get(
      '/api/v1/discovery/items/' + fixture.source.id,
    );
    expect(repeated.status()).toBe(200);
    expect(FeedItemSchema.parse(await repeated.json())).toEqual(item);
    const saved = await pool.query(
      'SELECT payload FROM evaluation_public_views WHERE source_id=$1',
      [item.id],
    );
    expect(saved.rows).toHaveLength(1);
    expect(saved.rows[0].payload).toEqual(item);
  } finally {
    try {
      if (renamed)
        await pool.query(
          'ALTER TABLE evaluation_public_views_unavailable RENAME TO evaluation_public_views',
        );
    } finally {
      await pool.end();
    }
  }
});
