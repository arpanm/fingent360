import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  EventLineageInputSchema,
  EventLineageReceiptSchema,
} from '../dist/index.js';
const editorial = {
  title: 'Synthetic reviewed context',
  family: 'Policy',
  geography: ['India'],
  claimKind: 'inference',
  explanation: 'Synthetic editorial context without causal claims.',
  announcedAt: null,
  effectiveAt: null,
  citations: [
    {
      sourceId: 'synthetic-source',
      version: 1,
      hash: 'a'.repeat(64),
      field: 'title',
      quote: 'Synthetic source title',
    },
  ],
  links: [],
};
test('lineage requires exact distinct merge/split membership and rejects unknown controls', () => {
  const input = {
    kind: 'merge',
    inputs: [
      { id: randomUUID(), version: 2 },
      { id: randomUUID(), version: 3 },
    ],
    outputs: [{ id: randomUUID(), editorial }],
    reason: 'Synthetic duplicate contexts',
  };
  assert.equal(EventLineageInputSchema.safeParse(input).success, true);
  assert.equal(
    EventLineageInputSchema.safeParse({
      ...input,
      inputs: input.inputs.slice(0, 1),
    }).success,
    false,
  );
  assert.equal(
    EventLineageInputSchema.safeParse({
      ...input,
      outputs: [{ ...input.outputs[0], id: input.inputs[0].id }],
    }).success,
    false,
  );
  assert.equal(
    EventLineageInputSchema.safeParse({ ...input, autoPublish: true }).success,
    false,
  );
  assert.equal(
    EventLineageInputSchema.safeParse({
      ...input,
      kind: 'split',
      inputs: input.inputs.slice(0, 1),
      outputs: [...input.outputs, { id: randomUUID(), editorial }],
    }).success,
    true,
  );
});
test('lineage application receipts reject duplicate consumed identities and wrong cardinality', () => {
  const receipt = {
    id: randomUUID(),
    fingerprint: 'a'.repeat(64),
    reviewedAt: '2026-09-14T00:00:00.000Z',
    kind: 'merge',
    inputs: [randomUUID(), randomUUID()],
    outputs: [randomUUID()],
    reason: 'Synthetic duplicate contexts',
  };
  assert.equal(EventLineageReceiptSchema.safeParse(receipt).success, true);
  assert.equal(
    EventLineageReceiptSchema.safeParse({
      ...receipt,
      inputs: [receipt.inputs[0], receipt.inputs[0]],
    }).success,
    false,
  );
  assert.equal(
    EventLineageReceiptSchema.safeParse({ ...receipt, kind: 'split' }).success,
    false,
  );
});
test('public lineage rejects contradictory availability, duplicate/self links and impossible direction membership', async () => {
  const { EventLineagePublicSchema } = await import('../dist/index.js');
  const value = {
    eventId: randomUUID(),
    evaluatedAt: '2026-09-14T00:00:00.000Z',
    relations: [
      {
        id: randomUUID(),
        kind: 'merge',
        direction: 'replaced-by',
        reviewedAt: '2026-09-14T00:00:00.000Z',
        reason: 'Synthetic reviewed replacement',
        related: [{ id: randomUUID(), available: false, title: null }],
      },
    ],
  };
  assert.equal(EventLineagePublicSchema.safeParse(value).success, true);
  for (const patch of [
    { title: 'Hidden body title' },
    { id: value.eventId },
    { available: true },
  ]) {
    const changed = structuredClone(value);
    Object.assign(changed.relations[0].related[0], patch);
    assert.equal(EventLineagePublicSchema.safeParse(changed).success, false);
  }
  assert.equal(
    EventLineagePublicSchema.safeParse({
      ...value,
      relations: [...value.relations, ...value.relations],
    }).success,
    false,
  );
  const wrongDirection = structuredClone(value);
  wrongDirection.relations[0].direction = 'derived-from';
  assert.equal(
    EventLineagePublicSchema.safeParse(wrongDirection).success,
    false,
  );
});
test('operations envelope cannot attach another plan receipt or predate plan creation', async () => {
  const { readFile } = await import('node:fs/promises');
  const {
    EventLineageOperationsSchema,
    buildEventRevision,
    currentPublications,
  } = await import('../dist/index.js');
  const bundle = JSON.parse(
    await readFile(
      new URL(
        '../../../apps/web/src/offline/content-bundle.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  const source = currentPublications(bundle.feed, bundle.histories).find(
    (row) =>
      row.status === 'published' && row.sourceHash && row.title.length >= 8,
  );
  assert.ok(source);
  const createdAt = new Date(
    Math.max(Date.now(), Date.parse(source.source.retrievedAt)),
  ).toISOString();
  const content = {
    ...editorial,
    citations: [
      {
        sourceId: source.id,
        version: source.version,
        hash: source.sourceHash,
        field: 'title',
        quote: source.title,
      },
    ],
  };
  const originalIds = [randomUUID(), randomUUID()],
    outputId = randomUUID(),
    id = randomUUID();
  const revision = (eventId) =>
    buildEventRevision(
      eventId,
      1,
      createdAt,
      {
        requestId: id,
        expectedVersion: 0,
        revisionReason: 'Synthetic lineage binding',
        editorial: content,
      },
      [source],
      [],
      randomUUID,
    );
  const plan = {
    id,
    fingerprint: 'a'.repeat(64),
    createdAt,
    input: {
      kind: 'merge',
      inputs: originalIds.map((id) => ({ id, version: 1 })),
      outputs: [{ id: outputId, editorial: content }],
      reason: 'Synthetic lineage binding',
    },
    originals: originalIds.map((eventId) => {
      const record = revision(eventId);
      record.graph.events[0].publicationState = 'published';
      return record;
    }),
    outputs: [revision(outputId)],
  };
  const receipt = {
    id,
    fingerprint: plan.fingerprint,
    reviewedAt: createdAt,
    kind: 'merge',
    inputs: originalIds,
    outputs: [outputId],
    reason: plan.input.reason,
  };
  assert.equal(
    EventLineageOperationsSchema.safeParse({ plan, receipt }).success,
    true,
  );
  for (const patch of [
    { id: randomUUID() },
    { fingerprint: 'b'.repeat(64) },
    { reason: 'A different reason' },
    { reviewedAt: '2000-01-01T00:00:00.000Z' },
    { outputs: [randomUUID()] },
  ])
    assert.equal(
      EventLineageOperationsSchema.safeParse({
        plan,
        receipt: { ...receipt, ...patch },
      }).success,
      false,
    );
});
test('public lineage rejects predecessor and successor overlap forming a two-event cycle', async () => {
  const { EventLineagePublicSchema } = await import('../dist/index.js');
  const eventId = randomUUID(),
    other = randomUUID(),
    at = '2026-09-14T00:00:00.000Z';
  const base = {
    kind: 'merge',
    reviewedAt: at,
    reason: 'Synthetic reviewed relationship',
  };
  const related = (id) => ({ id, available: false, title: null });
  const value = {
    eventId,
    evaluatedAt: at,
    relations: [
      {
        ...base,
        id: randomUUID(),
        direction: 'derived-from',
        related: [related(other), related(randomUUID())],
      },
      {
        ...base,
        id: randomUUID(),
        direction: 'replaced-by',
        related: [related(other)],
      },
    ],
  };
  assert.equal(EventLineagePublicSchema.safeParse(value).success, false);
});
