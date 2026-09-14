import { randomUUID } from 'node:crypto';
import {
  test,
  expect,
  eventHeaders as headers,
} from '../../helpers/event-fixture';
import { prepareLineage, saveLineage } from '../../helpers/event-lineage';
import {
  connectionDatabase,
  reviseConnectionSourceFixture,
} from '../../helpers/research-connection-fixture';
import {
  EventLineagePublicSchema,
  EventLineageReceiptSchema,
  EventPublicSchema,
} from '../../../../packages/contracts/src/index';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-API-830 immutable merge plan applies once with originals and reviewed replacement navigation @EVENT-LINEAGE-001', async ({
  request,
  feedbackSandbox,
}) => {
  const fixture = await prepareLineage(request, feedbackSandbox),
    plan = await saveLineage(request, fixture.input);
  const before = await (
    await request.get('/api/v1/events/' + fixture.input.inputs[0]!.id)
  ).json();
  expect(
    (
      await request.get('/api/v1/events/' + fixture.input.outputs[0]!.id)
    ).status(),
  ).toBe(404);
  expect(await saveLineage(request, fixture.input, plan.id)).toEqual(plan);
  const path = '/api/v1/ops/event-lineage/' + plan.id + '/approve';
  const applied = await request.post(path, {
    headers,
    data: { fingerprint: plan.fingerprint },
  });
  expect(applied.status()).toBe(201);
  const receipt = EventLineageReceiptSchema.parse(await applied.json());
  expect(
    await (
      await request.post(path, {
        headers,
        data: { fingerprint: plan.fingerprint },
      })
    ).json(),
  ).toEqual(receipt);
  const output = EventPublicSchema.parse(
    await (await request.get('/api/v1/events/' + receipt.outputs[0])).json(),
  );
  expect(output.event?.editorial.title).toBe('Synthetic merged context');
  const original = EventPublicSchema.parse(
    await (await request.get('/api/v1/events/' + receipt.inputs[0])).json(),
  );
  expect(original.event).toEqual(before.event);
  const relations = EventLineagePublicSchema.parse(
    await (
      await request.get('/api/v1/events/' + receipt.inputs[0] + '/lineage')
    ).json(),
  );
  expect(relations.relations[0]?.direction).toBe('replaced-by');
  expect(relations.relations[0]?.related[0]?.available).toBe(true);
  expect(
    (
      await request.put('/api/v1/ops/events/' + receipt.inputs[0], {
        headers,
        data: {
          requestId: randomUUID(),
          expectedVersion: 2,
          revisionReason: 'Must not edit superseded input',
          editorial: fixture.input.outputs[0]!.editorial,
        },
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await request.post(
        '/api/v1/ops/events/' + receipt.inputs[0] + '/review',
        {
          headers,
          data: {
            requestId: randomUUID(),
            expectedVersion: 2,
            status: 'published',
            note: 'Cannot reactivate original',
          },
        },
      )
    ).status(),
  ).toBe(409);
  await reviseConnectionSourceFixture(
    feedbackSandbox,
    fixture.source,
    'withdrawn',
  );
  const hidden = EventLineagePublicSchema.parse(
    await (
      await request.get('/api/v1/events/' + receipt.inputs[0] + '/lineage')
    ).json(),
  );
  expect(hidden.relations[0]?.related[0]).toEqual({
    id: receipt.outputs[0],
    available: false,
    title: null,
  });
});
test('E2E-API-831 competing plans cannot consume one original twice and split output failure rolls back atomically @EVENT-LINEAGE-001', async ({
  request,
  feedbackSandbox,
}) => {
  const fixture = await prepareLineage(request, feedbackSandbox);
  const split = {
    ...fixture.input,
    kind: 'split',
    inputs: [fixture.input.inputs[0]],
    outputs: [0, 1].map((index) => ({
      id: randomUUID(),
      editorial: {
        ...fixture.input.outputs[0]!.editorial,
        title: 'Synthetic split ' + index,
      },
    })),
  };
  const plan = await saveLineage(request, split),
    competing = await saveLineage(request, fixture.input);
  const pool = await connectionDatabase(feedbackSandbox);
  try {
    await pool.query(
      `CREATE FUNCTION fail_lineage_output() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id='${split.outputs[1]!.id}'::uuid THEN RAISE EXCEPTION 'Synthetic output failure'; END IF; RETURN NEW; END $$`,
    );
    await pool.query(
      'CREATE TRIGGER fail_lineage_output BEFORE INSERT ON reviewed_events FOR EACH ROW EXECUTE FUNCTION fail_lineage_output()',
    );
    expect(
      (
        await request.post(
          '/api/v1/ops/event-lineage/' + plan.id + '/approve',
          { headers, data: { fingerprint: plan.fingerprint } },
        )
      ).status(),
    ).toBeGreaterThanOrEqual(500);
    expect(
      (
        await pool.query(
          'SELECT count(*)::int AS n FROM reviewed_events WHERE id=ANY($1::uuid[])',
          [split.outputs.map((item) => item.id)],
        )
      ).rows[0].n,
    ).toBe(0);
    expect(
      (
        await pool.query(
          'SELECT count(*)::int AS n FROM event_lineage_receipts',
        )
      ).rows[0].n,
    ).toBe(0);
    await pool.query('DROP TRIGGER fail_lineage_output ON reviewed_events');
    const results = await Promise.all(
      [plan, competing].map((item) =>
        request.post('/api/v1/ops/event-lineage/' + item.id + '/approve', {
          headers,
          data: { fingerprint: item.fingerprint },
        }),
      ),
    );
    expect(results.map((result) => result.status()).sort()).toEqual([201, 409]);
    expect(
      (
        await pool.query(
          'SELECT count(*)::int AS n FROM event_lineage_receipts',
        )
      ).rows[0].n,
    ).toBe(1);
  } finally {
    await pool.end();
  }
});
test('E2E-API-832 source withdrawal before approval refuses all outputs without mutating original history @EVENT-LINEAGE-001', async ({
  request,
  feedbackSandbox,
}) => {
  const fixture = await prepareLineage(request, feedbackSandbox),
    plan = await saveLineage(request, fixture.input);
  await reviseConnectionSourceFixture(
    feedbackSandbox,
    fixture.source,
    'withdrawn',
  );
  expect(
    (
      await request.post('/api/v1/ops/event-lineage/' + plan.id + '/approve', {
        headers,
        data: { fingerprint: plan.fingerprint },
      })
    ).status(),
  ).toBe(409);
  const pool = await connectionDatabase(feedbackSandbox);
  try {
    expect(
      (await pool.query('SELECT count(*)::int AS n FROM reviewed_events'))
        .rows[0].n,
    ).toBe(2);
    expect(
      (
        await pool.query(
          'SELECT count(*)::int AS n FROM reviewed_event_versions',
        )
      ).rows[0].n,
    ).toBe(4);
  } finally {
    await pool.end();
  }
});
test('E2E-API-834 reviewed split publishes every output and allows a later replacement chain without rewriting originals @EVENT-LINEAGE-001', async ({
  request,
  feedbackSandbox,
}) => {
  const fixture = await prepareLineage(request, feedbackSandbox);
  const split = {
    ...fixture.input,
    kind: 'split',
    inputs: [fixture.input.inputs[0]],
    outputs: [0, 1].map((index) => ({
      id: randomUUID(),
      editorial: {
        ...fixture.input.outputs[0]!.editorial,
        title: 'Synthetic separate context ' + index,
      },
    })),
  };
  const plan = await saveLineage(request, split);
  const response = await request.post(
    '/api/v1/ops/event-lineage/' + plan.id + '/approve',
    { headers, data: { fingerprint: plan.fingerprint } },
  );
  expect(response.status()).toBe(201);
  const receipt = EventLineageReceiptSchema.parse(await response.json());
  for (const id of receipt.outputs)
    expect(
      EventPublicSchema.parse(
        await (await request.get('/api/v1/events/' + id)).json(),
      ).status,
    ).toBe('published');
  const next = await saveLineage(request, {
    ...fixture.input,
    inputs: receipt.outputs.map((id) => ({ id, version: 1 })),
    outputs: [{ ...fixture.input.outputs[0], id: randomUUID() }],
    reason: 'Synthetic later reviewed restructuring keeps all prior revisions.',
  });
  expect(
    (
      await request.post('/api/v1/ops/event-lineage/' + next.id + '/approve', {
        headers,
        data: { fingerprint: next.fingerprint },
      })
    ).status(),
  ).toBe(201);
  const middle = EventLineagePublicSchema.parse(
    await (
      await request.get('/api/v1/events/' + receipt.outputs[0] + '/lineage')
    ).json(),
  );
  expect(middle.relations.map((row) => row.direction).sort()).toEqual([
    'derived-from',
    'replaced-by',
  ]);
  expect(
    await (
      await request.post('/api/v1/ops/event-lineage/' + plan.id + '/approve', {
        headers,
        data: { fingerprint: plan.fingerprint },
      })
    ).json(),
  ).toEqual(receipt);
});
