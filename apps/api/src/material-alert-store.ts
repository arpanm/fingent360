import type pg from 'pg';
import {
  MacroIndicatorSchema,
  MacroObservationSchema,
  MaterialExportSchema,
  MaterialHistoryQuerySchema,
  MaterialReceiptSchema,
  MaterialStateSchema,
  MaterialSourceSchema,
  emptyMaterial,
  syncMaterialContext,
  type MaterialReceipt,
  type MacroIndicator,
} from '@fingent360/contracts';
import { BadRequestException } from '@nestjs/common';
import { normalizeDecimal } from './world-bank.js';

export async function materialSources(client: pg.PoolClient) {
  const result = await client.query(
    `
    SELECT keys.indicator, o.*, s.last_success_at
    FROM unnest($1::text[]) AS keys(indicator)
    LEFT JOIN LATERAL (
      SELECT id,year,value::text,revision,provider_updated_at::text,retrieved_at,source_hash,source_url,supersedes_id
      FROM macro_observations WHERE indicator=keys.indicator ORDER BY year DESC,revision DESC LIMIT 1
    ) o ON true
    LEFT JOIN LATERAL (SELECT max(finished_at) AS last_success_at FROM macro_runs WHERE indicator=keys.indicator AND status='succeeded') s ON true
    ORDER BY keys.indicator`,
    [MacroIndicatorSchema.options],
  );
  return result.rows.map((row) =>
    MaterialSourceSchema.parse({
      indicator: row.indicator,
      latest: row.id
        ? MacroObservationSchema.parse({
            id: row.id,
            indicator: row.indicator,
            year: row.year,
            value: row.value === null ? null : normalizeDecimal(row.value),
            revision: row.revision,
            unit: 'annual_percent',
            country: 'IND',
            providerUpdatedAt: row.provider_updated_at,
            retrievedAt: row.retrieved_at.toISOString(),
            sourceHash: row.source_hash,
            sourceUrl: row.source_url,
            supersedesId: row.supersedes_id,
          })
        : null,
      lastSuccessAt: row.last_success_at?.toISOString() ?? null,
    }),
  );
}
export async function readMaterial(client: pg.PoolClient, id: string) {
  const result = await client.query(
    'SELECT payload FROM material_alert_heads WHERE user_id=$1',
    [id],
  );
  return result.rows[0]
    ? MaterialStateSchema.parse(result.rows[0].payload)
    : emptyMaterial();
}
export async function materialContext(
  client: pg.PoolClient,
  id: string,
): Promise<{ followed: MacroIndicator[]; muted: MacroIndicator[] }> {
  const result = await client.query(
    'SELECT w.indicators,ARRAY(SELECT p.indicator FROM app_alert_preferences p WHERE p.user_id=w.user_id AND p.muted ORDER BY p.indicator) AS muted FROM app_watchlists w WHERE w.user_id=$1',
    [id],
  );
  return {
    followed: (result.rows[0]?.indicators ?? []).map((v: unknown) =>
      MacroIndicatorSchema.parse(v),
    ),
    muted: (result.rows[0]?.muted ?? []).map((v: unknown) =>
      MacroIndicatorSchema.parse(v),
    ),
  };
}
export async function saveMaterial(
  client: pg.PoolClient,
  id: string,
  receipt: MaterialReceipt,
  request: unknown = null,
) {
  await client.query(
    'INSERT INTO material_alert_heads(user_id,payload,automatic_due_at) VALUES($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET payload=excluded.payload,automatic_due_at=excluded.automatic_due_at,automatic_retry_at=NULL',
    [id, receipt.state, receipt.state.automatic.nextCheckAt],
  );
  await client.query(
    'INSERT INTO material_alert_events(user_id,request_id,request,payload) VALUES($1,$2,$3,$4)',
    [id, receipt.requestId, request, receipt],
  );
}
/** Caller holds account FOR UPDATE. Legacy mute/watchlist mutations share this transaction. */
export async function syncMaterialAccount(client: pg.PoolClient, id: string) {
  const previous = await readMaterial(client, id);
  // Accounts without an explicit material rule keep the original lightweight flow.
  if (previous.version === 0) return;
  const context = await materialContext(client, id);
  const sources = await materialSources(client),
    at = new Date().toISOString();
  const next = syncMaterialContext(
    previous,
    context.followed,
    context.muted,
    sources,
    at,
  );
  if (next.version !== previous.version)
    await saveMaterial(
      client,
      id,
      MaterialReceiptSchema.parse({
        requestId: null,
        action: 'context',
        at,
        state: next,
        sources,
        outcomes: [],
      }),
    );
}
export async function exportMaterial(
  client: pg.PoolClient,
  id: string,
  query: unknown = {},
) {
  const parsed = MaterialHistoryQuerySchema.safeParse(query);
  if (!parsed.success)
    throw new BadRequestException('Invalid material history page.');
  const q = parsed.data;
  if (
    (q.after && !q.upper) ||
    (q.after && q.upper && BigInt(q.after) > BigInt(q.upper))
  )
    throw new BadRequestException('Invalid material history boundary.');
  const upper =
    q.upper ??
    (
      await client.query(
        'SELECT coalesce(max(sequence),0)::text AS upper FROM material_alert_events WHERE user_id=$1',
        [id],
      )
    ).rows[0].upper;
  const rows = (
    await client.query(
      'SELECT sequence::text,payload FROM material_alert_events WHERE user_id=$1 AND sequence>$2::bigint AND sequence<=$3::bigint ORDER BY material_alert_events.sequence LIMIT 101',
      [id, q.after ?? '0', upper],
    )
  ).rows;
  return MaterialExportSchema.parse({
    ownerId: id,
    upper,
    events: rows
      .slice(0, 100)
      .map((row) => ({ sequence: row.sequence, receipt: row.payload })),
    next: rows.length > 100 ? rows[99].sequence : null,
  });
}
