import { randomUUID, createHash } from 'node:crypto';
import type pg from 'pg';
import { FeedItemSchema, type FeedItem } from '@fingent360/contracts';
export async function recordPublicView(c: pg.PoolClient, item: FeedItem) {
  if (item.status !== 'published') return;
  const payload = JSON.stringify(FeedItemSchema.parse(item)),
    id = createHash('sha256').update(payload).digest('hex');
  await c.query(
    'INSERT INTO evaluation_public_views(id,source_id,source_version,payload) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT DO NOTHING',
    [id, item.id, item.version, payload],
  );
}
export async function preparePublicAi(
  pool: pg.Pool,
  source: FeedItem,
  kind: 'media-caption' | 'event-extraction',
  provider: string,
  model: string,
  instructions: string,
  input: string,
) {
  const id = randomUUID();
  await pool.query(
    "INSERT INTO evaluation_public_calls(id,source_id,source_version,kind,provider,model,instructions,input,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'running')",
    [id, source.id, source.version, kind, provider, model, instructions, input],
  );
  return async (
    invoke: (raw: (output: string) => Promise<void>) => Promise<string>,
  ) => {
    try {
      const result = await invoke(async (raw) => {
        await pool.query(
          'UPDATE evaluation_public_calls SET raw_output=$2 WHERE id=$1',
          [id, raw.slice(0, 65536)],
        );
      });
      await pool.query(
        "UPDATE evaluation_public_calls SET finished_at=now(),status='succeeded',text_output=$2,outcome='provider-text-returned; consumer validation recorded in source attempt' WHERE id=$1",
        [id, result],
      );
      return result;
    } catch (error) {
      await pool
        .query(
          "UPDATE evaluation_public_calls SET finished_at=now(),status='failed',outcome='provider-or-capture-failed; no output admitted' WHERE id=$1",
          [id],
        )
        .catch(() => {});
      throw error;
    }
  };
}
export async function recordPublicAi(
  pool: pg.Pool,
  source: FeedItem,
  kind: 'media-caption' | 'event-extraction',
  provider: string,
  model: string,
  instructions: string,
  input: string,
  invoke: (raw: (output: string) => Promise<void>) => Promise<string>,
) {
  const run = await preparePublicAi(
    pool,
    source,
    kind,
    provider,
    model,
    instructions,
    input,
  );
  return run(invoke);
}

export async function recordPublicComposition(
  c: pg.PoolClient,
  item: FeedItem,
  asset: import('@fingent360/contracts').MediaAsset,
) {
  if (
    item.status !== 'published' ||
    asset.status !== 'published' ||
    asset.itemId !== item.id ||
    asset.itemVersion !== item.version
  )
    return;
  const payload = FeedItemSchema.parse(item),
    media = {
      assetId: asset.id,
      imageAttemptId: asset.image?.attemptId ?? null,
      imageHash: asset.image?.sha256 ?? null,
    };
  const id = createHash('sha256')
    .update(JSON.stringify({ item: payload, media }))
    .digest('hex');
  await c.query(
    'INSERT INTO evaluation_public_compositions(id,source_id,source_version,item,asset_id,image_attempt_id,image_hash) VALUES($1,$2,$3,$4::jsonb,$5,$6,$7) ON CONFLICT DO NOTHING',
    [
      id,
      item.id,
      item.version,
      JSON.stringify(payload),
      asset.id,
      media.imageAttemptId,
      media.imageHash,
    ],
  );
}
