import type pg from 'pg';
import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  ConsentStateSchema,
  ConsentReceiptSchema,
  ConsentExportSchema,
  ConsentHistoryQuerySchema,
  ConsentListSchema,
  consentActive,
  consentPurposes,
  consentStatus,
  emptyConsent,
  type ConsentPurpose,
  type ConsentState,
  type ConsentReceipt,
  type ConsentBasisSchema,
} from '@fingent360/contracts';
import type { z } from 'zod';

export class ConsentUnavailable extends ConflictException {
  constructor(
    message = 'This purpose is not currently permitted. Review or renew it in Privacy → Purpose consent.',
  ) {
    super(message);
  }
}
/** Caller admits the account before reading purpose state. No grant is written by a read. */
export async function readConsent(
  c: pg.PoolClient,
  userId: string,
  purpose: ConsentPurpose,
): Promise<ConsentState> {
  const head = await c.query(
    'SELECT payload FROM account_consent_heads WHERE user_id=$1 AND purpose=$2',
    [userId, purpose],
  );
  if (head.rows[0]) return ConsentStateSchema.parse(head.rows[0].payload);
  const empty = emptyConsent(purpose);
  if (purpose === 'reading-personalization') {
    const pref = await c.query(
      "SELECT 1 FROM library_preferences WHERE user_id=$1 AND data->>'mode'='for_you'",
      [userId],
    );
    if (pref.rowCount)
      return ConsentStateSchema.parse({
        ...empty,
        decision: 'granted',
        basis: { kind: 'legacy-reading-preference', recordedAt: null },
      });
  }
  if (purpose === 'scheduled-record-reviews') {
    const choice = await c.query(
      `SELECT r.payload FROM report_schedule_requests r
      JOIN report_schedules s ON s.id=(r.payload->'schedule'->>'id')::uuid AND s.user_id=r.user_id
      WHERE r.user_id=$1 AND s.status<>'deleted' AND r.payload->'schedule'->>'status'='active'
      ORDER BY r.seq DESC LIMIT 1`,
      [userId],
    );
    if (choice.rows[0]) {
      const receipt = choice.rows[0].payload;
      return ConsentStateSchema.parse({
        ...empty,
        decision: 'granted',
        grantedAt: receipt.schedule.savedAt,
        basis: {
          kind: 'legacy-schedule-opt-in',
          recordedAt: receipt.schedule.savedAt,
          scheduleId: receipt.schedule.id,
          scheduleVersion: receipt.schedule.version,
          requestId: receipt.requestId,
        },
      });
    }
  }
  return empty;
}
export async function requireConsent(
  c: pg.PoolClient,
  userId: string,
  purpose: ConsentPurpose,
  version?: number,
) {
  const state = await readConsent(c, userId, purpose);
  if (
    !consentActive(state, new Date().toISOString()) ||
    (version !== undefined && state.version !== version)
  )
    throw new ConsentUnavailable(
      'This purpose is not currently permitted. Review or renew it in Privacy → Purpose consent.',
    );
  return state;
}
export async function readConsentList(c: pg.PoolClient, userId: string) {
  const records = await Promise.all(
    consentPurposes.map((purpose) => readConsent(c, userId, purpose)),
  );
  const evaluatedAt = new Date().toISOString();
  return ConsentListSchema.parse({
    ownerId: userId,
    evaluatedAt,
    purposes: records.map((record) => ({
      record,
      status: consentStatus(record, evaluatedAt),
    })),
  });
}
export async function saveConsent(
  c: pg.PoolClient,
  userId: string,
  receipt: ConsentReceipt,
  request: unknown = null,
) {
  await c.query(
    'INSERT INTO account_consent_heads(user_id,purpose,payload) VALUES($1,$2,$3) ON CONFLICT(user_id,purpose) DO UPDATE SET payload=excluded.payload',
    [userId, receipt.state.purpose, receipt.state],
  );
  await c.query(
    'INSERT INTO account_consent_events(user_id,request_id,request,payload) VALUES($1,$2,$3,$4)',
    [userId, receipt.requestId, request, receipt],
  );
}
/** An actual existing opt-in action may create the first head; it cannot renew an explicit denial. */
export async function recordConsentOptIn(
  c: pg.PoolClient,
  userId: string,
  purpose: ConsentPurpose,
  basis: z.infer<typeof ConsentBasisSchema>,
) {
  const before = await readConsent(c, userId, purpose);
  if (before.version > 0) {
    if (!consentActive(before, new Date().toISOString()))
      throw new ConflictException(
        'Renew this purpose in Privacy → Purpose consent before enabling it again.',
      );
    return before;
  }
  const at = new Date().toISOString();
  const state = ConsentStateSchema.parse({
    ...emptyConsent(purpose),
    version: 1,
    decision: 'granted',
    grantedAt: at,
    changedAt: at,
    basis,
  });
  await saveConsent(
    c,
    userId,
    ConsentReceiptSchema.parse({
      requestId: null,
      action: 'recorded-opt-in',
      at,
      before,
      state,
      scheduleEffects: [],
    }),
  );
  return state;
}
export async function exportConsents(
  c: pg.PoolClient,
  userId: string,
  query: unknown = {},
) {
  const parsed = ConsentHistoryQuerySchema.safeParse(query);
  if (!parsed.success)
    throw new BadRequestException('Invalid consent history page.');
  const q = parsed.data;
  if (
    (q.after && !q.upper) ||
    (q.after && q.upper && BigInt(q.after) > BigInt(q.upper))
  )
    throw new BadRequestException('Invalid consent history boundary.');
  const upper =
    q.upper ??
    (
      await c.query(
        'SELECT coalesce(max(sequence),0)::text AS upper FROM account_consent_events WHERE user_id=$1',
        [userId],
      )
    ).rows[0].upper;
  const rows = (
    await c.query(
      'SELECT sequence::text,payload FROM account_consent_events WHERE user_id=$1 AND sequence>$2::bigint AND sequence<=$3::bigint ORDER BY account_consent_events.sequence LIMIT 101',
      [userId, q.after ?? '0', upper],
    )
  ).rows;
  return ConsentExportSchema.parse({
    ownerId: userId,
    upper,
    events: rows
      .slice(0, 100)
      .map((r) => ({ sequence: r.sequence, receipt: r.payload })),
    next: rows.length > 100 ? rows[99].sequence : null,
  });
}
