import { randomUUID, createHash } from 'node:crypto';
import type pg from 'pg';
import type { MongoClient } from 'mongodb';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  BEA_FEED,
  BeaHistorySchema,
  BEA_RECOVERY_PARSER,
  BeaAttemptSchema,
  BeaAttemptPageSchema,
  BeaAttemptEventSchema,
  BeaRetainedSchema,
  BeaValidationSchema,
  BeaStageInputSchema,
  BeaStageSchema,
  BeaRevalidateInputSchema,
  FeedItemSchema,
  enrichResearchItem,
  type FeedItem,
} from '@fingent360/contracts';
import { parseBeaRss } from './bea-provider.js';
import { sourceHash } from './discovery-provider.js';
const digest = (v: unknown) =>
  createHash('sha256').update(JSON.stringify(v)).digest('hex');
const uuid = (v: string) => {
  if (
    typeof v !== 'string' ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v)
  )
    throw new BadRequestException('Invalid attempt identifier.');
  return v.toLowerCase();
};
export async function beaEvent(
  c: pg.PoolClient,
  attemptId: string,
  kind: 'started' | 'retained' | 'parsed' | 'staged' | 'failed',
  message: string,
  raw?: { hash: string; body: string; retrievedAt: string },
) {
  const event = BeaAttemptEventSchema.parse({
    id: randomUUID(),
    attemptId,
    at: new Date().toISOString(),
    kind,
    message,
    hash: raw?.hash ?? null,
    bytes: raw ? Buffer.byteLength(raw.body) : null,
    retrievedAt: raw?.retrievedAt ?? null,
  });
  await c.query(
    'INSERT INTO bea_ingestion_events(id,attempt_id,at,payload) VALUES($1,$2,$3,$4)',
    [event.id, attemptId, event.at, event],
  );
}
export async function beginBeaAttempt(c: pg.PoolClient, run: string) {
  const id = randomUUID();
  await c.query(
    'INSERT INTO bea_ingestion_attempts(id,source_run_id) VALUES($1,$2)',
    [id, run],
  );
  await beaEvent(c, id, 'started', 'Fixed BEA RSS attempt started.');
  return id;
}
export async function beaAttempt(c: pg.PoolClient, id: string) {
  id = uuid(id);
  const found = await c.query(
    'SELECT * FROM bea_ingestion_attempts WHERE id=$1',
    [id],
  );
  if (!found.rows[0])
    throw new NotFoundException(
      'No linked BEA attempt. Legacy raw evidence is not recoverable here.',
    );
  const events = await c.query(
    'SELECT payload FROM bea_ingestion_events WHERE attempt_id=$1 ORDER BY sequence',
    [id],
  );
  return BeaAttemptSchema.parse({
    id,
    sourceRunId: found.rows[0].source_run_id,
    startedAt: found.rows[0].started_at.toISOString(),
    events: events.rows.map((r) => r.payload),
  });
}
export async function beaAttempts(c: pg.PoolClient, after?: string) {
  if (after) after = uuid(after);
  const rows = await c.query(
    'SELECT id FROM bea_ingestion_attempts WHERE ($1::uuid IS NULL OR id>$1) ORDER BY id LIMIT 31',
    [after ?? null],
  );
  const ids = rows.rows.slice(0, 30);
  return BeaAttemptPageSchema.parse({
    attempts: await Promise.all(ids.map((r) => beaAttempt(c, r.id))),
    next: rows.rows.length > 30 ? ids[29].id : null,
    legacy: 'Legacy unlinked evidence cannot be revalidated.',
  });
}
export async function beaRetained(
  c: pg.PoolClient,
  mongo: MongoClient,
  id: string,
) {
  const attempt = await beaAttempt(c, id),
    link = attempt.events.find((e) => e.kind === 'retained');
  if (!link?.hash)
    throw new ConflictException(
      'No complete verified retained response is linked to this attempt.',
    );
  const raw = await mongo
    .db()
    .collection<{
      _id: string;
      url: string;
      body: string;
      retrievedAt: string;
    }>('discovery_raw')
    .findOne({ _id: link.hash }, { timeoutMS: 3000, maxTimeMS: 2500 });
  if (
    !raw ||
    raw.url !== BEA_FEED ||
    typeof raw.body !== 'string' ||
    Buffer.byteLength(raw.body) !== link.bytes ||
    sourceHash(BEA_FEED, raw.body) !== link.hash
  )
    throw new ServiceUnavailableException(
      'Linked retained response is missing or inconsistent. No candidates were accepted.',
    );
  return BeaRetainedSchema.parse({
    attemptId: id,
    hash: link.hash,
    bytes: link.bytes,
    retrievedAt: link.retrievedAt,
    body: raw.body,
  });
}
export async function revalidateBea(
  c: pg.PoolClient,
  mongo: MongoClient,
  id: string,
  body: unknown,
  authorize: () => Promise<unknown>,
) {
  id = uuid(id);
  const input = BeaRevalidateInputSchema.safeParse(body);
  if (!input.success)
    throw new BadRequestException('Provide one revalidation request ID.');
  await c.query('SELECT id FROM bea_staging_gate WHERE id=1 FOR UPDATE');
  await authorize();
  const old = await c.query(
    'SELECT attempt_id,payload FROM bea_revalidations WHERE id=$1',
    [input.data.requestId],
  );
  if (old.rows[0]) {
    if (old.rows[0].attempt_id !== id)
      throw new ConflictException('Request ID belongs to another attempt.');
    return BeaValidationSchema.parse(old.rows[0].payload);
  }
  const raw = await beaRetained(c, mongo, id);
  let items: FeedItem[] = [],
    accepted = true;
  try {
    items = parseBeaRss(raw.body, raw.retrievedAt).map(enrichResearchItem);
  } catch {
    accepted = false;
  }
  await c.query(
    'SELECT id FROM discovery_items WHERE id=ANY($1::text[]) ORDER BY id FOR SHARE',
    [items.map((i) => i.id)],
  );
  await authorize();
  const heads = await c.query(
    'SELECT v.data FROM discovery_items i JOIN discovery_versions v ON v.item_id=i.id AND v.version=i.version WHERE i.id=ANY($1::text[])',
    [items.map((i) => i.id)],
  );
  const candidates = items.map((item) => ({
    item,
    baseline:
      heads.rows
        .map((r) => FeedItemSchema.parse(r.data))
        .find((v) => v.id === item.id) ?? null,
  }));
  const value = BeaValidationSchema.parse({
    requestId: input.data.requestId,
    attemptId: id,
    parser: BEA_RECOVERY_PARSER,
    outcome: accepted ? 'accepted' : 'rejected',
    message: accepted
      ? 'Retained response passed the current bounded parser.'
      : 'Retained response rejected by the bounded parser; original evidence unchanged.',
    hash: raw.hash,
    validatedAt: new Date().toISOString(),
    candidates,
    fingerprint: digest(candidates),
  });
  await c.query(
    'INSERT INTO bea_revalidations(id,attempt_id,payload) VALUES($1,$2,$3)',
    [value.requestId, id, value],
  );
  return value;
}
export async function stageBea(
  c: pg.PoolClient,
  body: unknown,
  authorize: () => Promise<unknown>,
  promote: (c: pg.PoolClient, item: FeedItem) => Promise<number>,
) {
  const parsed = BeaStageInputSchema.safeParse(body);
  if (!parsed.success)
    throw new BadRequestException(
      'Provide the exact reviewed validation and fingerprint.',
    );
  const input = parsed.data,
    deadline = Date.now() + 10000;
  await c.query('SELECT id FROM bea_staging_gate WHERE id=1 FOR UPDATE');
  await authorize();
  const old = await c.query(
    'SELECT input,payload FROM bea_staging_receipts WHERE id=$1 OR validation_id=$2',
    [input.requestId, input.validationId],
  );
  if (old.rows[0]) {
    if (
      JSON.stringify(BeaStageInputSchema.parse(old.rows[0].input)) !==
      JSON.stringify(input)
    )
      throw new ConflictException(
        'This validation or request already has a staging receipt.',
      );
    return BeaStageSchema.parse(old.rows[0].payload);
  }
  const row = await c.query(
    'SELECT payload FROM bea_revalidations WHERE id=$1',
    [input.validationId],
  );
  if (!row.rows[0]) throw new NotFoundException('Validation not found.');
  const v = BeaValidationSchema.parse(row.rows[0].payload);
  if (v.outcome !== 'accepted')
    throw new ConflictException('Rejected validation cannot stage drafts.');
  if (
    v.fingerprint !== input.fingerprint ||
    digest(v.candidates) !== v.fingerprint
  )
    throw new ConflictException('Validation fingerprint changed. Revalidate.');
  await c.query(
    'SELECT id FROM discovery_items WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE',
    [v.candidates.map((x) => x.item.id)],
  );
  await authorize();
  const output = [];
  for (const candidate of [...v.candidates].sort((a, b) =>
    a.item.id.localeCompare(b.item.id),
  )) {
    if (Date.now() > deadline)
      throw new ServiceUnavailableException(
        'Draft staging deadline exceeded; transaction rolled back.',
      );
    const head = await c.query(
      'SELECT version FROM discovery_items WHERE id=$1',
      [candidate.item.id],
    );
    if (
      (head.rows[0]?.version ?? null) !== (candidate.baseline?.version ?? null)
    )
      throw new ConflictException(
        'A source head changed. Revalidate and review again.',
      );
    const changed = await promote(c, candidate.item);
    const result = await c.query(
      'SELECT version FROM discovery_items WHERE id=$1',
      [candidate.item.id],
    );
    output.push({
      id: candidate.item.id,
      version: result.rows[0].version,
      changed: changed === 1,
    });
  }
  await authorize();
  const receipt = BeaStageSchema.parse({
    requestId: input.requestId,
    validationId: input.validationId,
    stagedAt: new Date().toISOString(),
    items: output,
  });
  await c.query(
    'INSERT INTO bea_staging_receipts(id,validation_id,input,payload) VALUES($1,$2,$3,$4)',
    [input.requestId, input.validationId, input, receipt],
  );
  return receipt;
}

export async function beaHistory(c: pg.PoolClient, id: string, after?: string) {
  await beaAttempt(c, id);
  if (after) after = uuid(after);
  const r = await c.query(
    "SELECT v.id,v.payload->>'validatedAt' AS at,v.payload->>'outcome' AS outcome,s.payload AS staged FROM bea_revalidations v LEFT JOIN bea_staging_receipts s ON s.validation_id=v.id WHERE v.attempt_id=$1 AND ($2::uuid IS NULL OR v.id>$2) ORDER BY v.id LIMIT 31",
    [id, after ?? null],
  );
  return BeaHistorySchema.parse({
    entries: r.rows.slice(0, 30),
    next: r.rows.length > 30 ? r.rows[29].id : null,
  });
}
export async function beaValidation(c: pg.PoolClient, id: string) {
  uuid(id);
  const r = await c.query('SELECT payload FROM bea_revalidations WHERE id=$1', [
    id,
  ]);
  if (!r.rows[0]) throw new NotFoundException('Validation not found.');
  return BeaValidationSchema.parse(r.rows[0].payload);
}
